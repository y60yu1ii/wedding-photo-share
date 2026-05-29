# Guest Sign-In Wall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone guest sign-in wall mode that shows one representative photo per guest in a grid, updates live as guests upload, and lets guests choose which upload becomes their sign-in photo.

**Architecture:** Keep guest identity, representative-photo selection, and wall display policy in the backend so the public wall and guest-management pages read the same source of truth. Expose a dedicated `/wall/photos` API and a matching frontend route, then layer the polaroid card styling, shuffle motion, and ambient accents on top of a small set of pure helper functions so the layout logic stays testable.

**Tech Stack:** SvelteKit 5, Svelte 5 runes, TypeScript, AWS Lambda, DynamoDB, S3, API Gateway HTTP API, Jest, Vitest, `svelte-check`, CSS animations.

---

### Task 1: Add guest identity and representative-photo APIs in the backend

**Files:**
- Modify: `lambda/upload/index.ts`
- Modify: `lambda/myguest/index.ts`
- Create: `lambda/wall/index.ts`
- Modify: `lib/wedding-photo-stack.ts`
- Create: `lambda-pkgs/wall/index.js`
- Test: `test/lambda/upload.test.ts`
- Test: `test/lambda/myguest.test.ts`
- Test: `test/lambda/wall.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test("POST /upload/confirm persists guestKey and representative metadata", async () => {
  const event = {
    requestContext: { http: { method: "POST", path: "/upload/confirm" } },
    body: JSON.stringify({
      eventId: "EVENT-1",
      photoId: "PHOTO-1",
      nickname: "Alice",
      guestKey: "guest-abc",
      greeting: "祝新婚快樂",
    }),
  };
  const result = await handler(event as any);
  expect(result.statusCode).toBe(200);
  expect(mockDdbSend.mock.calls[0][0].input.Item.guestKey).toBe("guest-abc");
});

test("PATCH /myguest/photos/:photoId/representative updates the chosen photo", async () => {
  const event = {
    requestContext: { http: { method: "PATCH", path: "/myguest/photos/PHOTO-2/representative" } },
    body: JSON.stringify({ eventId: "EVENT-1", guestKey: "guest-abc" }),
  };
  const result = await handler(event as any);
  expect(result.statusCode).toBe(200);
});

test("GET /wall/photos returns one representative photo per guest in oldest-first order", async () => {
  mockDdbSend.mockResolvedValueOnce({
    Item: { PK: "EVENT-1", SK: "METADATA", wallPolicy: "approved_only" },
  });
  mockDdbSend.mockResolvedValueOnce({
    Items: [
      { PK: "PHOTO#1", eventId: "EVENT-1", guestKey: "guest-abc", nickname: "Alice", representativePhotoId: "PHOTO#1", status: "approved", createdAt: "2026-05-29T00:00:01.000Z", s3Key: "k1" },
      { PK: "PHOTO#2", eventId: "EVENT-1", guestKey: "guest-abc", nickname: "Alice", representativePhotoId: "PHOTO#1", status: "approved", createdAt: "2026-05-29T00:00:02.000Z", s3Key: "k2" },
    ],
  });
  const result = await handler({
    requestContext: { http: { method: "GET", path: "/wall/photos" } },
    queryStringParameters: { eventId: "EVENT-1" },
  } as any);
  expect(result.statusCode).toBe(200);
  expect(JSON.parse(result.body).photos).toHaveLength(1);
  expect(JSON.parse(result.body).photos[0].PK).toBe("PHOTO#1");
});
```

- [ ] **Step 2: Run the targeted tests and confirm they fail**

Run:
```bash
npm run test:unit -- test/lambda/upload.test.ts test/lambda/myguest.test.ts test/lambda/wall.test.ts
```

Expected: fail because `guestKey`, representative selection, and `/wall/photos` do not exist yet.

- [ ] **Step 3: Add the backend data flow and route wiring**

