# slideshow Specification

## Purpose
Define the public slideshow playback, the event template data model, and the admin template editor contract for the wedding photo share system. The slideshow renders approved guest photos on a per-event display using an event-specific template, while the admin template editor lets operators design the canvas, layer decorations, and per-layer frame styling that the slideshow will then apply.

## Conventions

### Transition presets
The system SHALL support exactly eight `TemplateTransition` values, classified as legacy (3) and motion-expanded (5):

- Legacy: `fade`, `fade-scale`, `slide`
- Motion-expanded: `fade-soft`, `slide-parallax`, `stack-flip`, `kenburns`, `ribbon-flow`

### Layer types
A template layer SHALL be one of `photo-frame`, `text`, or `decorative-asset`.

### Frame model
A `FrameToken` is the resolved style applied to a `photo-frame` layer, containing `borderWidth`, `borderRadius`, `padding`, `shadow`, `color`, plus optional `backgroundColor`, `gradient`, `doubleBorder`, `texture`, and `glow`. A `FramePreset` is a named, reusable `FrameToken`. A layer MAY reference a preset via `framePresetId` and MAY override individual token fields via `frameTokenOverride`; overrides SHALL take precedence over the preset and any preset field not overridden SHALL inherit from the preset.

### Resource limits
Template canonicalization SHALL enforce `MAX_DIMENSION = 10000` per canvas side, `MAX_LAYER_COUNT = 100`, `MAX_ASSET_COUNT = 100`, and `MAX_FRAME_PRESET_COUNT = 32`.

### Presigned URL expiry
S3 presigned URLs generated for slideshow photos and template assets SHALL expire after 1 hour (3600 seconds).

### Runtime and recipe contract
The slideshow SHALL run on the GSAP animation library (`gsap` core, free Webflow licensing) as its sole runtime animation engine. CSS keyframes and CSS `transition` properties SHALL NOT be used to drive per-frame animation. Each `TemplateTransition` value SHALL be implemented as a pure function that takes a target element and a normalized config, and returns (or registers) a `gsap.core.Tween` or `gsap.core.Timeline` that performs the visual effect. The function contract SHALL be:

```ts
type TransitionRecipe = (
  target: HTMLElement | HTMLElement[],
  config: Required<TransitionConfig>,
) => gsap.core.Tween | gsap.core.Timeline;
```

A recipe function SHALL be referentially stable for a given `TemplateTransition` value, SHALL be side-effect free outside of registering tweens on the supplied target, and SHALL be safe to invoke multiple times for sequential slides (i.e. a recipe MUST call `gsap.killTweensOf(target)` on the targets it is about to animate, or the slideshow runtime SHALL call it before invoking the recipe).

### Easing vocabulary
`TransitionConfig.easing` values SHALL be mapped to GSAP ease strings. The mapping SHALL be exhaustive for the five values declared in `frontend/src/lib/api/types.ts`:

| TypeScript value | GSAP ease |
|---|---|
| `"linear"` | `"none"` |
| `"ease"` | `"power1.out"` |
| `"ease-in"` | `"power1.in"` |
| `"ease-out"` | `"power1.out"` |
| `"ease-in-out"` | `"power2.inOut"` |

### Reduced-motion binding
The slideshow SHALL use `gsap.matchMedia()` to bind the active recipe to a media query for `prefers-reduced-motion: reduce`. When the query matches, the slideshow SHALL swap the active recipe to a deterministic opacity-fade recipe of duration `<= 200ms` regardless of the configured `TemplateTransition`.

## Requirements

### Requirement: SLIDE-1 — Approved photo retrieval
The public slideshow endpoint SHALL return only photos whose status is `approved`, whose `confirmedAt` attribute exists, and whose nickname is not the sentinel `__pending__`, paginated by DynamoDB cursor with a default page size of 50 and a hard cap of 100.

