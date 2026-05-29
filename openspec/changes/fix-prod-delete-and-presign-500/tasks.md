# Tasks: fix-prod-delete-and-presign-500

## Investigation

- [x] Reproduce admin delete reappearance.
- [x] Reproduce upload presign 500.
- [x] Confirm presign root cause from CloudWatch logs.

## Fixes

- [x] Ensure admin list excludes archived events in deployed artifact.
- [x] Change upload presign pending record nickname from empty string to non-empty placeholder.
- [x] Ensure upload confirm still writes validated nickname.
- [x] Encode photo ID path params in frontend API client.
- [x] Sync `lambda/*` and `lambda-pkgs/*` for affected handlers.

## Verification

- [x] Deploy stack.
- [x] Smoke test: create event -> delete -> refresh list not reappearing.
- [x] Smoke test: upload presign returns 200.
- [x] Smoke test: upload+confirm+approve+slideshow/myguest flow.
- [x] Check CloudWatch UploadLambda logs contain no nickname-key ValidationException.
