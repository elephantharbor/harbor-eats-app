import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { previousCompletedMeal } from "../src/lib/household-state.js";
import { reduceMealAction } from "../src/lib/meal-identity.js";

function loadClient(file, globalName) {
  const code = readFileSync(new URL(`../public/${file}`, import.meta.url), "utf8");
  const sandbox = { window: {}, Object, JSON };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window[globalName];
}

const Nav = loadClient("nav-context.js", "FlavorWeaveNav");
const clientReduce = loadClient("meal-identity.js", "MealIdentity").reduceMealAction;

/** Mirror of how show() resolves a child screen. */
function open(view, from, opts = {}) {
  const ctx = Nav.contextFor(view, from, { established: true, ...opts });
  return {
    ctx,
    back: Nav.backTarget(view, ctx),
    label: Nav.backLabel(Nav.backTarget(view, ctx)),
    nav: Nav.navSection(view, ctx),
    chrome: Nav.chrome(view, ctx),
  };
}

describe("FW-10 recipe detail remembers where it was opened", () => {
  it("Tonight → recipe → Back returns to Tonight with Tonight lit", () => {
    const r = open("detail", "choices");
    expect(r.back).toBe("choices");
    expect(r.label).toBe("Tonight");
    expect(r.nav).toBe("choices");
    expect(r.ctx.source).toBe("round");
  });

  it("History → recipe → Back returns to History with History lit", () => {
    const r = open("detail", "meals");
    expect(r.back).toBe("meals");
    expect(r.label).toBe("History");
    expect(r.nav).toBe("meals");
    expect(r.ctx.source).toBe("history");
  });

  it("Home → recipe → Back returns Home", () => {
    const r = open("detail", "home");
    expect(r.back).toBe("home");
    expect(r.nav).toBe("home");
  });

  it("a deep link with no origin gets a sensible parent", () => {
    expect(open("detail", null).back).toBe("home");
    expect(open("detail", "welcome").back).toBe("home");
    expect(open("detail", null, { parent: "choices" }).back).toBe("choices");
  });

  it("kitchen mode and back keeps the original origin", () => {
    const fromHistory = Nav.contextFor("detail", "meals", { established: true });
    const afterCook = Nav.contextFor("detail", "cook", { established: true, current: fromHistory });
    expect(afterCook).toEqual(fromHistory);
    const fromTonight = Nav.contextFor("detail", "choices", { established: true });
    expect(Nav.contextFor("detail", "cook", { current: fromTonight }).origin).toBe("choices");
  });

  it("opening from a new section replaces a stale context", () => {
    const stale = { origin: "meals", source: "history" };
    const fresh = Nav.contextFor("detail", "choices", { established: true, current: stale });
    expect(fresh.origin).toBe("choices");
    expect(fresh.source).toBe("round");
  });

  it("contexts are plain JSON for a future history-backed Back", () => {
    const ctx = Nav.contextFor("detail", "meals", { established: true });
    expect(JSON.parse(JSON.stringify(ctx))).toEqual(ctx);
  });

  it("recipe detail keeps the header nav (focus chrome); kitchen mode hides it", () => {
    expect(Nav.chrome("detail", { origin: "choices" })).toBe("focus");
    expect(Nav.chrome("cook", null)).toBe("none");
    expect(Nav.navSection("cook", null)).toBe(null);
  });
});

describe("FW-05 invite navigation", () => {
  it("Settings → Invite stays in the app shell and returns to Settings", () => {
    const r = open("invite", "settings");
    expect(r.ctx.mode).toBe("household");
    expect(r.chrome).toBe("full");
    expect(r.back).toBe("settings");
    expect(r.label).toBe("Settings");
    expect(r.nav).toBe("settings");
  });

  it("Home → Invite returns Home", () => {
    const r = open("invite", "home");
    expect(r.ctx.mode).toBe("household");
    expect(r.back).toBe("home");
  });

  it("onboarding invite keeps the onboarding flow and Back to taste", () => {
    const ctx = Nav.contextFor("invite", "taste", { established: false });
    expect(ctx).toEqual({ origin: "taste", mode: "onboarding" });
    expect(Nav.chrome("invite", ctx)).toBe("brand");
  });

  it("an established household can never land on a stale onboarding step", () => {
    for (const step of Nav.ONBOARDING_STEPS) {
      expect(Nav.guardView(step, true)).toBe("home");
      expect(Nav.guardView(step, false)).toBe(step);
    }
    expect(Nav.guardView("settings", true)).toBe("settings");
    expect(Nav.backTarget("invite", Nav.contextFor("invite", "settings", { established: true }))).not.toBe("taste");
  });

  it("re-rendering invite keeps the household context", () => {
    const first = Nav.contextFor("invite", "settings", { established: true });
    expect(Nav.contextFor("invite", "invite", { established: true, current: first })).toEqual(first);
  });
});