#### Scenario: List approved photos for an event
- **GIVEN** an event with a mix of approved, pending, and unconfirmed photos
- **WHEN** the client calls `GET /slideshow/photos?eventId={id}&limit=50`
- **THEN** the response SHALL include only approved and confirmed photos, each carrying `PK`, `nickname`, `greeting`, `createdAt` (derived from `confirmedAt ?? uploadedAt ?? createdAt`), and a valid `presignedUrl`

#### Scenario: Paginate through older photos
- **GIVEN** an event with more than 50 approved photos
- **WHEN** the client calls `GET /slideshow/photos?eventId={id}&cursor={opaque}`
- **THEN** the response SHALL include the next page and a `nextCursor` while more pages remain, and an empty `nextCursor` when the page is final

#### Scenario: Reject missing eventId
- **WHEN** the client calls `GET /slideshow/photos` without an `eventId` query parameter
- **THEN** the system SHALL respond with HTTP 400 and an `eventId required` error

### Requirement: SLIDE-2 — Auto-advance with selectable transition presets
The public slideshow SHALL auto-advance through photos using the active template's `playback.intervalSeconds` (default 8s) and SHALL render the transition effect declared in `playback.transition` by invoking the corresponding GSAP recipe (see Conventions → Runtime and recipe contract). The slideshow runtime SHALL call `gsap.killTweensOf(target)` on the incoming and outgoing photo elements before invoking the recipe. Switching the transition preset at runtime SHALL NOT leave the current photo stuck mid-tween and SHALL NOT cause a blank frame; the runtime SHALL call the new recipe with `gsap.set(target, { clearProps: "all" })` first to reset transform/opacity.

#### Scenario: Advance on schedule
- **GIVEN** a template with `intervalSeconds = 6` and at least 2 photos
- **WHEN** 6 seconds elapse in presentation mode
- **THEN** the active photo SHALL advance to the next photo and the recipe for `playback.transition` SHALL be invoked against the new photo's element

#### Scenario: Apply fade-soft with GSAP ease mapping
- **GIVEN** a template with `transition: "fade-soft"`, `transitionSeconds: 0.6`, `transitionConfig: { durationMs: 600, easing: "ease-in-out" }`
- **WHEN** the recipe runs
- **THEN** it SHALL emit a `gsap.fromTo(target, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: "power2.inOut" })` tween and the target's inline `transform` SHALL be cleared at completion

#### Scenario: Slide-parallax emits a composed timeline
- **GIVEN** a template with `transition: "slide-parallax"` and two stacked layers (back + front)
- **WHEN** the recipe runs
- **THEN** it SHALL return a `gsap.timeline()` containing (a) a back-layer `gsap.fromTo` on `xPercent: 30 → 0` over the full duration and (b) a front-layer `gsap.fromTo` on `xPercent: 100 → 0` over the configured `durationMs` with `ease` derived from `TransitionConfig.easing`

#### Scenario: Kenburns runs for the full interval
- **GIVEN** a template with `transition: "kenburns"`, `intervalSeconds: 8`
- **WHEN** the recipe runs against the active image
- **THEN** it SHALL emit a `gsap.fromTo` on `scale: 1 → 1.12`, `x: 0 → -30`, `y: 0 → -15` with `duration: 8` and `ease: "none"` (linear over the full slide window) so the zoom completes in sync with the next auto-advance

#### Scenario: Switch preset safely during playback
- **GIVEN** an active slideshow rendering photo N with the `kenburns` recipe mid-tween
- **WHEN** the template is updated to `ribbon-flow`
- **THEN** the runtime SHALL call `gsap.killTweensOf(photoElN)` and `gsap.set(photoElN, { clearProps: "all" })`, then invoke the `ribbon-flow` recipe; photo N SHALL restart under the new preset without a blank frame and the next photo SHALL also use `ribbon-flow`

### Requirement: SLIDE-3 — Fullscreen presentation mode
The slideshow SHALL support a fullscreen presentation mode that fills the viewport with the active photo, dims non-photo chrome via a GSAP tween on the chrome container's `opacity`, and exits cleanly on user gesture or `fullscreenchange` loss. Entering and exiting presentation mode SHALL be driven by a GSAP timeline that animates the chrome container from its current `opacity` to the target value over a configurable duration.

