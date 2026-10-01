// @ts-check
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";

test.describe("golden path", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("new household: welcome → onboarding → choices", async ({ page }) => {
    await page.goto("/");
    await page.goto("/");
    await expect(page.getByTestId("welcome-title")).toBeVisible();
    await skipToChoices(page);
    await expect(page.getByRole("heading", { name: "Which should we make?" })).toBeVisible();
  });

  test("returning household reopens to home, not Get Started", async ({ page }) => {
    await page.goto("/");
    await skipToChoices(page);
    await page.reload();
    await expect(page.locator(".view.is-active")).toHaveCount(1, { timeout: 15000 });
    await expect(page.locator('.view[data-view="welcome"].is-active')).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Get started" })).toBeHidden();
  });
});
