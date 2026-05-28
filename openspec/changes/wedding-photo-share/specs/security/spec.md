# security

## ADDED Requirements

### Requirement: SEC-1 — Key Hashing

The system SHALL store all UPLOAD_KEY and SHOW_KEY values as SHA-256 hashes only; plaintext keys SHALL NOT be stored in any database, log, or environment variable.

#### Scenario: Key lookup
- **GIVEN** a plaintext key presented in a request
- **WHEN** the system needs to validate the key
- **THEN** the system SHALL compute SHA-256(plaintext) and compare against stored hashes

#### Scenario: Key retrieval impossible
- **GIVEN** a lost UPLOAD_KEY or SHOW_KEY
- **WHEN** the admin requests the plaintext key
- **THEN** the system SHALL NOT be able to return it; the admin MUST regenerate a new keypair

### Requirement: SEC-2 — Admin Password Security

The system SHALL hash admin passwords with bcrypt (cost factor 12) and SHALL NOT store plaintext passwords.

#### Scenario: Password storage
- **GIVEN** an admin sets or updates their password
- **WHEN** the password is saved
- **THEN** the system SHALL store only the bcrypt hash

### Requirement: SEC-3 — JWT Security

The system SHALL store the JWT signing secret in AWS Secrets Manager and enforce a 24-hour expiry on all admin JWTs.

#### Scenario: Token expiry
- **GIVEN** a JWT with 24-hour expiry has expired
- **WHEN** any admin API request is made
- **THEN** the system SHALL return HTTP 401

### Requirement: SEC-4 — CORS Domain Restriction

The system SHALL configure API Gateway CORS to allow requests only from the AWS Amplify domain.

#### Scenario: Cross-origin request from allowed domain
- **GIVEN** a request originating from `https://xxx.amplifyapp.com`
- **WHEN** the preflight or actual request arrives at API Gateway
- **THEN** the system SHALL return `Access-Control-Allow-Origin: https://xxx.amplifyapp.com`

#### Scenario: Cross-origin request from disallowed domain
- **GIVEN** a request originating from an unknown domain
- **WHEN** the preflight or actual request arrives at API Gateway
- **THEN** the system SHALL return HTTP 403

### Requirement: SEC-5 — S3 Presigned URL Scoping

The system SHALL scope presigned PUT URLs to specific S3 key prefixes and enforce a 5-minute expiry.

#### Scenario: Presigned URL scope validation
- **GIVEN** a presigned PUT URL for `uploads/{eventId}/`
- **WHEN** a client attempts to PUT to a different S3 key
- **THEN** S3 SHALL reject the upload with HTTP 403

### Requirement: SEC-6 — File Type Validation by Magic Bytes

The system SHALL validate uploaded file types by reading magic bytes, not by file extension or Content-Type header.

#### Scenario: Fake extension rejected
- **GIVEN** an executable file renamed to `photo.jpg`
- **WHEN** the magic bytes are checked in the Lambda validation step
- **THEN** the upload SHALL be rejected with HTTP 403

### Requirement: SEC-7 — XSS Prevention

The system SHALL escape all user-provided nickname strings on output to prevent XSS attacks.

#### Scenario: Script injection blocked
- **GIVEN** a nickname containing `<script>alert('xss')</script>`
- **WHEN** the nickname is rendered in any page
- **THEN** the system SHALL output the HTML-escaped version `&lt;script&gt;...` and the script SHALL NOT execute
