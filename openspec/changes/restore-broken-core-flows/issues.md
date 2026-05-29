# Open Issues — restore-broken-core-flows

## 1. Upload confirm key contract mismatch

- Frontend `upload.confirm` does not pass upload key.
- Backend `POST /upload/confirm` requires upload key validation.
- Result: confirm frequently fails with HTTP 403.

## 2. Photo status mismatch between upload and slideshow

- Upload confirm sets `status = active`.
- Slideshow query filters `status = approved`.
- Result: uploaded photos do not appear in slideshow unless separately patched.

## 3. MyGuest contract mismatch (nickname vs keyHash)

- OpenSpec requires `eventId + nickname`.
- Current myguest Lambda expects `keyHash`.
- Frontend calls myguest APIs without keyHash.
- Result: myguest search/delete paths are broken.

## 4. WebSocket connection data model mismatch

- Websocket connect stores connection items by `PK=CONN#...`.
- Upload broadcast queries connections by `PK=EVENT-{eventId}`.
- Result: broadcast cannot find active event connections.

## 5. Admin event photo query pattern mismatch

- Admin photo list queries by `PK=eventId`.
- Photo records are stored with `PK=photoId`, indexed by GSIs.
- Result: admin event photo list can be empty or inconsistent.

## 6. Verification entrypoint is broken

- `npm test` points to missing script (`scripts/test-api.js`).
- Unit test command currently depends on watchman behavior that fails in this environment.
- Result: regression confidence is low and workflow is fragile.
