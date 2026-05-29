# Design Document: Wedding Management and Upload Improvements

## Overview
This document specifies the design for solving three critical issues in the wedding photo share application:
1. **Ghost Weddings (Deletion Issue):** Deleted weddings reappear on page refresh because the previous soft-delete mechanism left stale records and lacked robust list filtering. We will switch to a **Physical Cascade Delete** model.
2. **Review Bypass and Admin Photo Previews:** Uploaded photos fallback to placeholder seed images on the admin dashboard because `AdminLambda` lacks S3 read permissions and does not generate presigned URLs. Additionally, guest uploads are hardcoded to `"pending"` status. We will introduce a dynamic toggle `requiresReview` (stored per-wedding) to support bypassing reviews and generate presigned S3 URLs inside the `AdminLambda`.
3. **MIME Type Restriction and Upload Failures:** Uploading JPEG, WEBP, HEIC, and other formats fails with `Unsupported file type` because the upload lambda strictly validates content types against a small predefined list. Additionally, production users encounter "Failed to get upload link" (HTTP 403) because the CloudFront API distribution strips query strings (`?key=...`) and auth headers. We will broaden the upload MIME type validation to accept `image/*` and configure the CloudFront distribution to disable caching and forward all viewer query parameters and headers.

---

## 1. Problem Statements & Root Causes

### 1.1 Stale/Ghost Weddings
*   **Root Cause:**
    *   `deleteEvent()` in `lambda/admin/index.ts` only sets `status = "archived"` in the database.
    *   Stale keys are left in `KEYPAIRS_TABLE` with only a `_deleted: true` marker, which is ignored by the validator.
    *   Older weddings created before the `status` attribute was introduced are filtered out by `#s <> :archived` because the attribute doesn't exist, which causes inconsistency.
*   **Solution:** Switch to **Physical Cascade Delete**. Physically delete the event metadata, all keypairs, all DynamoDB photo metadata, and all S3 image files associated with the wedding.

### 1.2 Invisible Admin Photos and Mandatory Review
*   **Root Causes:**
    *   `lambda/admin/index.ts` does not instantiate S3Client and does not generate `presignedUrl` for photo items. The frontend falls back to Picsum seed images.
    *   `AdminLambda` lacks S3 read permission in `lib/wedding-photo-stack.ts`.
    *   `UploadLambda` lacks the `EVENTS_TABLE` name as an environment variable and cannot inspect if the event requires review. It always hardcodes confirmed uploads to `"pending"`.
*   **Solutions:**
    *   Grant S3 read access to `AdminLambda` and supply `PHOTO_BUCKET` in its environment.
    *   Generate S3 presigned GET URLs inside the `AdminLambda` for all event photos.
    *   Introduce `requiresReview: boolean` (default to `true`) in `EVENTS_TABLE` metadata. Update `UploadLambda` to fetch the event metadata and set `status = "approved"` if `requiresReview` is `false`.

### 1.3 Restricted Upload MIME Types & Production 403s
*   **Root Causes:**
    *   `lambda/upload/index.ts` restricts `contentType` to exactly four keys in `MAGIC_BYTES`. Any browser sending `image/jpg` or other MIME types is rejected.
    *   `ApiCloudFront` CloudFront distribution in CDK has no cache policy or origin request policy. Thus, CloudFront strips the `?key=...` query string from incoming guest upload requests and the `Authorization` header from admin requests.
*   **Solutions:**
    *   Change upload lambda type verification to accept any content type matching `/^image\//i`.
    *   Expand `MAGIC_BYTES` to include common extensions like `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.heic`, `.heif`, `.bmp`, `.tiff`.
    *   Add `cachePolicy: CachePolicy.CACHING_DISABLED` and `originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER` to the `ApiCloudFront` CloudFront distribution default behavior in `lib/wedding-photo-stack.ts`.

---

## 2. Proposed Changes & Architecture

```mermaid
graph TD
    Client[Browser Frontend] -->|api.fishare.de| CF[CloudFront Dist]
    CF -->|Forward Headers & Query Params| APIGW[API Gateway]
    APIGW -->|DELETE /admin/events/{id}| AdminLambda[Admin Lambda]
    APIGW -->|POST /upload/presign| UploadLambda[Upload Lambda]
    AdminLambda -->|Delete Metadata| DDB_Events[(DynamoDB Events)]
    AdminLambda -->|Delete Keypairs| DDB_Keys[(DynamoDB Keypairs)]
    AdminLambda -->|Delete Photos| DDB_Photos[(DynamoDB Photos)]
    AdminLambda -->|Delete S3 Objects| S3Bucket[(S3 Photo Bucket)]
    AdminLambda -->|Generate Presigned GET| Client
    UploadLambda -->|Read requiresReview| DDB_Events
```

### 2.1 Database Schema Additions
*   **`EVENTS_TABLE` Metadata Item:**
    *   Add optional `requiresReview` (Boolean) attribute. If missing/undefined, defaults to `true` (safe fallback).

### 2.2 API Changes
*   **`PATCH /admin/events/{eventId}`** (New / handled by ANY handler on Event Route):
    *   Accepts `{ name?: string, date?: string, requiresReview?: boolean }`.
    *   Updates the metadata item in `EVENTS_TABLE`.
*   **`POST /admin/events`**:
    *   Accepts `requiresReview` parameter in request body, defaulting to `true` if omitted.

### 2.3 CloudFront/CDK Updates
*   **`lib/wedding-photo-stack.ts`**:
    *   Import `CachePolicy` and `OriginRequestPolicy` from `aws-cdk-lib/aws-cloudfront`.
    *   Configure `ApiCloudFront` Default Behavior:
        ```typescript
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        ```
    *   Grant S3 read access to `AdminLambda`:
        ```typescript
        this.photoBucket.grantRead(this.adminLambda);
        ```
    *   Provide `PHOTO_BUCKET` environment variable to `AdminLambda`.
    *   Provide `EVENTS_TABLE` environment variable to `UploadLambda`.

---

## 3. Verification & Testing Plan

### 3.1 Unit Testing
*   Add unit tests in `test/lambda/admin.test.ts` to verify:
    *   Physical cascade deletion deletes from `EVENTS_TABLE`, `KEYPAIRS_TABLE`, `PHOTOS_TABLE` and calls S3 delete commands.
    *   Event update (`PATCH`) successfully modifies `requiresReview` and metadata fields.
    *   `GET /admin/events/{eventId}/photos` returns presigned URLs correctly.
*   Add unit tests in `test/lambda/upload.test.ts` to verify:
    *   MIME types (like `image/jpg`, `image/gif`) succeed in `presignUpload`.
    *   Upload confirmation automatically sets `status = "approved"` when the wedding has `requiresReview = false`.

### 3.2 Integration Testing
*   Validate CDK synthesize and compile: `npm run build && npm run synth`.
*   Run full test suite: `npm run test`.
