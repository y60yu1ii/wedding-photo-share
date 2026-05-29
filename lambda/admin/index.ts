import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { S3Client, DeleteObjectsCommand, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { SignJWT, jwtVerify } from "jose";
import { defaultTemplate, makeAssetKey, normalizeTemplate, validateTemplate } from "../template";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const secrets = new SecretsManagerClient({});
const s3 = new S3Client({});

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

async function createEvent(body: { name: string; date: string; requiresReview?: boolean }) {
  const PK = `EVENT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const templateDraft = defaultTemplate();

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
    requiresReview: body.requiresReview ?? true, // default to true
    templateDraft,
    templatePublished: null,
    templateUpdatedAt: now,
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

async function getEventTemplateRecord(eventId: string) {
  const resp = await dynamo.send(
    new GetCommand({ TableName: process.env.EVENTS_TABLE!, Key: { PK: eventId, SK: "METADATA" } })
  );
  if (!resp.Item) return null;

  const draft = normalizeTemplate(resp.Item.templateDraft ?? resp.Item.template ?? resp.Item.templatePublished ?? defaultTemplate());
  const published = resp.Item.templatePublished
    ? normalizeTemplate(resp.Item.templatePublished, draft)
    : resp.Item.template
      ? normalizeTemplate(resp.Item.template, draft)
    : null;
  return {
    ...resp.Item,
    templateDraft: draft,
    templatePublished: published,
  };
}

async function presignTemplateAssetGet(s3Key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.PHOTO_BUCKET!,
      Key: s3Key,
    }),
    { expiresIn: 900 }
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

async function persistTemplate(eventId: string, templateBody: any, publish = false) {
  const record = await getEventTemplateRecord(eventId);
  if (!record) return null;

  const baseTemplate = normalizeTemplate(templateBody, record.templateDraft ?? defaultTemplate());
  validateTemplate(baseTemplate);

  const now = new Date().toISOString();
  const updateExpression = publish
    ? "SET templateDraft = :draft, templatePublished = :published, templateUpdatedAt = :updatedAt"
    : "SET templateDraft = :draft, templateUpdatedAt = :updatedAt";
  const expressionValues: Record<string, any> = {
    ":draft": { ...baseTemplate, updatedAt: now },
    ":updatedAt": now,
  };
  if (publish) {
    expressionValues[":published"] = { ...baseTemplate, updatedAt: now };
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: process.env.EVENTS_TABLE!,
      Key: { PK: eventId, SK: "METADATA" },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionValues,
    })
  );

  return {
    template: await decorateTemplateAssets({ ...baseTemplate, updatedAt: now }),
    publishedTemplate: publish ? await decorateTemplateAssets({ ...baseTemplate, updatedAt: now }) : record.templatePublished ? await decorateTemplateAssets(record.templatePublished) : null,
  };
}

async function addTemplateAsset(eventId: string, body: any) {
  const record = await getEventTemplateRecord(eventId);
  if (!record) return null;

  const assetId = typeof body.assetId === "string" && body.assetId ? body.assetId : crypto.randomUUID();
  const filename = typeof body.filename === "string" && body.filename ? body.filename : "asset";
  const contentType = typeof body.contentType === "string" && body.contentType ? body.contentType : "image/png";
  if (!contentType.startsWith("image/")) {
    throw new Error("Invalid asset type");
  }
  const key = typeof body.assetKey === "string" && body.assetKey ? body.assetKey : makeAssetKey(eventId, assetId, filename);
  const uploadedAt = new Date().toISOString();
  const asset = { assetId, filename, contentType, key, uploadedAt };
  const draft = normalizeTemplate(record.templateDraft ?? defaultTemplate());
  const nextDraft = {
    ...draft,
    assets: [...draft.assets.filter((item) => item.assetId !== assetId), asset],
    updatedAt: uploadedAt,
  };
  validateTemplate(nextDraft);

  await dynamo.send(
    new UpdateCommand({
      TableName: process.env.EVENTS_TABLE!,
      Key: { PK: eventId, SK: "METADATA" },
      UpdateExpression: "SET templateDraft = :draft, templateUpdatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":draft": nextDraft,
        ":updatedAt": uploadedAt,
      },
    })
  );

  return {
    asset: {
      ...asset,
      previewUrl: await presignTemplateAssetGet(asset.key),
    },
    template: await decorateTemplateAssets(nextDraft),
  };
}

async function presignPhoto(s3Key: string): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: process.env.PHOTO_BUCKET!,
    Key: s3Key,
  });
  return getSignedUrl(s3, cmd, { expiresIn: 900 });
}

async function listEventPhotos(eventId: string) {
  const resp = await dynamo.send(
    new ScanCommand({
      TableName: process.env.PHOTOS_TABLE!,
      FilterExpression: "eventId = :eid",
      ExpressionAttributeValues: { ":eid": eventId },
    })
  );
  const photos = resp.Items ?? [];
  return Promise.all(
    photos.map(async (p: any) => ({
      ...p,
      presignedUrl: p.s3Key ? await presignPhoto(p.s3Key) : undefined,
    }))
  );
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
    requiresReview: item.requiresReview !== false, // default to true
    keyNote: item.uploadKey && item.showKey
      ? null
      : "金鑰僅於建立時顯示，請複製並妥善保存。若需重設，請刪除婚禮後重新建立。",
  };
}

async function deleteEvent(eventId: string) {
  // 1. Find all keypairs associated with the event
  const keypairsResp = await dynamo.send(
    new ScanCommand({
      TableName: process.env.KEYPAIRS_TABLE!,
      FilterExpression: "eventId = :eid",
      ExpressionAttributeValues: { ":eid": eventId },
    })
  );

  // 2. Find all photos associated with the event
  const photosResp = await dynamo.send(
    new ScanCommand({
      TableName: process.env.PHOTOS_TABLE!,
      FilterExpression: "eventId = :eid",
      ExpressionAttributeValues: { ":eid": eventId },
    })
  );

  const deletes: Promise<any>[] = [];

  // 3. Physically delete all objects from S3
  const photoItems = photosResp.Items ?? [];
  if (photoItems.length > 0) {
    const s3Keys = photoItems.map((p: any) => p.s3Key).filter(Boolean);
    if (s3Keys.length > 0) {
      deletes.push(
        s3.send(
          new DeleteObjectsCommand({
            Bucket: process.env.PHOTO_BUCKET!,
            Delete: { Objects: s3Keys.map((k) => ({ Key: k })) },
          })
        ).catch((err) => console.error("Failed to delete S3 photos:", err))
      );
    }
  }

  // 4. Physically delete the wedding event metadata
  deletes.push(
    dynamo.send(
      new DeleteCommand({
        TableName: process.env.EVENTS_TABLE!,
        Key: { PK: eventId, SK: "METADATA" },
      })
    )
  );

  // 5. Physically delete all keypairs from KeypairsTable
  for (const k of (keypairsResp.Items ?? [])) {
    deletes.push(
      dynamo.send(
        new DeleteCommand({
          TableName: process.env.KEYPAIRS_TABLE!,
          Key: { PK: k.PK, SK: k.SK },
        })
      )
    );
  }

  // 6. Physically delete all photo records from PhotosTable
  for (const p of photoItems) {
    deletes.push(
      dynamo.send(
        new DeleteCommand({
          TableName: process.env.PHOTOS_TABLE!,
          Key: { PK: p.PK, SK: p.SK },
        })
      )
    );
  }

  await Promise.all(deletes);
}

async function broadcastNewPhoto(eventId: string, photoId: string, s3Key: string, nickname: string, greeting?: string) {
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

async function approvePhoto(photoId: string) {
  const updateResult = await dynamo.send(
    new UpdateCommand({
      TableName: process.env.PHOTOS_TABLE!,
      Key: { PK: photoId, SK: "METADATA" },
      UpdateExpression: "SET #s = :approved",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":approved": "approved" },
      ReturnValues: "ALL_NEW",
    })
  );
  const photo = updateResult.Attributes;
  if (photo && photo.s3Key && photo.eventId) {
    await broadcastNewPhoto(photo.eventId, photoId, photo.s3Key, photo.nickname, photo.greeting);
  }
  return { photoId, status: "approved" };
}

async function broadcastDeletePhoto(eventId: string, photoId: string) {
  const connections = await dynamo.send(
    new QueryCommand({
      TableName: process.env.CONNECTIONS_TABLE!,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": `EVENT-${eventId}` },
    })
  );
  const items = connections.Items ?? [];
  if (items.length === 0) return;
  const wsUrl = items[0]?.wsEndpoint ?? process.env.WEBSOCKET_API_URL;
  if (!wsUrl) return;

  const wsClient = new ApiGatewayManagementApiClient({ endpoint: wsUrl });
  const message = JSON.stringify({
    type: "delete_photo",
    photoId,
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

async function deletePhoto(photoId: string) {
  const resp = await dynamo.send(
    new GetCommand({
      TableName: process.env.PHOTOS_TABLE!,
      Key: { PK: photoId, SK: "METADATA" },
    })
  );

  if (!resp.Item) return null;

  const photo = resp.Item;
  const eventId = photo.eventId;
  const s3Key = photo.s3Key;

  const deletes: Promise<any>[] = [];

  if (s3Key) {
    deletes.push(
      s3.send(
        new DeleteObjectCommand({
          Bucket: process.env.PHOTO_BUCKET!,
          Key: s3Key,
        })
      ).catch((err) => console.error("Failed to delete S3 photo object:", err))
    );
  }

  deletes.push(
    dynamo.send(
      new DeleteCommand({
        TableName: process.env.PHOTOS_TABLE!,
        Key: { PK: photoId, SK: "METADATA" },
      })
    )
  );

  await Promise.all(deletes);

  if (eventId) {
    await broadcastDeletePhoto(eventId, photoId);
  }

  return { photoId };
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

async function updateEvent(eventId: string, body: { name?: string; date?: string; requiresReview?: boolean }) {
  const updates: string[] = [];
  const attrNames: Record<string, string> = {};
  const attrValues: Record<string, any> = {};

  if (body.name !== undefined) {
    updates.push("#n = :name");
    attrNames["#n"] = "name";
    attrValues[":name"] = body.name;
  }
  if (body.date !== undefined) {
    updates.push("#d = :date");
    attrNames["#d"] = "date";
    attrValues[":date"] = body.date;
  }
  if (body.requiresReview !== undefined) {
    updates.push("#r = :reqRev");
    attrNames["#r"] = "requiresReview";
    attrValues[":reqRev"] = body.requiresReview;
  }

  if (updates.length === 0) return { success: true };

  await dynamo.send(new UpdateCommand({
    TableName: process.env.EVENTS_TABLE!,
    Key: { PK: eventId, SK: "METADATA" },
    UpdateExpression: `SET ${updates.join(", ")}`,
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues,
  }));
  return { success: true };
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

    // GET /admin/events/{eventId}/template
    const templateMatch = path.match(/^\/admin\/events\/([^/]+)\/template$/);
    if (templateMatch && method === "GET") {
      const eventId = decodeURIComponent(templateMatch[1]);
      const record = await getEventTemplateRecord(eventId);
      if (!record) return res(404, { error: "Not found" });
      const template = await decorateTemplateAssets(record.templateDraft ?? defaultTemplate());
      const publishedTemplate = record.templatePublished ? await decorateTemplateAssets(record.templatePublished) : null;
      return res(200, {
        eventId,
        template,
        publishedTemplate,
        published: !!record.templatePublished,
      });
    }

    // PUT /admin/events/{eventId}/template
    if (templateMatch && method === "PUT") {
      const eventId = decodeURIComponent(templateMatch[1]);
      const body = JSON.parse(event.body ?? "{}");
      const result = await persistTemplate(eventId, body.template ?? body, Boolean(body.publish));
      if (!result) return res(404, { error: "Not found" });
      return res(200, {
        eventId,
        ...result,
        published: Boolean(body.publish),
      });
    }

    // POST /admin/events/{eventId}/template-assets/presign
    const assetPresignMatch = path.match(/^\/admin\/events\/([^/]+)\/template-assets\/presign$/);
    if (assetPresignMatch && method === "POST") {
      const eventId = decodeURIComponent(assetPresignMatch[1]);
      const record = await getEventTemplateRecord(eventId);
      if (!record) return res(404, { error: "Not found" });
      const body = JSON.parse(event.body ?? "{}");
      if (!body.filename || !body.contentType) {
        return res(400, { error: "missing fields" });
      }
      if (!String(body.contentType).startsWith("image/")) {
        return res(400, { error: "Invalid asset type" });
      }
      const assetId = crypto.randomUUID();
      const assetKey = makeAssetKey(eventId, assetId, body.filename);
      const uploadUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: process.env.PHOTO_BUCKET!,
          Key: assetKey,
          ContentType: body.contentType,
        }),
        { expiresIn: 900 }
      );
      return res(200, { assetId, assetKey, uploadUrl });
    }

    // POST /admin/events/{eventId}/template-assets/confirm
    const assetConfirmMatch = path.match(/^\/admin\/events\/([^/]+)\/template-assets\/confirm$/);
    if (assetConfirmMatch && method === "POST") {
      const eventId = decodeURIComponent(assetConfirmMatch[1]);
      const body = JSON.parse(event.body ?? "{}");
      const result = await addTemplateAsset(eventId, body);
      if (!result) return res(404, { error: "Not found" });
      return res(200, { eventId, ...result });
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

    // PATCH /admin/events/{eventId}
    if (path.match(/^\/admin\/events\/[^/]+$/) && method === "PATCH") {
      const eventId = decodeURIComponent(path.split("/")[3]);
      const body = JSON.parse(event.body ?? "{}");
      const result = await updateEvent(eventId, body);
      return res(200, result);
    }

    // PATCH /admin/photos/{photoId}
    if (path.match(/^\/admin\/photos\/[^/]+$/) && method === "PATCH") {
      const photoId = path.split("/")[3];
      const result = await approvePhoto(photoId);
      return res(200, result);
    }

    // DELETE /admin/photos/{photoId}
    if (path.match(/^\/admin\/photos\/[^/]+$/) && method === "DELETE") {
      const photoId = path.split("/")[3];
      const result = await deletePhoto(photoId);
      if (!result) return res(404, { error: "Photo not found" });
      return res(200, { success: true });
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
