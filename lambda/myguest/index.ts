import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  DeleteCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

function normalizeNickname(nickname: string): string {
  return nickname.trim().toLowerCase();
}

function getPhotoCreatedAt(photo: Record<string, any>): string {
  return photo.confirmedAt ?? photo.uploadedAt ?? photo.createdAt ?? "";
}

async function listEventPhotos(eventId: string) {
  const resp = await dynamo.send(
    new QueryCommand({
      TableName: process.env.PHOTOS_TABLE!,
      IndexName: "eventId-status-index",
      KeyConditionExpression: "eventId = :eid",
      FilterExpression: "nickname <> :pendingNick AND attribute_exists(confirmedAt)",
      ExpressionAttributeValues: {
        ":eid": eventId,
        ":pendingNick": "__pending__",
      },
    })
  );
  return resp.Items ?? [];
}

function photoBelongsToGuest(photo: Record<string, any>, eventId: string, guestKey?: string, nickname?: string): boolean {
  if (photo.eventId !== eventId) {
    return false;
  }
  if (guestKey) {
    if (photo.guestKey === guestKey) {
      return true;
    }
    if (photo.guestKey) {
      return false;
    }
  }
  if (!nickname) {
    return false;
  }
  return normalizeNickname(photo.nickname ?? "") === normalizeNickname(nickname);
}

// GET /myguest/photos?eventId=xxx&guestKey=yyy or nickname fallback
async function getMyPhotos(eventId: string, guestKey?: string, nickname?: string) {
  const photos = await listEventPhotos(eventId);
  return photos
    .filter((photo) => photoBelongsToGuest(photo, eventId, guestKey, nickname))
    .sort((a, b) => getPhotoCreatedAt(a).localeCompare(getPhotoCreatedAt(b)));
}

// Presign photo for display
async function presignPhoto(s3Key: string): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: process.env.PHOTO_BUCKET!,
    Key: s3Key,
  });
  return getSignedUrl(s3, cmd, { expiresIn: 900 });
}

// DELETE /myguest/photos/{photoId}
async function deletePhoto(photoId: string, eventId: string, guestKey?: string, nickname?: string) {
  // Get photo to verify ownership
  const photo = await dynamo.send(
    new GetCommand({
      TableName: process.env.PHOTOS_TABLE!,
      Key: { PK: photoId, SK: "METADATA" },
    })
  );
  if (!photo.Item) {
    return { statusCode: 404, body: JSON.stringify({ error: "Photo not found" }) };
  }
  if (!photoBelongsToGuest(photo.Item, eventId, guestKey, nickname)) {
    return { statusCode: 403, body: JSON.stringify({ error: "Guest mismatch" }) };
  }

  // Delete from S3
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.PHOTO_BUCKET!,
      Key: photo.Item.s3Key,
    })
  );

  // Delete from DynamoDB
  await dynamo.send(
    new DeleteCommand({
      TableName: process.env.PHOTOS_TABLE!,
      Key: { PK: photoId, SK: "METADATA" },
    })
  );
  return { statusCode: 200, body: JSON.stringify({ photoId }) };
}

async function setRepresentativePhoto(photoId: string, eventId: string, guestKey?: string, nickname?: string) {
  const photo = await dynamo.send(
    new GetCommand({
      TableName: process.env.PHOTOS_TABLE!,
      Key: { PK: photoId, SK: "METADATA" },
    })
  );
  if (!photo.Item) {
    return { statusCode: 404, body: JSON.stringify({ error: "Photo not found" }) };
  }
  if (!photoBelongsToGuest(photo.Item, eventId, guestKey, nickname)) {
    return { statusCode: 403, body: JSON.stringify({ error: "Guest mismatch" }) };
  }

  const ownerGuestKey = typeof photo.Item.guestKey === "string" ? photo.Item.guestKey : undefined;
  const ownerNickname = typeof photo.Item.nickname === "string" ? photo.Item.nickname : nickname;
  const guestPhotos = await getMyPhotos(eventId, ownerGuestKey, ownerNickname);

  await Promise.all(
    guestPhotos.map((guestPhoto) =>
      dynamo.send(
        new UpdateCommand({
          TableName: process.env.PHOTOS_TABLE!,
          Key: { PK: guestPhoto.PK, SK: "METADATA" },
          UpdateExpression: "SET representativePhotoId = :representativePhotoId",
          ExpressionAttributeValues: {
            ":representativePhotoId": photoId,
          },
          ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        })
      )
    )
  );

  return { statusCode: 200, body: JSON.stringify({ photoId, representativePhotoId: photoId }) };
}

export async function handler(event: any) {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path: string = event.requestContext?.http?.path ?? event.path ?? "";
  const query = event.queryStringParameters ?? {};

  try {
    // GET /myguest/photos?eventId=xxx&nickname=yyy
    if (path === "/myguest/photos" && method === "GET") {
      const { eventId, nickname, guestKey } = query;
      if (!eventId || (!guestKey && !nickname)) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing params" }) };
      }
      const photos = await getMyPhotos(eventId, guestKey, nickname);
      // Attach presigned URLs
      const withUrls = await Promise.all(
        photos.map(async (p: any) => ({
          PK: p.PK,
          eventId: p.eventId,
          nickname: p.nickname,
          guestKey: p.guestKey,
          representativePhotoId: p.representativePhotoId,
          status: p.status,
          createdAt: getPhotoCreatedAt(p),
          presignedUrl: p.s3Key ? await presignPhoto(p.s3Key) : undefined,
        }))
      );
      return { statusCode: 200, body: JSON.stringify({ photos: withUrls }) };
    }

    const representativeMatch = path.match(/^\/myguest\/photos\/([^/]+)\/representative$/);
    if (representativeMatch && method === "PATCH") {
      const photoId = representativeMatch[1];
      const body = JSON.parse(event.body ?? "{}");
      const { eventId, guestKey, nickname } = body;
      if (!eventId || (!guestKey && !nickname)) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing params" }) };
      }
      return await setRepresentativePhoto(photoId, eventId, guestKey, nickname);
    }

    // DELETE /myguest/photos/{photoId}
    const deleteMatch = path.match(/^\/myguest\/photos\/([^/]+)$/);
    if (deleteMatch && method === "DELETE") {
      const photoId = deleteMatch[1];
      const body = JSON.parse(event.body ?? "{}");
      const { eventId, nickname, guestKey } = body;
      if (!eventId || (!guestKey && !nickname)) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing params" }) };
      }
      return await deletePhoto(photoId, eventId, guestKey, nickname);
    }

    return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
  } catch (err) {
    console.error("MyGuest Lambda error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
}
