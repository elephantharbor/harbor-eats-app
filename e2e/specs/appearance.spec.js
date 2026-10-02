// @ts-check
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";

test.describe("appearance themes", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("defaults to Signature and falls back on invalid saved values", async ({ page }) => {
    await page.evaluate(() => localStorage.setItem("fw_theme", "not-a-theme"));
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "signature");
    await expect(page.locator("#topbar img[alt='FlavorWeave']:visible")).toHaveCount(1);
  });

  test("Settings → Appearance switches instantly and persists", async ({ page }) => {
    await skipToChoices(page);
    await page.locator("#topbar").getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("radiogroup", { name: "Appearance" })).toBeVisible();

    await page.getByRole("radio", { name: /Dark Mode/ }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("#topbar img[src$='lockup-horizontal-reversed.svg']")).toBeVisible();

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.locator("#topbar").getByRole("button", { name: "Settings" }).click();
    await expect(page.getByRole("radio", { name: /Dark Mode/ })).toBeChecked();
    await page.getByRole("radio", { name: /Citrus Berry/ }).check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "citrus-berry");
  });
});
