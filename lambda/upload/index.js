"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var index_exports = {};
__export(index_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(index_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_s3 = require("@aws-sdk/client-s3");
var import_s3_request_presigner = require("@aws-sdk/s3-request-presigner");
var import_client_apigatewaymanagementapi = require("@aws-sdk/client-apigatewaymanagementapi");
const dynamo = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({}));
const s3 = new import_client_s3.S3Client({});
const MAGIC_BYTES = {
  "image/jpeg": { bytes: [255, 216, 255] },
  "image/png": { bytes: [137, 80, 78, 71] },
  "image/webp": { bytes: [82, 73, 70, 70], offset: 0 },
  // RIFF....WEBP
  "image/heic": { bytes: [102, 116, 121, 112, 104, 101, 105, 99] }
  // ftypheic
};
const MAX_FILE_SIZE = 20 * 1024 * 1024;
async function validateUploadKey(eventId, uploadKey) {
  const keyHash = await sha256(uploadKey);
  const result = await dynamo.send(
    new import_lib_dynamodb.QueryCommand({
      TableName: process.env.KEYPAIRS_TABLE,
      IndexName: "keyHash-index",
      KeyConditionExpression: "keyHash = :h",
      FilterExpression: "keyType = :t",
      ExpressionAttributeValues: {
        ":h": keyHash,
        ":t": "UPLOAD"
      }
    })
  );
  if (!result.Items?.length) return false;
  return result.Items.some((item) => item.eventId === eventId);
}
function generatePhotoId() {
  return `PHOTO#${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function sha256(text) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(
    (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}
function sanitizeNickname(nickname) {
  return nickname.replace(/[^a-zA-Z0-9 ]/g, "").trim().slice(0, 20);
}
function isValidNickname(nickname) {
  return /^[a-zA-Z0-9 ]{2,20}$/.test(nickname);
}
async function broadcastNewPhoto(eventId, photoId, s3Key) {
  const wsUrl = process.env.WEBSOCKET_API_URL;
  if (!wsUrl) return;
  const connections = await dynamo.send(
    new import_lib_dynamodb.QueryCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": `EVENT-${eventId}` }
    })
  );
  const wsClient = new import_client_apigatewaymanagementapi.ApiGatewayManagementApiClient({ endpoint: wsUrl });
  const message = JSON.stringify({ type: "new_photo", photoId, s3Key, uploadedAt: (/* @__PURE__ */ new Date()).toISOString() });
  await Promise.allSettled(
    (connections.Items ?? []).map(
      (conn) => wsClient.send(
        new import_client_apigatewaymanagementapi.PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: Buffer.from(message)
        })
      )
    )
  );
}
async function presignUpload(eventId, filename, contentType, fileSize, uploadKey) {
  const keyValid = await validateUploadKey(eventId, uploadKey);
  if (!keyValid) {
    return { statusCode: 403, body: JSON.stringify({ error: "Invalid or expired key" }) };
  }
  if (!Object.keys(MAGIC_BYTES).includes(contentType)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Unsupported file type" }) };
  }
  if (fileSize > MAX_FILE_SIZE) {
    return { statusCode: 413, body: JSON.stringify({ error: "File too large (max 20MB)" }) };
  }
  if (!filename || filename.length > 255) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid filename" }) };
  }
  const photoId = generatePhotoId();
  const ext = filename.split(".").pop() ?? "jpg";
  const s3Key = `${process.env.STAGE ?? "prod"}/${eventId}/${photoId}.${ext}`;
  const command = new import_client_s3.PutObjectCommand({
    Bucket: process.env.PHOTO_BUCKET,
    Key: s3Key,
    ContentType: contentType
  });
  const uploadUrl = await (0, import_s3_request_presigner.getSignedUrl)(s3, command, { expiresIn: 300 });
  await dynamo.send(
    new import_lib_dynamodb.PutCommand({
      TableName: process.env.PHOTOS_TABLE,
      Item: {
        PK: photoId,
        SK: "METADATA",
        eventId,
        filename,
        contentType,
        s3Key,
        status: "pending",
        nickname: "",
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      // Conditional write: fail if PK already exists (duplicate)
      ConditionExpression: "attribute_not_exists(PK)"
    })
  );
  return { statusCode: 200, body: JSON.stringify({ photoId, uploadUrl, s3Key }) };
}
async function confirmUpload(photoId, eventId, nickname, uploadKey) {
  const keyValid = await validateUploadKey(eventId, uploadKey);
  if (!keyValid) {
    return { statusCode: 403, body: JSON.stringify({ error: "Invalid or expired key" }) };
  }
  if (!isValidNickname(nickname)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid nickname format" }) };
  }
  const cleanNickname = sanitizeNickname(nickname);
  await dynamo.send(
    new import_lib_dynamodb.UpdateCommand({
      TableName: process.env.PHOTOS_TABLE,
      Key: { PK: photoId, SK: "METADATA" },
      UpdateExpression: "SET nickname = :n, #status = :s, confirmedAt = :c",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":n": cleanNickname,
        ":s": "active",
        ":c": (/* @__PURE__ */ new Date()).toISOString()
      },
      ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)"
    })
  );
  const photo = await dynamo.send(
    new import_lib_dynamodb.QueryCommand({
      TableName: process.env.PHOTOS_TABLE,
      KeyConditionExpression: "PK = :pk AND SK = :sk",
      ExpressionAttributeValues: { ":pk": photoId, ":sk": "METADATA" }
    })
  );
  const s3Key = photo.Items?.[0]?.s3Key;
  if (s3Key) {
    await broadcastNewPhoto(eventId, photoId, s3Key);
  }
  return { statusCode: 200, body: JSON.stringify({ photoId, status: "active" }) };
}
async function handler(event) {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "POST";
  const path = event.requestContext?.http?.path ?? event.path ?? "";
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "https://wedding.fishare.de",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,Origin,X-Requested-With,Accept",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400"
      },
      body: ""
    };
  }
  const queryKey = event.queryStringParameters?.key ?? "";
  const body = JSON.parse(event.body ?? "{}");
  try {
    if (path === "/upload/presign" && method === "POST") {
      const { eventId, filename, contentType, fileSize } = body;
      if (!eventId || !filename || !contentType) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing fields" }) };
      }
      const result = await presignUpload(eventId, filename, contentType, fileSize ?? 0, queryKey);
      return result;
    }
    if (path === "/upload/confirm" && method === "POST") {
      const { eventId, photoId, nickname } = body;
      if (!eventId || !photoId || !nickname) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing fields" }) };
      }
      const result = await confirmUpload(photoId, eventId, nickname, queryKey);
      return result;
    }
    return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
  } catch (err) {
    console.error("Upload Lambda error:", err);
    if (err.name === "ConditionalCheckFailedException") {
      return { statusCode: 409, body: JSON.stringify({ error: "Duplicate upload" }) };
    }
    return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
