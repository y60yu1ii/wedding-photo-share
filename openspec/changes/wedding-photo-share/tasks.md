# Tasks: Wedding Photo Share System

## Infrastructure

- [ ] Create CDK stack `lib/wedding-photo-stack.ts`
- [ ] Provision DynamoDB tables: `events`, `keypairs`, `photos`, `connections`
- [ ] Create S3 bucket `wedding-photo-share-{env}`
- [ ] Configure S3 lifecycle rules (retention per event setting)
- [ ] Create API Gateway REST API `wedding-photo-api`
- [ ] Create API Gateway WebSocket API `wedding-photo-websocket`
- [ ] Add CORS configuration (Amplify domain only)
- [ ] Configure API Gateway throttling per method
- [ ] Create Secrets Manager entry for JWT secret
- [ ] Create CloudWatch alarms: error rate, Lambda duration
- [ ] Create DLQ SQS queue for Lambda retries
- [ ] Configure CloudFront distribution for thumbnails
- [ ] Set up AWS budget alert for unexpected spend

## Go Lambda Functions

### admin-handler

- [ ] `cmd/admin/main.go` — Lambda entry point
- [ ] `internal/admin/handlers.go` — HTTP handlers for all endpoints
- [ ] `internal/admin/auth.go` — JWT generation and validation
- [ ] `internal/admin/models.go` — Event, Keypair structs
- [ ] `internal/admin/dynamodb.go` — DynamoDB CRUD operations
- [ ] `POST /admin/login` handler
- [ ] `GET /admin/events` handler (paginated)
- [ ] `POST /admin/events` — create event + generate both keys
- [ ] `PUT /admin/events/:eventId` — update name/status
- [ ] `DELETE /admin/events/:eventId` — cascade delete photos + keys
- [ ] `DELETE /admin/photos/:photoId` handler
- [ ] Unit tests for all handlers

### upload-handler

- [ ] `cmd/upload/main.go`
- [ ] `internal/upload/presign.go` — generate presigned S3 PUT URL
- [ ] `internal/upload/confirm.go` — validate + write DynamoDB metadata
- [ ] `internal/upload/validate.go` — magic byte validation, size check
- [ ] `POST /upload/presign` — key validation + presign response
- [ ] `POST /upload/confirm` — metadata write + WebSocket broadcast trigger
- [ ] WebSocket broadcast call from upload confirm
- [ ] Unit tests for validation logic

### slideshow-handler

- [ ] `cmd/slideshow/main.go`
- [ ] `internal/slideshow/handlers.go`
- [ ] `GET /slideshow/photos` — query DynamoDB GSI
- [ ] `GET /slideshow/presign/:photoId` — thumbnail presigned URL
- [ ] Thumbnail generation logic (call S3 thumbnail generation or serve original)
- [ ] Unit tests

### websocket-handler

- [ ] `cmd/websocket/main.go`
- [ ] `internal/websocket/connect.go` — validate SHOW_KEY + register connection
- [ ] `internal/websocket/disconnect.go` — remove connection
- [ ] `internal/websocket/broadcast.go` — push to all connections for eventId
- [ ] DynamoDB connections table operations
- [ ] Connection TTL management
- [ ] Unit tests

### myguest-handler

- [ ] `cmd/myguest/main.go`
- [ ] `internal/myguest/handlers.go`
- [ ] `GET /myguest/photos` — query by eventId + nickname
- [ ] `DELETE /myguest/photos/:photoId` — ownership verification + delete
- [ ] Rate limiting (10 req/min per IP)
- [ ] Unit tests

## AWS Amplify Frontend (React)

### Infrastructure

- [ ] Create Amplify app via CDK Amplify backend
- [ ] Configure Amplify custom rewrites for SPA (redirect all to index.html)
- [ ] Add Amplify environment variables: API endpoint, region
- [ ] Set up Amplify branch auto-deploy

### Pages

#### Admin Page `/admin`

- [ ] `src/pages/Admin/LoginPage.tsx` — email + password form
- [ ] `src/pages/Admin/AdminDashboard.tsx` — event list
- [ ] `src/pages/Admin/EventEditor.tsx` — create/edit event modal
- [ ] `src/pages/Admin/KeypairDisplay.tsx` — show UPLOAD_KEY and SHOW_KEY as QR codes
- [ ] `src/pages/Admin/PhotoManager.tsx` — photo list with delete
- [ ] `src/components/Admin/QRCode.tsx` — QR code generator component
- [ ] JWT storage in localStorage + auto-refresh
- [ ] Protected route wrapper (redirect to login if no JWT)
- [ ] Responsive layout for tablet use

