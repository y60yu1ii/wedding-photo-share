# admin

## ADDED Requirements

### Requirement: ADM-4 - Event Template Editor

The system SHALL provide a dedicated event template editor for each wedding event, allowing authenticated admins to create, update, and publish a slideshow template with image-frame, text, and decorative-asset layers.

#### Scenario: Open event template editor
- **GIVEN** an authenticated admin viewing an existing event
- **WHEN** the admin opens the design page for that event
- **THEN** the system SHALL load the current template draft or published template for that event

#### Scenario: Edit and save template
- **GIVEN** an authenticated admin editing a template
- **WHEN** the admin changes layer position, size, text content, or canvas ratio and saves the draft
- **THEN** the system SHALL persist the updated template for that event without affecting other events

#### Scenario: Publish template
- **GIVEN** an event template draft has been saved
- **WHEN** the admin publishes the template
- **THEN** the system SHALL mark that template as the active published version for slideshow rendering

### Requirement: ADM-5 - Decorative Asset Upload

The system SHALL allow authenticated admins to upload event-scoped decorative assets for use in the template editor and shall make those assets available for preview and placement inside the template.

#### Scenario: Upload decorative asset
- **GIVEN** an authenticated admin on the event design page
- **WHEN** the admin uploads an image asset for a template layer
- **THEN** the system SHALL store the asset under that event's template asset namespace and return a usable asset reference

#### Scenario: Preview uploaded asset
- **GIVEN** an uploaded decorative asset exists for the event
- **WHEN** the admin loads the template editor
- **THEN** the system SHALL return a previewable URL or equivalent reference for that asset

### Requirement: ADM-6 - Live Template Preview

The system SHALL provide a live preview of the event template so admins can verify the composition against real event photos before publishing.

#### Scenario: Preview composition
- **GIVEN** an event template contains a photo frame, text, and decorative assets
- **WHEN** the admin opens the preview panel
- **THEN** the system SHALL render the same composition that the slideshow will use after publication

### Requirement: ADM-7 - Slideshow Playback Settings

The system SHALL allow authenticated admins to configure slideshow playback settings for each event, including transition style and the number of seconds each photo stays on screen.

#### Scenario: Change transition style
- **GIVEN** an authenticated admin editing an event template
- **WHEN** the admin selects a transition style such as fade, fade-plus-scale, or slide
- **THEN** the system SHALL persist that playback setting with the template

#### Scenario: Change photo interval
- **GIVEN** an authenticated admin editing an event template
- **WHEN** the admin sets the photo interval in seconds
- **THEN** the system SHALL persist that interval and apply it to slideshow playback after publish
