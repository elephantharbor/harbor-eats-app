import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { constraintRowsFromKeys, isOptionEligibleForHousehold } from "../src/lib/eligibility.js";
import { learningRows } from "../src/lib/evidence-origin.js";
import {
  HH001_CASHEW_BACKFILL,
  LEGACY_CONSTRAINT_IDS,
  LEGACY_EVIDENCE_KINDS,
  LEGACY_SPARK_IDS,
  auditKnownClientPreferences,
  bbqResolution,
  classifyLegacyValue,
  rulesFromLegacyKeys,
} from "../src/lib/legacy-preference-audit.js";
import { catalogMealToOption, MEAL_CATALOG } from "../src/lib/meal-catalog.js";
import {
  activePracticalHints,
  attributeTastesFromMealRating,
  combineTasteRanks,
  decideEligibility,
  learningTasteRows,
  overridePracticalHint,
  planningNote,
  presentStance,
  rankFor,
  recordTargetedFeedback,
  removeTaste,
  setPracticalHint,
  setTaste,
  tasteRankEffect,
} from "../src/lib/preference-concepts.js";
import { projectLegacyConcept } from "../src/lib/recipe-package.js";
import { getConceptBySlug } from "../src/lib/recipe-store.js";

const HH001 = ["dairy", "meat", "poultry", "shellfish", "nuts", "cashew_ok"];

function signals(slug) {
  const pkg = projectLegacyConcept(getConceptBySlug(slug));
  return {
    allergens: pkg.allergens,
    vocabulary_tag_ids: pkg.vocabulary_tag_ids,
  };
}

function limits(memberId, keys) {
  return { member_id: memberId, rules: rulesFromLegacyKeys(keys) };
}

describe("legacy preference audit", () => {
  it("covers every hard-coded constraint, spark, and evidence kind", () => {
    const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    const slice = (name) => {
      const start = app.indexOf(`const ${name} = [`);
      return app.slice(start, app.indexOf("];", start));
    };
    const ids = (source) => [...source.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);
    expect(ids(slice("constraintOptions"))).toEqual(LEGACY_CONSTRAINT_IDS);
    // Spark chips were replaced by the shared vocabulary. Stored spark rows still need the audit.
    expect(app).not.toContain("const sparkOptions");

    const audit = auditKnownClientPreferences();
    for (const id of [...LEGACY_CONSTRAINT_IDS, ...LEGACY_SPARK_IDS, ...LEGACY_EVIDENCE_KINDS]) {
      expect(audit.some((row) => row.value === id)).toBe(true);
    }
  });

  it("maps only the unambiguous client values", () => {
    expect(classifyLegacyValue("constraint", "meat")).toMatchObject({
      status: "mapped",
      limit_id: "no_meat",
      includes_poultry: true,
    });
    expect(classifyLegacyValue("constraint", "fish")).toMatchObject({
      status: "mapped",
      concept_type: "hard_limit",
      limit_id: "no_finfish",
      eligibility_only: true,
    });
    expect(classifyLegacyValue("constraint", "cashew_ok").limit_id).toBe("cashew_permitted");
    expect(classifyLegacyValue("constraint", "none").status).toBe("unresolved");
    expect(classifyLegacyValue("spark", "bright").vocabulary_slug).toBe("citrusy");
    expect(classifyLegacyValue("spark", "curry").vocabulary_slug).toBe("curries");
    expect(classifyLegacyValue("spark", "sheet")).toMatchObject({
      status: "mapped",
      concept_type: "practical",
      practical_detail: "sheet-pan",
    });
    expect(classifyLegacyValue("spark", "fish").status).toBe("unresolved");
    expect(classifyLegacyValue("evidence_kind", "like").status).toBe("mapped");
    expect(classifyLegacyValue("evidence_kind", "dislike").status).toBe("unresolved");
    expect(classifyLegacyValue("evidence_kind", "neutral").status).toBe("unresolved");
    expect(classifyLegacyValue("cuisine", "asian-fusion").status).toBe("unresolved");
    expect(classifyLegacyValue("flavor_profile", "warm-spiced").status).toBe("unresolved");
    expect(classifyLegacyValue("flavor_profile", "savory").status).toBe("unresolved");
    expect(classifyLegacyValue("primary_ingredient", "beans").status).toBe("unresolved");
    expect(classifyLegacyValue("meal_format", "handheld").status).toBe("unresolved");
    expect(classifyLegacyValue("tag", "seafood").status).toBe("unresolved");
    expect(classifyLegacyValue("weeknight_flag", "true").status).toBe("unresolved");
    expect(classifyLegacyValue("presentation", "avoid").status).toBe("unresolved");
  });

  it("documents the Household 001 cashew backfill without writing it", () => {
    expect(HH001_CASHEW_BACKFILL.documentation_only).toBe(true);
    expect(HH001_CASHEW_BACKFILL.write_production).toBe(false);
    expect(HH001_CASHEW_BACKFILL.production_d1_id).toBe("23aa3db3-1090-471b-8c8a-b6fe71f5c053");
    expect(HH001_CASHEW_BACKFILL.future_rows).toEqual([
      { rule_key: "nuts", status: "prohibited" },
      { rule_key: "cashew", status: "permitted" },
      { rule_key: "dairy", status: "prohibited" },
      { rule_key: "meat", status: "prohibited" },
      { rule_key: "poultry", status: "prohibited" },
      { rule_key: "shellfish", status: "prohibited" },
    ]);
    expect(bbqResolution()).toMatchObject({ resolved_slug: "smoky", separate_barbecue_row: false });
  });
});

