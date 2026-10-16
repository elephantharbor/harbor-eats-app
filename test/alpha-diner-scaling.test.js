import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { plannerCatalog } from "../src/lib/dinner-planner.js";
import { scaleForDiners, neededLines } from "../src/lib/ingredient-identity.js";
import { dinerCountForMeal, dinerExceptionCopy, shopCookingHeadline } from "../src/lib/diner-count.js";
import { applyPlanMutation, createDinnerPlan } from "../src/lib/plan-mutations.js";
import { emptyHouseholdList, projectPlanIntoList, setLineState } from "../src/lib/household-shop.js";

function loadMigrations(db) {
  const dir = new URL("../migrations", import.meta.url).pathname;
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) db.exec(readFileSync(`${dir}/${file}`, "utf8"));
}

describe("diner exception and shop headline", () => {
  it("names up to two dinners that differ, and the one person who is out", () => {
    expect(shopCookingHeadline({ mealCount: 3, householdCount: 2, exceptions: [] })).toBe(
      "3 dinners · cooking for 2"
    );
    expect(
      shopCookingHeadline({
        mealCount: 3,
        householdCount: 2,
        exceptions: [
          { label: "Fri", count: 4 },
          { label: "Sat", count: 1 },
        ],
      })
    ).toBe("3 dinners · cooking for 2, Fri for 4, Sat for 1");
    expect(
      shopCookingHeadline({
        mealCount: 4,
        householdCount: 2,
        exceptions: [
          { label: "Fri", count: 4 },
          { label: "Sat", count: 1 },
          { label: "Sun", count: 3 },
        ],
      })
    ).toBe("4 dinners · cooking for 2 · amounts match each dinner");
    expect(
      dinerExceptionCopy({
        householdCount: 3,
        dinerCount: 2,
        eatingNames: ["Renata", "Tom"],
        absentNames: ["Sam"],
      })
    ).toBe("For 2 · Sam’s out");
    expect(
      dinerExceptionCopy({
        householdCount: 2,
        dinerCount: 1,
        eatingNames: ["Renata"],
        absentNames: ["Tom"],
      })
    ).toBe("For 1 · just Renata");
    expect(
      dinerExceptionCopy({ householdCount: 2, dinerCount: 4, guestCount: 2, eatingNames: ["Renata", "Tom"] })
    ).toBe("For 4 · 2 guests");
    expect(dinerExceptionCopy({ householdCount: 2, dinerCount: 2, eatingNames: ["Renata", "Tom"] })).toBeNull();
  });
});

describe("alpha diner scaling", () => {
  it("for serving lines scale to diner count", () => {
    const pin = [{ name: "steamed rice", quantity: 1, unit: "serving", raw_quantity: "for serving" }];
    expect(scaleForDiners(pin, 4, 2)[0].quantity).toBe(2);
    expect(scaleForDiners(pin, 4, 4)[0].quantity).toBe(4);
  });

  it("guest_count adds to participant count for shopping", () => {
    const ctx = {
      now: "2026-10-04T12:00:00.000Z",
      actor_member_id: "a",
      household_member_ids: ["a", "b"],
      constraints: [],
      data_origin: "household",
      tastes: [],
      catalog: plannerCatalog(),
    };
    const created = createDinnerPlan(
      {
        entry_point: "plan_dinners",
        meal_count: 1,
        fill: "manual",
        meals: [{ kind: "recipe", recipe_version_id: plannerCatalog()[0].pkg.recipe_version_id }],
        participant_ids: ["a", "b"],
      },
      ctx
    );
    expect(created.ok).toBe(true);
    const meal = created.plan.meals[0];
    meal.guest_count = 1;
    const lines = neededLines([{ ...meal, pinned_ingredients: meal.pinned_ingredients }]);
    expect(dinerCountForMeal(meal)).toBe(3);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("migration 0016 adds guest_count column", () => {
    const db = new DatabaseSync(":memory:");
    loadMigrations(db);
    const row = db.prepare("PRAGMA table_info(dinner_plan_meal)").all().find((c) => c.name === "guest_count");
    expect(row).toBeTruthy();
  });

  it("set_guest_count updates shopping without clearing purchased", () => {
    const ctx = {
      now: "2026-10-04T12:00:00.000Z",
      actor_member_id: "a",
      household_member_ids: ["a"],
      constraints: [],
      data_origin: "household",
      tastes: [],
      catalog: plannerCatalog(),
      id: (p) => `${p}_1`,
    };
    const created = createDinnerPlan(
      {
        entry_point: "plan_dinners",
        meal_count: 1,
        fill: "manual",
        meals: [{ kind: "recipe", recipe_version_id: plannerCatalog()[0].pkg.recipe_version_id }],
        participant_ids: ["a"],
      },
      ctx
    );
    const plan = created.plan;
    plan.shopping_started_at = ctx.now;
    const line = plan.shop_lines[0];
    line.list_state = "purchased";
    const mutated = applyPlanMutation(plan, { op: "set_guest_count", meal_id: plan.meals[0].meal_id, guest_count: 1 }, ctx);
    expect(mutated.ok).toBe(true);
    const again = mutated.plan.shop_lines.find((l) => l.ingredient_id === line.ingredient_id);
    expect(again.list_state).toBe("purchased");
    const list = projectPlanIntoList(
      emptyHouseholdList({ shop_list_id: "hsl_guest", household_id: "hh", now: ctx.now }),
      plan,
      { now: ctx.now }
    ).list;
    const marked = setLineState(list, { line_id: list.lines[0].line_id, list_state: "purchased" }, { now: ctx.now });
    const projected = projectPlanIntoList(marked.list, mutated.plan, { now: ctx.now }).list;
    const kept = projected.lines.find((row) => row.ingredient_id === line.ingredient_id && row.unit === line.unit);
    expect(kept.list_state).toBe("purchased");
    expect(projected.lines.filter((row) => row.ingredient_id === line.ingredient_id && row.unit === line.unit)).toHaveLength(1);
  });
});