#### Scenario: Enter fullscreen presentation
- **GIVEN** the public event page in non-presentation mode
- **WHEN** the user activates presentation mode
- **THEN** the browser SHALL enter fullscreen on the document element, presentation mode SHALL be marked active, the active photo SHALL render at `max-w-[92vw] max-h-[88vh]`, and a GSAP tween SHALL drive the chrome container's `opacity` from `1` to `0` over the configured enter duration

#### Scenario: Exit fullscreen on ESC
- **GIVEN** presentation mode is active
- **WHEN** the browser fires `fullscreenchange` with no fullscreen element
- **THEN** the runtime SHALL kill any in-flight presentation tween, deactivate presentation mode, and reverse the chrome `opacity` tween back to `1`

### Requirement: SLIDE-4 — Template layer rendering
The slideshow SHALL render template layers on top of the active photo in ascending `zIndex` order, positioning each layer with `left/top/width/height` as percentages of `template.canvas`, and dispatching to a layer-specific renderer based on `type`.

#### Scenario: Position layers relative to canvas
- **GIVEN** a template with canvas `1920x1080` and a layer at `(x=960, y=540, width=600, height=420)`
- **WHEN** the slideshow renders the layer
- **THEN** the layer's inline style SHALL resolve to `left:50%; top:50%; width:31.25%; height:38.888...%` and the parent container SHALL carry `aspect-ratio: 1920 / 1080`

#### Scenario: Render decorative-asset layer
- **GIVEN** a `decorative-asset` layer with `assetId` matching an uploaded template asset
- **WHEN** the slideshow renders the layer
- **THEN** the asset's presigned `previewUrl` SHALL be used as the `<img src>`

#### Scenario: Render text layer
- **GIVEN** a `text` layer with `text: "Hello"`, `fontSize: 28`, `color: "#ffffff"`, `align: "center"`
- **WHEN** the slideshow renders the layer
- **THEN** the text SHALL be rendered centered in white at 28px

#### Scenario: Layer entrance stagger via GSAP
- **GIVEN** a template with 3 layers and `transitionConfig.staggerMs = 80`
- **WHEN** a new photo is presented and the template overlay is mounted
- **THEN** the runtime SHALL emit a `gsap.fromTo` on each layer's `opacity` and `y` using a `stagger: 0.08` option, with the photo-frame layer entering first, then text and decorative-asset layers

#### Scenario: Omit template overlay when missing
- **GIVEN** an event with no published template
- **WHEN** the slideshow loads
- **THEN** the slideshow SHALL render the photo without template layers and SHALL NOT call any GSAP recipe for the overlay

### Requirement: SLIDE-5 — Frame token resolution with override precedence
The slideshow SHALL resolve the final `FrameToken` for a `photo-frame` layer by starting from the layer's referenced `FramePreset` (if any), merging the `frameTokenOverride` partial on top, and then falling back to per-layer `borderWidth` / `borderColor` / `borderRadius` / `backgroundColor` for backward compatibility. The resolved token SHALL be converted to inline CSS by `frameTokenToInlineStyle`.

#### Scenario: Layer without preset or override
- **GIVEN** a layer with no `framePresetId` and no `frameTokenOverride`
- **WHEN** `resolveLayerFrameToken` is called
- **THEN** the resolved token SHALL equal `DEFAULT_FRAME_TOKEN`

#### Scenario: Layer with preset but no override
- **GIVEN** a layer referencing a preset with `borderWidth: 8`
- **WHEN** `resolveLayerFrameToken` is called
- **THEN** the resolved token SHALL inherit `borderWidth: 8` from the preset

#### Scenario: Layer with override beats preset
- **GIVEN** a layer referencing a preset with `borderWidth: 8` and an override with `borderWidth: 12`
- **WHEN** `resolveLayerFrameToken` is called
- **THEN** the resolved token SHALL have `borderWidth: 12`

