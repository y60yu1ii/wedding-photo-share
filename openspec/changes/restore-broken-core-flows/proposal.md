# Proposal: Restore Broken Core Flows

## Why

Current system behavior is inconsistent with OpenSpec requirements across upload, slideshow, myguest, websocket, and admin photo review paths.  
These mismatches cause user-visible failures (403, empty lists, no real-time updates, and missing photos in slideshow).

## What

Define and execute a focused recovery change that:

1. Aligns frontend/backend API contracts
2. Aligns DynamoDB data model usage with query patterns
3. Restores end-to-end core flows:
   - guest upload
   - admin approve
   - slideshow display + realtime update
   - myguest lookup/delete
4. Restores runnable verification commands and minimal regression coverage

## Scope

- Lambda handlers: `upload`, `slideshow`, `myguest`, `websocket`, `admin`
- Frontend API client and affected pages
- CDK wiring only when needed for contract/data-model alignment
- Unit/E2E verification scripts needed to prove flow recovery

## Out of Scope

- New product features
- UI redesign
- Large refactors unrelated to flow recovery
- Infrastructure hardening unrelated to current breakages
