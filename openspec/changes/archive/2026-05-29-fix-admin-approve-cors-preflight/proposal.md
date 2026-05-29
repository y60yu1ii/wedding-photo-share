# Proposal: Fix Admin Approve Photo CORS Preflight Failure

## Why

Production admin review flow has two failures:

1. Cannot approve photos from browser because `PATCH /admin/photos/{photoId}` preflight is blocked by CORS policy.
2. Review grid does not show uploaded photos correctly because image URLs are not returned as expected.

## What

Apply a targeted hotfix to:

- align API Gateway CORS preflight methods with actual REST methods;
- restore admin photo payload image URL enrichment for correct rendering.

## Scope

- API Gateway `HttpApi` CORS preflight method list.
- Admin approve flow (`PATCH /admin/photos/{photoId}`) browser compatibility.
- Admin photo review image rendering correctness.
- Production verification for cross-origin admin operations.

## Out of Scope

- Auth redesign
- Route contract redesign
- UI redesign
