// @ts-check
/**
 * A planned meal's recipe, cook list, and shopping list use that meal's diner
 * count. This spec only talks to the app. It does not edit local D1.
 */
import { expect, test } from "@playwright/test";
import { skipToChoices } from "./helpers.js";

const SLUG = "maple-mustard-glazed-salmon";

async function recipeAt(page, servings) {
  return page.evaluate(async ({ slug, servings }) => {
    const response = await fetch(`/api/recipes/${slug}?servings=${servings}`, { credentials: "include" });
    return response.json();
  }, { slug: SLUG, servings });
}

async function createSalmonPlan(page, versionId) {
  return page.evaluate(async (versionId) => {
    const me = await fetch("/api/sessions/me", { credentials: "include" }).then((response) => response.json());
    const memberId = me.session?.member_id || me.member_id;
    if (!memberId) throw new Error("no member");
    const created = await fetch("/api/dinner-plans", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meal_count: 1,
        entry_point: "plan_dinners",
        participant_ids: [memberId],
        meals: [{ kind: "recipe", recipe_version_id: versionId, participant_ids: [memberId] }],
      }),
    }).then((response) => response.json());
    if (!created.ok) throw new Error("create plan failed: " + JSON.stringify(created));
    return { dinner_plan_id: created.plan.dinner_plan_id, meal_id: created.plan.meals[0].meal_id };
  }, versionId);
}

async function setGuests(page, plan, guests) {
  const result = await page.evaluate(async ({ planId, mealId, guests }) => {
    const response = await fetch("/api/dinner-plans/" + planId + "/mutations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "set_guest_count", meal_id: mealId, guest_count: guests }),
    });
    return response.json();
  }, { planId: plan.dinner_plan_id, mealId: plan.meal_id, guests });
  expect(result.ok, JSON.stringify(result)).toBe(true);
}

async function openPlannedSalmon(page) {
  await page.goto("/");
  await page.locator("[data-go='home'][data-nav='home']").filter({ visible: true }).first().click();
  await page.getByRole("button", { name: "Finish the plan" }).click();
  await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible();
  await page.locator(".view.is-active [data-action='open-plan-meal']").filter({ visible: true }).first().click();
  await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible();
}

test("a planned salmon scales recipe, cook, and shopping to the meal's diners", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/");
  await skipToChoices(page);
  const published = await recipeAt(page, 4);
  expect(published.ok, JSON.stringify(published)).toBe(true);
  const plan = await createSalmonPlan(page, published.recipe.recipe_version_id);

  const marker = published.recipe.ingredients.find((item) => /salt/i.test(item.name))
    || published.recipe.ingredients.find((item) => /dijon/i.test(item.name));
  expect(marker, "published salmon needs salt or Dijon to prove scaling").toBeTruthy();
  const token = /salt/i.test(marker.name) ? /salt/i : /dijon/i;
  const amountOf = (body) => body.recipe.ingredients.find((item) => token.test(item.name)).quantity;
  /** @type {Record<number, string>} */
  const amounts = {};
  for (const diners of [1, 2, 6]) {
    await setGuests(page, plan, diners - 1);
    const scaled = await recipeAt(page, diners);
    amounts[diners] = amountOf(scaled);
    await openPlannedSalmon(page);
    await expect(page.locator(".view.is-active #detailServingsNote")).toContainText(`Cooking for ${diners}`);
    await expect(page.locator(".view.is-active #detailIngredients .qty").first()).not.toHaveText("");
    const shown = await page.locator(".view.is-active #detailIngredients .qty").allTextContents();
    expect(shown.map((item) => item.trim())).toEqual(scaled.recipe.ingredients.map((item) => String(item.quantity || "")));
  }
  expect(amounts[1]).not.toBe(amounts[2]);
  expect(amounts[2]).not.toBe(amounts[6]);

  const shop = await page.evaluate(async (planId) => {
    const [list, current] = await Promise.all([
      fetch("/api/dinner-plans/" + planId + "/shopping", { credentials: "include" }).then((response) => response.json()),
      fetch("/api/dinner-plans/current", { credentials: "include" }).then((response) => response.json()),
    ]);
    return { list, current };
  }, plan.dinner_plan_id);
  const meal = shop.current.plan.meals.find((item) => item.meal_id === plan.meal_id);
  const pin = meal.pinned_ingredients.find((item) => token.test(item.name || item.display_name || ""));
  const line = (shop.list.lines || []).find((item) => token.test(item.display_name || ""));
  expect(pin, JSON.stringify(meal.pinned_ingredients || []).slice(0, 800)).toBeTruthy();
  expect(line, JSON.stringify(shop.list.lines || []).slice(0, 800)).toBeTruthy();
  const expectedQty = Math.round(Number(pin.quantity) * (6 / meal.base_servings) * 1000) / 1000;
  expect(Number(line.quantity)).toBeCloseTo(expectedQty, 3);
  expect(line.unit).toBe(pin.unit);

  await page.locator("#btnStartCook").click();
  await expect(page.locator(".view.is-active[data-view='cook']")).toBeVisible();
  const atSix = await recipeAt(page, 6);
  const stepIngredients = atSix.recipe.steps.flatMap((step) => step.ingredients || []);
  expect(stepIngredients.length).toBeGreaterThan(0);
  await expect(page.locator("#cookIngList")).toContainText(stepIngredients[0]);
});
