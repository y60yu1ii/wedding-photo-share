# Design Document: Guest Sign-In Wall Mode

## 1. Goal

Add a standalone event display mode that behaves like a living guest sign-in wall instead of a slideshow.

The wall should:
- show one representative photo per guest
- default to a grid layout
- keep older representative photos near the top and newer ones flowing downward
- let the wall accept new guest photos in real time
- animate inserts so the wall feels alive
- periodically reshuffle some newer cards upward with motion
- allow guests to choose which of their uploaded photos becomes their sign-in photo
- let organizers configure whether the wall shows only approved photos, all uploads, or an event-specific selection policy

This mode is independent from the existing slideshow player. It has its own route, its own rendering logic, and its own display behavior.

## 2. Scope

### In scope
- New public display route for the sign-in wall
- New event setting for wall display policy
- New guest-facing selection flow for choosing a representative photo
- Real-time insertion of new wall cards
- Card styling with a white polaroid-style frame, shadow, and pin
- Grid-first layout with dense but readable composition
- Occasional shuffle animation that repositions some newer cards upward
- Lightweight ambient motion such as card float, flip-in, or occasional butterfly flyby

### Out of scope
- Replacing the existing slideshow mode
- Automatic face detection or image quality scoring
- Complex drag-and-drop wall editing by guests
- Multi-screen synchronized wall composition
- Full WYSIWYG wall editor in the first iteration

## 3. Proposed Routes

### Public display
- `/event/[eventId]/wall`

This route renders the guest sign-in wall for venue screens, TVs, and projectors.

### Guest management
- `/myguest/[eventId]`

This page remains the place where a guest can view their uploads and choose their representative sign-in photo.

### Admin configuration
- `/admin/event/[eventId]`

The event detail page gains a wall configuration section that controls the wall display policy and links to the new display route.

## 4. Core Behavior

### 4.1 One representative photo per guest

Each guest is represented by exactly one active wall card.

Recommended identity resolution order:
1. stable guest identity key if present
2. normalized nickname
3. fallback to the first matching upload record for legacy data

The wall uses the selected representative photo for that guest. If a guest uploads multiple photos, only the chosen one is shown on the wall.

### 4.2 Guest photo selection

The guest can choose which upload becomes their sign-in photo from the guest gallery page.

Recommended interaction:
- show all photos uploaded by that guest
- mark the current representative photo clearly
- let the guest switch the representative choice with one action
- persist the choice immediately

The wall should update after the change without a full refresh.

### 4.3 Wall display policy

The event controls wall visibility through a single policy setting with two concrete values:
- `approved_only`
- `all_uploads`

This policy determines which uploads are eligible to appear on the wall. The admin UI can present it as a simple toggle or dropdown, but the persisted value should be an explicit enum.

Default:
- `approved_only` for a safe initial experience

But the setting must be editable per event because some organizers may want the wall to show everything live.

### 4.4 Ordering

Cards should normally be ordered from oldest to newest, flowing downward in the grid.

When a new card arrives:
- append it to the logical end of the wall
- animate it into place
- preserve the overall top-to-bottom reading direction

If the wall becomes dense, use the existing placement logic to fill the next available slot in the grid instead of reshuffling the whole surface every time.

### 4.5 Shuffle refresh

To avoid a static wall, the display occasionally performs a soft shuffle:
- select a small subset of recent cards
- animate them upward or into a slightly different slot
- keep the reordering subtle enough that the wall remains readable

This should feel like a gentle live rearrangement, not a hard reset.

## 5. Visual Design

### 5.1 Card style

Each card should look like a small polaroid:
- small photo area
- white border frame
- soft drop shadow
- tiny pin or tack at the top
- slight rotation variation per card

The style should feel playful and celebratory without becoming cluttered.

### 5.2 Grid composition

Use a dense grid as the default layout because it reads well on large venue screens and scales across many photos.

Design goals:
- maximize visible cards without making them tiny
- allow mixed portrait and landscape source photos to be cropped or fitted consistently
- maintain clear spacing so the wall does not collapse visually when it fills up

### 5.3 Ambient motion

Motion should be decorative, not essential.

Recommended effects:
- new card enters with a flip-in, pop, or rotate-and-settle animation
- cards have a very subtle float or shadow pulse
- occasional butterfly or small floating accent crosses the screen

Motion frequency should remain low enough that the wall never feels noisy.

## 6. Data Model

### 6.1 Guest identity

