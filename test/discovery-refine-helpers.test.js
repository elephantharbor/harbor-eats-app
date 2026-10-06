import { describe, expect, it } from "vitest";
import {
  activeCriteriaCount,
  applyRelaxChip,
  cuisineValuesForTerm,
  findHistorySnapshot,
  vocabularyByKind,
} from "../src/discovery/refine-helpers.js";
import { normalizeQuery } from "../src/discovery/query.js";

describe("discovery refine helpers", () => {
  it("expands inspired cuisines for vocabulary terms", () => {
    expect(cuisineValuesForTerm({ slug: "italian" })).toEqual(["italian", "italian-inspired"]);
    expect(cuisineValuesForTerm({ slug: "mexican" })).toEqual(["mexican"]);
  });

  it("groups taste catalog vocabulary by kind", () => {
    const vocab = vocabularyByKind({
      groups: [
        { kind: "cuisine", terms: [{ slug: "mexican", name: "Mexican", on_menu: true }] },
        { kind: "meal_style", terms: [{ slug: "tacos", name: "Tacos", on_menu: true }] },
      ],
    });
    expect(vocab.cuisines[0].slug).toBe("mexican");
    expect(vocab.meal_styles[0].slug).toBe("tacos");
  });

  it("counts active criteria for refine label", () => {
    const q = normalizeQuery({ criteria: { diet: ["plant"], effort_levels: ["easy"] } }).query;
    expect(activeCriteriaCount(q)).toBeGreaterThan(1);
  });

  it("snapshots find history for back navigation", () => {
    const snap = findHistorySnapshot(
      { scrollY: 120, focusSlug: "miso-ginger-salmon", forceResults: true, mode: "standalone", urlContext: {} },
      function () {
        return "/find?effort=easy";
      }
    );
    expect(snap.path).toBe("/find?effort=easy");
    expect(snap.scrollY).toBe(120);
  });

  it("applies relax chip patches without mixing soft and hard", () => {
    const q = normalizeQuery({ criteria: { quick: true, effort_levels: ["easy"] } }).query;
    const next = applyRelaxChip(q, { label: "Easy", patch: { effort_levels: [] } });
    expect(next.criteria.effort_levels).toEqual([]);
    expect(next.criteria.quick).toBe(true);
  });
});
