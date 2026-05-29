import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { SignJWT, jwtVerify } from "jose";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const secrets = new SecretsManagerClient({});

interface Env {
  EVENTS_TABLE: string;
  KEYPAIRS_TABLE: string;
  PHOTOS_TABLE: string;
  JWT_SECRET_NAME: string;
  STAGE: string;
}

async function getJwtSecret(): Promise<string> {
  const cmd = await secrets.send(
    new GetSecretValueCommand({ SecretId: process.env.JWT_SECRET_NAME! })
  );
  if (!cmd.SecretString) throw new Error("JWT secret not found");
  return cmd.SecretString;
}

function makeToken(secret: string, payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(secret));
}

// ─── Key generation ───────────────────────────────────────────────────────
function generateKey(length = 16): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  const random = new Uint32Array(length);
  crypto.getRandomValues(random);
  for (let i = 0; i < length; i++) {
    result += chars[random[i] % chars.length];
  }
  return result;
}

async function sha256(text: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
    .then((buf) =>
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
}

// ─── DynamoDB helpers ───────────────────────────────────────────────────
async function listEvents() {
  const resp = await dynamo.send(
    new ScanCommand({
      TableName: process.env.EVENTS_TABLE!,
      FilterExpression: "#s <> :archived",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":archived": "archived" },
    })
  );
  return (resp.Items ?? []).sort((a: any, b: any) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
  );
}

async function createEvent(body: { name: string; date: string }) {
  const PK = `EVENT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  // Generate UPLOAD_KEY and SHOW_KEY
  const uploadKey = generateKey(16);
  const showKey = generateKey(16);
  const uploadKeyHash = await sha256(uploadKey);
  const showKeyHash = await sha256(showKey);

  const item = {
    PK,
    SK: "METADATA",
    name: body.name,
    date: body.date,
    status: "active",
    createdAt: now,
    // Store plaintext keys for admin retrieval (hashes still used for validation)
    uploadKey,
    showKey,
    uploadKeyHash,
    showKeyHash,
  };

  await dynamo.send(new PutCommand({ TableName: process.env.EVENTS_TABLE!, Item: item }));

  // Store keypairs (keyId = the hash prefix for lookups)
  await Promise.all([
    dynamo.send(new PutCommand({
      TableName: process.env.KEYPAIRS_TABLE!,
      Item: {
        PK: `KEY#${uploadKeyHash.slice(0, 16)}`,
        SK: "METADATA",
        eventId: PK,
        keyType: "UPLOAD",
        keyHash: uploadKeyHash,
        createdAt: now,
      },
    })),
    dynamo.send(new PutCommand({
      TableName: process.env.KEYPAIRS_TABLE!,
      Item: {
        PK: `KEY#${showKeyHash.slice(0, 16)}`,
        SK: "METADATA",
        eventId: PK,
        keyType: "SHOW",
        keyHash: showKeyHash,
        createdAt: now,
      },
    })),
  ]);

  // Return plaintext keys (only at creation time)
  return { PK, name: body.name, date: body.date, status: "active", uploadKey, showKey, createdAt: now };
}

async function getEvent(eventId: string) {
  const resp = await dynamo.send(
    new GetCommand({ TableName: process.env.EVENTS_TABLE!, Key: { PK: eventId, SK: "METADATA" } })
  );
  if (!resp.Item) return null;

  const photosResp = await dynamo.send(
    new QueryCommand({
      TableName: process.env.PHOTOS_TABLE!,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": eventId, ":sk": "PHOTO#" },
    })
  );

  return {
    ...resp.Item,
    photoCount: photosResp.Items?.length ?? 0,
    hasKeys: !!(resp.Item.uploadKey && resp.Item.showKey),
  };
}

async function listEventPhotos(eventId: string) {
  const resp = await dynamo.send(
    new ScanCommand({
      TableName: process.env.PHOTOS_TABLE!,
      FilterExpression: "eventId = :eid",
      ExpressionAttributeValues: { ":eid": eventId },
    })
  );
  return resp.Items ?? [];
}

// Separate function to get event with actual keys (used only for admin display)
async function getEventWithKeys(eventId: string) {
  const resp = await dynamo.send(
    new GetCommand({ TableName: process.env.EVENTS_TABLE!, Key: { PK: eventId, SK: "METADATA" } })
  );
  if (!resp.Item) return null;

  const item = resp.Item;
  // Keys are stored in the EVENTS table itself
  return {
    ...item,
    photoCount: 0, // filled by caller if needed
    hasKeys: !!(item.uploadKey && item.showKey),
    uploadKey: item.uploadKey ?? "[已產生，請於建立時複製]",
    showKey: item.showKey ?? "[已產生，請於建立時複製]",
    keyNote: item.uploadKey && item.showKey
      ? null
      : "金鑰僅於建立時顯示，請複製並妥善保存。若需重設，請刪除婚禮後重新建立。",
  };
}

