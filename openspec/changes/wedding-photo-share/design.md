# Design: Wedding Photo Share System

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  SvelteKit + Tailwind CSS (adapter-static)                           │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ /admin  │  │ /event/:id  │  │/myguest/ │  │ /admin/event/ │
│  │ /login  │  │ /upload     │  │  :id     │  │   [eventId]   │  │
│  └────┬─────┘  └──────┬──────┘  └────┬─────┘  └───────┬───────┘  │
└────────┼───────────────┼──────────────┼───────────────┼───────────┘
         │               │              │               │
         │  REST API    │   WebSocket  │               │
         ▼              ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  API Gateway (HTTP API v2)                                           │
│  ┌─────────────────────┐  ┌────────────────────────────────────┐  │
│  │ REST API            │  │ WebSocket API                      │  │
│  │ /admin/*            │  │ $connect / $disconnect / broadcast │  │
│  │ /upload/*           │  └────────────────────────────────────┘  │
│  │ /slideshow/*        │                                            │
│  │ /myguest/*         │                                            │
│  └──────────┬──────────┘                                            │
└─────────────┼───────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Node.js 20 Lambda Functions (TypeScript)                           │
│  ┌────────────┐ ┌────────────┐ ┌──────────────┐ ┌────────────────┐  │
│  │ admin     │ │ upload     │ │ slideshow    │ │ websocket      │  │
│  │ - auth    │ │ - presign  │ │ - photo list│ │ - connect     │  │
│  │ - events  │ │ - confirm  │ │ - presign   │ │ - disconnect  │  │
│  │ - keys    │ │ - validate │ │              │ │ - broadcast   │  │
│  │ - delete  │ │            │ │              │ │                │  │
│  └────────────┘ └────────────┘ └──────────────┘ └────────────────┘  │
│  ┌────────────┐                                                     │
│  │ myguest    │                                                     │
│  │ - photos   │                                                     │
│  │ - delete   │                                                     │
│  └────────────┘                                                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  ┌───────────┐    ┌────────────┐    ┌──────────────┐
  │ DynamoDB  │    │    S3      │    │ WebSocket    │
  │ events    │    │ wedding-   │    │ Connections  │
  │ keypairs  │    │ photo-*-* │    │ (in DynamoDB)│
  │ photos    │    │            │    │              │
  │ connections│   └────────────┘    └──────────────┘
  └───────────┘
```

## Infrastructure

- **Region**: ap-northeast-1
- **AWS Profile**: yyl
- **Frontend Domain**: `wedding.fishare.de`
- **API Domain**: `api.fishare.de`
- **CDK Stack**: `WeddingPhotoStack` in `lib/wedding-photo-stack.ts`
- **Frontend**: SvelteKit 2 + Svelte 5 + Tailwind CSS v3 + adapter-static
- **Node Runtime**: Node.js 20 (Lambda)
- **Auth**: JWT (jose library), admin password bcrypt-hashed, keys SHA-256 hashed

## DynamoDB Tables

### `events` — PK/SK
| PK | SK | name | createdAt | status | uploadKeyHash | showKeyHash |
|---|---|---|---|---|---|---|
| EVENT-{eventId} | METADATA | ... | ... | active | sha256 | sha256 |

GSI: `status-createdAt-index` (status + createdAt)

> ⚠️ PK format uses `-` separator (not `#`) to avoid URL fragment issues in browser URLs.

### `keypairs` — PK/SK
| PK | SK | eventId | keyType | keyHash | createdAt |
|---|---|---|---|---|---|
| KEY#{keyId} | METADATA | eventId | UPLOAD/SHOW | sha256(key) | ... |

Query by keyHash to look up eventId for a given key.

### `photos` — PK/SK
| PK | SK | eventId | nickname | s3Key | status | uploadedAt |
|---|---|---|---|---|---|---|
| PHOTO#{photoId} | METADATA | eventId | nickname | ... | active | ... |

GSIs:
- `eventId-nickname-index`: query all photos by eventId + nickname (for /myguest)
- `eventId-status-index`: query all active photos by eventId (for slideshow)

### `connections` — PK/SK
| PK | SK | connectionId | eventId | connectedAt |
|---|---|---|---|---|
| EVENT-{eventId} | CONN#{connectionId} | connectionId | eventId | ... |

TTL: 1 hour (DynamoDB TTL attribute)

> ⚠️ PK format uses `-` separator (not `#`) to match events table.

## S3 Bucket

**Bucket**: `wedding-photo-share-{stage}-{account}`
- `uploads/{eventId}/{photoId}.{ext}` — original photos
- All uploads via presigned PUT URL only

## CloudFront + S3 Static Hosting

- CloudFront distribution with `wedding.fishare.de` domain
- ACM Certificate in us-east-1 (required for CloudFront)
- S3 bucket as origin, static website hosting enabled
- Default root object: `index.html` (SPA routing)
- Error page: 404 → `index.html` (SPA routing)

## Lambda Functions

All Lambda handlers are TypeScript compiled to CommonJS via esbuild.
Zip files pre-built in `lambda-pkgs/{name}/index.js`.

### admin
- `POST /admin/login` — validate credentials → return JWT
- `GET /admin/events` — list all events
- `POST /admin/events` — create event + generate keypairs
- `DELETE /admin/events/:eventId` — cascade delete event + photos + keypairs
- `DELETE /admin/photos/:photoId` — admin delete any photo
- Auth: JWT Bearer token required

### upload
- `POST /upload/presign` — body: `{eventId, filename, contentType}` → presigned PUT URL
- `POST /upload/confirm` — write DynamoDB metadata + WebSocket broadcast
- Auth: UPLOAD_KEY hash verification

### slideshow
- `GET /slideshow/photos?eventId=` — ordered list of active photo metadata (newest first)
- `GET /slideshow/presign/:photoId` — presigned GET URL (15-min expiry)
- Auth: SHOW_KEY hash verification

### websocket
- `$connect`: validate SHOW_KEY → register connection in DynamoDB
- `$disconnect`: remove connection
- `broadcast`: push new photo to all connections for eventId
- Message format: `{type: "new_photo", photoId, s3Key, uploadedAt}`

### myguest
- `GET /myguest/photos?eventId=&nickname=` — all photos for that nickname
- `DELETE /myguest/photos/:photoId` — verify nickname match → delete
- No key auth; rate-limited by IP

## Security Checklist

- [x] All keys stored as SHA-256 hash only; plaintext never stored or logged
- [x] JWT secret in AWS Secrets Manager; JWT expiry 24 hours
- [x] Admin password hashed with bcrypt (cost factor 12)
- [x] CORS restricted to wedding.fishare.de and api.fishare.de
- [x] S3 presigned URLs: 5-min expiry, scoped to specific eventId prefix
- [x] File type validated by magic bytes
- [x] File size enforced: max 20MB per file
- [x] Nickname input sanitized: alphanumeric + spaces only, 2-20 chars
- [x] DynamoDB conditional writes on all writes
- [x] WebSocket connection IDs not exposed to client
- [ ] Rate limiting on `/myguest`: 10 req/min per IP
- [x] Magic bytes validation for file types

## Robustness Checklist

- [x] Lambda concurrency: DLQ on all Lambda functions
- [x] DynamoDB PAY_PER_REQUEST billing (on-demand)
- [x] WebSocket reconnect with exponential backoff
- [x] DynamoDB TTL on connections table (1 hour)
- [x] Lambda timeout: upload/admin 30s, slideshow/myguest 10s
- [x] API Gateway timeout matches Lambda timeout
- [x] Dead letter queue (SQS) on all Lambda functions
- [x] CloudWatch alarms: error rate > 1% for 5 min, Lambda duration > 20s
- [ ] S3 multipart upload for files > 5MB
- [ ] Slideshow fallback to polling if WebSocket disconnect
