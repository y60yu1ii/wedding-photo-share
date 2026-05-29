# upload Specification

## Purpose
TBD - created by archiving change fix-admin-approve-cors-preflight. Update Purpose after archive.
## Requirements
### Requirement: UPLOAD-1 — Support broad image formats
The upload system SHALL accept any image files matching the image/* content type pattern during upload presigning.

#### Scenario: Presign upload with webp format
- **GIVEN** an active wedding event
- **WHEN** a guest requests a presigned upload URL for a webp image
- **THEN** the upload system SHALL return a valid upload URL

### Requirement: UPLOAD-2 — Unicode nickname support
The upload system SHALL support guest nicknames containing any combination of Unicode multilingual characters (including Chinese, English, spaces, and punctuation) while filtering out HTML tags to prevent cross-site scripting attacks.

#### Scenario: Guest upload with Chinese nickname
- **GIVEN** an active wedding event
- **WHEN** a guest confirms an upload with the nickname "張三(測試)"
- **THEN** the upload system SHALL successfully accept the nickname

