# Event Slideshow Template Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add event-scoped slideshow templates with a dedicated admin editor, uploadable decorative assets, selectable transition styles, per-photo timing, and a template-aware fullscreen slideshow.

**Architecture:** Store the active template as structured event metadata so admin edits and slideshow rendering read the same source of truth. Keep decorative assets in S3, expose them through admin API presigns, and render them in the slideshow as a lightweight overlay layer. Use a dedicated admin design route for editing so the existing event detail page stays focused on QR links and review controls.

**Tech Stack:** SvelteKit 5, Svelte Flow (`@xyflow/svelte` or equivalent installed package), TypeScript, AWS Lambda, DynamoDB, S3, AWS SDK v3, Jest, Vitest, `svelte-check`.

---

### Task 1: Add template data helpers and backend contracts

**Files:**
- Modify: `lambda/admin/index.ts`
- Modify: `lambda/slideshow/index.ts`
- Modify: `lib/wedding-photo-stack.ts`
- Test: `test/lambda/admin.test.ts`
- Test: `test/lambda/slideshow.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
test("GET /admin/events/:eventId/template returns template payload", async () => {
  // expects a stored template object to be returned with playback settings
});

test("GET /slideshow/template returns published template for event", async () => {
  // expects the slideshow API to return the published template for the event
});
```

- [ ] **Step 2: Run the targeted tests and confirm they fail**

Run: `npm run test:unit -- test/lambda/admin.test.ts test/lambda/slideshow.test.ts`
Expected: fail because template endpoints do not exist yet.

- [ ] **Step 3: Add minimal backend support**

```ts
// lambda/admin/index.ts
type TemplateLayer = {
  id: string;
  type: "photo-frame" | "text" | "decorative-asset";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex: number;
  data?: Record<string, unknown>;
};

type EventTemplate = {
  canvas: { width: number; height: number };
  playback: { transition: "fade" | "fade-scale" | "slide"; intervalSeconds: number };
  layers: TemplateLayer[];
  published: boolean;
  updatedAt: string;
};
```

- [ ] **Step 4: Re-run the targeted tests**

Run: `npm run test:unit -- test/lambda/admin.test.ts test/lambda/slideshow.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lambda/admin/index.ts lambda/slideshow/index.ts lib/wedding-photo-stack.ts test/lambda/admin.test.ts test/lambda/slideshow.test.ts
git commit -m "feat: add event slideshow template contracts"
```

### Task 2: Build template editor UI and asset upload flow

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/lib/api/client.ts`
- Create: `frontend/src/routes/admin/event/[eventId]/design/+page.svelte`
- Modify: `frontend/src/routes/admin/event/[eventId]/+page.svelte`
- Test: `frontend/src/lib/components/HomePage.test.svelte` or new Svelte tests for route helpers

- [ ] **Step 1: Write the failing frontend test or route-level assertion**

```ts
test("admin event page links to the template editor", () => {
  // verify the detail page exposes a design-page link
});
```

- [ ] **Step 2: Run the frontend check to confirm it fails**

Run: `cd frontend && npm run check`
Expected: fail because the new route and APIs are missing.

- [ ] **Step 3: Add the editor page and client methods**

```ts
// frontend/src/lib/api/client.ts
export const templates = {
  async get(eventId: string) { /* GET /admin/events/:eventId/template */ },
  async save(eventId: string, body: unknown) { /* PUT /admin/events/:eventId/template */ },
  async presignAsset(eventId: string, filename: string, contentType: string) { /* POST ... */ },
  async confirmAsset(eventId: string, assetId: string) { /* POST ... */ },
  async slideshowTemplate(eventId: string) { /* GET /slideshow/template?eventId=... */ },
};
```

- [ ] **Step 4: Re-run the frontend check**

Run: `cd frontend && npm run check`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/src/lib/api/client.ts frontend/src/routes/admin/event/[eventId]/design/+page.svelte frontend/src/routes/admin/event/[eventId]/+page.svelte
git commit -m "feat(frontend): add event template editor entrypoint"
```

### Task 3: Render the published template in the fullscreen slideshow

**Files:**
- Modify: `frontend/src/routes/event/[eventId]/+page.svelte`
- Modify: `frontend/src/lib/api/client.ts`
- Test: `frontend/src/routes/event/[eventId]/+page.svelte` via `npm run check`

- [ ] **Step 1: Write a failing UI assertion or route smoke test**

```ts
test("slideshow page consumes template playback settings", () => {
  // verify interval and transition state are read from template data
});
```

- [ ] **Step 2: Run the frontend check and confirm it fails**

Run: `cd frontend && npm run check`
Expected: fail until the slideshow reads template settings.

- [ ] **Step 3: Implement the template-aware slideshow rendering**

```svelte
{#if activePhoto}
  <div class={`transition-${template.playback.transition}`}>
    <!-- render overlay, photo frame, decorative assets, and the active photo -->
  </div>
{/if}
```

- [ ] **Step 4: Re-run the frontend check**

Run: `cd frontend && npm run check`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/event/[eventId]/+page.svelte frontend/src/lib/api/client.ts
git commit -m "feat(frontend): render published slideshow templates"
```

### Task 4: Add root-level check script and verify the repo gate

**Files:**
- Modify: `package.json`
- Modify: `frontend/package.json`

- [ ] **Step 1: Add a real `check` script**

```json
{
  "scripts": {
    "check": "npm --prefix frontend run check && npm run build"
  }
}
```

- [ ] **Step 2: Confirm the new command exists and fails only on real issues**

Run: `npm run check`
Expected: pass after the frontend issues are fixed.

- [ ] **Step 3: Commit**

```bash
git add package.json frontend/package.json
git commit -m "chore: add repository check script"
```

### Task 5: Final verification

**Files:**
- All files touched by Tasks 1-4

- [ ] **Step 1: Run the repo verification command**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 2: Run targeted tests**

Run: `npm run test:unit -- test/lambda/admin.test.ts test/lambda/slideshow.test.ts`
Expected: exit 0.

- [ ] **Step 3: Review the diff for scope creep**

Run: `git diff --stat`
Expected: only template-editor related files changed.