#### Scenario: Render inline style from token
- **GIVEN** a resolved token with `borderWidth: 4`, `borderColor: "#f5e9d7"`, `borderRadius: 12`
- **WHEN** `frameTokenToInlineStyle` is called
- **THEN** the output SHALL include `border: 4px solid #f5e9d7` and `border-radius: 12px`

### Requirement: SLIDE-6 — Reduced-motion fallback
The slideshow SHALL detect the user agent's `prefers-reduced-motion: reduce` preference via `gsap.matchMedia("(prefers-reduced-motion: reduce)", …)` and SHALL swap the active recipe to a deterministic opacity-only fade (duration `<= 200ms`, ease `"none"`) regardless of the configured `TemplateTransition`. The reduced-motion binding SHALL be re-evaluated when the page becomes visible or hidden to handle runtime preference changes.

#### Scenario: User has reduced motion enabled
- **GIVEN** the OS-level reduced-motion preference is `reduce`
- **WHEN** `gsap.matchMedia` evaluates the binding
- **THEN** the function passed to the reduced-motion branch SHALL be installed as the active recipe and `gsap.matchMedia` SHALL have called it with a `gsapContext` argument

#### Scenario: Motion preset downgrades under reduced motion
- **GIVEN** a template with `transition: "kenburns"` and reduced-motion enabled
- **WHEN** the slideshow advances to the next photo
- **THEN** the active recipe SHALL be the reduced-motion fade, the duration SHALL be `<= 200ms`, and no `scale`, `x`, or `y` properties SHALL be animated

#### Scenario: Runtime preference change is respected
- **GIVEN** the slideshow is mounted with reduced-motion disabled
- **WHEN** the user toggles reduced-motion to `reduce` at the OS level
- **THEN** the next photo advance SHALL use the reduced-motion recipe and the next subsequent toggle back to no-preference SHALL restore the configured recipe

### Requirement: SLIDE-7 — Live photo push via WebSocket
The slideshow SHALL subscribe to the event's WebSocket and SHALL prepend a newly approved photo (with a presigned URL) to the local list and bump `transitionVersion` so the active frame animates to the new photo in presentation mode. On `delete_photo` messages the slideshow SHALL remove the photo and adjust `activeIndex` if it was pointing at the removed one.

#### Scenario: New approved photo received
- **GIVEN** the slideshow is mounted and presentation mode is active
- **WHEN** a WebSocket message of type `new_photo` arrives with `s3Key`, `nickname`, `greeting`
- **THEN** the photo SHALL be prepended to `photos`, `activeIndex` SHALL become 0, and `transitionVersion` SHALL increment by 1

#### Scenario: Greeting triggers GSAP-driven danmaku
- **GIVEN** a `new_photo` message with non-empty `greeting`
- **WHEN** the message is processed
- **THEN** the danmaku item SHALL spawn in the lowest available of 5 tracks and SHALL animate via a `gsap.fromTo` on `xPercent` from `100` to `-100` over `4.5s` with `ease: "none"`, auto-destroying the element in its `onComplete` callback

#### Scenario: Delete photo that is not active
- **GIVEN** the slideshow has 5 photos and `activeIndex = 2`
- **WHEN** a `delete_photo` message for photo PK at index 4 arrives
- **THEN** the photo SHALL be removed and `activeIndex` SHALL remain 2

#### Scenario: Delete active photo
- **GIVEN** the slideshow has 1 photo and `activeIndex = 0`
- **WHEN** a `delete_photo` message for that photo arrives
- **THEN** the photo SHALL be removed and the slideshow SHALL render an empty state

#### Scenario: Reconnect on close
- **GIVEN** the WebSocket is open
- **WHEN** the socket closes unexpectedly
- **THEN** the client SHALL schedule a reconnect after 3000ms

### Requirement: SLIDE-8 — GSAP lifecycle hygiene
The slideshow runtime SHALL manage GSAP resources deterministically across mount, photo swap, preset switch, fullscreen exit, and unmount. A `gsap.context()` SHALL be created at the slideshow component's mount and SHALL have `revert()` invoked on unmount. On every photo swap, the runtime SHALL call `gsap.killTweensOf` on the outgoing photo element and on the chrome container before invoking the next recipe.

