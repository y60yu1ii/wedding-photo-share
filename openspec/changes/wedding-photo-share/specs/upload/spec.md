# upload

## ADDED Requirements

### Requirement: UPL-1 — Valid Upload Key Required

The system SHALL reject any upload attempt where the provided UPLOAD_KEY does not match a hash stored in the keypairs table, returning HTTP 403.

#### Scenario: Valid key accepted
- **GIVEN** a valid UPLOAD_KEY is provided in the URL query parameter
- **WHEN** the upload page is loaded
- **THEN** the system SHALL validate the key hash against the keypairs table and allow access to the upload form

#### Scenario: Invalid key rejected
- **GIVEN** an invalid or expired UPLOAD_KEY is provided
- **WHEN** the upload page is loaded or a presign request is made
- **THEN** the system SHALL return HTTP 403 with message "Invalid or expired key"

### Requirement: UPL-2 — Presigned S3 Upload Flow

The system SHALL use a presigned URL flow where the client first requests a presigned PUT URL from the API, then uploads the file directly to S3, then confirms with the API to record metadata.

#### Scenario: Presigned URL generation
- **GIVEN** a valid UPLOAD_KEY and upload request with filename and content type
- **WHEN** `POST /upload/presign` is called
- **THEN** the system SHALL return a presigned S3 PUT URL with 5-minute expiry scoped to the specific eventId and filename pattern

#### Scenario: Direct S3 upload
- **GIVEN** a valid presigned PUT URL has been issued
- **WHEN** the client uploads a file directly to S3 using the presigned URL
- **THEN** the file SHALL be stored in S3 under `uploads/{eventId}/{photoId}.{ext}` with the content type specified in the presign request

#### Scenario: Upload confirmation
- **GIVEN** a file has been successfully uploaded to S3
- **WHEN** the client calls `POST /upload/confirm` with the S3 key and metadata
- **THEN** the system SHALL write the photo record to DynamoDB photos table and trigger a WebSocket broadcast

### Requirement: UPL-3 — File Validation

The system SHALL validate all uploaded files by magic bytes (not extension) and enforce a maximum size of 20MB per file.

#### Scenario: Valid JPEG accepted
- **GIVEN** a file with JPEG magic bytes (FF D8 FF) and size ≤ 20MB is uploaded
- **WHEN** the presign request is processed
- **THEN** the system SHALL accept the file and store it

#### Scenario: Invalid file type rejected
- **GIVEN** a file with non-image magic bytes (e.g., executable) is uploaded
- **WHEN** the presign request or S3 PUT is processed
- **THEN** the system SHALL reject the upload with HTTP 403

#### Scenario: Oversized file rejected
- **GIVEN** a file larger than 20MB is uploaded
- **WHEN** the presign request is processed
- **THEN** the system SHALL reject with HTTP 413

### Requirement: UPL-4 — Nickname Input Sanitization

The system SHALL sanitize nickname input to contain only alphanumeric characters and spaces, with a length between 2 and 20 characters.

#### Scenario: Valid nickname accepted
- **GIVEN** a nickname input containing only letters, numbers, and spaces (2-20 chars)
- **WHEN** the upload confirm request is processed
- **THEN** the system SHALL accept the nickname and store it in DynamoDB

#### Scenario: Invalid characters rejected
- **GIVEN** a nickname input containing special characters (e.g., `<script>`, `DROP TABLE`)
- **WHEN** the upload confirm request is processed
- **THEN** the system SHALL reject with HTTP 400 and message "Invalid nickname format"

### Requirement: UPL-5 — Duplicate Prevention

The system SHALL use DynamoDB conditional writes to prevent duplicate photo records for the same S3 key.

#### Scenario: Duplicate upload attempt blocked
- **GIVEN** a photo with S3 key `uploads/{eventId}/{photoId}.ext` already exists
- **WHEN** another upload confirm request arrives with the same S3 key
- **THEN** DynamoDB SHALL reject the write with a conditional check failure and the system SHALL return HTTP 409
