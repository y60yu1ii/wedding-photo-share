import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const PRESIGN_EXPIRY = 3600; // 1 hour

// GET /slideshow/photos?eventId=xxx → list approved photos for event
async function getSlideshowPhotos(eventId: string) {
  const resp = await dynamo.send(
    new QueryCommand({
      TableName: process.env.PHOTOS_TABLE!,
      IndexName: "eventId-status-index",
      KeyConditionExpression: "eventId = :eid AND #s = :approved",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":eid": eventId, ":approved": "approved" },
    })
  );
  return resp.Items ?? [];
}

// GET /slideshow/presign/{photoId} → presigned GET URL for photo
async function presignPhoto(photoId: string) {
  // First get the photo to find s3Key
  const photo = await dynamo.send(
    new GetCommand({ TableName: process.env.PHOTOS_TABLE!, Key: { PK: photoId, SK: "METADATA" } })
  );
  if (!photo.Item) throw new Error("Photo not found");

  const cmd = new GetObjectCommand({
    Bucket: process.env.PHOTO_BUCKET!,
    Key: photo.Item.s3Key,
  });
  const url = await getSignedUrl(s3, cmd, { expiresIn: PRESIGN_EXPIRY });
  return { photoId, presignedUrl: url };
}

export async function handler(event: any) {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path: string = event.requestContext?.http?.path ?? event.path ?? "";

  try {
    // GET /slideshow/photos?eventId=xxx
    if (path === "/slideshow/photos" && method === "GET") {
      const eventId = event.queryStringParameters?.eventId;
      if (!eventId) {
        return { statusCode: 400, body: JSON.stringify({ error: "eventId required" }) };
      }
      const photos = await getSlideshowPhotos(eventId);
      return { statusCode: 200, body: JSON.stringify({ eventId, photos }) };
    }

    // GET /slideshow/presign/{photoId}
    const presignMatch = path.match(/^\/slideshow\/presign\/(.+)$/);
    if (presignMatch && method === "GET") {
      const photoId = presignMatch[1];
      const result = await presignPhoto(photoId);
      return { statusCode: 200, body: JSON.stringify(result) };
    }

    return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
  } catch (err) {
    console.error("Slideshow Lambda error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
}
