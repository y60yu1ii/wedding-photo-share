import { test, expect, type Page } from "@playwright/test";

/**
 * E2E spec for the public slideshow page (SLIDE-1, SLIDE-2, SLIDE-4, SLIDE-6).
 *
 * Scope (matches the current state of the migration):
 *   - SLIDE-1: page renders the public slideshow and the photo stage
 *   - SLIDE-2: default fade recipe is exercised when the photo swaps
 *   - SLIDE-4: the entry button text matches the actual rendered label
 *   - SLIDE-6: reduced-motion preference does not break the mount
 *
 * Out of scope (not yet wired in the page, or not safe in the test env):
 *   - Fullscreen API behavior (button toggles state, but the real Fullscreen
 *     API is not exercised in headless Chromium without a real user gesture)
 *   - Danmaku WebSocket (would require a fake wss:// server in the test env)
 *   - GSAP lifecycle leak probe (`window.gsap` is not exposed as a global, so
 *     asserting on `gsap.globalTimeline` would be a vacuous check)
 */

const EVENT_ID = "demo";
const PHOTO_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

function mockSlideshowPhotos(page: Page, photos: unknown[] = []) {
  return page.route("**/slideshow/photos**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        event: { name: "Demo Wedding", date: "2026-06-01" },
        photos,
        nextCursor: null,
      }),
    });
  });
}

function mockSlideshowTemplate(page: Page, template: unknown | null = null) {
  return page.route("**/slideshow/template**", async (route) => {
    if (template === null) {
      await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ event: {}, template }),
    });
  });
}

async function gotoEvent(page: Page) {
  await page.goto(`/event/${EVENT_ID}`);
}

test.describe("public slideshow", () => {
  test("renders the empty-state shell when no photos are approved (SLIDE-1)", async ({ page }) => {
    await mockSlideshowPhotos(page, []);
    await mockSlideshowTemplate(page);
    await gotoEvent(page);

    // The standard grid mode is shown when there are no photos.
    // The page-level mount flips `loading` to false as soon as the API resolves,
    // so the empty-state copy should be visible without race.
    await expect(page.getByText("目前尚無已發布的照片")).toBeVisible();

    // The presentation entry button is rendered but disabled with no photos.
    const entryButton = page.getByRole("button", { name: /開啟即時大螢幕投屏/ });
    await expect(entryButton).toBeVisible();
    await expect(entryButton).toBeDisabled();
  });

  test("shows the presentation entry button when at least one photo is approved (SLIDE-1, SLIDE-4)", async ({
    page,
  }) => {
    await mockSlideshowPhotos(page, [
      {
        PK: "PHOTO#1",
        eventId: EVENT_ID,
        nickname: "Alice",
        greeting: "恭喜新人!",
        presignedUrl: PHOTO_PNG_DATA_URL,
        status: "approved",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    await mockSlideshowTemplate(page);
    await gotoEvent(page);

    const entryButton = page.getByRole("button", { name: /開啟即時大螢幕投屏/ });
    await expect(entryButton).toBeVisible();
    await expect(entryButton).toBeEnabled();
  });

  test("entering presentation mode mounts the .photo-stage and contributor meta (SLIDE-1, SLIDE-2)", async ({
    page,
  }) => {
    await mockSlideshowPhotos(page, [
      {
        PK: "PHOTO#1",
        eventId: EVENT_ID,
        nickname: "Alice",
        greeting: "恭喜新人!",
        presignedUrl: PHOTO_PNG_DATA_URL,
        status: "approved",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    await mockSlideshowTemplate(page);
    await gotoEvent(page);

    await page.getByRole("button", { name: /開啟即時大螢幕投屏/ }).click();

    // .photo-stage lives inside the presentation fullscreen container and is
    // the target of the GSAP entry recipe (default: fade).
    const stage = page.locator(".photo-stage");
    await expect(stage).toBeVisible();

    // The contributor info bar (photo-meta) is also part of the SLIDE-2 contract:
    // it should show the nickname for the active photo.
    await expect(page.locator(".photo-meta")).toContainText("Alice");

    // The exit control is the inverse of the entry control.
    await expect(page.getByRole("button", { name: /退出投屏模式/ })).toBeVisible();
  });

  test("reduced-motion preference still mounts the presentation view (SLIDE-6)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockSlideshowPhotos(page, [
      {
        PK: "PHOTO#1",
        eventId: EVENT_ID,
        nickname: "Alice",
        greeting: "恭喜新人!",
        presignedUrl: PHOTO_PNG_DATA_URL,
        status: "approved",
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    ]);
    await mockSlideshowTemplate(page);
    await gotoEvent(page);

    await page.getByRole("button", { name: /開啟即時大螢幕投屏/ }).click();

    // bindReducedMotion() must not break the mount: .photo-stage should still
    // be visible, and the meta bar should still be rendered.
    const stage = page.locator(".photo-stage");
    await expect(stage).toBeVisible();
    await expect(page.locator(".photo-meta")).toContainText("Alice");
  });
});
