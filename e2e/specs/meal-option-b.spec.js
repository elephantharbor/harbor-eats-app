// @ts-check
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";

test("option B recipe detail matches selection (not flagship A)", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await skipToChoices(page);
  const cards = page.locator(".option-card[data-preview]");
  await expect(cards).toHaveCount(3, { timeout: 15000 });
  const titles = await cards.locator("h2").allTextContents();
  const cardB = cards.nth(1);
  const titleB = titles[1];
  await cardB.click();
  await page.locator('[data-view="detail"].is-active').waitFor();
  await expect(page.locator("#detailTitle")).toHaveText(titleB);
  await expect(page.locator("#detailPickState")).toContainText("Just looking");
  await page.locator("#btnStartCook").click();
  await expect(page.locator("#detailPickState")).toContainText("Tonight’s pick");
  await expect(page.locator("#detailTitle")).toHaveText(titleB);
  await expect(page.locator("#btnStartCook")).toContainText("Start cooking");
});
