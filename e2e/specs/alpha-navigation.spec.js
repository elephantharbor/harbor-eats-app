// @ts-check
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";
import {
  mockAlphaAi,
  seedDinnerPlan,
  openPlanReviewFromHome,
  openPlanRecipeFromReview,
  openPlanReviewFromFindPick,
  addEmptyPlanSlot,
  waitDiscoveryReady,
} from "./alpha-helpers.js";

test.describe("Alpha D-04 navigation", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await mockAlphaAi(page);
    await skipToChoices(page);
  });

  test("transient surface closes before task back (swap sheet)", async ({ page }) => {
    await seedDinnerPlan(page);
    await openPlanReviewFromHome(page);
    await page.evaluate(() => {
      document.querySelector('[data-action="swap-meal"]')?.click();
    });
    await expect(page.locator("#swapSheet[open]")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#swapSheet[open]")).toHaveCount(0);
    await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible();
  });

  test("shopping list → recipe → Back returns to shopping list", async ({ page }) => {
    await seedDinnerPlan(page, { finalize: true });
    await page.goto("/");
    await page.locator('[data-go="shopList"]').filter({ visible: true }).first().click();
    await expect(page.locator(".view.is-active[data-view='shopList']")).toBeVisible({ timeout: 30000 });
    const more = page.locator("[data-shop-more]").first();
    await expect(more).toBeVisible({ timeout: 30000 });
    await more.click();
    await page.locator('[data-action="shop-view-recipe"]').click();
    await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible();
    await page.getByRole("button", { name: /Shopping list/i }).click();
    await expect(page.locator(".view.is-active[data-view='shopList']")).toBeVisible();
  });

  test("cook → recipe → Back returns to kitchen mode", async ({ page }) => {
    await seedDinnerPlan(page, { finalize: true });
    await page.goto("/");
    await page.locator('[data-go="choices"]').filter({ visible: true }).first().click();
    await page.locator('[data-action="pick-for-tonight"]').first().click({ force: true });
    await page.evaluate(() => {
      document.querySelector('[data-action="cook-plan-meal"]')?.click();
    });
    await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible({ timeout: 30000 });
    await page.locator("#btnStartCook").click();
    await expect(page.locator(".view.is-active[data-view='cook']")).toBeVisible({ timeout: 30000 });
    await page.locator("#btnCookViewRecipe").click();
    await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible();
    await page.getByRole("button", { name: "Back to Kitchen" }).click();
    await expect(page.locator(".view.is-active[data-view='cook']")).toBeVisible();
    const next = page.locator("#btnNextStep");
    if ((await next.innerText()) === "Next") await next.click();
    await page.goBack();
    await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible();
    await expect(page.locator("#btnStartCook")).toContainText(/Resume step [12]/);
    await page.locator("#btnStartCook").click();
    await expect(page.locator(".view.is-active[data-view='cook']")).toBeVisible();
    await expect(page.locator("#cookStepMeta")).toHaveText(/^[12] \/ /);
  });

  test("deep link meal in active plan names Tonight parent", async ({ page }) => {
    await seedDinnerPlan(page);
    const slug = await page.evaluate(async () => {
      const res = await fetch("/api/dinner-plans/current", { credentials: "include" }).then((r) => r.json());
      return res.plan.meals[0].recipe_slug;
    });
    await page.goto("/meal/" + encodeURIComponent(slug));
    await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Back to Tonight" })).toBeVisible();
  });

  test("deep link meal not in plan names Find parent (fallback)", async ({ page }) => {
    await seedDinnerPlan(page);
    const otherSlug = await page.evaluate(async () => {
      const cur = await fetch("/api/dinner-plans/current", { credentials: "include" }).then((r) => r.json());
      const inPlan = new Set((cur.plan.meals || []).map((m) => m.recipe_slug));
      const disc = await fetch("/api/discovery/search", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "standalone",
          context: { mode: "standalone" },
          query: { text: null, limit: 40, offset: 0 },
        }),
      }).then((r) => r.json());
      const rows = disc.results || disc.rows || [];
      const hit = rows.find((r) => r.recipe_slug && !inPlan.has(r.recipe_slug));
      if (!hit) throw new Error("no discovery slug outside plan");
      return hit.recipe_slug;
    });
    await page.goto("/meal/" + encodeURIComponent(otherSlug));
    await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Back to Find" })).toBeVisible();
  });

  test("system Back closes the swap sheet and stays on the plan", async ({ page }) => {
    await seedDinnerPlan(page);
    await openPlanReviewFromHome(page);
    await page.evaluate(() => {
      document.querySelector('[data-action="swap-meal"]')?.click();
    });
    await expect(page.locator("#swapSheet[open]")).toBeVisible();
    await page.waitForFunction(() => history.state && history.state.transient === "swapSheet");
    await page.goBack();
    await expect(page.locator("#swapSheet[open]")).toHaveCount(0);
    await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible();
  });

  test("task Back closes swap sheet before leaving plan review", async ({ page }) => {
    await seedDinnerPlan(page);
    await openPlanReviewFromHome(page);
    await page.evaluate(() => {
      document.querySelector('[data-action="swap-meal"]')?.click();
    });
    await expect(page.locator("#swapSheet[open]")).toBeVisible();
    await page.waitForFunction(() => history.state && history.state.transient === "swapSheet");
    await page.locator('section[data-view="planReview"] .back[data-back="planReview"]').dispatchEvent("click");
    await expect(page.locator("#swapSheet[open]")).toHaveCount(0);
    await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible();
  });

  test("choose-for-plan empty slot → find → recipe → Back restores choose mode", async ({ page }) => {
    await seedDinnerPlan(page);
    await addEmptyPlanSlot(page);
    await openPlanReviewFromHome(page);
    const emptyPick = page.locator('[data-action="disc-pick-slot"]').first();
    await expect(emptyPick).toBeVisible({ timeout: 30000 });
    await emptyPick.click({ force: true });
    await expect(page.locator('.view.is-active[data-view="find"]')).toBeVisible({ timeout: 30000 });
    await waitDiscoveryReady(page);
    const card = page.locator('.view.is-active[data-view="find"] .disc-card__link').first();
    await expect(card).toBeVisible({ timeout: 60000 });
    await card.click({ force: true });
    await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible();
    await page.getByRole("button", { name: "Back to Find" }).click();
    await expect(page.locator('.view.is-active[data-view="find"]')).toBeVisible();
  });

  test("Weave plan → recipe → Back (plan review)", async ({ page }) => {
    await seedDinnerPlan(page);
    await openPlanReviewFromHome(page);
    await openPlanRecipeFromReview(page);
    await page.getByRole("button", { name: /Plan/i }).click();
    await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible();
  });
});
