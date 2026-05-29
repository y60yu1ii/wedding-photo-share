# Tasks: fix-admin-approve-cors-preflight

## Investigation

- [x] Confirm CORS preflight failure for `PATCH /admin/photos/{photoId}` in browser.
- [x] Confirm deployed admin photo list payload lacks `presignedUrl`.
- [x] Confirm frontend fallback path currently uses placeholder image source.

## Fixes

- [x] Add `PATCH` to `HttpApi` `corsPreflight.allowMethods` (and `PUT` for consistency).
- [x] Ensure `listEventPhotos` in deployed admin artifact includes `presignedUrl`.
- [x] Rebuild `lambda-pkgs/admin` from source with bundle command.
- [x] Deploy stack with updated API and Lambda assets.
- [x] Add requiresReview dynamic toggle configuration to create, list, and update endpoints.
- [x] Add broad image format (image/*) support in upload presigning.
- [x] Support Unicode multilingual guest nicknames while filtering HTML tags.

## Verification

- [x] Browser approve action succeeds without CORS errors.
- [x] `PATCH /admin/photos/{photoId}` returns success.
- [x] Admin review thumbnails display uploaded photos correctly.
- [x] Approved photo appears in approved section and slideshow API list.
- [x] Jest test suites for upload, admin, myguest, and websocket lambdas pass completely.
