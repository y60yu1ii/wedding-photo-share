# Tasks: Wedding Photo Share System

## Infrastructure

- [x] Create CDK stack `lib/wedding-photo-stack.ts`
- [x] Provision DynamoDB tables: `events`, `keypairs`, `photos`, `connections`
- [x] Create S3 bucket `wedding-photo-share-{env}-{account}`
- [x] Create API Gateway HTTP API `wedding-photo-api`
- [x] Create API Gateway WebSocket API `wedding-photo-websocket`
- [x] Configure CORS (wedding.fishare.de and api.fishare.de)
- [x] Create Secrets Manager entry for JWT secret
- [x] Create CloudWatch alarms: error rate, Lambda duration
- [x] Create DLQ SQS queue for Lambda retries
- [x] Configure CloudFront distribution with ACM Certificate
- [x] Route53 A-record alias for wedding.fishare.de
- [x] Route53 A-record alias for api.fishare.de → API Gateway
- [x] CloudFront Cache Policy: forward `Authorization` + `Origin` headers (ID: `3d2eea86-7550-424d-9b3a-727674f24100`) — fixes 401 + CORS
- [x] CloudFront Function `wedding-cors-prod` → `viewer-response` (inject CORS headers, OPTIONS 204) — **fixes CORS preflight 503**
- [x] EVENT PK format migration: `EVENT#xxx` → `EVENT-xxx` (fixes URL fragment bug)
- [ ] Set up S3 lifecycle rules (retention per event setting)
- [ ] Set up AWS budget alert for unexpected spend

## CDK Stack Tests

- [x] 18/18 CDK stack tests pass
- [x] 10/10 admin Lambda unit tests pass (28/28 total)
- [ ] Add tests for CloudFront distribution (certificate, domain, origin)
- [ ] Add tests for Route53 records

## Lambda Functions (TypeScript)

### admin
- [x] `lambda/admin/index.ts` — Lambda handler
- [x] `POST /admin/login` handler
- [x] `GET /admin/events` handler
- [x] `POST /admin/events` — create event + generate both keys, keys stored in EVENTS table
- [x] `GET /admin/events/:eventId` — returns keys from EVENTS table (no GSI needed)
- [x] `PUT /admin/events/:eventId` — update name/status
- [x] `DELETE /admin/events/:eventId` — archive event (keypairs via Scan, no GSI)
- [x] `DELETE /admin/photos/:photoId` handler
- [x] `KEYPAIRS_TABLE` env var typo fixed (`AlR` → `AI` in admin Lambda)
- [x] `jwtVerify` uses real jose library (not hand-rolled decode)
- [x] Web Crypto polyfill in `test/setup.ts` for Node.js 18 compatibility
- [x] 10/10 admin Lambda unit tests pass
- [ ] Unit tests for upload handlers
- [ ] Unit tests for slideshow handlers
- [ ] Unit tests for websocket handlers
- [ ] Unit tests for myguest handlers

### Design Decisions (this session)
- [x] Plaintext keys stored in EVENTS table (METADATA item) — allows key retrieval after creation
- [x] keypairs table still used for hash-based key validation at upload/show time
- [x] No GSI on keypairs table — all lookups use Scan (acceptable for admin ops)

### upload
- [x] `lambda/upload/index.ts` — Lambda handler
- [x] `POST /upload/presign` — presigned S3 PUT URL
- [x] `POST /upload/confirm` — DynamoDB write + WebSocket broadcast
- [x] Magic bytes validation for JPEG (FF D8 FF), PNG (89 50 4E 47), WebP (52 49 46 46), HEIC (66 74 79 70 68 65 69 63)
- [x] File size validation (max 20MB)
- [x] Nickname sanitization (alphanumeric + spaces, 2-20 chars)
- [x] DynamoDB conditional write (duplicate prevention)
- [ ] Multipart upload support (> 5MB)
- [ ] Unit tests for upload handlers

