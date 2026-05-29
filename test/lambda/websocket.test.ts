/* eslint-disable @typescript-eslint/no-explicit-any */

const mockDdbSend = jest.fn();
const mockWsSend = jest.fn();

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({ send: mockDdbSend }),
  },
  PutCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
  DeleteCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
  ScanCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
  QueryCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
}));

jest.mock("@aws-sdk/client-apigatewaymanagementapi", () => ({
  ApiGatewayManagementApiClient: jest.fn().mockImplementation(() => ({ send: mockWsSend })),
  PostToConnectionCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
}));

import { handler } from "../../lambda/websocket/index";

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CONNECTIONS_TABLE = "connections";
});

describe("$connect", () => {
  test("stores connection under event partition", async () => {
    mockDdbSend.mockResolvedValueOnce({});
    const event = {
      requestContext: {
        routeKey: "$connect",
        connectionId: "abc123",
        domainName: "ws.example.com",
        stage: "prod",
      },
      queryStringParameters: { eventId: "EVENT-1" },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    const call = mockDdbSend.mock.calls[0][0];
    expect(call.input.Item.PK).toBe("EVENT-EVENT-1");
    expect(call.input.Item.SK).toBe("CONN#abc123");
  });
});

describe("broadcast", () => {
  test("queries by event partition and sends to all connections", async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [
        { connectionId: "c1", wsEndpoint: "https://ws.example.com/prod" },
        { connectionId: "c2", wsEndpoint: "https://ws.example.com/prod" },
      ],
    });
    mockWsSend.mockResolvedValue({});
    const event = {
      requestContext: { routeKey: "broadcast", connectionId: "sender" },
      body: JSON.stringify({ eventId: "EVENT-1", type: "new_photo", payload: { photoId: "P1" } }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(mockWsSend).toHaveBeenCalledTimes(2);
  });
});
