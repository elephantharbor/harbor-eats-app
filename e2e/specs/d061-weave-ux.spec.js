// @ts-check
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";

/** @param {import('@playwright/test').Page} page */
async function showConsumerComposer(page) {
  await page.route("**/api/health", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.consumer_ui = true;
    await route.fulfill({ status: res.status(), contentType: "application/json", body: JSON.stringify(body) });
  });
}

test.describe("D-06.1 weave UX", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await showConsumerComposer(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("no-fish household hides fish starters", async ({ page }) => {
    await page.getByRole("button", { name: "Get started" }).click();
    await page.locator("#hhName").fill("[synthetic] no fish weave");
    await page.locator("#ownerName").fill("Alex");
    await page.locator("#btnCreateHh").click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator('input[data-cid="finfish"]').check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.getByRole("button", { name: "Skip — show tonight’s picks" }).click();

    await page.locator('[data-go="find"]').first().click();
    await expect(page.getByRole("heading", { name: "Find a dinner" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Easy fish dinner" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Something cozy" })).toBeVisible();
  });

  test("keyboard open hides tab bar on weave field", async ({ page }) => {
    await skipToChoices(page);
    await page.locator('[data-go="home"]').first().click();
    await page.locator('[data-action="plan-dinners"]').first().click();
    const field = page.locator(".weave-composer__field").first();
    await field.click();
    await page.evaluate(() => {
      if (window.visualViewport) {
        Object.defineProperty(window.visualViewport, "height", { configurable: true, value: 400 });
        window.visualViewport.dispatchEvent(new Event("resize"));
      }
      window.FlavorWeaveKeyboard?.measure?.();
    });
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.keyboardOwner)).toBe("weave");
    await field.blur();
    await page.waitForTimeout(400);
    await page.evaluate(() => window.FlavorWeaveKeyboard?.measure?.());
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.keyboard || "")).toBe("");
  });
});
