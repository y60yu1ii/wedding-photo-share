# Design: Event Slideshow Template Editor

## Goal

Let each wedding event define its own visual frame system and render that frame consistently in the big-screen slideshow.

## High-Level Approach

Use a structured template document per event rather than a single flattened image.
The editor stores a template as data, and the slideshow renderer reads the same data to display the live composition.

This keeps the system editable after publication:
- admins can move or resize elements
- text can be changed without re-uploading a full composite image
- decorative assets can be reused across the same event
- the slideshow can animate photo changes independently from the frame

## Template Model

Each event gets one active template document with:
- canvas size or aspect ratio
- background settings
- slideshow playback settings
- a list of layers
- an optional published/draft state
- references to decorative asset files stored in S3

Layer types:
- `photo-frame` for the visible frame around the slideshow image
- `text` for titles, captions, or labels
- `decorative-asset` for uploaded stickers, ornaments, or other visual assets

Playback settings:
- transition style, such as fade, fade-plus-scale, or slide
- dwell time per photo in seconds
- optional transition duration in seconds

Template coordinates should be stored in normalized form so the same design can be displayed across different canvas ratios without losing layout intent.

## Admin Editor

Create a dedicated page at `/admin/event/[eventId]/design` using Svelte Flow as the primary layout surface.

Editor capabilities:
- choose a canvas ratio or custom width/height ratio
- choose slideshow transition style
- set the number of seconds each photo stays on screen
- add, move, resize, rotate, lock, and reorder layers
- upload event-specific decorative assets
- edit text content, font, color, opacity, and alignment
- preview the template against sample or real event photos
- save drafts and publish the active template

The editor should treat each visual layer as a node in the flow canvas.
Edges are optional and only needed if we later add grouping or parent-child relationships.

## Asset Handling

Decorative assets are event-scoped files stored in S3 under a template asset prefix.
The admin API returns asset references and presigned read URLs for previewing them in the editor.

Accepted asset types should be limited to images so the editor remains predictable and safe for slideshow rendering.

## Slideshow Rendering

The fullscreen slideshow should:
- load the published template for the current event
- render the template as an overlay around the active photo
- display photos one by one with a fade or fade-plus-scale transition
- preserve the current WebSocket-driven photo update flow

When a new photo arrives, it should enter the queue normally and inherit the same published template.

## Data and API Notes

Recommended API shape:
- `GET /admin/events/:eventId/template`
- `PUT /admin/events/:eventId/template`
- `POST /admin/events/:eventId/template-assets/presign`
- `POST /admin/events/:eventId/template-assets/confirm`
- `GET /slideshow/template?eventId=...`

The template payload should carry playback settings alongside the visual layout so the slideshow can render the same event-specific timing and animation choice everywhere.

Template save operations should validate:
- canvas ratio is positive and non-zero
- layer geometry stays within reasonable bounds
- referenced assets belong to the same event
- template payload remains within safe size limits

## Risks

- Svelte Flow may add bundle weight to the admin page
- A custom template document can grow large if we do not cap asset count and layer count
- Slideshow rendering must stay lightweight because it runs on a TV or projector machine

## Verification Strategy

- Unit test template save/load validation
- Unit test slideshow template rendering decisions
- Manual smoke test on a large-screen browser window
- Verify a published template persists after page reload
- Run `npm run check` from the relevant package root and treat any reported issue as a blocking failure before completion
