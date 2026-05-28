# slideshow

## ADDED Requirements

### Requirement: SLI-1 — Valid Show Key Required

The system SHALL reject any slideshow access where the provided SHOW_KEY does not match a hash stored in the keypairs table, returning HTTP 403.

#### Scenario: Valid key accepted
- **GIVEN** a valid SHOW_KEY is provided in the URL query parameter
- **WHEN** the slideshow page is loaded
- **THEN** the system SHALL validate the key hash and establish a WebSocket connection

#### Scenario: Invalid key rejected
- **GIVEN** an invalid SHOW_KEY is provided
- **WHEN** the slideshow page is loaded or a WebSocket connection is attempted
- **THEN** the system SHALL return HTTP 403 and close the connection

### Requirement: SLI-2 — WebSocket Real-Time Updates

The system SHALL push new photo notifications to all connected slideshow clients via WebSocket immediately after a photo is uploaded.

#### Scenario: New photo broadcast
- **GIVEN** a new photo is uploaded and confirmed
- **WHEN** the upload confirm Lambda triggers a broadcast
- **THEN** the system SHALL send a WebSocket message `{type: "new_photo", photoId, thumbnailUrl, uploadedAt}` to all connections for that eventId

#### Scenario: Connection registration
- **GIVEN** a valid SHOW_KEY is provided during WebSocket handshake
- **WHEN** the `connect` route is invoked
- **THEN** the Lambda SHALL store the connectionId in DynamoDB connections table under the correct eventId partition

### Requirement: SLI-3 — Auto-Advance Slideshow

The system SHALL automatically advance the slideshow every 5 seconds, displaying photos in reverse chronological order (newest first), with a CSS fade transition.

#### Scenario: Automatic photo advancement
- **GIVEN** a slideshow session with photos in queue
- **WHEN** 5 seconds have elapsed since the last photo was displayed
- **THEN** the system SHALL transition to the next photo with a 0.5-second fade animation

#### Scenario: New photo prepended to queue
- **GIVEN** a slideshow is playing with photos in queue
- **WHEN** a new photo arrives via WebSocket
- **THEN** the new photo SHALL be inserted at the front of the display queue

### Requirement: SLI-4 — Staff Manual Controls

The system SHALL allow staff to control the slideshow via keyboard shortcuts and a hidden control panel.

#### Scenario: Pause/Resume
- **GIVEN** the slideshow is playing
- **WHEN** the staff presses `Space`
- **THEN** auto-advance SHALL pause; pressing `Space` again SHALL resume

#### Scenario: Manual navigation
- **GIVEN** the slideshow has multiple photos in queue
- **WHEN** the staff presses `ArrowLeft` or `ArrowRight`
- **THEN** the system SHALL display the previous or next photo respectively and reset the auto-advance timer

#### Scenario: Force refresh
- **GIVEN** the slideshow page is open
- **WHEN** the staff presses `R`
- **THEN** the system SHALL re-fetch the full photo list from DynamoDB and reset the queue

### Requirement: SLI-5 — WebSocket Reconnection

The system SHALL automatically reconnect WebSocket connections with exponential backoff after a disconnect, and fall back to polling if reconnection fails.

#### Scenario: Automatic reconnection
- **GIVEN** the WebSocket connection is lost
- **WHEN** the disconnection is detected
- **THEN** the client SHALL attempt reconnection with exponential backoff: 1s, 2s, 4s, up to a maximum of 30s

#### Scenario: Fallback to polling
- **GIVEN** WebSocket reconnection fails after 5 attempts
- **WHEN** the client cannot establish a WebSocket connection
- **THEN** the client SHALL fall back to polling `GET /slideshow/photos` every 10 seconds
