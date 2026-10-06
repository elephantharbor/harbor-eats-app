import { describe, expect, it } from "vitest";
import {
  DISCOVERY_SHELVES,
  emptyStateKind,
  findPathFromState,
  queryHasActiveCriteria,
  relaxRemoveChips,
} from "../src/discovery/client-ui.js";
import { emptyQuery, normalizeQuery, parseQuery, serializeQueryString } from "../src/discovery/query.js";

describe("discovery client-ui", () => {
  it("treats Easy, Quick, and Simple as independent query fields", () => {
    const easy = normalizeQuery({ criteria: { effort_levels: ["easy"] } }).query;
    const quick = normalizeQuery({ criteria: { quick: true } }).query;
    expect(queryHasActiveCriteria(easy)).toBe(true);
    expect(queryHasActiveCriteria(quick)).toBe(true);
    expect(easy.criteria.quick).toBe(false);
    expect(quick.criteria.effort_levels).toEqual([]);
  });

  it("serializes browser find URLs without schema or paging", () => {
    const q = normalizeQuery({ criteria: { effort_levels: ["easy"] }, text: "bowl" }).query;
    const path = findPathFromState(q, { mode: "standalone" });
    expect(path.startsWith("/find?")).toBe(true);
    expect(path).not.toContain("schema=");
    expect(path).not.toContain("limit=");
    const parsed = parseQuery(path.replace("/find?", ""));
    expect(parsed.ok).toBe(true);
    expect(parsed.query.text).toBe("bowl");
    expect(parsed.query.criteria.effort_levels).toEqual(["easy"]);
  });

  it("includes plan mode context in find URLs", () => {
    const path = findPathFromState(emptyQuery(), {
      mode: "replace_plan_meal",
      dinner_plan_id: "dp_1",
      meal_id: "dpm_2",
    });
    expect(path).toContain("mode=replace_plan_meal");
    expect(path).toContain("dinner_plan_id=dp_1");
    expect(path).toContain("meal_id=dpm_2");
  });

  it("picks empty state kind from totals and excluded_counts", () => {
    const q = normalizeQuery({ text: "taco" }).query;
    expect(emptyStateKind(q, 0, {})).toBe("text");
    expect(emptyStateKind(emptyQuery(), 0, { explicit_quick: 3 })).toBe("relax");
    expect(emptyStateKind(emptyQuery(), 0, {})).toBe("nothing_fits");
  });

  it("offers remove chips for explicit exclusions", () => {
    const q = normalizeQuery({ criteria: { quick: true, effort_levels: ["easy"] } }).query;
    const chips = relaxRemoveChips({ explicit_quick: 5, explicit_effort: 2 }, q);
    expect(chips.length).toBeGreaterThan(0);
    expect(chips.some((c) => c.label === "Under 30 min")).toBe(true);
  });

  it("defines shelves including seafood, plant, and different", () => {
    const ids = DISCOVERY_SHELVES.map((s) => s.id);
    expect(ids).toContain("seafood");
    expect(ids).toContain("plant");
    expect(ids).toContain("different");
  });

  it("round-trips contract query string for discovery search", () => {
    const normalized = normalizeQuery({
      criteria: { protein_groups: ["seafood"], diet: ["plant"], different: true },
    });
    const search = serializeQueryString(normalized.query);
    const back = parseQuery(search);
    expect(back.query.criteria.protein_groups).toEqual(["seafood"]);
    expect(back.query.criteria.diet).toEqual(["plant", "plant_based", "vegetarian"]);
    expect(back.query.criteria.different).toBe(true);
  });
});
