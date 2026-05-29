# Proposal: Event Slideshow Template Editor

## Why

Wedding hosts need a way to build a custom frame for each event, not just upload a static border image.
The slideshow also needs to feel more polished on a large screen by showing photos one at a time with visible transitions.

## What

Add an event-scoped slideshow template system that lets admins:

1. Create and edit a custom template for each event in a dedicated editor page
2. Upload decorative assets for use inside the template
3. Compose the template with image frames, text, and decorative elements
4. Preview the template against real event photos before publishing
5. Render the published template in the fullscreen slideshow with one-by-one animated transitions

## Scope

- Admin UI: new template editor page under `/admin/event/[eventId]/design`
- Admin API: template save/load/publish and decorative asset upload
- Slideshow UI: template-aware fullscreen rendering and transition animation
- Storage: event-scoped template data and event-scoped decorative assets

## Out of Scope

- Full photo editing tools such as filters, cropping, or retouching
- Collaborative real-time editing by multiple admins
- Video or GIF authoring inside the editor
- Sharing templates across different events by default
