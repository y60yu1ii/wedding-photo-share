import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

function normalizeNickname(nickname: string): string {
  return nickname.trim().toLowerCase();
}

function getPhotoCreatedAt(photo: Record<string, any>): string {
  return photo.confirmedAt ?? photo.uploadedAt ?? photo.createdAt ?? "";
}

function getGuestIdentity(photo: Record<string, any>): string {
  if (typeof photo.guestKey === "string" && photo.guestKey.trim()) {
    return photo.guestKey;
  }
  return normalizeNickname(photo.nickname ?? "");
}

function chooseRepresentativePhoto(photos: Array<Record<string, any>>) {
  const explicitRepresentativeId = photos.find(
    (photo) => typeof photo.representativePhotoId === "string" && photo.PK === photo.representativePhotoId
  )?.PK;

  if (explicitRepresentativeId) {
    return photos.find((photo) => photo.PK === explicitRepresentativeId) ?? photos[0];
  }

  return photos[0];
}

async function presignPhoto(s3Key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.PHOTO_BUCKET!,
      Key: s3Key,
    }),
    { expiresIn: 900 }
  );
}

async function getWallPhotos(eventId: string) {
  const eventRecord = await dynamo.send(
    new GetCommand({
      TableName: process.env.EVENTS_TABLE!,
      Key: { PK: eventId, SK: "METADATA" },
    })
  );

  if (!eventRecord.Item) {
    return { statusCode: 404, body: JSON.stringify({ error: "Event not found" }) };
  }

  const wallPolicy = eventRecord.Item.wallPolicy === "all_uploads" ? "all_uploads" : "approved_only";
  const queryInput =
    wallPolicy === "approved_only"
      ? {
          TableName: process.env.PHOTOS_TABLE!,
          IndexName: "eventId-status-index",
          KeyConditionExpression: "eventId = :eid AND #status = :approved",
          ExpressionAttributeNames: { "#status": "status" },
          FilterExpression: "nickname <> :pendingNick AND attribute_exists(confirmedAt)",
          ExpressionAttributeValues: {
            ":eid": eventId,
            ":approved": "approved",
            ":pendingNick": "__pending__",
          },
        }
      : {
          TableName: process.env.PHOTOS_TABLE!,
          IndexName: "eventId-status-index",
          KeyConditionExpression: "eventId = :eid",
          FilterExpression: "nickname <> :pendingNick AND attribute_exists(confirmedAt)",
          ExpressionAttributeValues: {
            ":eid": eventId,
            ":pendingNick": "__pending__",
          },
        };

  const photosResp = await dynamo.send(new QueryCommand(queryInput));
  const sortedPhotos = (photosResp.Items ?? []).sort((a, b) => getPhotoCreatedAt(a).localeCompare(getPhotoCreatedAt(b)));
  const photosByGuest = new Map<string, Array<Record<string, any>>>();

  for (const photo of sortedPhotos) {
    const identity = getGuestIdentity(photo);
    const guestPhotos = photosByGuest.get(identity) ?? [];
    guestPhotos.push(photo);
    photosByGuest.set(identity, guestPhotos);
  }

  const representativePhotos = Array.from(photosByGuest.values())
    .map((photos) => chooseRepresentativePhoto(photos))
    .sort((a, b) => getPhotoCreatedAt(a).localeCompare(getPhotoCreatedAt(b)));

  const withUrls = await Promise.all(
    representativePhotos.map(async (photo) => ({
      ...photo,
      createdAt: getPhotoCreatedAt(photo),
      presignedUrl: photo.s3Key ? await presignPhoto(photo.s3Key) : undefined,
    }))
  );

  return {
    statusCode: 200,
    body: JSON.stringify({
      eventId,
      wallPolicy,
      photos: withUrls,
    }),
  };
}

export async function handler(event: any) {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path: string = event.requestContext?.http?.path ?? event.path ?? "";

  try {
    if (path === "/wall/photos" && method === "GET") {
      const eventId = event.queryStringParameters?.eventId;
      if (!eventId) {
        return { statusCode: 400, body: JSON.stringify({ error: "eventId required" }) };
      }
      return await getWallPhotos(eventId);
    }

    return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
  } catch (err) {
    console.error("Wall Lambda error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
}
