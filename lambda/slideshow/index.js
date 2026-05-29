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

// lambda/slideshow/index.ts
var index_exports = {};
__export(index_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(index_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_s3 = require("@aws-sdk/client-s3");
var import_s3_request_presigner = require("@aws-sdk/s3-request-presigner");
var dynamo = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({}));
var s3 = new import_client_s3.S3Client({});
var PRESIGN_EXPIRY = 3600;
async function getSlideshowPhotos(eventId) {
  const resp = await dynamo.send(
    new import_lib_dynamodb.QueryCommand({
      TableName: process.env.PHOTOS_TABLE,
      IndexName: "eventId-status-index",
      KeyConditionExpression: "eventId = :eid AND #s = :approved",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":eid": eventId, ":approved": "approved" }
    })
  );
  return resp.Items ?? [];
}
async function presignPhoto(photoId) {
  const photo = await dynamo.send(
    new import_lib_dynamodb.GetCommand({ TableName: process.env.PHOTOS_TABLE, Key: { PK: photoId, SK: "METADATA" } })
  );
  if (!photo.Item) throw new Error("Photo not found");
  const cmd = new import_client_s3.GetObjectCommand({
    Bucket: process.env.PHOTO_BUCKET,
    Key: photo.Item.s3Key
  });
  const url = await (0, import_s3_request_presigner.getSignedUrl)(s3, cmd, { expiresIn: PRESIGN_EXPIRY });
  return { photoId, presignedUrl: url };
}
async function handler(event) {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path = event.requestContext?.http?.path ?? event.path ?? "";
  try {
    if (path === "/slideshow/photos" && method === "GET") {
      const eventId = event.queryStringParameters?.eventId;
      if (!eventId) {
        return { statusCode: 400, body: JSON.stringify({ error: "eventId required" }) };
      }
      const photos = await getSlideshowPhotos(eventId);
      return { statusCode: 200, body: JSON.stringify({ eventId, photos }) };
    }
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
