import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  GetCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

// ─── Magic bytes for image validation ───────────────────────────────────────
const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }> = {
  "image/jpeg": { bytes: [0xff, 0xd8, 0xff] },
  "image/png": { bytes: [0x89, 0x50, 0x4e, 0x47] },
  "image/webp": { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF....WEBP
  "image/heic": { bytes: [0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63] }, // ftypheic
};

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// ─── Key validation ─────────────────────────────────────────────────────────
async function validateUploadKey(eventId: string, uploadKey: string): Promise<boolean> {
  const keyHash = await sha256(uploadKey);
  const result = await dynamo.send(
    new QueryCommand({
      TableName: process.env.KEYPAIRS_TABLE!,
      IndexName: "keyHash-index",
      KeyConditionExpression: "keyHash = :h",
      FilterExpression: "keyType = :t",
      ExpressionAttributeValues: {
        ":h": keyHash,
        ":t": "UPLOAD",
      },
    })
  );
  if (!result.Items?.length) return false;
  // Verify the key belongs to the requested eventId
  return result.Items.some((item) => item.eventId === eventId);
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function generatePhotoId(): string {
  return `PHOTO#${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sha256(text: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then((buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

function sanitizeNickname(nickname: string): string {
  // Strip dangerous HTML tag delimiters < and > to prevent basic XSS injections
  return nickname
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 20);
}

function isValidNickname(nickname: string): boolean {
  // Allow Chinese, English, numbers, spaces, common punctuation between 2 and 20 characters.
  // Must not contain HTML tag delimiters < and >.
  const hasHtml = /[<>]/.test(nickname);
  const trimmed = nickname.trim();
  return !hasHtml && trimmed.length >= 2 && trimmed.length <= 20;
}

async function getRepresentativePhotoId(eventId: string, guestKey?: string, nickname?: string): Promise<string | null> {
  const expressionValues: Record<string, string> = { ":eid": eventId };
  const filterParts = ["eventId = :eid", "attribute_exists(confirmedAt)"];

  if (guestKey) {
    expressionValues[":gk"] = guestKey;
    filterParts.push("guestKey = :gk");
  } else if (nickname) {
    expressionValues[":nickname"] = nickname;
    filterParts.push("nickname = :nickname");
  }

  const result = await dynamo.send(
    new ScanCommand({
      TableName: process.env.PHOTOS_TABLE!,
      FilterExpression: filterParts.join(" AND "),
      ExpressionAttributeValues: expressionValues,
    })
  );

  const guestPhotos = (result.Items ?? []).sort((a, b) =>
    (a.confirmedAt ?? a.uploadedAt ?? a.createdAt ?? "").localeCompare(b.confirmedAt ?? b.uploadedAt ?? b.createdAt ?? "")
  );

  if (guestPhotos.length === 0) {
    return null;
  }

  return (
    guestPhotos.find((photo) => typeof photo.representativePhotoId === "string" && photo.representativePhotoId)
      ?.representativePhotoId ?? guestPhotos[0].PK
  );
}

// ─── WebSocket broadcast ────────────────────────────────────────────────────
async function broadcastNewPhoto(eventId: string, photoId: string, s3Key: string, nickname: string, greeting?: string) {
  // Find all connections for this event
  const connections = await dynamo.send(
    new QueryCommand({
      TableName: process.env.CONNECTIONS_TABLE!,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": `EVENT-${eventId}` },
    })
  );
  const items = connections.Items ?? [];
  const wsUrl = items[0]?.wsEndpoint ?? process.env.WEBSOCKET_API_URL;
  if (!wsUrl || items.length === 0) return;

  // Generate 15-minute S3 GET presigned URL for slideshow client
  const s3GetCmd = new GetObjectCommand({
    Bucket: process.env.PHOTO_BUCKET!,
    Key: s3Key,
  });
  const presignedUrl = await getSignedUrl(s3, s3GetCmd, { expiresIn: 900 });

  const wsClient = new ApiGatewayManagementApiClient({ endpoint: wsUrl });
  const message = JSON.stringify({
    type: "new_photo",
    photoId,
    presignedUrl,
    nickname,
    greeting,
    uploadedAt: new Date().toISOString()
  });

  await Promise.allSettled(
    items.map((conn) =>
      wsClient.send(
        new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: Buffer.from(message),
        })
      )
    )
  );
}

// ─── POST /upload/presign ───────────────────────────────────────────────────
async function presignUpload(
  eventId: string,
  filename: string,
  contentType: string,
  fileSize: number,
  uploadKey: string
) {
  // 1. Validate upload key
  const keyValid = await validateUploadKey(eventId, uploadKey);
  if (!keyValid) {
    return { statusCode: 403, body: JSON.stringify({ error: "Invalid or expired key" }) };
  }

  // 2. Validate content type (accept any image/* format)
  if (!contentType.toLowerCase().startsWith("image/")) {
    return { statusCode: 400, body: JSON.stringify({ error: "Unsupported file type" }) };
  }

  // 3. Validate file size
  if (fileSize > MAX_FILE_SIZE) {
    return { statusCode: 413, body: JSON.stringify({ error: "File too large (max 20MB)" }) };
  }

  // 4. Validate filename
  if (!filename || filename.length > 255) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid filename" }) };
  }

  const photoId = generatePhotoId();
  const ext = filename.split(".").pop() ?? "jpg";
  const s3Key = `${process.env.STAGE ?? "prod"}/${eventId}/${photoId}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.PHOTO_BUCKET!,
    Key: s3Key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  // Store pending photo record
  await dynamo.send(
    new PutCommand({
      TableName: process.env.PHOTOS_TABLE!,
      Item: {
        PK: photoId,
        SK: "METADATA",
        eventId,
        filename,
        contentType,
        s3Key,
        status: "pending",
        nickname: "__pending__",
        uploadedAt: new Date().toISOString(),
      },
      // Conditional write: fail if PK already exists (duplicate)
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );

  return { statusCode: 200, body: JSON.stringify({ photoId, uploadUrl, s3Key }) };
}

// ─── POST /upload/confirm ───────────────────────────────────────────────────
async function confirmUpload(
  photoId: string,
  eventId: string,
  nickname: string,
  uploadKey: string,
  guestKey?: string,
  greeting?: string
) {
  // 1. Validate upload key
  const keyValid = await validateUploadKey(eventId, uploadKey);
  if (!keyValid) {
    return { statusCode: 403, body: JSON.stringify({ error: "Invalid or expired key" }) };
  }

  // 2. Validate and sanitize nickname
  if (!isValidNickname(nickname)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid nickname format" }) };
  }
  const cleanNickname = sanitizeNickname(nickname);
  const cleanGuestKey = typeof guestKey === "string" && guestKey.trim() ? guestKey.trim() : undefined;
  const representativePhotoId = (await getRepresentativePhotoId(eventId, cleanGuestKey, cleanNickname)) ?? photoId;

  // Fetch event metadata to check if it requires review
  const eventGet = await dynamo.send(
    new GetCommand({
      TableName: process.env.EVENTS_TABLE!,
      Key: { PK: eventId, SK: "METADATA" },
    })
  );
  const requiresReview = eventGet.Item?.requiresReview !== false; // default to true
  const finalStatus = requiresReview ? "pending" : "approved";

  // 3. Update DynamoDB record
  const exprValues: Record<string, any> = {
    ":n": cleanNickname,
    ":s": finalStatus,
    ":c": new Date().toISOString(),
    ":representativePhotoId": representativePhotoId,
  };
  const updateFields = [
    "nickname = :n",
    "#status = :s",
    "confirmedAt = :c",
    "representativePhotoId = :representativePhotoId",
  ];
  if (greeting) {
    updateFields.push("greeting = :g");
    exprValues[":g"] = greeting.slice(0, 50); // limit to 50 chars
  }
  if (cleanGuestKey) {
    updateFields.push("guestKey = :guestKey");
    exprValues[":guestKey"] = cleanGuestKey;
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: process.env.PHOTOS_TABLE!,
      Key: { PK: photoId, SK: "METADATA" },
      UpdateExpression: `SET ${updateFields.join(", ")}`,
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: exprValues,
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
    })
  );

  // 4. Get the s3Key for broadcast
  const photo = await dynamo.send(
    new QueryCommand({
      TableName: process.env.PHOTOS_TABLE!,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: { ":pk": photoId, ":sk": "METADATA" },
    })
  );
  const s3Key = photo.Items?.[0]?.s3Key;

  // 5. Broadcast to WebSocket clients
  if (s3Key) {
    await broadcastNewPhoto(eventId, photoId, s3Key, cleanNickname, greeting);
  }

  return { statusCode: 200, body: JSON.stringify({ photoId, status: finalStatus }) };
}

// ─── Handler ────────────────────────────────────────────────────────────────
export async function handler(event: any) {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "POST";
  const path: string = event.requestContext?.http?.path ?? event.path ?? "";

  // CORS preflight — respond directly without auth
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "https://wedding.fishare.de",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,Origin,X-Requested-With,Accept",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
      },
      body: "",
    };
  }

  const queryKey = event.queryStringParameters?.key ?? "";
  const body = JSON.parse(event.body ?? "{}");

  try {
    // POST /upload/presign
    if (path === "/upload/presign" && method === "POST") {
      const { eventId, filename, contentType, fileSize } = body;
      console.log("presign: eventId=" + eventId + " filename=" + filename + " contentType=" + contentType + " fileSize=" + (fileSize ?? 0) + " key=" + queryKey);
      if (!eventId || !filename || !contentType) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing fields" }) };
      }
      const result = await presignUpload(eventId, filename, contentType, fileSize ?? 0, queryKey);
      console.log("presign: result=" + JSON.stringify(result).slice(0,100));
      return result;
    }

    // POST /upload/confirm
    if (path === "/upload/confirm" && method === "POST") {
      const { eventId, photoId, nickname, greeting, guestKey } = body;
      if (!eventId || !photoId || !nickname) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing fields" }) };
      }
      const result = await confirmUpload(photoId, eventId, nickname, queryKey, guestKey, greeting);
      return result;
    }

    return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
  } catch (err: any) {
    console.error("Upload Lambda error:", err);
    if (err.name === "ConditionalCheckFailedException") {
      return { statusCode: 409, body: JSON.stringify({ error: "Duplicate upload" }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
}
