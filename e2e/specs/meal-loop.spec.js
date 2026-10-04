// @ts-check
import { test, expect } from "@playwright/test";
import { advanceCookToRate, skipToChoices } from "./helpers.js";

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
