# Design: Admin Review Flow Recovery (CORS + Image Rendering)

## Goals

1. Restore admin approve action from browser.
2. Ensure review images render real uploaded photos, not broken placeholders.
3. Keep fix minimal and deployment-safe.

## Problem Breakdown

### A) Approve action blocked by CORS preflight
- Frontend approve uses `PATCH /admin/photos/{photoId}`.
- Lambda route supports `PATCH`.
- API Gateway `corsPreflight.allowMethods` excludes `PATCH`.
- Browser blocks request before Lambda is invoked.

### B) Review image display incorrect
- Frontend expects `photo.presignedUrl` and falls back to `picsum.photos`.
- Deployed admin artifact currently returns raw photo rows without presigned URLs.
- Fallback placeholder is not reliable for production review usage.

## Chosen Fix

### 1) CORS method alignment
- Add `PATCH` (and `PUT` for parity) to `HttpApi` CORS preflight `allowMethods`.

### 2) Admin photo list response alignment
- Ensure deployed `admin` artifact uses logic that enriches each photo with `presignedUrl`.
- Keep existing table contract; only adjust response shaping for admin review page.

### 3) Deployment artifact consistency
- Rebuild `lambda-pkgs/admin` from `lambda/admin/index.ts` using project bundling command.
- Deploy stack after package rebuild.

## Verification

1. Browser console no longer shows CORS preflight failure for approve PATCH.
2. Approve click returns 200 and photo status transitions to approved.
3. `GET /admin/events/{eventId}/photos` payload includes `presignedUrl` for photos with `s3Key`.
4. Admin review grid renders actual uploaded images.
