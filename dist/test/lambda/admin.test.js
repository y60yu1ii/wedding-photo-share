"use strict";
/**
 * Unit tests for admin Lambda handler
 * Uses jest.mock modules and globalThis to share mock refs across jest hoisting boundary.
 */
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const mockSend = jest.fn();
const mockSecretsSend = jest.fn();
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
        jwtVerify: jest.fn().mockResolvedValue({
            payload: { sub: "admin", role: "admin", exp: Math.floor(Date.now() / 1000) + 3600 },
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
const index_1 = require("../../lambda/admin/index");
beforeEach(() => {
    jest.clearAllMocks();
    mockSecretsSend.mockResolvedValue({ SecretString: "jwt-secret-value" });
    process.env.EVENTS_TABLE = "events-table";
    process.env.KEYPAlRS_TABLE = "keypairs-table";
    process.env.PHOTOS_TABLE = "photos-table";
    process.env.JWT_SECRET_NAME = "jwt-secret-name";
    process.env.STAGE = "prod";
    process.env.ADMIN_USER = "admin";
    process.env.ADMIN_PASS = "wedding2026";
});
function authHeaders() {
    return { authorization: "Bearer mock.jwt.token" };
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
        expect(body.token).toBe("mock.jwt.token");
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