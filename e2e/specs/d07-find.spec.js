// @ts-check
import { test, expect } from "@playwright/test";
import { apiCreateHousehold, skipToChoices } from "./helpers.js";

/** @param {import('@playwright/test').Page} page */
async function openFind(page) {
  await page.goto("/");
  await page.locator('[data-go="find"][data-nav="find"]').filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Find a dinner" })).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#discChips [data-disc-chip='easy']")).toBeVisible({ timeout: 60000 });
  await waitDiscoveryReady(page);
}

/** @param {import('@playwright/test').Page} page */
async function waitDiscoveryReady(page) {
  const main = page.locator("#discMain");
  await expect(main).toBeVisible({ timeout: 60000 });
  const busy = await main.getAttribute("aria-busy");
  if (busy === "true") {
    await expect(main).toHaveAttribute("aria-busy", "false", { timeout: 60000 });
  }
  await expect(
    page.locator(".disc-shelf, .disc-grid, .disc-results-title, #discMain .empty-state").first()
  ).toBeVisible({ timeout: 60000 });
}

const BLOCKED_DAIRY_SLUG = "harissa-roasted-carrots-feta";

/** @param {import('@playwright/test').APIRequestContext} request */
/** @param {string} base */
/** @param {Record<string, string>} headers */
async function discoverySearchPost(request, base, headers, queryPatch = {}) {
  return request.post(`${base}/api/discovery/search`, {
    headers: { ...headers, "Content-Type": "application/json" },
    data: {
      mode: "standalone",
      context: { mode: "standalone" },
      query: {
        text: queryPatch.text ?? null,
        limit: 50,
        offset: 0,
      },
    },
  });
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
    await expect(page.locator(".disc-shelf, .disc-grid").first()).toBeVisible({ timeout: 30000 });

    const search = page.locator("#discSearch");
    await search.fill("taco");
    await waitDiscoveryReady(page);
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
    await page.locator(".disc-card__link").first().click({ force: true });
    await expect(page).toHaveURL(/\/meal\/.+\?from=find/);
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/find\?.*text=taco/);
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

  test("eligibility: dairy household does not get a blocked meal in discovery search", async ({ request }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
    const hh = await apiCreateHousehold(request, "D07 Dairy");
    const headers = hh.cookieHeader || {};
    const res = await discoverySearchPost(request, base, headers, {
      text: "harissa",
      criteria: {},
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
    const slugs = (body.results || []).map((r) => r.recipe_slug);
    expect(slugs).not.toContain(BLOCKED_DAIRY_SLUG);
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
    const useBtn = page.locator('.view[data-view="find"].is-active [data-disc-action="use"]').first();
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/mutations") && res.request().method() === "POST" && res.ok(),
        { timeout: 60000 }
      ),
      useBtn.click({ timeout: 60000 }),
    ]);
    await expect(page.locator('.view[data-view="planReview"].is-active #planReviewTitle')).toBeVisible({
      timeout: 30000,
    });
    await expect(page.locator(".view.is-active .badge", { hasText: "Swapped in" })).toBeVisible({
      timeout: 30000,
    });
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
    await page.locator(".disc-card__link").first().click({ force: true, timeout: 60000 });
    await expect(page.getByRole("button", { name: /Use this for/ })).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByRole("heading", { name: "Find something else" })).toBeVisible();
    await page.locator("[data-disc-back]").click();
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
