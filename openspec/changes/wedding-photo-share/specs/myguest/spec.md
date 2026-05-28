# myguest

## ADDED Requirements

### Requirement: MGR-1 — Nickname-Based Photo Lookup

The system SHALL allow any visitor to search for photos by nickname within a specific event, without requiring a key.

#### Scenario: Search by nickname
- **GIVEN** a valid eventId and nickname
- **WHEN** `GET /myguest/photos?eventId=X&nickname=Y` is called
- **THEN** the system SHALL return all photos uploaded with that nickname in the event, including photoId, S3 key, and uploadedAt

#### Scenario: No photos found
- **GIVEN** a nickname with no uploaded photos
- **WHEN** the search request is processed
- **THEN** the system SHALL return an empty array with HTTP 200

### Requirement: MGR-2 — Photo Deletion by Uploader

The system SHALL allow deletion of photos by verifying the nickname match, deleting both the S3 object and DynamoDB record.

#### Scenario: Successful deletion
- **GIVEN** a photoId with associated nickname stored in DynamoDB
- **WHEN** `DELETE /myguest/photos/:photoId` is called with matching nickname
- **THEN** the system SHALL delete the S3 object and DynamoDB record and return HTTP 200

#### Scenario: Nickname mismatch blocked
- **GIVEN** a photo deletion request with a nickname that does not match the record
- **WHEN** the request is processed
- **THEN** the system SHALL return HTTP 403

### Requirement: MGR-3 — Rate Limiting

The system SHALL enforce rate limiting of 10 requests per minute per IP on all `/myguest` endpoints.

#### Scenario: Rate limit exceeded
- **GIVEN** more than 10 requests from the same IP within 1 minute
- **WHEN** an additional `/myguest` request is received
- **THEN** the system SHALL return HTTP 429

### Requirement: MGR-4 — Presigned URL for Photo Viewing

The system SHALL provide a presigned GET URL (15-minute expiry) for viewing full-size photos, accessible only after nickname verification.

#### Scenario: View photo
- **GIVEN** a verified nickname matching a photo record
- **WHEN** the user requests a view URL for a photo
- **THEN** the system SHALL return a presigned S3 GET URL valid for 15 minutes