```ts
// lambda/upload/index.ts
type ConfirmBody = {
  eventId: string;
  photoId: string;
  nickname: string;
  guestKey?: string;
  greeting?: string;
};

// Store guestKey when present so later uploads and representative changes group correctly.

// lambda/myguest/index.ts
// GET /myguest/photos?eventId=...&guestKey=...
// PATCH /myguest/photos/:photoId/representative
// -> mark the selected photo as representativePhotoId for that guestKey

// lambda/wall/index.ts
// GET /wall/photos?eventId=...
// -> load event.wallPolicy, query eligible photos, group by guestKey, keep the oldest eligible representative card per guest
// -> presign the chosen photo and return cards ordered oldest-to-newest

// lib/wedding-photo-stack.ts
// Add a new WallLambda, grant read access to EVENTS_TABLE / PHOTOS_TABLE / PHOTO_BUCKET,
// and register GET /wall/photos on the HTTP API.
```

- [ ] **Step 4: Re-run the targeted tests and bundle the new lambda**

Run:
```bash
npm run test:unit -- test/lambda/upload.test.ts test/lambda/myguest.test.ts test/lambda/wall.test.ts
npx esbuild lambda/wall/index.ts --bundle --platform=node --format=cjs --target=node20 --outfile=lambda-pkgs/wall/index.js
```

Expected: tests pass and `lambda-pkgs/wall/index.js` is regenerated for CDK deployment.

- [ ] **Step 5: Commit**

```bash
git add lambda/upload/index.ts lambda/myguest/index.ts lambda/wall/index.ts lambda-pkgs/wall/index.js lib/wedding-photo-stack.ts test/lambda/upload.test.ts test/lambda/myguest.test.ts test/lambda/wall.test.ts
git commit -m "feat(backend): add guest sign-in wall data flow"
```

### Task 2: Add shared frontend wall types and pure layout helpers

**Files:**
- Create: `frontend/src/lib/utils/wall.ts`
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/lib/api/client.ts`
- Test: `frontend/tests/unit/wall.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildWallCards, chooseRepresentativePhoto, shuffleWallCards } from "$lib/utils/wall";

