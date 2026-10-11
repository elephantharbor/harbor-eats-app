// @ts-check
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";
import {
  mockAlphaAi,
  seedDinnerPlan,
  openPlanReviewFromHome,
  openPlanRecipeFromReview,
} from "./alpha-helpers.js";

const adaptResponse = {
  ok: true,
  support: "advice",
  acknowledgement: "Parsley works here instead.",
  kind: "substitution",
  ingredient_ops: [{ op: "replace", from_id: "cilantro", to_name: "parsley", policy: "keep_scaled" }],
  step_notes: [{ step_number: 2, note: "scatter parsley at the end" }],
  equipment_supported: true,
  flavor_impact: "similar",
  warning: null,
  override: {
    acknowledgement: "Parsley works here instead.",
    kind: "substitution",
    support: "advice",
    ops: [
      {
        op: "replace",
        from_id: "cilantro",
        to_name: "parsley",
        to_ingredient_id: "parsley",
        policy: "keep_scaled",
        step_notes: [{ step_number: 2, note: "scatter parsley at the end" }],
      },
    ],
    dropped: [],
  },
};

/** @param {import('@playwright/test').Page} page */
async function openPlanRecipe(page) {
  await seedDinnerPlan(page, { prefs: { keep_it_easy: true, keep_ingredients_simple: false } });
  await openPlanReviewFromHome(page);
  await openPlanRecipeFromReview(page);
}

test.describe("Alpha readiness UI", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await mockAlphaAi(page);
    await skipToChoices(page);
  });

  test("plan back from recipe names Plan parent", async ({ page }) => {
    await openPlanRecipe(page);
    await expect(page.getByRole("button", { name: /Plan/i })).toBeVisible();
    await page.getByRole("button", { name: /Plan/i }).click();
    await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible();
  });

  test("adaptation apply shows your version and undo toast", async ({ page }) => {
    await openPlanRecipe(page);
    const fromId = await page.evaluate(async () => {
      const res = await fetch("/api/dinner-plans/current", { credentials: "include" }).then((r) => r.json());
      const meal = res.plan && res.plan.meals && res.plan.meals[0];
      const ingredients = (meal && meal.pinned_ingredients) || [];
      const ing = ingredients.find((item) => item.ingredient_id) || ingredients[0];
      return ing ? ing.ingredient_id : null;
    });
    await page.unroute("**/api/recipes/adapt");
    await page.route("**/api/recipes/adapt", async (route) => {
      const body = {
        ...adaptResponse,
        ingredient_ops: [{ op: "replace", from_id: fromId, to_name: "parsley", policy: "keep_scaled" }],
        override: {
          ...adaptResponse.override,
          ops: [
            {
              op: "replace",
              from_id: fromId,
              to_name: "parsley",
              to_ingredient_id: "parsley",
              policy: "keep_scaled",
              step_notes: [{ step_number: 2, note: "scatter parsley at the end" }],
            },
          ],
        },
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    });
    const weave = page.locator("#detailWeaveHost .weave-composer__field");
    await weave.click();
    await weave.fill("I don't have cilantro");
    await weave.press("Enter");
    await expect(page.locator(".weave-change")).toBeVisible({ timeout: 30000 });
    await page.locator(".weave-adapt-apply").click();
    await expect(page.locator("#detailVersionLine")).toContainText("Your version", { timeout: 15000 });
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
  });

  test("why this one expands with explanation", async ({ page }) => {
    await openPlanRecipe(page);
    await page.getByRole("button", { name: /Plan/i }).click();
    const why = page.getByRole("button", { name: "Why this one?" }).first();
    await expect(why).toBeVisible({ timeout: 15000 });
    await expect(page.locator("[data-why-reason]").first()).toContainText(/Easy/i);
    await why.click();
    await expect(page.locator("[data-why-reveal]:not([hidden])")).toBeVisible({ timeout: 15000 });
  });
});
