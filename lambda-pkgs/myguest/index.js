"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const dynamo = lib_dynamodb_1.DynamoDBDocumentClient.from(new client_dynamodb_1.DynamoDBClient({}));
const s3 = new client_s3_1.S3Client({});
// GET /myguest/photos?eventId=xxx&nickname=yyy
async function getMyPhotos(eventId, nickname) {
    const resp = await dynamo.send(new lib_dynamodb_1.QueryCommand({
        TableName: process.env.PHOTOS_TABLE,
        IndexName: "eventId-nickname-index",
        KeyConditionExpression: "eventId = :eid AND nickname = :nick",
        ExpressionAttributeValues: { ":eid": eventId, ":nick": nickname },
    }));
    return resp.Items ?? [];
}
// Presign photo for display
async function presignPhoto(s3Key) {
    const cmd = new client_s3_1.GetObjectCommand({
        Bucket: process.env.PHOTO_BUCKET,
        Key: s3Key,
    });
    return (0, s3_request_presigner_1.getSignedUrl)(s3, cmd, { expiresIn: 900 });
}
// DELETE /myguest/photos/{photoId}
async function deletePhoto(photoId, eventId, nickname) {
    // Get photo to verify ownership
    const photo = await dynamo.send(new lib_dynamodb_1.GetCommand({
        TableName: process.env.PHOTOS_TABLE,
        Key: { PK: photoId, SK: "METADATA" },
    }));
    if (!photo.Item) {
        return { statusCode: 404, body: JSON.stringify({ error: "Photo not found" }) };
    }
    if (photo.Item.eventId !== eventId || photo.Item.nickname !== nickname) {
        return { statusCode: 403, body: JSON.stringify({ error: "Nickname mismatch" }) };
    }
    // Delete from S3
    await s3.send(new client_s3_1.DeleteObjectCommand({
        Bucket: process.env.PHOTO_BUCKET,
        Key: photo.Item.s3Key,
    }));
    // Delete from DynamoDB
    await dynamo.send(new lib_dynamodb_1.DeleteCommand({
        TableName: process.env.PHOTOS_TABLE,
        Key: { PK: photoId, SK: "METADATA" },
    }));
    return { statusCode: 200, body: JSON.stringify({ photoId }) };
}
async function handler(event) {
    const method = event.requestContext?.http?.method ?? event.httpMethod ?? "GET";
    const path = event.requestContext?.http?.path ?? event.path ?? "";
    const query = event.queryStringParameters ?? {};
    try {
        // GET /myguest/photos?eventId=xxx&nickname=yyy
        if (path === "/myguest/photos" && method === "GET") {
            const { eventId, nickname } = query;
            if (!eventId || !nickname) {
                return { statusCode: 400, body: JSON.stringify({ error: "missing params" }) };
            }
            const photos = await getMyPhotos(eventId, nickname);
            // Attach presigned URLs
            const withUrls = await Promise.all(photos.map(async (p) => ({
                PK: p.PK,
                nickname: p.nickname,
                status: p.status,
                presignedUrl: p.s3Key ? await presignPhoto(p.s3Key) : undefined,
            })));
            return { statusCode: 200, body: JSON.stringify({ photos: withUrls }) };
        }
        // DELETE /myguest/photos/{photoId}
        const deleteMatch = path.match(/^\/myguest\/photos\/(.+)$/);
        if (deleteMatch && method === "DELETE") {
            const photoId = deleteMatch[1];
            const body = JSON.parse(event.body ?? "{}");
            const { eventId, nickname } = body;
            if (!eventId || !nickname) {
                return { statusCode: 400, body: JSON.stringify({ error: "missing params" }) };
            }
            return await deletePhoto(photoId, eventId, nickname);
        }
        return { statusCode: 404, body: JSON.stringify({ error: "Not found" }) };
    }
    catch (err) {
        console.error("MyGuest Lambda error:", err);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal error" }) };
    }
}
//# sourceMappingURL=index.js.map