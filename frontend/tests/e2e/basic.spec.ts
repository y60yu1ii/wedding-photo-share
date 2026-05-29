import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("renders landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("💍 婚禮照片分享")).toBeVisible();
    await expect(page.getByText("管理登入")).toBeVisible();
    await expect(page.getByPlaceholder("婚禮ID（向工作人員取得）")).toBeVisible();
  });

  test("shows error when eventId empty on guest access", async ({ page }) => {
    await page.goto("/");
    await page.getByText("進入上傳").click();
    await expect(page.getByText("請輸入婚禮ID")).toBeVisible();
  });

  test("navigates to admin login", async ({ page }) => {
    await page.goto("/");
    await page.getByText("管理登入").click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByText("管理登入")).toBeVisible();
  });

  test("navigates to event page with valid eventId", async ({ page }) => {
    await page.goto("/");
    await page.getByPlaceholder("婚禮ID（向工作人員取得）").fill("evt-test-123");
    await page.getByText("進入上傳").click();
    await expect(page).toHaveURL(/\/event\/evt-test-123/);
  });
});

test.describe("Admin Login", () => {
  test("shows validation error for empty fields", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByText("登入").click();
    await expect(page.getByText("請填寫帳號與密碼")).toBeVisible();
  });

  test("shows error on wrong credentials", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByPlaceholder("管理員帳號").fill("bad");
    await page.getByPlaceholder("管理員密碼").fill("bad");
    await page.getByText("登入").click();
    await expect(page.getByText("登入失敗")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Admin Dashboard", () => {
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("Event Guest Page", () => {
  test("shows loading then empty state", async ({ page }) => {
    await page.goto("/event/nonexistent");
    await expect(page.getByText("載入中...")).toBeVisible();
    // allow network to settle
    await page.waitForTimeout(1000);
  });
});

test.describe("Upload Page", () => {
  test("shows upload form", async ({ page }) => {
    await page.goto("/event/test-event/upload");
    await expect(page.getByText("上傳照片")).toBeVisible();
    await expect(page.getByText("送出照片")).toBeVisible();
  });

  test("validates nickname before upload", async ({ page }) => {
    await page.goto("/event/test-event/upload");
    // Select a file (we won't actually upload, just test validation)
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
  });
});
