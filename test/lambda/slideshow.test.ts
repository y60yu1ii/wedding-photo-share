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
  QueryCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
  GetCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
}));

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  GetObjectCommand: jest.fn().mockImplementation((i: any) => ({ input: i })),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
}));

import { handler } from "../../lambda/slideshow/index";

beforeEach(() => {
  jest.clearAllMocks();
  process.env.PHOTOS_TABLE = "photos";
  process.env.PHOTO_BUCKET = "bucket";
  mockGetSignedUrl.mockResolvedValue("https://signed-photo-url");
});

describe("GET /slideshow/photos", () => {
  test("returns approved photos for event", async () => {
    mockDdbSend.mockResolvedValueOnce({
      Items: [{ PK: "PHOTO#1", status: "approved", eventId: "EVENT-1" }],
    });

    const event = {
      requestContext: { http: { method: "GET", path: "/slideshow/photos" } },
      queryStringParameters: { eventId: "EVENT-1" },
    };
    const result = await handler(event);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.photos).toHaveLength(1);

    const call = mockDdbSend.mock.calls[0][0];
    expect(call.input.KeyConditionExpression).toContain("#s = :approved");
    expect(call.input.ExpressionAttributeValues[":approved"]).toBe("approved");
  });
});

describe("GET /slideshow/presign/:photoId", () => {
  test("returns presigned URL for existing photo", async () => {
    mockDdbSend.mockResolvedValueOnce({
      Item: { PK: "PHOTO#1", SK: "METADATA", s3Key: "prod/EVENT-1/PHOTO#1.jpg" },
    });

    const event = {
      requestContext: { http: { method: "GET", path: "/slideshow/presign/PHOTO#1" } },
    };
    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.presignedUrl).toBe("https://signed-photo-url");
  });
});

describe("GET /slideshow/template", () => {
  test("returns published template for event", async () => {
    mockDdbSend.mockResolvedValueOnce({
      Item: {
        PK: "EVENT-1",
        SK: "METADATA",
        template: {
          canvas: { width: 1920, height: 1080 },
          playback: { transition: "slide", intervalSeconds: 8 },
          layers: [],
          published: true,
        },
      },
    });

    const event = {
      requestContext: { http: { method: "GET", path: "/slideshow/template" } },
      queryStringParameters: { eventId: "EVENT-1" },
    };

    const result = await handler(event);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.template.playback.transition).toBe("slide");
    expect(body.template.playback.intervalSeconds).toBe(8);
  });
});
