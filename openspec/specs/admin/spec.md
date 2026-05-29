# admin Specification

## Purpose
TBD - created by archiving change fix-admin-approve-cors-preflight. Update Purpose after archive.
## Requirements
### Requirement: ADMIN-1 — Dynamic review requirements configuration
The admin system SHALL support configuring requiresReview dynamic toggling, saving this state to the events table, and immediately updating guest photo publishing status to skip manual review if review requirement is disabled.

#### Scenario: Enable and disable photo review requirement
- **GIVEN** an active wedding event
- **WHEN** the admin patches the event status with requiresReview equal to false
- **THEN** guest uploads SHALL bypass manual review and automatically become approved

### Requirement: ADMIN-2 — Real image previews via S3 presigned URLs
The admin system SHALL generate S3 presigned URLs with at least a 15-minute expiration time for all listed photos to enable real image previews on the dashboard.

#### Scenario: List event photos
- **GIVEN** an active wedding event with guest uploads
- **WHEN** the admin requests the photo list
- **THEN** each photo payload SHALL include a valid presignedUrl property

### Requirement: ADMIN-3 — Physical cascade deletion
The admin system SHALL physically and cleanly delete all references of a wedding event, including the event record, keypairs, photos metadata, and associated S3 objects upon event deletion request.

#### Scenario: Delete an event
- **GIVEN** a wedding event with multiple guest photos
- **WHEN** the admin deletes the event
- **THEN** all database records and S3 files associated with the event SHALL be physically deleted

