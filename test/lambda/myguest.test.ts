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
  UpdateCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
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
      Items: [
        {
          PK: "PHOTO#1",
          eventId: "EVENT-1",
          nickname: "Alice",
          status: "approved",
          confirmedAt: "2026-05-29T00:00:01.000Z",
          s3Key: "k1",
        },
      ],
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
    expect(mockDdbSend.mock.calls[0][0].input.IndexName).toBe("eventId-nickname-index");
  });

  test("returns photos by eventId + guestKey while keeping representative metadata", async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [
        {
          PK: "PHOTO#1",
          eventId: "EVENT-1",
          nickname: "Alice",
          guestKey: "guest-abc",
          representativePhotoId: "PHOTO#2",
          status: "approved",
          s3Key: "k1",
          confirmedAt: "2026-05-29T00:00:01.000Z",
        },
      ],
    });
    const event = {
      requestContext: { http: { method: "GET", path: "/myguest/photos" } },
      queryStringParameters: { eventId: "EVENT-1", guestKey: "guest-abc" },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.photos[0].guestKey).toBe("guest-abc");
    expect(body.photos[0].representativePhotoId).toBe("PHOTO#2");
    expect(body.photos[0].createdAt).toBe("2026-05-29T00:00:01.000Z");
    expect(mockDdbSend.mock.calls[0][0].input.IndexName).toBe("eventId-status-index");
  });
});

describe("PATCH /myguest/photos/:photoId/representative", () => {
  test("updates representativePhotoId for the guest's photos", async () => {
    mockDdbSend
      .mockResolvedValueOnce({
        Item: {
          PK: "PHOTO#2",
          SK: "METADATA",
          eventId: "EVENT-1",
          guestKey: "guest-abc",
          nickname: "Alice",
        },
      })
      .mockResolvedValueOnce({
        Items: [
          { PK: "PHOTO#1", SK: "METADATA", eventId: "EVENT-1", guestKey: "guest-abc", nickname: "Alice", confirmedAt: "2026-05-29T00:00:01.000Z" },
          { PK: "PHOTO#2", SK: "METADATA", eventId: "EVENT-1", guestKey: "guest-abc", nickname: "Alice", confirmedAt: "2026-05-29T00:00:02.000Z" },
        ],
      })
      .mockResolvedValue({});

    const event = {
      requestContext: { http: { method: "PATCH", path: "/myguest/photos/PHOTO#2/representative" } },
      body: JSON.stringify({ eventId: "EVENT-1", guestKey: "guest-abc" }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    expect(mockDdbSend.mock.calls[1][0].input.IndexName).toBe("eventId-nickname-index");
    expect(mockDdbSend.mock.calls[2][0].input.ExpressionAttributeValues[":representativePhotoId"]).toBe("PHOTO#2");
    expect(mockDdbSend.mock.calls[3][0].input.ExpressionAttributeValues[":representativePhotoId"]).toBe("PHOTO#2");
  });

  test("rejects representative updates when the guestKey does not own the photo", async () => {
    mockDdbSend.mockResolvedValueOnce({
      Item: {
        PK: "PHOTO#2",
        SK: "METADATA",
        eventId: "EVENT-1",
        guestKey: "guest-owner",
        nickname: "Alice",
      },
    });

    const event = {
      requestContext: { http: { method: "PATCH", path: "/myguest/photos/PHOTO#2/representative" } },
      body: JSON.stringify({ eventId: "EVENT-1", guestKey: "guest-abc" }),
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(403);
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