describe("three concept types", () => {
  it("lets hard limits decide, and ignores tastes, ratings, inferred notes, and hints", () => {
    const loved = setTaste([], {
      member_id: "ana",
      vocabulary_slug: "salmon",
      rank: "love",
      stance: "explicit",
    }).tastes;
    const inferred = setTaste([], {
      member_id: "ana",
      vocabulary_slug: "crispy",
      rank: "love",
      stance: "inferred",
      confidence: 0.99,
    }).tastes;
    const hints = setPracticalHint([], { member_id: "ana", hint_key: "grill_friendly" });
    const decision = decideEligibility({
      limits: [limits("ana", ["fish"])],
      recipe: signals("miso-ginger-salmon"),
      tastes: loved,
      inferred,
      ratings: [{ score: 10, member_id: "ana" }],
      practicalHints: hints,
    });
    expect(decision.eligible).toBe(false);
    expect(decision.blocked[0].limit_ids).toContain("no_finfish");
    expect(decision.taste_count_ignored).toBe(2);
    expect(decision.rating_count_ignored).toBe(1);
    expect(decision.hint_count_ignored).toBe(1);
  });

  it("matches the current eligibility rules for the named limits", () => {
    const cases = [
      ["cashew-pesto-pasta", HH001, true],
      ["cashew-pesto-pasta", ["nuts"], false],
      ["mushroom-walnut-bolognese", HH001, false],
      ["miso-ginger-salmon", HH001, true],
      ["miso-ginger-salmon", ["fish"], false],
      ["sheet-pan-lemon-herb-chicken", ["meat"], false],
      ["sheet-pan-lemon-herb-chicken", ["poultry"], false],
      ["miso-ginger-salmon", ["poultry"], true],
      ["lemon-garlic-shrimp-pasta", ["shellfish"], false],
      ["black-bean-quesadillas", ["dairy"], false],
      ["coconut-chickpea-curry", HH001, true],
    ];
    for (const [slug, keys, eligible] of cases) {
      const option = catalogMealToOption(
        MEAL_CATALOG.find((meal) => meal.recipe_slug === slug),
        "A",
        "p"
      );
      const legacy = isOptionEligibleForHousehold(
        option,
        constraintRowsFromKeys(keys).map((row) => ({ ...row, member_id: "ana" }))
      );
      const contract = decideEligibility({
        limits: [limits("ana", keys)],
        recipe: signals(slug),
        tastes: [{ member_id: "ana", vocabulary_slug: "salmon", rank: "love", stance: "explicit" }],
        ratings: [{ score: 10 }],
      }).eligible;
      expect(legacy, slug).toBe(eligible);
      expect(contract, slug).toBe(eligible);
    }
  });

  it("keeps a cashew exception on the diner who has it", () => {
    const recipe = signals("cashew-pesto-pasta");
    const both = decideEligibility({
      limits: [limits("ana", ["nuts", "cashew_ok"]), limits("ben", ["nuts"])],
      recipe,
    });
    expect(both.eligible).toBe(false);
    expect(
      decideEligibility({ limits: [limits("ana", ["nuts", "cashew_ok"])], recipe }).eligible
    ).toBe(true);
    expect(decideEligibility({
      limits: [limits("ana", ["nuts"])],
      recipe: { allergens: ["nuts"], vocabulary_tag_ids: [] },
    }).eligible).toBe(false);
  });

  it("treats Less often as a rank, not an exclusion", () => {
    expect(tasteRankEffect("less_often")).toMatchObject({
      excludes: false,
      allergy: false,
      ban: false,
      ordering: "lower",
    });
    const tastes = setTaste([], {
      member_id: "ana",
      vocabulary_slug: "spicy",
      rank: "less_often",
    }).tastes;
    const decision = decideEligibility({
      limits: [limits("ana", [])],
      recipe: { allergens: [], vocabulary_tag_ids: ["spicy"] },
      tastes,
    });
    expect(decision.eligible).toBe(true);
  });

  it("keeps tastes on one diner and refuses a household average", () => {
    let tastes = [];
    tastes = setTaste(tastes, { member_id: "ana", vocabulary_slug: "tacos", rank: "love" }).tastes;
    tastes = setTaste(tastes, { member_id: "ben", vocabulary_slug: "tacos", rank: "less_often" }).tastes;
    expect(rankFor(tastes, "ana", "tacos").rank).toBe("love");
    expect(rankFor(tastes, "ben", "tacos").rank).toBe("less_often");
    expect(() => combineTasteRanks(["love", "less_often"])).toThrow(/one diner/);
  });

  it("removes a taste without writing a ban", () => {
    const tastes = setTaste([], {
      member_id: "ana",
      vocabulary_slug: "mushrooms",
      rank: "like",
    }).tastes;
    const removed = removeTaste(tastes, "ana", "mushrooms");
    expect(removed.tastes).toEqual([]);
    expect(removed.hard_limit_written).toBe(false);
    expect(removed.action).toBe("remove");
  });

  it("lets an explicit taste win over a later inferred one", () => {
    const explicit = setTaste([], {
      member_id: "ana",
      vocabulary_slug: "rich",
      rank: "less_often",
      stance: "explicit",
    }).tastes;
    const kept = setTaste(explicit, {
      member_id: "ana",
      vocabulary_slug: "rich",
      rank: "love",
      stance: "inferred",
      confidence: 0.95,
    });
    expect(kept.rejected).toBe("explicit_wins");
    expect(kept.tastes).toEqual(explicit);
  });

  it("shows You told us and We're learning, without a confidence figure", () => {
    const stated = presentStance({ stance: "explicit", confidence: null });
    const learning = presentStance({ stance: "inferred", confidence: 0.91 });
    expect(stated).toEqual({
      stance: "explicit",
      label: "You told us",
      editable: true,
      correctable: true,
    });
    expect(learning).toEqual({
      stance: "inferred",
      label: "We're learning",
      editable: true,
      correctable: true,
    });
    expect(JSON.stringify(learning)).not.toMatch(/0\.91|confidence|probability|statistic/i);
  });

  it("does not turn a high rating into a liking for every attribute", () => {
    expect(
      attributeTastesFromMealRating({
        score: 10,
        vocabulary_tag_ids: ["smoky", "crispy", "tofu", "mexican", "tacos"],
      })
    ).toEqual([]);
  });

  it("keeps targeted feedback optional and on one meal", () => {
    const crunch = recordTargetedFeedback({
      member_id: "ana",
      recipe_version_id: "rv_crispy-chipotle-tofu-tacos_v1",
      code: "loved_the_crunch",
    });
    const sauce = recordTargetedFeedback({
      member_id: "ana",
      recipe_version_id: "rv_crispy-chipotle-tofu-tacos_v1",
      code: "great_sauce",
    });
    expect(crunch).toMatchObject({
      vocabulary_slug: "crispy",
      writes_taste_rank: false,
      writes_hard_limit: false,
      required: false,
      label: "Loved the crunch",
    });
    expect(sauce.vocabulary_slug).toBeNull();
    expect(recordTargetedFeedback({
      member_id: "ana",
      recipe_version_id: "rv_x_v1",
      code: "too_spicy",
    }).signal).toBe("too_much");
    expect(() =>
      recordTargetedFeedback({ member_id: "ana", recipe_version_id: "rv_x_v1", code: "survey" })
    ).toThrow(/unknown targeted feedback/);
  });

  it("treats practical hints as overridable planning notes", () => {
    let hints = setPracticalHint([], { member_id: "ana", hint_key: "under_30_minutes" });
    hints = setPracticalHint(hints, {
      member_id: "ana",
      hint_key: "equipment",
      detail: "sheet-pan",
    });
    const slow = { total_minutes: 45, equipment: ["sheet-pan"], vocabulary_tag_ids: [] };
    expect(planningNote(hints[0], slow)).toEqual({
      applies: false,
      blocks: false,
      taste_evidence: false,
    });
    expect(decideEligibility({
      limits: [],
      recipe: { allergens: [], vocabulary_tag_ids: [] },
      practicalHints: hints,
    }).eligible).toBe(true);
    hints = overridePracticalHint(hints, "ana", "equipment", "sheet-pan");
    expect(activePracticalHints(hints).map((hint) => hint.hint_key)).toEqual(["under_30_minutes"]);
    expect(planningNote(hints.find((hint) => hint.hint_key === "equipment"), slow).applies).toBe(false);
    expect(hints.every((hint) => hint.affects_eligibility === false && hint.taste_evidence === false)).toBe(true);
  });

  it("keeps synthetic and unproven taste rows out of learning", () => {
    const household = { data_origin: "household", acquisition_source: "organic" };
    const rows = [
      { vocabulary_slug: "tacos", data_origin: "household" },
      { vocabulary_slug: "spicy", data_origin: "synthetic" },
      { vocabulary_slug: "rich", data_origin: "unproven" },
    ];
    expect(learningTasteRows(rows, household).map((row) => row.vocabulary_slug)).toEqual(["tacos"]);
    expect(learningTasteRows(rows, { data_origin: "synthetic", acquisition_source: "synthetic_qa" })).toEqual([]);
    expect(learningRows(rows, household)).toEqual(learningTasteRows(rows, household));
  });
});
