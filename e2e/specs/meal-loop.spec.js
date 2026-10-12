// @ts-check
import { test, expect } from "@playwright/test";
import { advanceCookToRate, delayCookMutations, skipToChoices } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  if (process.env.E2E_COOK_DELAY_MS) await delayCookMutations(page, process.env.E2E_COOK_DELAY_MS);
});

test("meal loop: select → cook → rate", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await skipToChoices(page);
  await page.locator(".option-card[data-preview]").first().click();
  await page.locator("#btnStartCook").click();
  await page.getByRole("button", { name: "Start cooking" }).click();
  await advanceCookToRate(page);
  const cards = page.locator(".rater-card");
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    await cards.nth(i).locator(".score-row button.score").first().click();
  }
  await page.getByRole("button", { name: "Submit all ratings" }).click();
  await expect(
    page.getByRole("heading", { name: /(Both of you|Everyone) rated dinner/ })
  ).toBeVisible();
});

test("select → Start cooking still opens the kitchen while begin_cook is delayed", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  let releaseCook = function () {};
  const held = new Promise(function (resolve) {
    releaseCook = resolve;
  });
  await page.route("**/api/dinner-plans/**/mutations", async (route) => {
    let body = {};
    try {
      body = route.request().postDataJSON() || {};
    } catch (_) {
      body = {};
    }
    if (body.op === "begin_cook") await held;
    await route.continue();
  });
  // Keep the recipe paint behind the first CTA click so the shell
  // "Start cooking" control is what the click hits.
  await page.route("**/api/recipes/**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await skipToChoices(page);
  await page.locator(".option-card[data-preview]").first().click();
  await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible();
  await page.evaluate(() => document.getElementById("btnStartCook").click());
  const cookBtn = page.locator("#btnStartCook");
  await expect(cookBtn).toBeVisible();
  await expect(cookBtn).toContainText("Start cooking");
  await expect(cookBtn).not.toContainText("Resume");
  await cookBtn.click();
  await expect(page.locator(".view.is-active[data-view='cook']")).toBeVisible({ timeout: 30000 });
  releaseCook();
});