describe("wall helpers", () => {
  it("keeps one representative card per guest and orders oldest first", () => {
    const cards = buildWallCards([
      { PK: "PHOTO#1", guestKey: "guest-abc", nickname: "Alice", status: "approved", createdAt: "2026-05-29T00:00:01.000Z", representativePhotoId: "PHOTO#1", presignedUrl: "https://example.com/1.jpg" },
      { PK: "PHOTO#2", guestKey: "guest-abc", nickname: "Alice", status: "approved", createdAt: "2026-05-29T00:00:02.000Z", representativePhotoId: "PHOTO#1", presignedUrl: "https://example.com/2.jpg" },
    ], "approved_only");

    expect(cards).toHaveLength(1);
    expect(cards[0].photoId).toBe("PHOTO#1");
  });

  it("selects a photo by id and keeps the guest grouping stable", () => {
    expect(chooseRepresentativePhoto([{ photoId: "PHOTO#1" }, { photoId: "PHOTO#2" }], "PHOTO#2").photoId).toBe("PHOTO#2");
  });

  it("soft-shuffles only a small recent subset", () => {
    const shuffled = shuffleWallCards(
      [{ photoId: "PHOTO#1" }, { photoId: "PHOTO#2" }, { photoId: "PHOTO#3" }, { photoId: "PHOTO#4" }],
      2,
    );
    expect(shuffled.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run the targeted frontend test and confirm it fails**

Run:
```bash
cd frontend && npx vitest run tests/unit/wall.test.ts
```

Expected: fail because `frontend/src/lib/utils/wall.ts` and the wall-specific API types do not exist yet.

- [ ] **Step 3: Add the shared types, API methods, and pure helpers**

```ts
// frontend/src/lib/api/types.ts
export type WallPolicy = "approved_only" | "all_uploads";

export type GuestUpload = {
  PK: string;
  eventId: string;
  nickname: string;
  guestKey?: string;
  representativePhotoId?: string;
  status: "pending" | "approved";
  createdAt: string;
  s3Key?: string;
  presignedUrl?: string;
};

export type WallCard = {
  photoId: string;
  guestKey: string;
  nickname: string;
  createdAt: string;
  presignedUrl: string;
  status: "pending" | "approved";
};

// frontend/src/lib/api/client.ts
wall: {
  async photos(eventId: string) {
    const res = await request(`/wall/photos?eventId=${encodeURIComponent(eventId)}`);
    if (!res.ok) throw new Error("取得簽到牆失敗");
    return res.json() as Promise<{ eventId: string; wallPolicy: WallPolicy; photos: GuestUpload[] }>;
  },
},
myguest: {
  async photos(eventId: string, guestKey: string, nickname: string) {
    const res = await request(`/myguest/photos?eventId=${encodeURIComponent(eventId)}&guestKey=${encodeURIComponent(guestKey)}&nickname=${encodeURIComponent(nickname)}`);
    if (!res.ok) throw new Error("取得上傳記錄失敗");
    return res.json() as Promise<{ photos: GuestUpload[] }>;
  },
  async setRepresentative(photoId: string, eventId: string, guestKey: string) {
    const res = await request(`/myguest/photos/${encodeURIComponent(photoId)}/representative`, {
      method: "PATCH",
      body: JSON.stringify({ eventId, guestKey }),
    });
    if (!res.ok) throw new Error("更新簽到照片失敗");
  },
},

// frontend/src/lib/utils/wall.ts
export function chooseRepresentativePhoto<T extends { photoId: string }>(photos: T[], selectedPhotoId: string): T {
  return photos.find((photo) => photo.photoId === selectedPhotoId) ?? photos[0];
}

export function buildWallCards(photos: GuestUpload[], wallPolicy: WallPolicy): WallCard[] {
  const eligible = wallPolicy === "approved_only" ? photos.filter((photo) => photo.status === "approved") : photos;
  const byGuest = new Map<string, GuestUpload>();
  for (const photo of eligible.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const key = photo.guestKey ?? photo.nickname.trim().toLowerCase();
    const chosen = byGuest.get(key);
    if (!chosen || chosen.PK === photo.representativePhotoId) byGuest.set(key, photo);
  }
  return [...byGuest.values()].map((photo) => ({
    photoId: photo.PK,
    guestKey: photo.guestKey ?? photo.nickname.trim().toLowerCase(),
    nickname: photo.nickname,
    createdAt: photo.createdAt,
    presignedUrl: photo.presignedUrl ?? "",
    status: photo.status,
  }));
}

export function shuffleWallCards(cards: WallCard[], recentCount = 4): WallCard[] {
  if (cards.length <= recentCount) return [...cards];
  const head = cards.slice(0, cards.length - recentCount);
  const tail = cards.slice(cards.length - recentCount);
  return [...tail.slice(1), tail[0], ...head];
}
```

- [ ] **Step 4: Re-run the frontend test and the typecheck**

Run:
```bash
cd frontend && npx vitest run tests/unit/wall.test.ts && npm run check
```

Expected: pass once the helpers and API methods are wired up.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api/types.ts frontend/src/lib/api/client.ts frontend/src/lib/utils/wall.ts frontend/tests/unit/wall.test.ts
git commit -m "feat(frontend): add wall selection helpers"
```

### Task 3: Update guest and admin pages for sign-in-photo selection and wall settings

**Files:**
- Modify: `frontend/src/routes/event/[eventId]/upload/+page.svelte`
- Modify: `frontend/src/routes/myguest/[eventId]/+page.svelte`
- Modify: `frontend/src/routes/admin/event/[eventId]/+page.svelte`
- Modify: `frontend/src/lib/api/client.ts`
- Create: `frontend/src/lib/components/GuestRepresentativePicker.svelte`
- Create: `frontend/src/lib/components/WallPolicySelect.svelte`
- Test: `frontend/tests/unit/wall-selection.test.ts`

- [ ] **Step 1: Write the failing UI test**

```ts
import { describe, expect, it } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import GuestRepresentativePicker from "$lib/components/GuestRepresentativePicker.svelte";
import WallPolicySelect from "$lib/components/WallPolicySelect.svelte";

describe("guest representative selection", () => {
  it("marks a photo as the selected sign-in photo", async () => {
    const { getByRole, getByText } = render(GuestRepresentativePicker, {
      props: {
        selectedPhotoId: "PHOTO#1",
        photos: [
          { PK: "PHOTO#1", nickname: "Alice", presignedUrl: "https://example.com/1.jpg" },
          { PK: "PHOTO#2", nickname: "Alice", presignedUrl: "https://example.com/2.jpg" },
        ],
      },
    });
    await fireEvent.click(getByRole("button", { name: "設為簽到照", hidden: true }));
    expect(getByText("目前簽到照")).toBeTruthy();
  });

  it("lets the admin switch the wall policy", async () => {
    const { getByRole } = render(WallPolicySelect, {
      props: { value: "approved_only" },
    });
    await fireEvent.change(getByRole("combobox"), { target: { value: "all_uploads" } });
    expect((getByRole("combobox") as HTMLSelectElement).value).toBe("all_uploads");
  });
});
```

- [ ] **Step 2: Run the targeted frontend test and confirm it fails**

Run:
```bash
cd frontend && npx vitest run tests/unit/wall-selection.test.ts
```

Expected: fail because the pages do not yet expose representative-photo selection or wall policy controls.

- [ ] **Step 3: Add the selection UX and the event wall settings panel**

```svelte
<!-- frontend/src/routes/event/[eventId]/upload/+page.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  let guestKey = $state("");
  onMount(() => {
    const saved = localStorage.getItem(`guest_key:${eventId}`);
    guestKey = saved ?? crypto.randomUUID();
    localStorage.setItem(`guest_key:${eventId}`, guestKey);
  });
  // send guestKey with upload.confirm so the backend can group uploads reliably
</script>

<!-- frontend/src/routes/myguest/[eventId]/+page.svelte -->
<GuestRepresentativePicker
  {photos}
  {selectedPhotoId}
  on:choose={(event) => setRepresentative(event.detail.photoId)}
/>

<!-- frontend/src/routes/admin/event/[eventId]/+page.svelte -->
<WallPolicySelect bind:value={event.wallPolicy} on:change={(event) => saveWallPolicy(event.detail.value)} />

<a href={`/event/${eventId}/wall`} class="inline-flex items-center gap-2 rounded-full border px-4 py-2">
  打開簽到牆
</a>
```

- [ ] **Step 4: Re-run the frontend test and the full frontend check**

Run:
```bash
cd frontend && npx vitest run tests/unit/wall-selection.test.ts && npm run check
```

Expected: pass after the pages persist guest keys, update representative photos, and save wall policy.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/event/[eventId]/upload/+page.svelte frontend/src/routes/myguest/[eventId]/+page.svelte frontend/src/routes/admin/event/[eventId]/+page.svelte frontend/src/lib/api/client.ts frontend/tests/unit/wall-selection.test.ts
git commit -m "feat(frontend): add guest sign-in photo controls"
```

### Task 4: Build the standalone wall page with polaroid cards, insert motion, and soft shuffle

**Files:**
- Create: `frontend/src/routes/event/[eventId]/wall/+page.svelte`
- Create: `frontend/src/lib/components/SignInWallCard.svelte`
- Create: `frontend/src/lib/components/WallAccent.svelte`
- Modify: `frontend/src/app.css`
- Test: `frontend/tests/unit/SignInWallCard.test.svelte`
- Test: `frontend/tests/e2e/signin-wall.spec.ts`

- [ ] **Step 1: Write the failing visual and unit tests**

```ts
// frontend/tests/unit/SignInWallCard.test.svelte
import { render } from "@testing-library/svelte";
import SignInWallCard from "$lib/components/SignInWallCard.svelte";

it("renders a polaroid frame with a pin and shadow", () => {
  const { getByTestId } = render(SignInWallCard, {
    props: {
      card: {
        photoId: "PHOTO#1",
        guestKey: "guest-abc",
        nickname: "Alice",
        createdAt: "2026-05-29T00:00:01.000Z",
        presignedUrl: "https://example.com/photo.jpg",
        status: "approved",
      },
    },
  });
  expect(getByTestId("sign-in-wall-card")).toBeTruthy();
});

// frontend/tests/e2e/signin-wall.spec.ts
test("wall route loads and keeps the oldest cards at the top", async ({ page }) => {
  await page.goto("/event/EVENT-1/wall");
  await expect(page.getByTestId("sign-in-wall-grid")).toBeVisible();
});
```

- [ ] **Step 2: Run the targeted tests and confirm they fail**

Run:
```bash
cd frontend && npx vitest run tests/unit/SignInWallCard.test.svelte && npx playwright test tests/e2e/signin-wall.spec.ts
```

Expected: fail because the route and card components do not exist yet.

- [ ] **Step 3: Implement the wall renderer and motion layer**

```svelte
<!-- frontend/src/lib/components/SignInWallCard.svelte -->
<script lang="ts">
  export let card;
  export let drift = 0;
</script>

<article
  data-testid="sign-in-wall-card"
  class="relative overflow-hidden rounded-[18px] bg-white p-2 shadow-[0_18px_45px_rgba(0,0,0,0.16)]"
  style={`transform: rotate(${drift}deg);`}
>
  <div class="absolute left-1/2 top-[-8px] h-4 w-4 -translate-x-1/2 rounded-full bg-[#d4a373] shadow-sm"></div>
  <img src={card.presignedUrl} alt={card.nickname} class="aspect-[3/4] w-full rounded-[12px] object-cover" />
</article>

<!-- frontend/src/routes/event/[eventId]/wall/+page.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { wall } from "$lib/api/client";
  import { buildWallCards, shuffleWallCards } from "$lib/utils/wall";
  import SignInWallCard from "$lib/components/SignInWallCard.svelte";
  import WallAccent from "$lib/components/WallAccent.svelte";
  const eventId = $derived($page.params.eventId);
  let cards = $state([]);
  let accents = $state([]);
  onMount(() => {
    void (async () => {
      const result = await wall.photos(eventId);
      cards = buildWallCards(result.photos, result.wallPolicy);
    })();
    const interval = setInterval(() => {
      cards = shuffleWallCards(cards, 4);
      accents = Math.random() > 0.75 ? [{ id: crypto.randomUUID(), type: "butterfly" }, ...accents].slice(0, 3) : accents;
    }, 45000);
    return () => clearInterval(interval);
  });
</script>

<div data-testid="sign-in-wall-grid" class="grid grid-cols-3 gap-4 lg:grid-cols-6">
  {#each cards as card, index (card.photoId)}
    <SignInWallCard {card} drift={(index % 5) - 2} />
  {/each}
  {#each accents as accent (accent.id)}
    <WallAccent {accent} />
  {/each}
</div>
```

- [ ] **Step 4: Re-run the visual checks and the frontend check**

Run:
```bash
cd frontend && npx vitest run tests/unit/SignInWallCard.test.svelte && npx playwright test tests/e2e/signin-wall.spec.ts && npm run check
```

Expected: pass once the route, card component, motion CSS, and shuffle behavior are wired up.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/event/[eventId]/wall/+page.svelte frontend/src/lib/components/SignInWallCard.svelte frontend/src/lib/components/WallAccent.svelte frontend/src/app.css frontend/tests/unit/SignInWallCard.test.svelte frontend/tests/e2e/signin-wall.spec.ts
git commit -m "feat(frontend): add standalone sign-in wall"
```

### Task 5: Final verification and bundle refresh

**Files:**
- All files touched by Tasks 1-4

- [ ] **Step 1: Run the backend and frontend verification suite**

Run:
```bash
npm run test:unit -- test/lambda/upload.test.ts test/lambda/myguest.test.ts test/lambda/wall.test.ts
cd frontend && npm run test
cd frontend && npm run check
```

Expected: all commands exit 0.

- [ ] **Step 2: Refresh the generated lambda bundle and confirm the stack still synthesizes**

Run:
```bash
npx esbuild lambda/wall/index.ts --bundle --platform=node --format=cjs --target=node20 --outfile=lambda-pkgs/wall/index.js
npm run build
npm run synth
```

Expected: the new wall bundle is present and the CDK app synthesizes without route or permission errors.

- [ ] **Step 3: Review the diff for scope creep**

Run:
```bash
git diff --stat
```

Expected: only backend guest-selection, wall-route, and sign-in-wall files changed.