async function deleteEvent(eventId: string) {
  // Delete all photos from S3 (would need separate Lambda for this)
  // Delete all keypairs via Scan (no GSI on keypairs table)
  const keypairsResp = await dynamo.send(
    new ScanCommand({
      TableName: process.env.KEYPAIRS_TABLE!,
      FilterExpression: "eventId = :eid",
      ExpressionAttributeValues: { ":eid": eventId },
    })
  );

  await Promise.all([
    dynamo.send(new UpdateCommand({
      TableName: process.env.EVENTS_TABLE!,
      Key: { PK: eventId, SK: "METADATA" },
      UpdateExpression: "SET #s = :s",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": "archived" },
    })),
    ...(keypairsResp.Items ?? []).map((k: any) =>
      dynamo.send(new PutCommand({
        TableName: process.env.KEYPAIRS_TABLE!,
        Item: { ...k, _deleted: true },
      }))
    ),
  ]);
}

async function approvePhoto(photoId: string) {
  await dynamo.send(
    new UpdateCommand({
      TableName: process.env.PHOTOS_TABLE!,
      Key: { PK: photoId, SK: "METADATA" },
      UpdateExpression: "SET #s = :approved",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":approved": "approved" },
    })
  );
  return { photoId, status: "approved" };
}

// ─── Auth ────────────────────────────────────────────────────────────────
async function verifyToken(token: string): Promise<boolean> {
  try {
    const secret = await getJwtSecret();
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

function res(statusCode: number, body: object) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────
export async function handler(event: any) {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path: string = event.requestContext?.http?.path ?? event.path ?? "";

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    // POST /admin/login
    if (path === "/admin/login" && method === "POST") {
      const { username, password } = JSON.parse(event.body ?? "{}");
      if (!username || !password) {
        return res(400, { error: "missing credentials" });
      }
      // Simple admin check (in prod: compare against stored hash in Secrets Manager)
      const ADMIN_USER = process.env.ADMIN_USER ?? "admin";
      const ADMIN_PASS = process.env.ADMIN_PASS ?? "wedding2026";
      if (username !== ADMIN_USER || password !== ADMIN_PASS) {
        return res(401, { error: "Invalid credentials" });
      }
      const secret = await getJwtSecret();
      const token = await makeToken(secret, { sub: username, role: "admin" });
      return res(200, { token });
    }

    // Auth check for protected routes
    const token = event.headers?.authorization?.replace("Bearer ", "") ??
                  event.headers?.Authorization?.replace("Bearer ", "");
    if (!token || !(await verifyToken(token))) {
      return res(401, { error: "Unauthorized" });
    }

    // GET /admin/events
    if (path === "/admin/events" && method === "GET") {
      const events = await listEvents();
      return res(200, { events });
    }

    // POST /admin/events
    if (path === "/admin/events" && method === "POST") {
      const body = JSON.parse(event.body ?? "{}");
      if (!body.name || !body.date) {
        return res(400, { error: "missing fields" });
      }
      const newEvent = await createEvent(body);
      return res(201, newEvent);
    }

    // GET /admin/events/{eventId}
    if (path.match(/^\/admin\/events\/[^/]+$/) && method === "GET") {
      const eventId = decodeURIComponent(path.split("/")[3]);
      const evt = await getEventWithKeys(eventId);
      if (!evt) return res(404, { error: "Not found" });
      return res(200, evt);
    }

    // DELETE /admin/events/{eventId}
    if (path.match(/^\/admin\/events\/[^/]+$/) && method === "DELETE") {
      const eventId = decodeURIComponent(path.split("/")[3]);
      await deleteEvent(eventId);
      return res(200, { success: true });
    }

    // PATCH /admin/photos/{photoId}
    if (path.match(/^\/admin\/photos\/[^/]+$/) && method === "PATCH") {
      const photoId = path.split("/")[3];
      const result = await approvePhoto(photoId);
      return res(200, result);
    }

    // GET /admin/events/{eventId}/photos
    if (path.match(/^\/admin\/events\/[^/]+\/photos$/) && method === "GET") {
      const eventId = decodeURIComponent(path.split("/")[3]);
      const photos = await listEventPhotos(eventId);
      return res(200, { photos });
    }

    return res(404, { error: "Not found" });
  } catch (err) {
    console.error("Admin Lambda error:", err);
    return res(500, { error: "Internal error" });
  }
}
