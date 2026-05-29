# Tasks: Event Slideshow Template Editor

## Phase 1 - Contracts and Data Model

- [ ] Define the event template data structure and validation rules.
- [ ] Add admin API endpoints for loading and saving templates.
- [ ] Add admin API endpoints for decorative asset upload and preview.
- [ ] Add slideshow API support for fetching the published template.

## Phase 2 - Admin Editor

- [ ] Create `/admin/event/[eventId]/design`.
- [ ] Integrate Svelte Flow for template layout editing.
- [ ] Add playback settings controls for transition style and photo interval.
- [ ] Implement layer editing for photo frame, text, and decorative assets.
- [ ] Implement canvas ratio selection and live preview.
- [ ] Implement asset upload and asset library browsing.
- [ ] Implement draft save and publish controls.

## Phase 3 - Slideshow Rendering

- [ ] Render the published template in the fullscreen slideshow.
- [ ] Add selectable one-by-one animated transitions between photos.
- [ ] Honor the configured interval for each photo.
- [ ] Ensure template overlays and photo content stay synchronized.
- [ ] Reload the published template when the event template changes.

## Phase 4 - Verification

- [ ] Add unit tests for template validation and API contracts.
- [ ] Add frontend tests for editor state and preview behavior.
- [ ] Add slideshow regression coverage for template rendering and transitions.
- [ ] Run build and targeted tests for changed frontend and backend paths.
- [ ] Run `npm run check` from the relevant package root and fix all reported issues before marking the change complete.
