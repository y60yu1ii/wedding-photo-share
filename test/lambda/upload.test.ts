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
  GetCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
  ScanCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
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

  test("accepts diverse image formats like webp and gif", async () => {
    mockDdbSend
      .mockResolvedValueOnce({ Items: [{ eventId: "EVENT-1" }] }) // validate key
      .mockResolvedValueOnce({}); // put photo pending
    const event = {
      requestContext: { http: { method: "POST", path: "/upload/presign" } },
      queryStringParameters: { key: "GOODKEY" },
      body: JSON.stringify({
        eventId: "EVENT-1",
        filename: "a.webp",
        contentType: "image/webp",
        fileSize: 100,
      }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });

  test("rejects non-image formats like pdf", async () => {
    mockDdbSend.mockResolvedValueOnce({ Items: [{ eventId: "EVENT-1" }] }); // validate key
    const event = {
      requestContext: { http: { method: "POST", path: "/upload/presign" } },
      queryStringParameters: { key: "GOODKEY" },
      body: JSON.stringify({
        eventId: "EVENT-1",
        filename: "a.pdf",
        contentType: "application/pdf",
        fileSize: 100,
      }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(400);
  });
});

describe("POST /upload/confirm", () => {
  test("returns 200 pending for valid key and nickname (requiresReview = true)", async () => {
    mockDdbSend
      .mockResolvedValueOnce({ Items: [{ eventId: "EVENT-1" }] }) // validate key
      .mockResolvedValueOnce({ Items: [] }) // existing guest photos
      .mockResolvedValueOnce({ Item: { PK: "EVENT-1", SK: "METADATA", requiresReview: true } }) // fetch event metadata
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

  test("returns 200 approved when requiresReview is false", async () => {
    mockDdbSend
      .mockResolvedValueOnce({ Items: [{ eventId: "EVENT-1" }] }) // validate key
      .mockResolvedValueOnce({ Items: [] }) // existing guest photos
      .mockResolvedValueOnce({ Item: { PK: "EVENT-1", SK: "METADATA", requiresReview: false } }) // fetch event metadata
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
    expect(JSON.parse(result.body).status).toBe("approved");
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

  test("accepts Chinese and English Unicode nicknames", async () => {
    mockDdbSend
      .mockResolvedValueOnce({ Items: [{ eventId: "EVENT-1" }] }) // validate key
      .mockResolvedValueOnce({ Items: [] }) // existing guest photos
      .mockResolvedValueOnce({ Item: { PK: "EVENT-1", SK: "METADATA", requiresReview: false } }) // fetch event metadata
      .mockResolvedValueOnce({}) // update photo
      .mockResolvedValueOnce({ Items: [{ s3Key: "prod/EVENT-1/PHOTO#1.jpg" }] }) // fetch photo
      .mockResolvedValueOnce({ Items: [] }); // query connections

    const event = {
      requestContext: { http: { method: "POST", path: "/upload/confirm" } },
      queryStringParameters: { key: "GOODKEY" },
      body: JSON.stringify({
        eventId: "EVENT-1",
        photoId: "PHOTO#1",
        nickname: "張三 Alice 12",
      }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).status).toBe("approved");
  });

  test("saves greeting message in DynamoDB during confirmUpload", async () => {
    mockDdbSend
      .mockResolvedValueOnce({ Items: [{ eventId: "EVENT-1" }] }) // validate key
      .mockResolvedValueOnce({ Items: [] }) // existing guest photos
      .mockResolvedValueOnce({ Item: { PK: "EVENT-1", SK: "METADATA", requiresReview: false } }) // fetch event metadata
      .mockResolvedValueOnce({}) // update photo
      .mockResolvedValueOnce({ Items: [{ s3Key: "prod/EVENT-1/PHOTO#1.jpg" }] }) // fetch photo
      .mockResolvedValueOnce({ Items: [] }); // query connections

    const event = {
      requestContext: { http: { method: "POST", path: "/upload/confirm" } },
      queryStringParameters: { key: "GOODKEY" },
      body: JSON.stringify({
        eventId: "EVENT-1",
        photoId: "PHOTO#1",
        nickname: "張三",
        greeting: "祝新婚快樂，白頭偕老！",
      }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    
    // The 3rd DynamoDB call is UpdateCommand. Verify it contains the greeting
    const updateCall = mockDdbSend.mock.calls[3][0];
    expect(updateCall.input.UpdateExpression).toContain("greeting = :g");
    expect(updateCall.input.ExpressionAttributeValues[":g"]).toBe("祝新婚快樂，白頭偕老！");
  });

  test("persists guestKey and representativePhotoId when present", async () => {
    mockDdbSend
      .mockResolvedValueOnce({ Items: [{ eventId: "EVENT-1" }] }) // validate key
      .mockResolvedValueOnce({
        Items: [
          {
            PK: "PHOTO#existing",
            SK: "METADATA",
            eventId: "EVENT-1",
            guestKey: "guest-abc",
            representativePhotoId: "PHOTO#existing",
            confirmedAt: "2026-05-29T00:00:00.000Z",
          },
        ],
      }) // existing guest photos
      .mockResolvedValueOnce({ Item: { PK: "EVENT-1", SK: "METADATA", requiresReview: false } }) // event metadata
      .mockResolvedValueOnce({}) // update photo
      .mockResolvedValueOnce({ Items: [{ s3Key: "prod/EVENT-1/PHOTO#2.jpg" }] }) // fetch photo
      .mockResolvedValueOnce({ Items: [] }); // query connections

    const event = {
      requestContext: { http: { method: "POST", path: "/upload/confirm" } },
      queryStringParameters: { key: "GOODKEY" },
      body: JSON.stringify({
        eventId: "EVENT-1",
        photoId: "PHOTO#2",
        nickname: "Alice",
        guestKey: "guest-abc",
      }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);

    const updateCall = mockDdbSend.mock.calls[3][0];
    expect(updateCall.input.UpdateExpression).toContain("guestKey = :guestKey");
    expect(updateCall.input.UpdateExpression).toContain("representativePhotoId = :representativePhotoId");
    expect(updateCall.input.ExpressionAttributeValues[":guestKey"]).toBe("guest-abc");
    expect(updateCall.input.ExpressionAttributeValues[":representativePhotoId"]).toBe("PHOTO#existing");
  });
});
