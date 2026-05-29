# Open Issues — fix-prod-delete-and-presign-500

## 1) Admin delete reappears after refresh

### Symptom
- Admin panel DELETE returns success.
- Event disappears from current UI state.
- After refresh/reload, event appears again.

### Root Cause
- Event delete is soft-delete (`status = archived`), but production list path still returns archived records.
- Additional risk: source code and deployed `lambda-pkgs/admin` artifact drift can leave old list behavior online even if source was updated.

### Expected Fix
- Ensure list endpoint excludes `status = archived`.
- Ensure deployed artifact uses the same logic as source.

---

## 2) `POST /upload/presign` returns HTTP 500

### Symptom
- Upload page calls `/upload/presign?key=...`.
- API returns 500 repeatedly.

### Root Cause (confirmed from CloudWatch logs)
- DynamoDB `ValidationException` on photos write:
  - `eventId-nickname-index` has `nickname` as index key.
  - Presign flow writes `nickname: ""` (empty string), which is invalid for key attributes.

### Expected Fix
- Presign writes a non-empty placeholder nickname (e.g. `__pending__`) before confirm.
- Confirm replaces placeholder with sanitized real nickname.

---

## 3) Follow-on reliability issues found during smoke test

### Symptom
- Approve photo can fail when `photoId` contains `#`.

### Root Cause
- Frontend route uses raw `photoId` in URL path; `#` is treated as fragment unless encoded.

### Expected Fix
- Encode path parameters in frontend API client (`encodeURIComponent`).
