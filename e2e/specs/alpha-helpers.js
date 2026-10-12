// @ts-check
import { expect } from "@playwright/test";

/** @param {import('@playwright/test').Page} page */
export async function mockAlphaAi(page) {
  await page.route("**/api/recipes/adapt", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, support: "advice", acknowledgement: "OK", kind: "prep", ingredient_ops: [], step_notes: [] }),
    });
  });
  await page.route("**/api/explain", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        text: "Easy on a weeknight, with flavors your table tends to enjoy.",
        source: "template",
        basis: "run",
      }),
    });
  });
}

/** @param {import('@playwright/test').Page} page */
export async function seedDinnerPlan(page, opts = {}) {
  const mealCount = opts.mealCount ?? 1;
  const finalize = opts.finalize ?? false;
  const prefs = opts.prefs ?? { keep_it_easy: true, keep_ingredients_simple: false };
  await page.evaluate(
    async ({ mealCount, finalize, prefs }) => {
      const created = await fetch("/api/dinner-plans", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal_count: mealCount, entry_point: "plan_dinners", fill: "planner" }),
      }).then((r) => r.json());
      if (!created.ok) throw new Error("create plan failed: " + JSON.stringify(created));
      let plan = created.plan;
      const id = plan.dinner_plan_id;
      const mut = async (body) => {
        const res = await fetch("/api/dinner-plans/" + encodeURIComponent(id) + "/mutations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then((r) => r.json());
        if (res.ok) plan = res.plan;
        return res;
      };
      await mut({
        op: "set_planning_preferences",
        keep_it_easy: prefs.keep_it_easy === true,
        keep_ingredients_simple: prefs.keep_ingredients_simple === true,
      });
      if (finalize) await mut({ op: "finalize" });
    },
    { mealCount, finalize, prefs }
  );
}

/** @param {import('@playwright/test').Page} page */
export async function waitDiscoveryReady(page) {
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

/** @param {import('@playwright/test').Page} page */
export async function openPlanReviewFromFindPick(page) {
  await page.locator('[data-go="find"]').filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Pick one for us" }).click();
  await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible({ timeout: 60000 });
}

/** @param {import('@playwright/test').Page} page */
export async function openPlanReviewFromHome(page) {
  await page.goto("/");
  await page.locator('[data-go="home"][data-nav="home"]').filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Finish the plan" }).click();
  await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible({ timeout: 30000 });
}

/** @param {import('@playwright/test').Page} page */
export async function openPlanRecipeFromReview(page) {
  const mealOpen = page.locator(".view.is-active[data-view='planReview'] [data-action='open-plan-meal']").first();
  await expect(mealOpen).toHaveCount(1, { timeout: 60000 });
  await mealOpen.scrollIntoViewIfNeeded();
  await mealOpen.click({ force: true });
  await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible();
}

/** @param {import('@playwright/test').Page} page */
export async function addEmptyPlanSlot(page) {
  await page.evaluate(async () => {
    const cur = await fetch("/api/dinner-plans/current", { credentials: "include" }).then((r) => r.json());
    if (!cur.ok || !cur.plan) throw new Error("no plan");
    const id = cur.plan.dinner_plan_id;
    let plan = cur.plan;
    const mut = async (body) => {
      const res = await fetch("/api/dinner-plans/" + encodeURIComponent(id) + "/mutations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (res.ok) plan = res.plan;
      return res;
    };
    const nextCount = (plan.meal_count || 0) + 1;
    const bumped = await mut({ op: "set_count", meal_count: nextCount });
    if (!bumped.ok) throw new Error("set_count failed: " + JSON.stringify(bumped));
  });
}