#### Upload Page `/upload`

- [ ] `src/pages/Upload/UploadPage.tsx` — main upload page
- [ ] `src/pages/Upload/ManageLink.tsx` — post-upload management link display
- [ ] `src/components/Upload/PhotoUploader.tsx` — multi-file drag-drop uploader
- [ ] `src/components/Upload/NicknameInput.tsx` — validated nickname input
- [ ] `src/hooks/useUpload.ts` — presign → PUT → confirm flow
- [ ] Progress indicator per file
- [ ] Error handling with retry
- [ ] Mobile-first responsive design

#### Slideshow Page `/slideshow`

- [ ] `src/pages/Slideshow/SlideshowPage.tsx` — full-screen slideshow
- [ ] `src/components/Slideshow/PhotoSlide.tsx` — single photo with fade animation
- [ ] `src/components/Slideshow/ControlPanel.tsx` — hidden staff controls
- [ ] `src/hooks/useWebSocket.ts` — WebSocket connection + reconnect logic
- [ ] `src/hooks/useSlideshowControls.ts` — keyboard event handlers
- [ ] `src/context/SlideshowContext.tsx` — photo queue + playback state
- [ ] CSS fade transition animation (opacity 0→1, 0.5s)
- [ ] Auto-advance timer (5s per slide)
- [ ] localStorage fallback for offline queue
- [ ] Debug overlay component

#### MyGuest Page `/myguest`

- [ ] `src/pages/MyGuest/FindMyPhotos.tsx` — nickname search form
- [ ] `src/pages/MyGuest/MyPhotos.tsx` — photo grid + management
- [ ] `src/components/MyGuest/PhotoCard.tsx` — view + delete per photo
- [ ] `src/hooks/useMyGuest.ts` — API calls for photo list + delete
- [ ] Responsive photo grid (1-3 columns based on viewport)

### Shared Components

- [ ] `src/components/Layout/PageLayout.tsx` — common header/footer
- [ ] `src/components/Common/Button.tsx`
- [ ] `src/components/Common/Input.tsx`
- [ ] `src/components/Common/Modal.tsx`
- [ ] `src/context/AuthContext.tsx` — JWT + user state
- [ ] `src/lib/api.ts` — Axios instance with auth header + interceptors
- [ ] `src/lib/constants.ts` — key query param names, timing constants
- [ ] `src/hooks/useKeyValidation.ts` — validate key on page load (upload/slideshow)

## GitHub Actions CI/CD

- [ ] `.github/workflows/cdk-deploy.yml` — deploy CDK on merge to main
- [ ] `.github/workflows/frontend-deploy.yml` — Amplify build spec
- [ ] `amplify.yml` — Amplify build configuration
- [ ] AWS credentials: `AWS_PROFILE=yyl` for CDK deploy
- [ ] Branch protection: require PR + review for main branch

## Security Hardening

- [ ] Verify magic bytes for JPEG (FF D8 FF), PNG (89 50 4E 47), WebP (52 49 46 46)
- [ ] Ensure no plaintext keys in Lambda environment variables (use Secrets Manager)
- [ ] Verify S3 bucket policy: no public access, presigned URLs only
- [ ] Verify API Gateway CORS: whitelist only Amplify domain
- [ ] Add AWS WAF on API Gateway (rate limiting, IP allowlist option)
- [ ] Penetration test checklist: enumerate /admin endpoints without auth → expect 401
- [ ] Penetration test: upload non-image file with forged Content-Type → expect 403

## Testing

- [ ] Lambda unit tests (all handlers) with mocks
- [ ] Frontend component tests (React Testing Library)
- [ ] Upload flow E2E test (playwright): valid key → upload photo → appears in slideshow
- [ ] Slideshow WebSocket E2E: upload triggers new photo in slideshow within 5s
- [ ] MyGuest E2E: upload with nickname → search nickname → delete photo
- [ ] Admin E2E: create event → get keys → delete event → verify cascade delete

## Documentation

- [ ] `README.md` — setup instructions, AWS profile usage
- [ ] `docs/ARCHITECTURE.md` — system diagram and component descriptions
- [ ] `docs/DEPLOYMENT.md` — deployment steps, environment setup
- [ ] `docs/QR-SETUP.md` — how to print QR codes for venue
- [ ] Inline code comments for all Lambda handlers
- [ ] API endpoint documentation (OpenAPI spec in `docs/api.yaml`)
