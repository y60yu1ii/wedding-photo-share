# Design: Core Flow Recovery Alignment

## Goal

Recover functional parity with OpenSpec by aligning contracts and storage/query strategy before adding new behavior.

## Canonical Contracts

### Upload
- `POST /upload/presign?key=UPLOAD_KEY`
- `POST /upload/confirm?key=UPLOAD_KEY`
- Confirm updates metadata and triggers broadcast.

### Slideshow
- Reads only `approved` photos (or update spec+code together if status model changes).
- Requires explicit decision on approval gate:
  - Option A (recommended): keep `pending -> approved` gate
  - Option B: auto-approve on confirm

### MyGuest
- `GET /myguest/photos?eventId={id}&nickname={name}`
- `DELETE /myguest/photos/{photoId}` with nickname verification

### WebSocket Connections
- Use event-scoped partition shape:
  - `PK=EVENT-{eventId}`
  - `SK=CONN#{connectionId}`
- Broadcast uses Query on event partition (no table Scan).

## Data Access Alignment

- Photos read paths must use:
  - `eventId-status-index` for slideshow/admin status filters
  - `eventId-nickname-index` for myguest nickname lookup
- Avoid PK patterns that do not match persisted item layout.

## Verification Strategy

1. Restore a valid default test command.
2. Run unit tests for changed handlers.
3. Add/repair one end-to-end regression path:
   - upload -> confirm -> approve -> slideshow visible
4. Add myguest regression:
   - lookup by nickname -> delete with nickname match
