/* eslint-disable @typescript-eslint/no-explicit-any */

const mockDdbSend = jest.fn();
const mockS3Send = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({ send: mockDdbSend }),
  },
  QueryCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
  DeleteCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
  GetCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  GetObjectCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
  DeleteObjectCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

import { handler } from "../../lambda/myguest/index";

beforeEach(() => {
  jest.clearAllMocks();
  process.env.PHOTOS_TABLE = "photos";
  process.env.PHOTO_BUCKET = "bucket";
  mockGetSignedUrl.mockResolvedValue("https://signed-view-url");
});

describe("GET /myguest/photos", () => {
  test("returns photos by eventId + nickname", async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [{ PK: "PHOTO#1", nickname: "Alice", status: "approved", s3Key: "k1" }],
    });
    const event = {
      requestContext: { http: { method: "GET", path: "/myguest/photos" } },
      queryStringParameters: { eventId: "EVENT-1", nickname: "Alice" },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.photos).toHaveLength(1);
    expect(body.photos[0].presignedUrl).toBe("https://signed-view-url");
  });
});

describe("DELETE /myguest/photos/:photoId", () => {
  test("returns 403 for nickname mismatch", async () => {
    mockDdbSend.mockResolvedValueOnce({
      Item: { PK: "PHOTO#1", SK: "METADATA", eventId: "EVENT-1", nickname: "Bob", s3Key: "k1" },
    });
    const event = {
      requestContext: { http: { method: "DELETE", path: "/myguest/photos/PHOTO#1" } },
      body: JSON.stringify({ eventId: "EVENT-1", nickname: "Alice" }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(403);
  });

  test("returns 200 for matching nickname and deletes records", async () => {
    mockDdbSend
      .mockResolvedValueOnce({
        Item: { PK: "PHOTO#1", SK: "METADATA", eventId: "EVENT-1", nickname: "Alice", s3Key: "k1" },
      })
      .mockResolvedValueOnce({});
    mockS3Send.mockResolvedValueOnce({});
    const event = {
      requestContext: { http: { method: "DELETE", path: "/myguest/photos/PHOTO#1" } },
      body: JSON.stringify({ eventId: "EVENT-1", nickname: "Alice" }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
  });
});
