"use strict";
/**
 * Unit tests for admin Lambda handler
 * Uses jest.mock modules and globalThis to share mock refs across jest hoisting boundary.
 */
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const mockSend = jest.fn();
const mockSecretsSend = jest.fn();
const mockS3Send = jest.fn();
const mockWsSend = jest.fn();
jest.mock("@aws-sdk/client-apigatewaymanagementapi", () => ({
    ApiGatewayManagementApiClient: jest.fn().mockImplementation(() => ({ send: mockWsSend })),
    PostToConnectionCommand: jest.fn().mockImplementation((i) => ({ input: i })),
}));
jest.mock("@aws-sdk/client-s3", () => ({
    S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
    GetObjectCommand: jest.fn().mockImplementation((i) => ({ input: i })),
    DeleteObjectCommand: jest.fn().mockImplementation((i) => ({ input: i })),
    DeleteObjectsCommand: jest.fn().mockImplementation((i) => ({ input: i })),
}));
jest.mock("@aws-sdk/s3-request-presigner", () => ({
    getSignedUrl: jest.fn().mockResolvedValue("https://mock-presigned-url"),
}));
jest.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: {
        from: jest.fn().mockReturnValue({ send: mockSend }),
    },
    PutCommand: jest.fn().mockImplementation((i) => ({ input: i })),
    GetCommand: jest.fn().mockImplementation((i) => ({ input: i })),
    QueryCommand: jest.fn().mockImplementation((i) => ({ input: i })),
    UpdateCommand: jest.fn().mockImplementation((i) => ({ input: i })),
    ScanCommand: jest.fn().mockImplementation((i) => ({ input: i })),
    DeleteCommand: jest.fn().mockImplementation((i) => ({ input: i })),
}));
jest.mock("@aws-sdk/client-secrets-manager", () => ({
    SecretsManagerClient: jest.fn().mockImplementation(() => ({ send: mockSecretsSend })),
    GetSecretValueCommand: jest.fn().mockImplementation((i) => ({ input: i })),
}));
jest.mock("jose", () => {
    const secret = new TextEncoder().encode("test-secret");
    return {
        SignJWT: jest.fn().mockImplementation(() => ({
            setProtectedHeader: jest.fn().mockReturnThis(),
            setIssuedAt: jest.fn().mockReturnThis(),
            setExpirationTime: jest.fn().mockReturnThis(),
            sign: jest.fn().mockResolvedValue("mock.jwt.token"),
        })),
        jwtVerify: jest.fn().mockImplementation((token) => {
            // Accept any token that looks like JWT (3 base64url segments)
            if (token.split(".").length === 3) {
                return Promise.resolve({
                    payload: { sub: "admin", role: "admin", exp: Math.floor(Date.now() / 1000) + 3600 },
                });
            }
            return Promise.reject(new Error("Invalid token"));
        }),
        decodeJwt: jest.fn().mockReturnValue({ sub: "admin", role: "admin" }),
        createRemoteJWKSet: jest.fn(),
        FlattenedJWS: { createSignature: jest.fn(), verifySignature: jest.fn() },
        flattenedJwsSign: jest.fn(),
        flattenedJwsVerify: jest.fn(),
        CompactSign: jest.fn(),
        CompactVerify: jest.fn(),
        compactSign: jest.fn(),
        compactVerify: jest.fn(),
    };
});
// Stash mocks on globalThis so imports below can reference them after hoisting
globalThis.__mockSend = mockSend;
globalThis.__mockSecretsSend = mockSecretsSend;
globalThis.__mockS3Send = mockS3Send;
const index_1 = require("../../lambda/admin/index");
beforeEach(() => {
    jest.clearAllMocks();
    mockSecretsSend.mockResolvedValue({ SecretString: "jwt-secret-value" });
    process.env.EVENTS_TABLE = "events-table";
    process.env.KEYPAIRS_TABLE = "keypairs-table";
    process.env.PHOTOS_TABLE = "photos-table";
    process.env.CONNECTIONS_TABLE = "connections-table";
    process.env.PHOTO_BUCKET = "photo-bucket";
    process.env.JWT_SECRET_NAME = "jwt-secret-name";
    process.env.STAGE = "prod";
    process.env.ADMIN_USER = "admin";
    process.env.ADMIN_PASS = "wedding2026";
});
// Real-looking JWT (3 base64url segments), exp = 2090 (far future)
const MOCK_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsImV4cCI6MTg5MzQ1NjAwMH0.test";
function authHeaders() {
    return { authorization: `Bearer ${MOCK_TOKEN}` };
}
describe("POST /admin/login", () => {
    test("returns 200 with token for valid credentials", async () => {
        const event = {
            requestContext: { http: { method: "POST", path: "/admin/login" } },
            body: JSON.stringify({ username: "admin", password: "wedding2026" }),
        };
        const result = await (0, index_1.handler)(event);
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.token).toBeTruthy();
        expect(body.token.split(".")).toHaveLength(3); // real JWT format
    });
    test("returns 401 for invalid password", async () => {
        const event = {
            requestContext: { http: { method: "POST", path: "/admin/login" } },
            body: JSON.stringify({ username: "admin", password: "wrong" }),
        };
        const result = await (0, index_1.handler)(event);
        expect(result.statusCode).toBe(401);
    });
    test("returns 400 for missing credentials", async () => {
        const event = {
            requestContext: { http: { method: "POST", path: "/admin/login" } },
            body: JSON.stringify({ username: "admin" }),
        };
        const result = await (0, index_1.handler)(event);
        expect(result.statusCode).toBe(400);
    });
});
describe("Protected routes without auth", () => {
    test("GET /admin/events returns 401 without token", async () => {
        const event = {
            requestContext: { http: { method: "GET", path: "/admin/events" } },
        };
        const result = await (0, index_1.handler)(event);
        expect(result.statusCode).toBe(401);
    });
    test("POST /admin/events returns 401 without token", async () => {
        const event = {
            requestContext: { http: { method: "POST", path: "/admin/events" } },
            body: JSON.stringify({ name: "Test", date: "2026-06-01" }),
        };
        const result = await (0, index_1.handler)(event);
        expect(result.statusCode).toBe(401);
    });
});
describe("POST /admin/events (authenticated)", () => {
    beforeEach(() => {
        mockSend.mockResolvedValue({ Items: [] });
    });
    test("returns 201 with uploadKey and showKey", async () => {
        const event = {
            requestContext: { http: { method: "POST", path: "/admin/events" } },
            headers: authHeaders(),
            body: JSON.stringify({ name: "Test Wedding", date: "2026-06-01" }),
        };
        const result = await (0, index_1.handler)(event);
        expect(result.statusCode).toBe(201);
        const body = JSON.parse(result.body);
        expect(body.uploadKey).toBeDefined();
        expect(body.showKey).toBeDefined();
        expect(body.uploadKey).not.toBe(body.showKey);
    });
    test("keys are 16 uppercase alphanumeric characters", async () => {
        const event = {
            requestContext: { http: { method: "POST", path: "/admin/events" } },
            headers: authHeaders(),
            body: JSON.stringify({ name: "Test Wedding", date: "2026-06-01" }),
        };
        const result = await (0, index_1.handler)(event);
        const body = JSON.parse(result.body);
        const keyRegex = /^[A-Z0-9]{16}$/;
        expect(body.uploadKey).toMatch(keyRegex);
        expect(body.showKey).toMatch(keyRegex);
    });
    test("returns 400 when name is missing", async () => {
        const event = {
            requestContext: { http: { method: "POST", path: "/admin/events" } },
            headers: authHeaders(),
            body: JSON.stringify({ date: "2026-06-01" }),
        };
        const result = await (0, index_1.handler)(event);
        expect(result.statusCode).toBe(400);
    });
    test("writes event and two keypair records to DynamoDB", async () => {
        const event = {
            requestContext: { http: { method: "POST", path: "/admin/events" } },
            headers: authHeaders(),
            body: JSON.stringify({ name: "Test Wedding", date: "2026-06-01" }),
        };
        await (0, index_1.handler)(event);
        // Should have been called 3 times: 1 event + 2 keypairs
        expect(mockSend).toHaveBeenCalledTimes(3);
    });
    describe("DELETE /admin/events/{eventId} (authenticated cascade)", () => {
        test("performs physical cascade deletion", async () => {
            // 1. Scan keypairs returns 1 item
            // 2. Scan photos returns 1 item
            mockSend
                .mockResolvedValueOnce({ Items: [{ PK: "KEY#1", SK: "METADATA", eventId: "EVENT-1" }] }) // keypairs scan
                .mockResolvedValueOnce({ Items: [{ PK: "PHOTO#1", SK: "METADATA", eventId: "EVENT-1", s3Key: "prod/EVENT-1/PHOTO#1.jpg" }] }) // photos scan
                .mockResolvedValueOnce({}) // delete event metadata
                .mockResolvedValueOnce({}) // delete keypairs item
                .mockResolvedValueOnce({}); // delete photos item
            mockS3Send.mockResolvedValue({}); // S3 delete objects
            const event = {
                requestContext: { http: { method: "DELETE", path: "/admin/events/EVENT-1" } },
                headers: authHeaders(),
            };
            const result = await (0, index_1.handler)(event);
            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body).success).toBe(true);
            // Verify DynamoDB commands were sent (2 scans + 3 deletes = 5 times)
            expect(mockSend).toHaveBeenCalledTimes(5);
            // Verify S3 delete was called
            expect(mockS3Send).toHaveBeenCalled();
        });
    });
    describe("GET /admin/events/{eventId}/photos (authenticated)", () => {
        test("returns photos with S3 presigned URLs", async () => {
            mockSend.mockResolvedValueOnce({
                Items: [
                    { PK: "PHOTO#1", SK: "METADATA", eventId: "EVENT-1", s3Key: "prod/EVENT-1/PHOTO#1.jpg", nickname: "Alice", status: "pending" }
                ]
            });
            const event = {
                requestContext: { http: { method: "GET", path: "/admin/events/EVENT-1/photos" } },
                headers: authHeaders(),
            };
            const result = await (0, index_1.handler)(event);
            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.photos).toHaveLength(1);
            expect(body.photos[0].presignedUrl).toBe("https://mock-presigned-url");
        });
    });
    describe("PATCH /admin/events/{eventId} (authenticated)", () => {
        test("successfully updates event properties including requiresReview", async () => {
            mockSend.mockResolvedValueOnce({}); // UpdateCommand response
            const event = {
                requestContext: { http: { method: "PATCH", path: "/admin/events/EVENT-1" } },
                headers: authHeaders(),
                body: JSON.stringify({ name: "Updated Name", requiresReview: false }),
            };
            const result = await (0, index_1.handler)(event);
            expect(result.statusCode).toBe(200);
            const body = JSON.parse(result.body);
            expect(body.success).toBe(true);
            expect(mockSend).toHaveBeenCalled();
        });
    });
    describe("PATCH /admin/photos/{photoId} (authenticated)", () => {
        test("approves photo and broadcasts via WebSockets", async () => {
            mockSend
                .mockResolvedValueOnce({
                Attributes: {
                    PK: "PHOTO#1",
                    SK: "METADATA",
                    eventId: "EVENT-1",
                    s3Key: "prod/EVENT-1/PHOTO#1.jpg",
                    nickname: "Alice",
                    greeting: "Happy Wedding!"
                }
            })
                .mockResolvedValueOnce({
                Items: [
                    { connectionId: "conn-1", wsEndpoint: "https://ws-endpoint" }
                ]
            });
            mockWsSend.mockResolvedValue({});
            const event = {
                requestContext: { http: { method: "PATCH", path: "/admin/photos/PHOTO#1" } },
                headers: authHeaders(),
            };
            const result = await (0, index_1.handler)(event);
            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body).status).toBe("approved");
            // Verify WebSocket was invoked
            expect(mockWsSend).toHaveBeenCalled();
        });
    });
    describe("DELETE /admin/photos/{photoId} (authenticated)", () => {
        test("deletes photo from S3 and database and broadcasts deletion", async () => {
            mockSend
                .mockResolvedValueOnce({
                Item: {
                    PK: "PHOTO#1",
                    SK: "METADATA",
                    eventId: "EVENT-1",
                    s3Key: "prod/EVENT-1/PHOTO#1.jpg"
                }
            }) // GetCommand
                .mockResolvedValueOnce({}) // DeleteCommand
                .mockResolvedValueOnce({
                Items: [
                    { connectionId: "conn-1", wsEndpoint: "https://ws-endpoint" }
                ]
            }); // QueryCommand (connections)
            mockS3Send.mockResolvedValue({});
            mockWsSend.mockResolvedValue({});
            const event = {
                requestContext: { http: { method: "DELETE", path: "/admin/photos/PHOTO#1" } },
                headers: authHeaders(),
            };
            const result = await (0, index_1.handler)(event);
            expect(result.statusCode).toBe(200);
            expect(JSON.parse(result.body).success).toBe(true);
            // Verify S3 delete was called
            expect(mockS3Send).toHaveBeenCalled();
            // Verify WebSocket broadcast was sent
            expect(mockWsSend).toHaveBeenCalled();
        });
        test("returns 404 if photo not found", async () => {
            mockSend.mockResolvedValueOnce({ Item: null });
            const event = {
                requestContext: { http: { method: "DELETE", path: "/admin/photos/NON-EXISTENT" } },
                headers: authHeaders(),
            };
            const result = await (0, index_1.handler)(event);
            expect(result.statusCode).toBe(404);
        });
    });
});
describe("Unknown routes", () => {
    test("returns 404 for unknown path", async () => {
        const event = {
            requestContext: { http: { method: "GET", path: "/admin/unknown" } },
            headers: authHeaders(),
        };
        const result = await (0, index_1.handler)(event);
        expect(result.statusCode).toBe(404);
    });
});
//# sourceMappingURL=admin.test.js.map