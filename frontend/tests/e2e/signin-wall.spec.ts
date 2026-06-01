import { expect, test } from "@playwright/test";

test.describe("Sign-in wall", () => {
  test("renders representative guest cards", async ({ page }) => {
    await page.route("**/wall/photos?eventId=EVENT-1", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          eventId: "EVENT-1",
          wallPolicy: "approved_only",
          photos: [
            {
              PK: "PHOTO#1",
              eventId: "EVENT-1",
              nickname: "Alice",
              guestKey: "guest-alice",
              representativePhotoId: "PHOTO#1",
              status: "approved",
              createdAt: "2026-05-29T00:00:01.000Z",
              presignedUrl: "https://example.com/1.jpg",
            },
          ],
        }),
      });
    });

    await page.goto("/event/EVENT-1/wall");
    await expect(page.getByTestId("sign-in-wall-grid")).toBeVisible();
    await expect(page.getByTestId("sign-in-wall-card")).toBeVisible();
  });
});
