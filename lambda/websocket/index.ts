import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function sendToAll(eventId: string, message: object) {
  // Find all connections for this event
  const resp = await dynamo.send(
    new QueryCommand({
      TableName: process.env.CONNECTIONS_TABLE!,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": `EVENT-${eventId}` },
    })
  );
  const connections = resp.Items ?? [];

  const apiUrl = connections[0]?.wsEndpoint ?? process.env.WEBSOCKET_API_URL!;
  const mgmt = new ApiGatewayManagementApiClient({ endpoint: apiUrl });

  await Promise.allSettled(
    connections.map((conn: any) =>
      mgmt.send(
        new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: Buffer.from(JSON.stringify(message)),
        })
      )
    )
  );
}

export async function handler(event: any) {
  const routeKey: string = event.requestContext?.routeKey ?? "$default";
  const connectionId: string = event.requestContext?.connectionId ?? "";

  try {
    // $connect — store connection with eventId from query
    if (routeKey === "$connect") {
      const eventId = event.queryStringParameters?.eventId ?? "";
      const wsEndpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
      await dynamo.send(
        new PutCommand({
          TableName: process.env.CONNECTIONS_TABLE!,
          Item: {
            PK: `EVENT-${eventId}`,
            SK: `CONN#${connectionId}`,
            connectionId,
            eventId,
            wsEndpoint,
            connectedAt: new Date().toISOString(),
            expireAt: Math.floor(Date.now() / 1000) + 86400, // 24h TTL
          },
        })
      );
      return { statusCode: 200, body: "Connected" };
    }

    // $disconnect — remove connection
    if (routeKey === "$disconnect") {
      const conn = await dynamo.send(
        new ScanCommand({
          TableName: process.env.CONNECTIONS_TABLE!,
          FilterExpression: "connectionId = :cid",
          ExpressionAttributeValues: { ":cid": connectionId },
          Limit: 1,
        })
      );
      const row = conn.Items?.[0];
      if (row) {
        await dynamo.send(
          new DeleteCommand({
            TableName: process.env.CONNECTIONS_TABLE!,
            Key: { PK: row.PK, SK: row.SK },
          })
        );
      }
      return { statusCode: 200, body: "Disconnected" };
    }

    // broadcast — relay message to all connections for this event
    if (routeKey === "broadcast") {
      const { eventId, type, payload } = JSON.parse(event.body ?? "{}");
      if (eventId) {
        await sendToAll(eventId, { type, payload, timestamp: new Date().toISOString() });
      }
      return { statusCode: 200, body: "Broadcast sent" };
    }

    // Default route
    if (routeKey === "$default") {
      return { statusCode: 200, body: "ok" };
    }

    return { statusCode: 200, body: "Unknown route" };
  } catch (err) {
    console.error("WebSocket Lambda error:", err);
    return { statusCode: 500, body: "Internal error" };
  }
}