#### Scenario: Unmount cleans up all tweens
- **GIVEN** an active slideshow with a kenburns tween running on photo N
- **WHEN** the user navigates away from the event page
- **THEN** the component's `gsap.context().revert()` SHALL run, killing all in-flight tweens, and the next mount SHALL NOT observe any leaked tween state

#### Scenario: Photo swap kills the previous tween
- **GIVEN** a kenburns tween running on photo N
- **WHEN** the slideshow advances to photo N+1
- **THEN** the runtime SHALL call `gsap.killTweensOf(photoElN)` before invoking the recipe against photoElN+1

#### Scenario: Preset switch resets the target
- **GIVEN** a slide-parallax tween running with `xPercent: 50` mid-flight on photo N
- **WHEN** the operator switches the template's transition to `kenburns`
- **THEN** the runtime SHALL call `gsap.set(photoElN, { clearProps: "all" })` before invoking the new recipe; the photo SHALL restart with no leftover `xPercent` transform

#### Scenario: Fullscreen exit kills chrome tween
- **GIVEN** an opacity tween animating the chrome container from `1` to `0` mid-flight
- **WHEN** the browser fires `fullscreenchange` with no fullscreen element
- **THEN** the runtime SHALL call `gsap.killTweensOf(chromeEl)` and SHALL reverse the chrome opacity back to `1` via a fresh `gsap.to`

#### Scenario: MatchMedia context scoped to the slideshow
- **GIVEN** a slideshow instance has installed a `gsap.matchMedia` reduced-motion binding
- **WHEN** the user navigates to a different event page
- **THEN** the matchMedia binding SHALL be torn down as part of the `gsap.context().revert()` so it does not leak to the next mount

### Requirement: ADMIN-SLIDE-1 — Template editor loads draft and preview photos
The admin template editor SHALL fetch the event, the event's photo list (for preview), and the event's template via parallel `events.get`, `events.photos`, `templates.get` calls. The template SHALL be hydrated with `defaultFramePresets()` when its `framePresets` is empty or missing.

#### Scenario: Editor loads with no existing template
- **GIVEN** an event with no stored template
- **WHEN** the editor mounts
- **THEN** `template` SHALL be a `defaultTemplate()` with `framePresets` populated from `defaultFramePresets()` and `nodes` SHALL be empty

#### Scenario: Editor loads with existing template
- **GIVEN** a stored template with 3 layers and 2 frame presets
- **WHEN** the editor mounts
- **THEN** `nodes` SHALL contain 3 nodes sorted by `zIndex` ascending, each carrying its layer data and the matching asset `previewUrl` (if applicable), and `publishedTemplate` SHALL reflect the server response

#### Scenario: Unauthenticated access redirected
- **GIVEN** no admin token in storage
- **WHEN** the editor mounts
- **THEN** the page SHALL navigate to `/admin/login`

### Requirement: ADMIN-SLIDE-2 — Decorative asset upload
The admin template editor SHALL upload decorative assets via a two-step presign + S3 PUT + confirm flow. The confirm step SHALL add the asset to the template's `assets` list and SHALL redecorate existing nodes' `assetPreviewUrl` values.

#### Scenario: Upload a new PNG asset
- **GIVEN** an editor with a selected file `image/png` ≤ size limit
- **WHEN** the upload flow runs
- **THEN** the system SHALL call `POST /admin/events/{id}/template-assets/presign`, PUT the file to S3, and call `POST /admin/events/{id}/template-assets/confirm` with the returned `assetId` and `assetKey`

#### Scenario: S3 PUT failure surfaces error
- **GIVEN** the presigned S3 PUT returns a non-2xx response
- **WHEN** the upload flow runs
- **THEN** the system SHALL reject with `素材上傳失敗 ({status})` and SHALL NOT call the confirm endpoint

