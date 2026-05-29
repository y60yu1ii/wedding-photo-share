# Tasks: restore-broken-core-flows

## Phase 1 — Contract Alignment (Blockers)

- [x] Update frontend upload confirm call to include `key` query parameter.
- [x] Ensure upload page consistently carries `key` through full upload flow.
- [x] Align upload confirm status behavior with slideshow filtering strategy.
- [x] Normalize myguest API contract to `eventId + nickname` (frontend + backend).

## Phase 2 — Data Model + Query Fixes

- [x] Refactor websocket connection write/read to event-partition model (`EVENT-{eventId}`).
- [x] Replace websocket broadcast Scan pattern with Query on event partition.
- [x] Fix admin event photo listing to use correct GSI query strategy.
- [ ] Validate DynamoDB key/index usage in all affected Lambdas.

## Phase 3 — Verification Recovery

- [x] Fix `npm test` script to point to an existing command.
- [x] Stabilize unit test execution in this environment (remove watchman dependency path).
- [ ] Add regression tests for:
  - [x] upload -> confirm (valid key)
  - [x] upload confirm rejected (invalid key)
  - [x] slideshow visibility after approval
  - [x] myguest nickname lookup
  - [x] myguest delete nickname mismatch (403)
  - [x] websocket broadcast to event connections

## Phase 4 — Rollout Safety

- [ ] Produce migration notes for any contract changes impacting existing URLs.
- [ ] Verify local build + changed tests pass.
- [ ] Run staged deploy verification checklist for affected endpoints.