describe("rate screen origin", () => {
  it("returns to the finished screen or the section it came from", () => {
    expect(open("rate", "finished").back).toBe("finished");
    expect(open("rate", "meals").back).toBe("meals");
    expect(open("rate", "finished").nav).toBe("home");
  });
});

describe("D-07 Find focus chrome", () => {
  it("standalone Find lights the Find tab", () => {
    const r = open("find", "home", { mode: "standalone" });
    expect(r.nav).toBe("find");
    expect(r.chrome).toBe("full");
  });

  it("replace_plan_meal and choose_for_plan keep no primary nav lit", () => {
    expect(open("find", "planReview", { mode: "replace_plan_meal", origin: "planReview" }).nav).toBe(null);
    expect(open("find", "planReview", { mode: "choose_for_plan", origin: "planReview" }).nav).toBe(null);
    expect(Nav.chrome("find", { mode: "replace_plan_meal", origin: "planReview" })).toBe("focus");
  });

  it("recipe from plan-mode Find does not light Find", () => {
    const ctx = Nav.contextFor("detail", "find", {
      established: true,
      source: "discovery",
      mode: "replace_plan_meal",
    });
    expect(Nav.navSection("detail", ctx)).toBe(null);
  });
});

describe("Cycle 3 dinner plan navigation", () => {
  it("plan review opened from Tonight returns to Tonight", () => {
    const r = open("detail", "choices", { source: "tonight_plan", origin: "tonightPlan" });
    expect(r.back).toBe("choices");
    expect(r.nav).toBe("choices");
    expect(r.ctx.origin).toBe("tonightPlan");
  });

  it("plan review and shop list use focus chrome while composing", () => {
    expect(Nav.chrome("planCount", Nav.contextFor("planCount", "home", { established: true }))).toBe("focus");
    expect(Nav.chrome("planReview", Nav.contextFor("planReview", "planCount", { established: true }))).toBe("focus");
    expect(Nav.chrome("shopList", Nav.contextFor("shopList", "planConfirm", { established: true }))).toBe("focus");
  });

  it("edit plan review keeps Tonight lit", () => {
    const ctx = Nav.contextFor("planReview", "choices", { established: true, mode: "edit" });
    expect(Nav.navSection("planReview", ctx)).toBe("choices");
    expect(Nav.chrome("planReview", ctx)).toBe("full");
  });
});

describe("FW-01 · viewing is not selecting", () => {
  it("opening a recipe from History never changes tonight's selection", () => {
    const state = {
      previewMealId: null,
      selectedMealId: "plan2-A",
      cookingMealId: null,
      lifecycle: "Selected",
      outcomeLocked: false,
      lockedMealOptionId: null,
      ratingsByOption: {},
      ratings: {},
    };
    for (const reduce of [reduceMealAction, clientReduce]) {
      const next = reduce(state, { type: "preview", mealOptionId: "plan1-B" });
      expect(next.selectedMealId).toBe("plan2-A");
      expect(next.lifecycle).toBe("Selected");
    }
  });
});

describe("FW-07 next dinner", () => {
  const history = [
    { plan_id: "p3", meal_name: null, status: "Generated" },
    { plan_id: "p2", meal_option_id: "p2-B", meal_name: "Miso-Ginger Salmon", recipe_slug: "miso-ginger-salmon", status: "Rated", avg_score: 8.5 },
    { plan_id: "p1", meal_option_id: "p1-A", meal_name: "Tofu Tacos", status: "Rated", avg_score: 7 },
  ];

  it("the last finished dinner stays historical and separate from the current round", () => {
    const prev = previousCompletedMeal(history, "p3");
    expect(prev.plan_id).toBe("p2");
    expect(prev.meal_name).toBe("Miso-Ginger Salmon");
    expect(prev.avg_score).toBe(8.5);
  });

  it("never reports the current round as the previous one", () => {
    expect(previousCompletedMeal(history, "p2").plan_id).toBe("p1");
    expect(previousCompletedMeal([{ plan_id: "p1", status: "Selected", meal_name: "X" }], "p9")).toBe(null);
    expect(previousCompletedMeal([], "p1")).toBe(null);
  });

  it("a rated round stays locked, so its pick and ratings cannot be rewritten", () => {
    const rated = {
      selectedMealId: "p2-B",
      previewMealId: null,
      cookingMealId: null,
      lifecycle: "Rated",
      outcomeLocked: true,
      lockedMealOptionId: "p2-B",
      ratingsByOption: { "p2-B": { m1: { score: 9, note: "" } } },
      ratings: { m1: { score: 9, note: "" } },
    };
    for (const reduce of [reduceMealAction, clientReduce]) {
      expect(reduce(rated, { type: "select", mealOptionId: "p2-A" }).error).toBe("selection_locked");
      expect(reduce(rated, { type: "abandon_selection" }).error).toBe("selection_locked");
      expect(reduce(rated, { type: "preview", mealOptionId: "p2-A" }).selectedMealId).toBe("p2-B");
    }
  });
});
