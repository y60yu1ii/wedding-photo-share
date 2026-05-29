# Proposal: Fix Admin Delete Reappearance and Upload Presign 500

## Why

Production currently has two user-facing failures:

1. Admin delete appears successful, but deleted events reappear after refresh.
2. Guest upload fails at `POST /upload/presign` with HTTP 500.

Both issues break core event operation during active usage.

## What

Apply a targeted production bugfix covering:

- Event list consistency after admin delete (soft-delete correctness)
- Upload presign stability on DynamoDB write path
- Deployment artifact consistency between source handlers and `lambda-pkgs/*`

## Scope

- `admin` Lambda listing and delete visibility
- `upload` Lambda presign write behavior
- Frontend API path safety for IDs containing reserved URL characters
- Packaging/deploy path for Lambda assets used by CDK

## Out of Scope

- New product features
- UI redesign
- Schema redesign beyond minimum hotfix requirements
