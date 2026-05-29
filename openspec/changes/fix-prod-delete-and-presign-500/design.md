# Design: Targeted Production Hotfix

## Design Goals

1. Restore expected admin delete behavior after refresh.
2. Eliminate presign 500s without broad schema changes.
3. Keep changes minimal, reversible, and deploy-safe.

## Approach Options

### Option A (Recommended): Minimal behavioral hotfix
- Keep soft-delete model.
- Filter archived events at read path.
- Replace empty nickname with placeholder at presign.
- Encode path IDs in frontend.
- Sync `lambda/*` and `lambda-pkgs/*` for deployed handlers.

**Pros**
- Lowest risk and fastest recovery.
- No data migration required.

**Cons**
- Still relies on current soft-delete pattern.

### Option B: Hard-delete events + data cascade
- Delete event + related resources physically.

**Pros**
- No archived data to hide.

**Cons**
- Higher risk, irreversible mistakes, more code paths to validate.

### Option C: Keep behavior but alter GSI/index strategy
- Change photos index so presign doesn’t touch nickname key constraints.

**Pros**
- Avoid placeholder values.

**Cons**
- Requires schema/index change and migration; too heavy for incident hotfix.

## Chosen Design

Adopt Option A.

### Admin list/delete
- `DELETE /admin/events/:eventId`: keep `status = archived`.
- `GET /admin/events`: enforce filter to exclude archived.
- Verify deployed admin artifact contains this filter.

### Upload presign
- In pending record write, set `nickname = "__pending__"` (non-empty).
- On confirm, overwrite with validated real nickname.

### Frontend path safety
- Encode `photoId` (and similar path params) before composing API URLs.

### Deployment integrity
- CDK deploy source is `lambda-pkgs/*`; keep package artifacts synchronized with source handlers before deploy.

## Verification Plan

1. Admin create/delete/reload: deleted event must not reappear.
2. Upload presign returns 200 with valid key.
3. Upload PUT + confirm succeeds.
4. Admin approve succeeds for photo IDs containing `#`.
5. No upload `ValidationException` in CloudWatch logs.
