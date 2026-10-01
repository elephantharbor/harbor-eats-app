// @ts-check
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";

test("option B recipe detail matches selection (not flagship A)", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await skipToChoices(page);
  const cards = page.locator(".option-card[data-select]");
  await expect(cards).toHaveCount(3, { timeout: 15000 });
  const titles = await cards.locator("h2").allTextContents();
  const cardB = cards.nth(1);
  const titleB = titles[1];
  await cardB.click();
  await page.getByRole("button", { name: "Start cooking" }).click({ timeout: 5000 }).catch(() => {});
  await page.locator('[data-view="detail"].is-active, [data-view="detail"]').first().waitFor({ state: "attached" });
  const detailTitle = await page.locator("#detailTitle").textContent();
  expect(detailTitle).toContain(titleB.split(" ")[0]);
  expect(detailTitle).not.toMatch(/chipotle tofu/i);
});
