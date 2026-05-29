import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

// GET /myguest/photos?eventId=xxx → list photos uploaded by this keyHash
async function getMyPhotos(eventId: string, keyHash: string) {
  const resp = await dynamo.send(
    new QueryCommand({
      TableName: process.env.PHOTOS_TABLE!,
      IndexName: "eventId-status-index",
      KeyConditionExpression: "eventId = :eid",
      ExpressionAttributeValues: { ":eid": eventId },
    })
  );
  return (resp.Items ?? []).filter((p: any) => p.keyHash === keyHash);
}

// Presign photo for display
async function presignPhoto(s3Key: string): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: process.env.PHOTO_BUCKET!,
    Key: s3Key,
  });
  return getSignedUrl(s3, cmd, { expiresIn: 3600 });
}

// DELETE /myguest/photos/{photoId}?eventId=xxx&keyHash=xxx
async function deletePhoto(photoId: string, eventId: string, keyHash: string) {
  // Get photo to verify ownership
  const photo = await dynamo.send(
    new QueryCommand({
      TableName: process.env.PHOTOS_TABLE!,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": photoId },
    })
  );
  if (!photo.Items?.length) throw new Error("Photo not found");

  // Delete from S3
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.PHOTO_BUCKET!,
      Key: photo.Items[0].s3Key,
    })
  );

  // Delete from DynamoDB
  await dynamo.send(
    new DeleteCommand({
      TableName: process.env.PHOTOS_TABLE!,
      Key: { PK: photoId, SK: "METADATA" },
    })
  );
  return { photoId };
}

export async function handler(event: any) {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path: string = event.requestContext?.http?.path ?? event.path ?? "";
  const query = event.queryStringParameters ?? {};

  try {
    // GET /myguest/photos?eventId=xxx&keyHash=xxx
    if (path === "/myguest/photos" && method === "GET") {
      const { eventId, keyHash } = query;
      if (!eventId || !keyHash) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing params" }) };
      }
      const photos = await getMyPhotos(eventId, keyHash);
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
      const { eventId, keyHash } = query;
      if (!eventId || !keyHash) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing params" }) };
      }
      const result = await deletePhoto(photoId, eventId, keyHash);
      return { statusCode: 200, body: JSON.stringify(result) };
    }

    return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
  } catch (err) {
    console.error("MyGuest Lambda error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
}
