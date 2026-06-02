import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { defaultTemplate, normalizeTemplate } from "../template";
import { decodeCursor, encodeCursor } from "../pagination";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({});

const PRESIGN_EXPIRY = 3600; // 1 hour

async function presignTemplateAssetGet(s3Key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.PHOTO_BUCKET!,
      Key: s3Key,
    }),
    { expiresIn: PRESIGN_EXPIRY }
  );
}

async function decorateTemplateAssets(template: any) {
  const assets = await Promise.all(
    (template.assets ?? []).map(async (asset: any) => ({
      ...asset,
      previewUrl: asset.key ? await presignTemplateAssetGet(asset.key) : undefined,
    }))
  );
  return { ...template, assets };
}

// GET /slideshow/photos?eventId=xxx → list approved photos for event
async function getSlideshowPhotos(eventId: string, limit = 50, cursor?: string) {
  const resp = await dynamo.send(
    new QueryCommand({
      TableName: process.env.PHOTOS_TABLE!,
      IndexName: "eventId-status-index",
      KeyConditionExpression: "eventId = :eid AND #s = :approved",
      ExpressionAttributeNames: { "#s": "status" },
      FilterExpression: "nickname <> :pendingNick AND attribute_exists(confirmedAt)",
      ExpressionAttributeValues: {
        ":eid": eventId,
        ":approved": "approved",
        ":pendingNick": "__pending__",
      },
      Limit: limit,
      ExclusiveStartKey: decodeCursor(cursor),
    })
  );
  const items = resp.Items ?? [];

  const withUrls = await Promise.all(
    items.map(async (p: any) => {
      if (!p.s3Key) return p;
      const cmd = new GetObjectCommand({
        Bucket: process.env.PHOTO_BUCKET!,
        Key: p.s3Key,
      });
      const presignedUrl = await getSignedUrl(s3, cmd, { expiresIn: PRESIGN_EXPIRY });
      return {
        PK: p.PK,
        nickname: p.nickname,
        greeting: p.greeting,
        createdAt: p.confirmedAt ?? p.uploadedAt ?? p.createdAt,
        presignedUrl,
      };
    })
  );
  return {
    photos: withUrls,
    nextCursor: encodeCursor(resp.LastEvaluatedKey),
  };
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

async function getSlideshowTemplate(eventId: string) {
  const resp = await dynamo.send(
    new GetCommand({ TableName: process.env.EVENTS_TABLE!, Key: { PK: eventId, SK: "METADATA" } })
  );
  if (!resp.Item) return null;
  const publishedTemplate = resp.Item.templatePublished
    ? normalizeTemplate(resp.Item.templatePublished)
    : resp.Item.template
      ? normalizeTemplate(resp.Item.template)
    : null;
  const activeTemplate = publishedTemplate ?? defaultTemplate();
  return {
    eventId,
    template: await decorateTemplateAssets(activeTemplate),
    published: !!publishedTemplate,
  };
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
      const limit = Math.max(1, Math.min(Number(event.queryStringParameters?.limit ?? 50), 100));
      const result = await getSlideshowPhotos(eventId, limit, event.queryStringParameters?.cursor);
      return { statusCode: 200, body: JSON.stringify({ eventId, ...result }) };
    }

    // GET /slideshow/template?eventId=xxx
    if (path === "/slideshow/template" && method === "GET") {
      const eventId = event.queryStringParameters?.eventId;
      if (!eventId) {
        return { statusCode: 400, body: JSON.stringify({ error: "eventId required" }) };
      }
      const result = await getSlideshowTemplate(eventId);
      if (!result) {
        return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
      }
      return { statusCode: 200, body: JSON.stringify(result) };
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