To support "same person" grouping and later editing, the system should track a stable guest identity key.

Recommended fields:
- `guestId` or `guestKey`
- `eventId`
- `nickname`
- `selectedPhotoId`
- `representativePhotoId`
- `displayPolicy`

Identity resolution order:
1. `guestKey` if present
2. normalized nickname within the event
3. first matching legacy upload record

The guest-facing client should persist a stable `guestKey` per event in local storage and submit it with upload and selection requests. If a record predates `guestKey`, the backend can fall back to nickname normalization so existing uploads still group correctly.

### 6.2 Photo record relationship

Each uploaded photo still exists as a normal photo record.

The wall view should resolve:
- which uploads belong to the guest
- which one is marked representative
- whether the photo is eligible for display under the current wall policy

### 6.3 Event settings

Add event-level settings for wall mode:
- wall enabled or disabled
- wall display policy
- optional shuffle interval
- optional animation intensity

These settings should live alongside existing event configuration instead of being hardcoded in the frontend.

## 7. API Design

### 7.1 Guest gallery

Guest-side API additions:
- `GET /myguest/:eventId/photos?nickname=...`
  - returns the guest's uploads plus representative selection metadata
- `PATCH /myguest/photos/:photoId/representative`
  - marks one of the guest's uploads as the representative sign-in photo

The same endpoints should accept `guestKey` as the primary selector when available, with nickname retained as a fallback for legacy compatibility.

### 7.2 Wall data

Wall API:
- `GET /wall/photos?eventId=...`

Response should include:
- event metadata relevant to display
- resolved wall cards
- eligibility state
- representative selection state
- timestamps for stable ordering

### 7.3 Realtime updates

WebSocket events should notify the wall about:
- new upload arrived
- representative photo changed
- photo deleted
- photo approval changed

The wall can then insert or update a card without polling.

## 8. Animation Design

### 8.1 Insert animation

When a new representative card appears:
- scale from slightly smaller size
- rotate a few degrees into place
- fade in quickly
- settle with a small spring motion

This gives the impression that the wall is being pinned in real time.

### 8.2 Shuffle animation

The periodic shuffle should:
- move only a subset of cards
- use a smooth position transition instead of a hard swap
- keep the layout coherent during motion

Prefer CSS transforms and transition timing functions that feel physical but not exaggerated.

### 8.3 Ambient accents

Butterfly flybys or similar accents should be rare and lightweight.

Rules:
- trigger them sparsely
- keep them on a separate layer from the photos
- do not block interaction or obscure faces

## 9. Administration

The admin event page should expose:
- whether the wall mode is enabled
- the wall visibility policy
- a link to open the wall display route
- a warning or note if the wall is set to show all uploads live

This keeps the event organizer in control of the public display policy.

## 10. Error Handling

The wall should fail gracefully if data cannot be loaded:
- show a minimal fallback state
- avoid breaking the whole page if a single card is malformed
- continue rendering valid cards even if one photo record is missing metadata

Guest selection should also be resilient:
- if the current representative photo is deleted, fall back to the earliest remaining eligible upload
- if no eligible upload remains, show a clear empty state in the guest page

## 11. Testing Strategy

### Unit tests
- resolve guest grouping by guest key and fallback nickname
- confirm only one representative photo is active per guest
- verify wall policy filters approved vs all uploads correctly
- verify ordering remains oldest-to-newest by default
- verify shuffle logic only repositions a limited subset of cards

### Integration tests
- guest can change their representative photo from `/myguest/[eventId]`
- wall route receives the new representative choice and updates live
- newly uploaded photos appear on the wall without a manual refresh

### Visual/manual checks
- inspect the grid on desktop and projector-sized viewports
- confirm the polaroid frame, shadow, and pin read clearly
- confirm the insert animation is visible but not distracting
- confirm shuffle motion does not scramble the wall’s readability

## 12. Risks and Tradeoffs

- Guest identity is ambiguous if only nickname exists and it is reused by multiple people.
- Heavy shuffle animations can make the wall feel chaotic if the interval is too short.
- Too many ambient accents can distract from the actual guest photos.
- A dense grid may become visually cluttered if card size is not tuned carefully.

## 13. Recommended Implementation Direction

Implement the wall as a dedicated display renderer backed by event settings and guest-specific representative selection metadata.

Use the existing guest photo flows as the basis for selection, then extend them so guests can mark a single representative photo.
Keep the wall logic separate from the slideshow logic so the two modes can evolve independently.
