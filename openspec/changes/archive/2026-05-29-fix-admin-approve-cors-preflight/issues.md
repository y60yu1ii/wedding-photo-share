# Issues: fix-admin-approve-cors-preflight

## Confirmed Symptoms

1. Admin review page shows pending photos but clicking approve fails.
2. Browser console reports:
   - `blocked by CORS policy`
   - preflight failure on `PATCH /admin/photos/{photoId}`
3. Frontend receives `TypeError: Failed to fetch` for approve action.
4. Pending photo cards show broken/incorrect images instead of actual uploaded content.

## Root Cause

1. `HttpApi` CORS preflight configuration does not include `PATCH` in `allowMethods`,
   while frontend and backend both correctly use `PATCH` for approve.
2. Deployed admin artifact photo list response does not consistently include `presignedUrl`,
   so frontend falls back to placeholder source and image rendering is unreliable.

## Risks

- Any cross-origin `PATCH` call under same API will continue failing until CORS methods are corrected.
- Incident may appear intermittent due to browser preflight caching behavior.
