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

// lambda/websocket/index.ts
var index_exports = {};
__export(index_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(index_exports);
var import_client_dynamodb = require("@aws-sdk/client-dynamodb");
var import_lib_dynamodb = require("@aws-sdk/lib-dynamodb");
var import_client_apigatewaymanagementapi = require("@aws-sdk/client-apigatewaymanagementapi");
var dynamo = import_lib_dynamodb.DynamoDBDocumentClient.from(new import_client_dynamodb.DynamoDBClient({}));
async function sendToAll(eventId, message) {
  const resp = await dynamo.send(
    new import_lib_dynamodb.ScanCommand({
      TableName: process.env.CONNECTIONS_TABLE,
      FilterExpression: "eventId = :eid",
      ExpressionAttributeValues: { ":eid": eventId }
    })
  );
  const connections = resp.Items ?? [];
  const apiUrl = process.env.WEBSOCKET_API_URL;
  const mgmt = new import_client_apigatewaymanagementapi.ApiGatewayManagementApiClient({ endpoint: apiUrl });
  await Promise.allSettled(
    connections.map(
      (conn) => mgmt.send(
        new import_client_apigatewaymanagementapi.PostToConnectionCommand({
          ConnectionId: conn.PK.replace("CONN#", ""),
          Data: Buffer.from(JSON.stringify(message))
        })
      )
    )
  );
}
async function handler(event) {
  const routeKey = event.requestContext?.routeKey ?? "$default";
  const connectionId = event.requestContext?.connectionId ?? "";
  try {
    if (routeKey === "$connect") {
      const eventId = event.queryStringParameters?.eventId ?? "";
      await dynamo.send(
        new import_lib_dynamodb.PutCommand({
          TableName: process.env.CONNECTIONS_TABLE,
          Item: {
            PK: `CONN#${connectionId}`,
            SK: "METADATA",
            eventId,
            connectedAt: (/* @__PURE__ */ new Date()).toISOString(),
            expireAt: Math.floor(Date.now() / 1e3) + 86400
            // 24h TTL
          }
        })
      );
      return { statusCode: 200, body: "Connected" };
    }
    if (routeKey === "$disconnect") {
      await dynamo.send(
        new import_lib_dynamodb.DeleteCommand({
          TableName: process.env.CONNECTIONS_TABLE,
          Key: { PK: `CONN#${connectionId}`, SK: "METADATA" }
        })
      );
      return { statusCode: 200, body: "Disconnected" };
    }
    if (routeKey === "broadcast") {
      const { eventId, type, payload } = JSON.parse(event.body ?? "{}");
      if (eventId) {
        await sendToAll(eventId, { type, payload, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
      }
      return { statusCode: 200, body: "Broadcast sent" };
    }
    if (routeKey === "$default") {
      return { statusCode: 200, body: "ok" };
    }
    return { statusCode: 200, body: "Unknown route" };
  } catch (err) {
    console.error("WebSocket Lambda error:", err);
    return { statusCode: 500, body: "Internal error" };
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
