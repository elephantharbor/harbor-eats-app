// @ts-check
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";

const overflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("mobile: no horizontal overflow and bottom nav replaces top nav", async ({ page, context }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId("welcome-title").waitFor();
  expect(await overflow(page)).toBeLessThanOrEqual(0);

  await skipToChoices(page);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await expect(page.locator("#tabbar")).toBeVisible();
  await expect(page.locator("#topNav")).toBeHidden();

  await page.locator(".option-card[data-preview]").first().click();
  await page.locator("#detailTitle").waitFor();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await expect(page.getByRole("tab", { name: "Notes" })).toBeInViewport();
  await expect(page.locator("#tabbar")).toBeHidden();
  await page.locator('[data-view="detail"] [data-back="detail"]').click();
  await expect(page.locator('.view[data-view="choices"].is-active')).toHaveCount(1);

  for (const view of ["home", "meals", "tasteProfile", "settings"]) {
    await page.locator(`#tabbar [data-go="${view}"]:visible, #topbar [data-go="${view}"]:visible`).first().click();
    await expect(page.locator(`.view[data-view="${view}"].is-active`)).toHaveCount(1);
    expect(await overflow(page), view).toBeLessThanOrEqual(0);
  }
});

test("desktop: top nav, no tab bar, recipe tabs are keyboard operable", async ({ page, context }) => {
  await context.clearCookies();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await skipToChoices(page);
  await expect(page.locator("#topNav")).toBeVisible();
  await expect(page.locator("#tabbar")).toBeHidden();

  await page.locator(".option-card[data-preview]").first().click();
  await page.locator("#detailTitle").waitFor();
  await page.getByRole("tab", { name: "Overview" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Ingredients" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Ingredients" })).toBeFocused();
  await expect(page.locator("#panel-ingredients")).toBeVisible();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Notes" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "true");
});
