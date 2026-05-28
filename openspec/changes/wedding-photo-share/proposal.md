# Proposal: Wedding Photo Share System

## Why

- Wedding guests want to share photos on the spot
- Traditional sharing (Google Photos link) is slow and requires account
- No existing tool combines QR upload + live TV slideshow + guest self-management

## What

A two-part web system:
1. **Upload + Guest Management** — guests scan QR, upload photos, later view/delete their own uploads via nickname
2. **Live Slideshow** — laptop connected to TV shows incoming photos in real-time with animations, controllable by staff

Plus an admin panel to manage events and keypairs.

## Scope

- Frontend: AWS Amplify (React)
- Backend: Go Lambda + API Gateway (REST + WebSocket) + S3 + DynamoDB
- One system supports multiple wedding events (multi-tenant via keypairs)
- Photos persist post-wedding, key can be swapped to convert to a keepsake album

## Out of Scope

- Photo editing / filters
- Social sharing outside the platform
- Video upload
- SMS/email notifications