### slideshow
- [x] `lambda/slideshow/index.ts` — Lambda handler
- [x] `GET /slideshow/photos` — query DynamoDB GSI
- [x] `GET /slideshow/presign/:photoId` — thumbnail presigned URL
- [ ] Unit tests for slideshow handlers

### websocket
- [x] `lambda/websocket/index.ts` — Lambda handler
- [x] `$connect` route — validate SHOW_KEY + register connection
- [x] `$disconnect` route — remove connection
- [x] `broadcast` route — push to all connections for eventId
- [ ] Unit tests for websocket handlers

### myguest
- [x] `lambda/myguest/index.ts` — Lambda handler
- [x] `GET /myguest/photos` — query by eventId + nickname
- [x] `DELETE /myguest/photos/:photoId` — ownership verification + delete
- [ ] Rate limiting (10 req/min per IP)
- [ ] Unit tests for myguest handlers

## Frontend (SvelteKit)

### Infrastructure
- [x] SvelteKit 2 + Svelte 5 + Tailwind CSS v3
- [x] adapter-static with SPA routing
- [x] Vitest unit tests
- [x] Playwright E2E config

### Pages
- [x] `src/routes/+page.svelte` — Home (keyHash/eventId input)
- [x] `src/routes/admin/login/+page.svelte` — Admin login
- [x] `src/routes/admin/+page.svelte` — Admin dashboard (event list + create + delete with confirmation)
- [x] Batch delete: checkbox multi-select + delete all selected at once
- [x] `src/routes/admin/event/[eventId]/+page.svelte` — Event management (full URLs + QRCode + copy buttons, keys from API)
- [x] Keys always visible on event detail page (no "請至建立記錄取得金鑰" fallback)
- [x] `src/routes/event/[eventId]/+page.svelte` — Slideshow page
- [x] `src/routes/event/[eventId]/upload/+page.svelte` — Upload page
- [x] `src/routes/myguest/[eventId]/+page.svelte` — MyGuest page
- [x] QR code display via Google Charts QR API
- [x] Copy-to-clipboard buttons for upload/show URLs
- [x] Key storage: keys from API (no localStorage needed after server-side key storage)

### Shared
- [x] `src/lib/api/client.ts` — API client with auth
- [x] `src/lib/api/types.ts` — TypeScript types
- [x] `tailwind.config.js` — Wedding theme colors
- [x] API client retry logic (exponential backoff, max 3 retries, 5xx only)

### Tests
- [x] 11/11 Vitest unit tests pass
- [ ] Playwright E2E: upload flow (valid key → upload photo → appears in slideshow)
- [ ] Playwright E2E: admin flow (create event → get keys → delete event)
- [ ] Playwright E2E: myguest flow (upload with nickname → search → delete)

## Deployment

- [x] `lambda-pkgs/` — pre-built Lambda zip files
- [ ] `cdk deploy --profile yyl` — initial deployment
- [ ] Configure fishare.de hosted zone ID in CDK (via `hostedZoneId` prop)
- [ ] Verify CloudFront deployment succeeds
- [ ] Verify API Gateway routes are working
- [ ] Verify DNS propagation for wedding.fishare.de

## CI/CD

- [x] `.github/workflows/ci.yml` — CI: TypeScript + CDK tests + Lambda build + CDK synth + Frontend build
- [x] `.github/workflows/cd.yml` — CD: CDK diff + CDK deploy (BucketDeployment handles frontend)

## Security Hardening

- [ ] Verify S3 bucket policy: no public access
- [ ] Verify API Gateway CORS whitelist
- [ ] Add AWS WAF on API Gateway (rate limiting, IP allowlist option)
- [ ] Penetration test: enumerate /admin endpoints without auth → expect 401
- [ ] Penetration test: upload non-image file with forged Content-Type → expect 403

## Documentation

- [ ] `README.md` — setup instructions, AWS profile usage
- [ ] `docs/ARCHITECTURE.md` — system diagram
- [ ] `docs/DEPLOYMENT.md` — deployment steps
- [ ] `docs/QR-SETUP.md` — how to print QR codes for venue
- [ ] API endpoint documentation
