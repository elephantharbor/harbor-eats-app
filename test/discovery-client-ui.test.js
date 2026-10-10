import { describe, expect, it } from "vitest";
import {
  DISCOVERY_SHELVES,
  emptyStateKind,
  findPathFromState,
  queryHasActiveCriteria,
  relaxRemoveChips,
  timeChipIsOn,
  timeChipTogglePatch,
} from "../src/discovery/client-ui.js";
import { emptyQuery, normalizeQuery, parseQuery, serializeQueryString } from "../src/discovery/query.js";

describe("discovery client-ui", () => {
  it("toggles the Under 30 min chip off when already applied", () => {
    const on = normalizeQuery({ criteria: { quick: true } }).query.criteria;
    expect(timeChipIsOn(on)).toBe(true);
    expect(timeChipTogglePatch(on)).toEqual({ quick: false, max_minutes: null });
    const off = normalizeQuery({ criteria: { quick: false } }).query.criteria;
    expect(timeChipIsOn(off)).toBe(false);
    expect(timeChipTogglePatch(off)).toEqual({ quick: true, max_minutes: null });
    const max = normalizeQuery({ criteria: { max_minutes: 45, quick: false } }).query.criteria;
    expect(timeChipIsOn(max)).toBe(true);
    expect(timeChipTogglePatch(max)).toEqual({ quick: false, max_minutes: null });
  });

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
    expect(path).not.toContain("participant_id");
    expect(path).not.toContain("position=");
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

describe("D-07 no-results completeness (hardening-1)", async () => {
  const { relaxRemoveChips: srcChips, emptyCriteriaSummary } = await import("../src/discovery/client-ui.js");
  await import("../public/discovery-relax-bridge.js");
  const bridge = globalThis.FlavorWeaveDiscoveryRelax;
  const q = (criteria, text = null) => ({
    text,
    criteria: {
      cuisines: [], meal_styles: [], flavors: [], ingredients: [], exclude_ingredients: [], effort_levels: [],
      ingredient_complexities: [], max_minutes: null, methods: [], equipment: [], quick: false, protein_groups: [],
      diet: [], textures: [], different: false, ...criteria,
    },
  });

  it("method, equipment and exclude-ingredient exclusions always yield a broaden chip", () => {
    const query = q({ methods: ["grill"], equipment: ["air fryer"], exclude_ingredients: ["mushroom"] });
    const chips = srcChips({ explicit_method: 4, explicit_equipment: 2, explicit_exclude_ingredient: 1 }, query);
    expect(chips.map((c) => c.label)).toEqual(["grill", "air fryer", "No mushroom"]);
  });
  it("search text combined with criteria is offered as a removable chip", () => {
    const chips = srcChips({ explicit_effort: 3 }, q({ effort_levels: ["easy"] }, "tacos"));
    expect(chips.map((c) => c.label)).toEqual(["Easy", "“tacos”"]);
    const next = bridge.applyRelaxChip(q({ effort_levels: ["easy"] }, "tacos"), chips[1]);
    expect(next.text).toBeNull();
    expect(next.criteria.effort_levels).toEqual(["easy"]);
  });
  it("browser bridge mirrors src chips exactly", () => {
    const cases = [
      [{ explicit_quick: 1, explicit_cuisine: 2 }, q({ quick: true, cuisines: ["thai"] })],
      [{ explicit_equipment: 1 }, q({ equipment: ["pressure cooker"] }, "curry")],
      [{ explicit_exclude_ingredient: 1, explicit_texture: 1 }, q({ exclude_ingredients: ["egg"], textures: ["crispy"] })],
    ];
    for (const [ex, query] of cases) {
      expect(JSON.parse(JSON.stringify(bridge.relaxRemoveChips(ex, query)))).toEqual(JSON.parse(JSON.stringify(srcChips(ex, query))));
      expect(bridge.emptyCriteriaSummary(query)).toEqual(emptyCriteriaSummary(query));
    }
  });
  it("current criteria are summarized; household limits are never listed", () => {
    expect(emptyCriteriaSummary(q({ quick: true, effort_levels: ["easy"], cuisines: ["thai"], exclude_ingredients: ["egg"] }, "noodles"))).toEqual([
      "“noodles”", "Under 30 min", "Easy", "thai", "No egg",
    ]);
    expect(emptyCriteriaSummary(q({}))).toEqual([]);
  });
  it("applying every chip removes only that criterion", () => {
    const query = q({ methods: ["grill", "roast"], equipment: ["wok"], exclude_ingredients: ["egg"] });
    const chips = bridge.relaxRemoveChips({ explicit_method: 1, explicit_equipment: 1, explicit_exclude_ingredient: 1 }, query);
    expect(bridge.applyRelaxChip(query, chips[0]).criteria.methods).toEqual(["roast"]);
    expect(bridge.applyRelaxChip(query, chips[1]).criteria.equipment).toEqual([]);
    expect(bridge.applyRelaxChip(query, chips[2]).criteria.exclude_ingredients).toEqual([]);
    expect(bridge.applyRelaxChip(query, chips[2]).criteria.methods).toEqual(["grill", "roast"]);
  });
});
