# Design: Wedding Photo Share System

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  AWS Amplify (React SPA)                                   │
│  ┌─────────┐  ┌─────────────┐  ┌─────────┐  ┌──────────┐ │
│  │ /admin │  │ /upload     │  │/slideshow│  │ /myguest │ │
│  │ ?key=X  │  │ ?key=UPLOAD_KEY│ │?key=SHOW_KEY│ │ (nickname)│ │
│  └────┬────┘  └──────┬──────┘  └────┬────┘  └────┬─────┘ │
└───────┼───────────────┼──────────────┼───────────┼───────┘
        │               │              │           │
        │  REST API    │   WebSocket  │           │
        ▼              ▼              ▼           ▼
┌─────────────────────────────────────────────────────────────┐
│  API Gateway                                               │
│  ┌──────────────────┐  ┌───────────────────────────────┐  │
│  │ REST API         │  │ WebSocket API                 │  │
│  │ /admin/*         │  │ /slideshow (connect w/ SHOW_KEY)│  │
│  │ /upload/*        │  └───────────────────────────────┘  │
│  │ /slideshow/*     │                                     │
│  │ /myguest/*       │                                     │
│  └────────┬─────────┘                                     │
└───────────┼───────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│  Go Lambda Functions                                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │
│  │ admin-*     │ │ upload-*    │ │ websocket-*         │  │
│  │ - list events│ │ - presign S3│ │ - connect          │  │
│  │ - create key│ │ - getmeta   │ │ - disconnect       │  │
│  │ - delete key│ │ - putmeta   │ │ - broadcast        │  │
│  │ - auth      │ │ - delmeta   │ │                    │  │
│  └─────────────┘ └─────────────┘ └─────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌───────────┐  ┌────────────┐  ┌──────────────┐
    │ DynamoDB  │  │    S3      │  │ WebSocket    │
    │ events    │  │ wedding-   │  │ Connections  │
    │ keypairs  │  │ photos-*   │  │ (in DynamoDB)│
    │ photos    │  │            │  │              │
    └───────────┘  └────────────┘  └──────────────┘
```

## Pages

### 1. Admin Page (`/admin`)
- **Auth**: email + bcrypt-hashed password, session via JWT (1-day expiry)
- **Event management**: create/edit/delete events
- **Keypair management per event**:
  - `UPLOAD_KEY` (auto-generated, 16-char alphanumeric)
  - `SHOW_KEY` (auto-generated, 16-char alphanumeric)
  - Keys stored as SHA-256 hash in DynamoDB keypairs table
- **Event list**: name, date, upload key, show key, photo count, status (active/archived)
- **Manual photo deletion**: admin can delete any photo in any event

### 2. Upload Page (`/upload?key=UPLOAD_KEY`)
- Validate `UPLOAD_KEY` hash against DynamoDB keypairs table
- If invalid → 403 "Invalid or expired key"
- Form fields: nickname (required, 2-20 chars), photos (1-10 files)
- **S3 upload flow**:
  1. Client requests presigned PUT URL from `/upload/presign`
  2. Lambda generates presigned S3 PUT URL (5-min expiry)
  3. Client uploads directly to S3 via presigned URL
  4. Client calls `/upload/confirm` with S3 key + metadata → Lambda writes to DynamoDB photos table
- Accepted formats: JPEG, PNG, HEIC, WebP — max 20MB each
- On success: show "Manage link" (URL with guest token stored in DynamoDB, 90-day expiry)
- **Concurrency**: Lambda writes photo metadata with conditional write (fail on duplicate S3 key)

### 3. Slideshow Page (`/slideshow?key=SHOW_KEY`)
- Validate `SHOW_KEY` hash → if invalid 403
- Establish WebSocket connection (wss://.../slideshow?key=SHOW_KEY)
- **WebSocket lifecycle**:
  - `connect`: Lambda stores connectionId in DynamoDB (connections table, PK=eventId)
  - `broadcast`: new photo uploaded → Lambda pushes to all connections for that eventId
  - `disconnect`: Lambda removes connectionId from DynamoDB
- **Slideshow UI**:
  - Full-screen photo display, object-fit: cover
  - CSS fade-in transition (0.5s opacity)
  - Auto-advance: 5 seconds per slide, with fade transition
  - New photos prepended to front of queue
- **Staff controls** (keyboard + hidden UI panel):
  - `Space`: pause/resume auto-advance
  - `←` / `→`: previous/next photo
  - `R`: force refresh photo list from DynamoDB
  - `D`: toggle debug overlay (connection status, queue length)
- **Reconnection**: on WebSocket disconnect, auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s)
- **Offline queue**: if no connection, show last loaded photos; re-sync on reconnect

### 4. MyGuest Page (`/myguest`)
- Input: nickname → query DynamoDB photos table (GSI on eventId+nickname)
- Show all photos uploaded by that nickname in that event
- Actions per photo: view full-size (presigned GET URL, 15-min expiry), delete
- **Delete flow**: client calls `/myguest/delete/:photoId` → Lambda verifies nickname match → delete S3 object + DynamoDB item
- No key required; event identified by URL param or most recent active event

## DynamoDB Tables

### Table: `events`
| PK | SK | name | createdAt | status | uploadKeyHash | showKeyHash |
|---|---|---|---|---|---|---|
| EVENT#{eventId} | METADATA | ... | ... | active| ... | ... |

GSI: `status-createdAt-index` (status + createdAt) for listing active events

### Table: `keypairs`
| PK | SK | eventId | keyType | keyHash | createdAt |
|---|---|---|---|---|---|
| KEY#{keyId} | METADATA | eventId | UPLOAD/SHOW | sha256(key) | ... |

- Query by keyHash to look up eventId for a given key

### Table: `photos`
| PK | SK | eventId | nickname | s3Key | thumbnailKey | status | uploadedAt |
|---|---|---|---|---|---|---|---|
| PHOTO#{photoId} | METADATA | eventId | nickname | ... | ... | active | ... |

GSIs:
- `eventId-nickname-index`: query all photos by eventId + nickname (for /myguest)
- `eventId-status-index`: query all active photos by eventId (for slideshow)

### Table: `connections`
| PK | SK | connectionId | eventId | connectedAt |
|---|---|---|---|---|
| EVENT#{eventId} | CONN#{connectionId} | connectionId | eventId | ... |

- DynamoDB TTL: 1 hour (connections auto-expire if not cleanly disconnected)

## S3 Buckets

**Bucket**: `wedding-photos-{env}-{region}`
- `uploads/{eventId}/{photoId}.{ext}` — original uploaded photos
- `thumbnails/{eventId}/{photoId}.webp` — server-side generated WebP thumbnails (max 800px wide)

**S3 Lifecycle**:
- `uploads/` — no expiry by default; admin can set per-event retention
- `thumbnails/` — regenerate from originals on demand (no persistent cache needed)

**S3 Policy**:
- Uploads: only via presigned PUT URL (no public access)
- Thumbnails: presigned GET URL (15-min expiry), served through CloudFront CDN

## Go Lambda Functions

### `admin-handler`
- `POST /admin/login` — validate credentials → return JWT
- `GET /admin/events` — list all events (paginated)
- `POST /admin/events` — create event + generate keypairs (both keys)
- `PUT /admin/events/:eventId` — update event name/status
- `DELETE /admin/events/:eventId` — delete event + all photos + keypairs
- `DELETE /admin/photos/:photoId` — admin delete any photo
- Auth: all endpoints require `Authorization: Bearer <JWT>` header

### `upload-handler`
- `POST /upload/presign` — body: `{eventId, filename, contentType}` → return presigned PUT URL
- `POST /upload/confirm` — body: `{eventId, s3Key, filename, size, contentType, nickname}` → write DynamoDB
- Auth: `UPLOAD_KEY` hash verification against keypairs table

### `slideshow-handler`
- `GET /slideshow/photos?eventId=` — return ordered list of active photo metadata (newest first)
- `GET /slideshow/presign/:photoId` — return presigned GET URL for thumbnail (15-min expiry)
- Auth: `SHOW_KEY` hash verification

### `websocket-handler`
- `connect` route: verify SHOW_KEY hash → register connection in DynamoDB
- `disconnect` route: remove connection from DynamoDB
- `broadcast` route (internal, called by upload confirm): push new photo to all connections for eventId
- Message format: `{type: "new_photo", photoId, thumbnailUrl, uploadedAt}`

### `myguest-handler`
- `GET /myguest/photos?eventId=&nickname=` — return all photos for that nickname in event
- `DELETE /myguest/photos/:photoId` — verify nickname match → delete S3 + DynamoDB
- No key auth; rate-limited by IP (10 req/min per IP)

## Security Checklist

- [ ] All keys stored as SHA-256 hash only; plaintext never stored or logged
- [ ] JWT secret in AWS Secrets Manager; JWT expiry 24 hours
- [ ] Admin password hashed with bcrypt (cost factor 12)
- [ ] CORS restricted to Amplify domain only
- [ ] API Gateway throttling: 100 req/s per IP for upload/myguest; 1000 req/s for admin
- [ ] S3 presigned URLs: 5-min expiry, scoped to specific key prefix
- [ ] File type validated by Magic bytes (not just extension) in Lambda
- [ ] File size enforced at both presign (Content-Length header) and Lambda (ContentLength > 20MB → reject)
- [ ] Nickname input sanitized: alphanumeric + spaces only, 2-20 chars, XSS escaped on output
- [ ] DynamoDB conditional writes on all writes (prevent duplicate photoId)
- [ ] WebSocket connection IDs not exposed to client; only internal use
- [ ] Rate limiting on `/myguest`: 10 req/min per IP to prevent enumeration

## Robustness Checklist

- [ ] Lambda concurrency: 100 reserved concurrent executions for upload-handler
- [ ] DynamoDB on-demand capacity mode (PAY_PER_REQUEST) to handle burst upload traffic
- [ ] S3 Transfer Acceleration disabled (unnecessary cost for regional wedding)
- [ ] WebSocket reconnect with exponential backoff (1s → 2s → 4s → 30s max)
- [ ] DynamoDB TTL on connections table (1 hour) to clean stale WebSocket entries
- [ ] Photo upload: client retries on 5xx from /upload/confirm (up to 3 times)
- [ ] Slideshow: if WebSocket disconnect, fall back to 10s polling interval
- [ ] Photo metadata cache in slideshow: store last known photo list in localStorage as backup
- [ ] S3 multipart upload for files > 5MB
- [ ] Lambda timeout: upload-handler 30s, admin-handler 10s, websocket-handler 30s
- [ ] API Gateway timeout matches Lambda timeout
- [ ] Dead letter queue (DLQ) on all Lambda functions for async retry on failure
- [ ] CloudWatch alarms: error rate > 1% for 5 min, Lambda duration > 20s