### Requirement: ADMIN-SLIDE-3 — Save draft and publish
The admin template editor SHALL persist the working template to the server via `PUT /admin/events/{id}/template` with `{ template, publish }`. The server SHALL canonicalize the body via `normalizeTemplate`, validate it via `validateTemplate`, and persist `templateDraft` always and `templatePublished` only when `publish === true`. The response SHALL return the canonicalized template and (when applicable) the published template.

#### Scenario: Save draft only
- **GIVEN** the editor's working template has unsaved layer changes
- **WHEN** the operator clicks Save
- **THEN** the server SHALL persist `templateDraft` and SHALL NOT modify `templatePublished`; the editor SHALL reload from the response

#### Scenario: Publish on save
- **GIVEN** the operator clicks Publish
- **WHEN** the request reaches the server with `publish: true`
- **THEN** the server SHALL persist `templateDraft` and update `templatePublished` to the same canonical template; `publishedTemplate` SHALL be returned in the response

#### Scenario: Reject invalid template
- **GIVEN** a template whose canvas width exceeds `MAX_DIMENSION`
- **WHEN** the request reaches the server
- **THEN** the server SHALL respond with HTTP 400 and an `Invalid template canvas` error

#### Scenario: Reject too many layers
- **GIVEN** a template with 101 layers
- **WHEN** the request reaches the server
- **THEN** the server SHALL respond with HTTP 400 and a `Too many template layers` error

### Requirement: ADMIN-SLIDE-4 — Frame preset CRUD
The admin template editor SHALL let operators create, rename, update, and delete `FramePreset` entries on the template's `framePresets` list. A preset SHALL be assignable to any `photo-frame` layer via `framePresetId`. Layer-level `frameTokenOverride` SHALL be preserved when the preset changes.

#### Scenario: Add a custom preset
- **GIVEN** an editor with 2 existing presets
- **WHEN** the operator adds a new preset named "自訂相框"
- **THEN** `template.framePresets.length` SHALL become 3 and the new preset SHALL have a fresh `id` and the captured token

#### Scenario: Apply preset to selected layer
- **GIVEN** a `photo-frame` layer with no `framePresetId` and the operator selects preset P
- **WHEN** the apply action runs
- **THEN** the layer's `data.framePresetId` SHALL equal P's id, `frameTokenOverride` SHALL be cleared, and the resolved token SHALL match P's token

#### Scenario: Persist preset list across save
- **GIVEN** an editor with 3 custom presets
- **WHEN** the operator saves the template
- **THEN** the server SHALL persist all 3 presets and the editor SHALL reload them on the next mount

## Verification

### Test levels
The slideshow system SHALL be verified at three levels:

1. **Unit (frontend, Vitest)** — pure functions and components: `frameToken`, `slideshowTransition` (now GSAP recipe registry), `wall`, `wallMotion`, `SignInWallCard`, `HomePage`, `events`, `api`. The GSAP module SHALL be mocked via `vi.mock("gsap")` so recipe tests assert that the recipe calls the documented GSAP API shape (`gsap.fromTo` args, `gsap.timeline()` structure, `gsap.matchMedia` registration, `gsap.killTweensOf` and `gsap.set` hygiene calls) without spinning real animation.
2. **Unit (backend, Jest)** — Lambda handlers and shared modules: `template.ts` (`normalizeTemplate`, `validateTemplate`, `isTemplateTransition`, `makeAssetKey`), `slideshow/index.ts`, `admin/index.ts` (template routes), `pagination.ts`.
3. **End-to-end (Playwright)** — full user journeys in a real browser: `basic.spec.ts` (smoke), `signin-wall.spec.ts` (sign-in wall motion), and — required for this spec — `slideshow.spec.ts` and `admin-template-editor.spec.ts`. Playwright tests SHALL be able to override `prefers-reduced-motion` via `page.emulateMedia({ reducedMotion: "reduce" })` to exercise the SLIDE-6 fallback path.

### Scenario coverage target
Each `Requirement` in this spec SHALL map to **at least one** test in the `test/lambda/` or `frontend/tests/unit/` tree, or SHALL carry a `[GAP]` marker naming the missing test. The `Verification` section below enumerates the current gap map as of the spec's authoring date.

