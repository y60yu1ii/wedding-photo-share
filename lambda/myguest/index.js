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

// lambda/myguest/index.ts
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
async function getMyPhotos(eventId, keyHash) {
  const resp = await dynamo.send(
    new import_lib_dynamodb.QueryCommand({
      TableName: process.env.PHOTOS_TABLE,
      IndexName: "eventId-status-index",
      KeyConditionExpression: "eventId = :eid",
      ExpressionAttributeValues: { ":eid": eventId }
    })
  );
  return (resp.Items ?? []).filter((p) => p.keyHash === keyHash);
}
async function presignPhoto(s3Key) {
  const cmd = new import_client_s3.GetObjectCommand({
    Bucket: process.env.PHOTO_BUCKET,
    Key: s3Key
  });
  return (0, import_s3_request_presigner.getSignedUrl)(s3, cmd, { expiresIn: 3600 });
}
async function deletePhoto(photoId, eventId, keyHash) {
  const photo = await dynamo.send(
    new import_lib_dynamodb.QueryCommand({
      TableName: process.env.PHOTOS_TABLE,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": photoId }
    })
  );
  if (!photo.Items?.length) throw new Error("Photo not found");
  await s3.send(
    new import_client_s3.DeleteObjectCommand({
      Bucket: process.env.PHOTO_BUCKET,
      Key: photo.Items[0].s3Key
    })
  );
  await dynamo.send(
    new import_lib_dynamodb.DeleteCommand({
      TableName: process.env.PHOTOS_TABLE,
      Key: { PK: photoId, SK: "METADATA" }
    })
  );
  return { photoId };
}
async function handler(event) {
  const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
  const path = event.requestContext?.http?.path ?? event.path ?? "";
  const query = event.queryStringParameters ?? {};
  try {
    if (path === "/myguest/photos" && method === "GET") {
      const { eventId, keyHash } = query;
      if (!eventId || !keyHash) {
        return { statusCode: 400, body: JSON.stringify({ error: "missing params" }) };
      }
      const photos = await getMyPhotos(eventId, keyHash);
      const withUrls = await Promise.all(
        photos.map(async (p) => ({
          PK: p.PK,
          nickname: p.nickname,
          status: p.status,
          presignedUrl: p.s3Key ? await presignPhoto(p.s3Key) : void 0
        }))
      );
      return { statusCode: 200, body: JSON.stringify({ photos: withUrls }) };
    }
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
