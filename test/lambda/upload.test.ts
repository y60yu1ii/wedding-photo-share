/* eslint-disable @typescript-eslint/no-explicit-any */

const mockDdbSend = jest.fn();
const mockWsSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({ send: mockDdbSend }),
  },
  PutCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
  QueryCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
  UpdateCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

jest.mock("@aws-sdk/client-apigatewaymanagementapi", () => ({
  ApiGatewayManagementApiClient: jest.fn().mockImplementation(() => ({ send: mockWsSend })),
  PostToConnectionCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
}));

import { handler } from "../../lambda/upload/index";

beforeEach(() => {
  jest.clearAllMocks();
  process.env.KEYPAIRS_TABLE = "keypairs";
  process.env.PHOTOS_TABLE = "photos";
  process.env.CONNECTIONS_TABLE = "connections";
  process.env.PHOTO_BUCKET = "bucket";
  process.env.STAGE = "prod";
  mockGetSignedUrl.mockResolvedValue("https://signed-upload-url");
});

describe("POST /upload/presign", () => {
  test("returns 403 for invalid key", async () => {
    mockDdbSend.mockResolvedValueOnce({ Items: [] }); // validate key
    const event = {
      requestContext: { http: { method: "POST", path: "/upload/presign" } },
      queryStringParameters: { key: "BADKEY" },
      body: JSON.stringify({
        eventId: "EVENT-1",
        filename: "a.jpg",
        contentType: "image/jpeg",
        fileSize: 100,
      }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(403);
  });
});

describe("POST /upload/confirm", () => {
  test("returns 200 pending for valid key and nickname", async () => {
    mockDdbSend
      .mockResolvedValueOnce({ Items: [{ eventId: "EVENT-1" }] }) // validate key
      .mockResolvedValueOnce({}) // update photo
      .mockResolvedValueOnce({ Items: [{ s3Key: "prod/EVENT-1/PHOTO#1.jpg" }] }) // fetch photo
      .mockResolvedValueOnce({ Items: [] }); // query connections

    const event = {
      requestContext: { http: { method: "POST", path: "/upload/confirm" } },
      queryStringParameters: { key: "GOODKEY" },
      body: JSON.stringify({
        eventId: "EVENT-1",
        photoId: "PHOTO#1",
        nickname: "Alice",
      }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).status).toBe("pending");
  });

  test("returns 400 for invalid nickname format", async () => {
    mockDdbSend.mockResolvedValueOnce({ Items: [{ eventId: "EVENT-1" }] }); // validate key
    const event = {
      requestContext: { http: { method: "POST", path: "/upload/confirm" } },
      queryStringParameters: { key: "GOODKEY" },
      body: JSON.stringify({
        eventId: "EVENT-1",
        photoId: "PHOTO#1",
        nickname: "<script>",
      }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });
});
