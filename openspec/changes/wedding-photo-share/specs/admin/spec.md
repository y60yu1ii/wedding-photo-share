# admin

## ADDED Requirements

### Requirement: ADM-1 — Admin Authentication

The system SHALL require email and password authentication for all admin endpoints, returning a JWT valid for 24 hours.

#### Scenario: Successful login
- **GIVEN** a valid email and correct password
- **WHEN** `POST /admin/login` is called
- **THEN** the system SHALL return a JWT with 24-hour expiry

#### Scenario: Failed login
- **GIVEN** an invalid email or incorrect password
- **WHEN** `POST /admin/login` is called
- **THEN** the system SHALL return HTTP 401

#### Scenario: Protected endpoint without token
- **GIVEN** a request to any admin endpoint without JWT
- **WHEN** the request is processed
- **THEN** the system SHALL return HTTP 401

### Requirement: ADM-2 — Event Management

The system SHALL allow authenticated admins to create, read, update, and delete events, each with an auto-generated UPLOAD_KEY and SHOW_KEY pair.

#### Scenario: Create event
- **GIVEN** an authenticated admin with event name
- **WHEN** `POST /admin/events` is called
- **THEN** the system SHALL create an event record in DynamoDB and generate two keypairs (UPLOAD_KEY and SHOW_KEY) stored as SHA-256 hashes

#### Scenario: Delete event cascades
- **GIVEN** an authenticated admin deleting an event
- **WHEN** `DELETE /admin/events/:eventId` is called
- **THEN** the system SHALL delete all photos in S3 for that event, delete all photo records from DynamoDB, delete all keypairs, and delete the event record

### Requirement: ADM-3 — Keypair Naming and Management

The system SHALL allow admins to assign human-readable names to keypairs and manage them independently per event.

#### Scenario: Display keypair info
- **GIVEN** an existing event with keypairs
- **WHEN** the admin views event details
- **THEN** the system SHALL display the keypair names (e.g., "新郎朋友掃描") and their respective key values as QR codes

#### Scenario: Regenerate keypair
- **GIVEN** an authenticated admin
- **WHEN** the admin requests a new SHOW_KEY for an event
- **THEN** the system SHALL invalidate the old key hash, generate a new key, store its SHA-256 hash, and return the new plaintext key
