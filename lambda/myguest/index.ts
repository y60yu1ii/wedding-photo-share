import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

// GET /myguest/photos?eventId=xxx&nickname=yyy
async function getMyPhotos(eventId: string, nickname: string) {
  const resp = await dynamo.send(
    new QueryCommand({
      TableName: process.env.PHOTOS_TABLE!,
      IndexName: "eventId-nickname-index",
      KeyConditionExpression: "eventId = :eid AND nickname = :nick",
      ExpressionAttributeValues: { ":eid": eventId, ":nick": nickname },
    })
  );
  return resp.Items ?? [];
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
async function deletePhoto(photoId: string, eventId: string, nickname: string) {
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
  if (photo.Item.eventId !== eventId || photo.Item.nickname !== nickname) {
    return { statusCode: 403, body: JSON.stringify({ error: "Nickname mismatch" }) };
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

export async function handler(event: any) {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path: string = event.requestContext?.http?.path ?? event.path ?? "";
  const query = event.queryStringParameters ?? {};

  try {
    // GET /myguest/photos?eventId=xxx&nickname=yyy
    if (path === "/myguest/photos" && method === "GET") {
      const { eventId, nickname } = query;
      if (!eventId || !nickname) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing params" }) };
      }
      const photos = await getMyPhotos(eventId, nickname);
      // Attach presigned URLs
      const withUrls = await Promise.all(
        photos.map(async (p: any) => ({
          PK: p.PK,
          nickname: p.nickname,
          status: p.status,
          presignedUrl: p.s3Key ? await presignPhoto(p.s3Key) : undefined,
        }))
      );
      return { statusCode: 200, body: JSON.stringify({ photos: withUrls }) };
    }

    // DELETE /myguest/photos/{photoId}
    const deleteMatch = path.match(/^\/myguest\/photos\/(.+)$/);
    if (deleteMatch && method === "DELETE") {
      const photoId = deleteMatch[1];
      const body = JSON.parse(event.body ?? "{}");
      const { eventId, nickname } = body;
      if (!eventId || !nickname) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing params" }) };
      }
      return await deletePhoto(photoId, eventId, nickname);
    }

    return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
  } catch (err) {
    console.error("MyGuest Lambda error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
}
