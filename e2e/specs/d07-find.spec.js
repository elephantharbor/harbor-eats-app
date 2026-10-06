// @ts-check
import { test, expect } from "@playwright/test";
import { apiCreateHousehold, skipToChoices } from "./helpers.js";

/** @param {import('@playwright/test').Page} page */
async function openFind(page) {
  await page.goto("/find");
  await expect(page.getByRole("heading", { name: "Find a dinner" })).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#discChips [data-disc-chip='easy']")).toBeVisible({ timeout: 60000 });
}

/** @param {import('@playwright/test').Page} page */
async function waitDiscoveryReady(page) {
  await expect(page.locator("#discMain")).toHaveAttribute("aria-busy", "false", { timeout: 60000 });
}

test.describe("D-07 Find a dinner", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("standalone: shelves, search, refinement toggle, recipe back restores find", async ({ page }) => {
    await skipToChoices(page);
    await openFind(page);
    await waitDiscoveryReady(page);
    await expect(page.locator(".disc-shelf, .disc-grid").first()).toBeVisible({ timeout: 30000 });

    const search = page.locator("#discSearch");
    await search.fill("taco");
    await expect(page.locator(".disc-results-title")).toBeVisible({ timeout: 30000 });

    const easy = page.locator('[data-disc-chip="easy"]');
    await easy.click();
    await expect(easy).toHaveAttribute("aria-pressed", "true");
    await easy.click();
    await expect(easy).toHaveAttribute("aria-pressed", "false");

    const time = page.locator('[data-disc-chip="time"]');
    await expect(time).not.toHaveAttribute("aria-haspopup", /.*/);
    await time.click();
    await expect(time).toHaveAttribute("aria-pressed", "true");
    const findUrl = page.url();
    await page.locator(".disc-card__link").first().click();
    await expect(page).toHaveURL(/\/meal\/.+\?from=find/);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(findUrl);
    await expect(search).toHaveValue("taco");
  });

  test("refinements: Easy, Simple ingredients, and Quick are independent", async ({ page }) => {
    await skipToChoices(page);
    await openFind(page);
    await page.locator('[data-disc-chip="easy"]').click();
    await page.locator('[data-disc-chip="simple"]').click();
    await page.locator('[data-disc-chip="time"]').click();
    await expect(page.locator('[data-disc-chip="easy"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-disc-chip="simple"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-disc-chip="time"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-disc-chip="easy"]').click();
    await expect(page.locator('[data-disc-chip="easy"]')).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('[data-disc-chip="time"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("eligibility: dairy household does not get a blocked meal in discovery search", async ({ page, request }) => {
    const hh = await apiCreateHousehold(request, "D07 Dairy");
    await page.context().addCookies([
      {
        name: "he_session",
        value: hh.sessionToken || "",
        url: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787",
      },
    ]);
    const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
    const res = await request.get(`${base}/api/discovery/search?mode=standalone&q=feta&limit=50`, {
      headers: hh.cookieHeader,
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
    const slugs = (body.results || []).map((r) => r.recipe_slug);
    expect(slugs).not.toContain("harissa-roasted-carrots-feta");
  });

  test("replace mode: swap see all → pick → plan updates and exits discovery", async ({ page }) => {
    await skipToChoices(page);
    await page.locator('[data-go="find"]').filter({ visible: true }).first().click();
    await page.getByRole("button", { name: "Pick one for us" }).click();
    await expect(page.getByRole("heading", { name: /Here’s a good one|Your plan/ })).toBeVisible({ timeout: 60000 });
    const swap = page.locator('[data-action="swap-meal"]').first();
    await swap.click();
    await page.locator('[data-action="swap-see-all"]').click();
    await expect(page).toHaveURL(/mode=replace_plan_meal/);
    await expect(page.url()).not.toMatch(/participant_id=/);
    await expect(page.url()).not.toMatch(/position=/);
    await expect(page.getByRole("heading", { name: "Find something else" })).toBeVisible();
    await waitDiscoveryReady(page);
    const beforeTitle = await page.locator(".plan-meal-title").first().textContent();
    await page.locator('[data-disc-action="use"]').first().click({ timeout: 60000 });
    await expect(page.getByRole("heading", { name: /Here’s a good one|Your plan/ })).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".badge", { hasText: "Swapped in" })).toBeVisible();
    const afterTitle = await page.locator(".plan-meal-title").first().textContent();
    expect(afterTitle).not.toBe(beforeTitle);
  });

  test("opening a recipe from find does not swap until Use CTA", async ({ page }) => {
    await skipToChoices(page);
    await page.locator('[data-go="find"]').filter({ visible: true }).first().click();
    await page.getByRole("button", { name: "Pick one for us" }).click();
    await expect(page.locator('[data-action="swap-meal"]').first()).toBeVisible({ timeout: 60000 });
    const titleBefore = await page.locator(".plan-meal-title").first().textContent();
    await page.locator('[data-action="swap-meal"]').first().click();
    await page.locator('[data-action="swap-see-all"]').click();
    await waitDiscoveryReady(page);
    await page.locator(".disc-card__link").first().click({ timeout: 60000 });
    await expect(page.getByRole("button", { name: /Use this for/ })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.locator(".plan-meal-title").first()).toHaveText(titleBefore || "");
    await expect(page.locator(".badge", { hasText: "Swapped in" })).toHaveCount(0);
  });

  test("empty search shows recoverable no-results state", async ({ page }) => {
    await skipToChoices(page);
    await openFind(page);
    const search = page.locator("#discSearch");
    await search.fill("zzzznotonmenu999");
    await waitDiscoveryReady(page);
    await expect(page.getByText(/Nothing here matches/)).toBeVisible({ timeout: 30000 });
    await page.locator("[data-disc-clear-search]").click();
    await waitDiscoveryReady(page);
    await expect(page.locator(".disc-shelf, .disc-grid").first()).toBeVisible({ timeout: 30000 });
  });
});
