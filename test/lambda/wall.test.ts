/* eslint-disable @typescript-eslint/no-explicit-any */

const mockDdbSend = jest.fn();
const mockGetSignedUrl = jest.fn();

jest.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({ send: mockDdbSend }),
  },
  GetCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
  QueryCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  GetObjectCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

import { handler } from "../../lambda/wall/index";

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EVENTS_TABLE = "events";
  process.env.PHOTOS_TABLE = "photos";
  process.env.PHOTO_BUCKET = "bucket";
  mockGetSignedUrl.mockResolvedValue("https://signed-wall-url");
});

describe("GET /wall/photos", () => {
  test("returns one representative photo per guest in oldest-first order", async () => {
    mockDdbSend
      .mockResolvedValueOnce({
        Item: { PK: "EVENT-1", SK: "METADATA", wallPolicy: "approved_only" },
      })
      .mockResolvedValueOnce({
        Items: [
          {
            PK: "PHOTO#1",
            SK: "METADATA",
            eventId: "EVENT-1",
            guestKey: "guest-abc",
            nickname: "Alice",
            representativePhotoId: "PHOTO#1",
            status: "approved",
            confirmedAt: "2026-05-29T00:00:01.000Z",
            s3Key: "k1",
          },
          {
            PK: "PHOTO#2",
            SK: "METADATA",
            eventId: "EVENT-1",
            guestKey: "guest-abc",
            nickname: "Alice",
            representativePhotoId: "PHOTO#1",
            status: "approved",
            confirmedAt: "2026-05-29T00:00:02.000Z",
            s3Key: "k2",
          },
          {
            PK: "PHOTO#3",
            SK: "METADATA",
            eventId: "EVENT-1",
            guestKey: "guest-def",
            nickname: "Bob",
            representativePhotoId: "PHOTO#3",
            status: "approved",
            confirmedAt: "2026-05-29T00:00:03.000Z",
            s3Key: "k3",
          },
        ],
      });

    const result = await handler({
      requestContext: { http: { method: "GET", path: "/wall/photos" } },
      queryStringParameters: { eventId: "EVENT-1" },
    });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.wallPolicy).toBe("approved_only");
    expect(body.photos).toHaveLength(2);
    expect(body.photos.map((photo: any) => photo.PK)).toEqual(["PHOTO#1", "PHOTO#3"]);
    expect(body.photos[0].presignedUrl).toBe("https://signed-wall-url");
  });

  test("falls back to normalized nickname when guestKey is missing", async () => {
    mockDdbSend
      .mockResolvedValueOnce({
        Item: { PK: "EVENT-1", SK: "METADATA", wallPolicy: "all_uploads" },
      })
      .mockResolvedValueOnce({
        Items: [
          {
            PK: "PHOTO#1",
            SK: "METADATA",
            eventId: "EVENT-1",
            nickname: " Alice ",
            representativePhotoId: "PHOTO#1",
            status: "pending",
            confirmedAt: "2026-05-29T00:00:01.000Z",
            s3Key: "k1",
          },
          {
            PK: "PHOTO#2",
            SK: "METADATA",
            eventId: "EVENT-1",
            nickname: "alice",
            representativePhotoId: "PHOTO#1",
            status: "approved",
            confirmedAt: "2026-05-29T00:00:02.000Z",
            s3Key: "k2",
          },
        ],
      });

    const result = await handler({
      requestContext: { http: { method: "GET", path: "/wall/photos" } },
      queryStringParameters: { eventId: "EVENT-1" },
    });

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.photos).toHaveLength(1);
    expect(body.photos[0].PK).toBe("PHOTO#1");
  });
});
