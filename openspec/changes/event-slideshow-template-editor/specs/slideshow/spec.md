# slideshow

## ADDED Requirements

### Requirement: SLI-6 - Event Template Rendering

The system SHALL render the published template for the current event in the fullscreen slideshow, including photo-frame, text, and decorative-asset layers.

#### Scenario: Render published template
- **GIVEN** an event has a published slideshow template
- **WHEN** the slideshow page loads for that event
- **THEN** the system SHALL fetch and render the event template before showing photos

#### Scenario: Use event-specific assets
- **GIVEN** a template references decorative assets uploaded for the same event
- **WHEN** the slideshow renders the template
- **THEN** the system SHALL display those assets in the correct positions and z-order

### Requirement: SLI-7 - One-by-One Animated Photo Transitions

The system SHALL display photos one at a time in the fullscreen slideshow and animate each photo change with a visible transition.

#### Scenario: Advance to next photo
- **GIVEN** the slideshow is showing an active photo
- **WHEN** the auto-advance timer moves to the next photo
- **THEN** the system SHALL transition to the next photo using a fade or fade-plus-scale animation

#### Scenario: New photo arrives during slideshow
- **GIVEN** the slideshow is already running
- **WHEN** a new approved photo is received from WebSocket
- **THEN** the system SHALL insert the photo into the queue and display it with the same one-by-one animation model

### Requirement: SLI-8 - Template Refresh

The system SHALL refresh the active slideshow template when a published template update is detected for the current event.

#### Scenario: Template updated in admin
- **GIVEN** an admin publishes a new template for the same event
- **WHEN** the slideshow client receives the update notification or refreshes its template state
- **THEN** the system SHALL render the new published template without requiring a full browser restart

### Requirement: SLI-9 - Configurable Playback Timing

The system SHALL honor the event's published slideshow playback settings for both transition style and per-photo dwell time.

#### Scenario: Use configured interval
- **GIVEN** an event template has a published interval of N seconds
- **WHEN** the slideshow is running
- **THEN** the system SHALL keep each photo on screen for N seconds before advancing

#### Scenario: Use configured transition
- **GIVEN** an event template has a published transition style
- **WHEN** the slideshow advances from one photo to the next
- **THEN** the system SHALL use that transition style for the photo change animation
