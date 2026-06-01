# Proposal: Expand Slideshow Animation and Sign-in Wall Motion

## Why

Current slideshow and sign-in wall motion options are limited and visually repetitive during long-running events.  
Admins also need a stronger frame editor to tune presentation style without code changes.

## What

Introduce a focused enhancement package that:

1. Adds multiple selectable slideshow transition presets.
2. Upgrades the frame editor from fixed styles to parameterized controls and reusable presets.
3. Makes butterfly and airplane motion paths on the sign-in wall more dynamic and organic.

## Scope

- Frontend slideshow transition system and selector UI
- Frame editor data model, controls, preview, and preset save/apply behavior
- Sign-in wall butterfly/airplane animation engine and interaction hooks
- Accessibility fallback for reduced motion preference
- Regression tests for animation selection and configuration persistence

## Out of Scope

- Backend API contract changes unrelated to animation/frame settings
- New media processing pipeline
- Full visual redesign of unrelated admin pages