### Required verification commands
- `npm --prefix frontend run test` — Vitest
- `npm --prefix frontend run check` — svelte-check + tsc
- `npm --prefix frontend run build` — SvelteKit build
- `npm run test` — Jest (backend)

## Test coverage map (current state vs spec)

The following table records the verifiable test inventory as of 2026-06-01. A `[GAP]` cell means the requirement has no dedicated test today and a follow-up is required.

| Requirement | Unit (frontend) | Unit (backend) | E2E |
|---|---|---|---|
| SLIDE-1 — Approved photo retrieval | `[GAP: no dedicated test]` | `test/lambda/slideshow.test.ts` | `[GAP: no e2e]` |
| SLIDE-2 — Auto-advance with transitions | `slideshowTransition.test.ts` (normalization only) | `[GAP: handler returns template payload only]` | `[GAP: no e2e]` |
| SLIDE-3 — Fullscreen presentation | `[GAP: no test]` | n/a | `[GAP: no e2e]` |
| SLIDE-4 — Template layer rendering | `[GAP: no test for layer renderer]` | n/a | `[GAP: no e2e]` |
| SLIDE-5 — Frame token resolution | `frameToken.test.ts` | n/a | n/a |
| SLIDE-6 — Reduced-motion fallback | `slideshowTransition.test.ts` | n/a | `[GAP: no e2e with media query override]` |
| SLIDE-7 — WebSocket live push | `[GAP: no test for ws handler in event page]` | `test/lambda/websocket.test.ts` (handler only) | `[GAP: no e2e]` |
| SLIDE-8 — GSAP lifecycle hygiene | `eventPage.gsap.test.ts` (wiring) + `slideshowGsap.test.ts` (killTweensOf) | n/a | `frontend/tests/e2e/slideshow.spec.ts` |
| ADMIN-SLIDE-1 — Editor load | `[GAP: no test for admin design page mount]` | `test/lambda/admin.test.ts` (GET template) | `[GAP: no e2e]` |
| ADMIN-SLIDE-2 — Asset upload | `[GAP: no test for presign+confirm orchestration]` | `test/lambda/admin.test.ts` (presign/confirm routes only) | `[GAP: no e2e]` |
| ADMIN-SLIDE-3 — Save / publish | `[GAP: no test for save flow]` | `test/lambda/admin.test.ts` (PUT template) | `[GAP: no e2e]` |
| ADMIN-SLIDE-4 — Frame preset CRUD | `[GAP: no test for preset list mutations]` | `[GAP: not isolated from admin.test.ts]` | `[GAP: no e2e]` |

### Known gaps requiring follow-up
- `[GAP] E2E coverage for slideshow playback` — add `frontend/tests/e2e/slideshow.spec.ts` covering SLIDE-2, SLIDE-3, SLIDE-4, SLIDE-6, SLIDE-7, SLIDE-8. Use `page.emulateMedia({ reducedMotion: "reduce" })` to drive the SLIDE-6 fallback.
- `[GAP] E2E coverage for admin template editor` — add `frontend/tests/e2e/admin-template-editor.spec.ts` covering ADMIN-SLIDE-1..4.
- `[GAP] Isolated `template.ts` test file` — current coverage is indirect via `test/lambda/admin.test.ts`; lift to a direct `test/lambda/template.test.ts` for `normalizeTemplate`, `validateTemplate`, `isTemplateTransition`, `makeAssetKey`.
- `[GAP] `slideshow.test.ts` does not exercise the `ribbon-flow` / `kenburns` payload paths` — extend with a payload snapshot round-trip.
- `[GAP] WebSocket reconnect/back-off not unit tested` — cover the 3000ms back-off and `eventId` param reattachment.

## Out of Scope
The following are explicitly out of scope for this specification and are tracked separately:
- Scheduled / unattended playback
- Photo download (zip export)
- QR code generation for guest entry
- Internationalization (i18n)
- Analytics and observability dashboards
- Backend media processing pipeline
- Full visual redesign of unrelated admin pages
