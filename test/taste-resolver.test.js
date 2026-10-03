import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BBQ_RESOLUTION, VOCABULARY_CATEGORIES } from "../src/lib/cycle2-schema.js";
import { aliasIndex, parentOf, resolveTasteTerm } from "../src/lib/taste-resolver.js";
import { getTasteTerm, listVocabulary, normalizeTasteTerm } from "../src/lib/taste-vocabulary.js";

const OVERSIGHT = {
  cuisine: ["mexican", "indian", "thai", "mediterranean", "japanese", "italian", "korean"],
  flavor: ["smoky", "citrusy", "savory", "spicy", "tangy", "rich", "fresh"],
  texture: ["crispy", "creamy", "crunchy", "tender"],
  meal_style: ["tacos", "bowls", "soups", "pasta", "grilled", "curries", "sandwiches"],
  ingredient: ["mushrooms", "tofu", "salmon", "eggplant", "swordfish"],
};

describe("taste vocabulary", () => {
  it("uses the five shared categories and keeps every oversight example", () => {
    const terms = listVocabulary();
    expect(new Set(terms.map((row) => row.category))).toEqual(new Set(VOCABULARY_CATEGORIES));
    for (const [category, slugs] of Object.entries(OVERSIGHT)) {
      for (const slug of slugs) {
        const term = getTasteTerm(slug);
        expect(term, slug).toMatchObject({ slug, category, active: true, parent_slug: null });
      }
    }
  });

  it("does not add a separate barbecue row", () => {
    const slugs = listVocabulary().map((row) => row.slug);
    expect(slugs).not.toContain("bbq");
    expect(slugs).not.toContain("barbecue");
    expect(getTasteTerm(BBQ_RESOLUTION.vocabulary_slug).category).toBe("flavor");
  });

  it("leaves parent empty until a rollup earns it", () => {
    expect(listVocabulary().every((row) => row.parent_slug === null)).toBe(true);
    expect(parentOf("smoky")).toBeNull();
  });
});

describe("synonym resolution", () => {
  it("resolves BBQ to smoky and does not create a row", () => {
    const before = listVocabulary().length;
    for (const input of ["BBQ", "bbq", "barbecue", "barbeque", "bar-b-que", "Bar B Que", "smoked", "Smoky"]) {
      const hit = resolveTasteTerm(input);
      expect(hit).toMatchObject({ status: "resolved", vocabulary_slug: "smoky" });
    }
    expect(listVocabulary().length).toBe(before);
    expect(Object.isFrozen(listVocabulary())).toBe(true);
  });

  it("resolves the spark and cuisine aliases the app already uses", () => {
    expect(resolveTasteTerm("bright").vocabulary_slug).toBe("citrusy");
    expect(resolveTasteTerm("crispy").vocabulary_slug).toBe("crispy");
    expect(resolveTasteTerm("taco night").vocabulary_slug).toBe("tacos");
    expect(resolveTasteTerm("curry bowls").vocabulary_slug).toBe("curries");
    expect(resolveTasteTerm("indian-inspired").vocabulary_slug).toBe("indian");
    expect(resolveTasteTerm("thai-inspired").vocabulary_slug).toBe("thai");
    expect(resolveTasteTerm("stir-fry").vocabulary_slug).toBe("stir-fries");
    expect(resolveTasteTerm("aubergine").vocabulary_slug).toBe("eggplant");
  });

  it("does not invent a taste for an unknown search", () => {
    const before = listVocabulary().length;
    const hit = resolveTasteTerm("dragonfruit smoke");
    expect(hit).toMatchObject({ status: "unresolved", vocabulary_slug: null, concept: null });
    expect(resolveTasteTerm("")).toMatchObject({ status: "unresolved" });
    expect(resolveTasteTerm("   ")).toMatchObject({ status: "unresolved" });
    expect(listVocabulary().length).toBe(before);
  });

  it("keeps practical hints and finfish permission out of taste search", () => {
    for (const input of ["sheet", "sheet-pan", "fish", "weeknight", "grill-friendly", "under 30 minutes", "low cleanup"]) {
      expect(resolveTasteTerm(input).status).toBe("unresolved");
    }
    expect(resolveTasteTerm("grill").vocabulary_slug).toBe("grilled");
  });

  it("skips an inactive term instead of adding a replacement", () => {
    const vocabulary = listVocabulary().map((row) =>
      row.slug === "korean" ? { ...row, synonyms: [...row.synonyms], active: false } : row
    );
    const before = listVocabulary().length;
    expect(resolveTasteTerm("korean", vocabulary)).toMatchObject({
      status: "inactive",
      vocabulary_slug: "korean",
    });
    expect(listVocabulary().length).toBe(before);
    expect(getTasteTerm("korean").active).toBe(true);
  });

  it("does not treat a parent as a synonym", () => {
    const vocabulary = [
      {
        slug: "smoky",
        display_name: "Smoky",
        category: "flavor",
        synonyms: ["bbq"],
        active: true,
        parent_slug: null,
      },
      {
        slug: "barbecue-style",
        display_name: "Barbecue style",
        category: "meal_style",
        synonyms: [],
        active: true,
        parent_slug: "smoky",
      },
    ];
    expect(resolveTasteTerm("barbecue style", vocabulary).vocabulary_slug).toBe("barbecue-style");
    expect(resolveTasteTerm("bbq", vocabulary).vocabulary_slug).toBe("smoky");
  });

  it("rejects one alias that points at two terms", () => {
    expect(() =>
      aliasIndex([
        {
          slug: "smoky",
          display_name: "Smoky",
          category: "flavor",
          synonyms: ["bbq"],
          active: true,
          parent_slug: null,
        },
        {
          slug: "barbecue",
          display_name: "Barbecue",
          category: "flavor",
          synonyms: ["bbq"],
          active: true,
          parent_slug: null,
        },
      ])
    ).toThrow(/bbq/);
  });

  it("folds case and punctuation without stemming", () => {
    expect(normalizeTasteTerm("  Indian-Inspired! ")).toBe("indian inspired");
    expect(resolveTasteTerm("crisps").status).toBe("unresolved");
  });

  it("stays local and synchronous", () => {
    const source = readFileSync(new URL("../src/lib/taste-resolver.js", import.meta.url), "utf8");
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/openai|anthropic|workers\.ai/i);
    expect(resolveTasteTerm("pasta").status).toBe("resolved");
  });
});
