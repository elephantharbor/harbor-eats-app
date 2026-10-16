import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { eligibilityTagsFromFactory } from "../src/lib/catalog-import.js";
import { assessMealEligibility } from "../src/lib/dinner-planner.js";
import { isOptionEligibleForHousehold, optionTags, RULE_TO_TAGS } from "../src/lib/eligibility.js";
import { mapFactoryPackageAllergens } from "../src/lib/factory-package-tokens.js";

const SHELLFISH = [{ rule_key: "shellfish", status: "prohibited" }];
const RULES = ["dairy", "meat", "poultry", "fish", "shellfish", "nuts"];

const NUT_BUTTER = /\b(peanut|almond|cashew|sunflower|seed|apple|nut)[- ]butter\b/g;

/** Title scan as it behaved before the king-oyster fix. */
function legacyIngredientTags(name) {
  const lower = String(name).toLowerCase();
  if (!lower) return [];
  const found = new Set();
  for (const words of Object.values(RULE_TO_TAGS)) {
    for (const word of words) {
      const source = lower.replace(word === "butter" ? NUT_BUTTER : /$^/, " ");
      const pattern = word.replace(/[-\s]/g, "[-\\s]");
      if (new RegExp(`\\b${pattern}(?:s|es)?\\b`).test(source)) found.add(word);
    }
  }
  return [...found];
}

function loadPackages() {
  const root = join(process.cwd(), "catalog");
  return readdirSync(root)
    .filter((slug) => {
      try {
        readFileSync(join(root, slug, "v1.json"));
        return true;
      } catch {
        return false;
      }
    })
    .sort()
    .map((slug) => {
      const pkg = JSON.parse(readFileSync(join(root, slug, "v1.json"), "utf8"));
      const factory = pkg.catalog_contract === "flavorweave-catalog-package";
      const mapped = factory ? mapFactoryPackageAllergens(pkg) : null;
      const tags = factory ? eligibilityTagsFromFactory(pkg) : pkg.dish?.tags || [];
      const allergens = factory ? (mapped?.ok ? mapped.allergens : []) : pkg.projection?.allergens || [];
      return {
        slug,
        title: pkg.dish?.title || pkg.recipe_version?.title || slug,
        tags,
        allergens,
        dietary_eligibility: pkg.recipe_version?.dietary_eligibility || null,
        ingredients: pkg.recipe_version?.ingredients || [],
        vocabulary_tag_ids: pkg.dish?.vocabulary_tag_ids || pkg.projection?.vocabulary_tag_ids || [],
        contains_shellfish: pkg.recipe_version?.dietary_eligibility?.contains_shellfish,
      };
    });
}

function runtimeOption(meal, { withDeclaration }) {
  return {
    name: meal.title,
    title: meal.title,
    tags: meal.tags,
    allergens: meal.allergens,
    dietary_eligibility: withDeclaration ? meal.dietary_eligibility : null,
  };
}

function blocked(option, rule) {
  return !isOptionEligibleForHousehold(option, [{ rule_key: rule, status: "prohibited" }]);
}

function legacyBlocked(meal, rule) {
  return blocked({ name: "", tags: [...meal.tags, ...legacyIngredientTags(meal.title)] }, rule);
}

function eligibilityDelta(meals, withDeclaration) {
  /** @type {{slug: string, title: string, rule: string, before: string, after: string}[]} */
  const changes = [];
  for (const meal of meals) {
    const after = runtimeOption(meal, { withDeclaration });
    for (const rule of RULES) {
      const was = legacyBlocked(meal, rule);
      const now = blocked(after, rule);
      if (was !== now) {
        changes.push({
          slug: meal.slug,
          title: meal.title,
          rule,
          before: was ? "blocked" : "allowed",
          after: now ? "blocked" : "allowed",
        });
      }
    }
  }
  return changes;
}

const meals = loadPackages();

describe("shellfish title words", () => {
  it("does not treat king oyster mushrooms as shellfish", () => {
    const title = "Taiwanese Three-Cup King Oyster Mushrooms with Jasmine Rice";
    const option = { name: title, tags: ["sesame", "soy", "wheat"] };
    expect(optionTags(option)).not.toContain("oyster");
    expect(optionTags(option)).not.toContain("shellfish");
    expect(isOptionEligibleForHousehold(option, SHELLFISH)).toBe(true);
    expect(
      isOptionEligibleForHousehold(
        { ...option, dietary_eligibility: { contains_shellfish: false } },
        SHELLFISH
      )
    ).toBe(true);
  });

  it("still blocks real shellfish names, including oyster sauce", () => {
    for (const name of [
      "Fried Oysters",
      "Oyster Po'boy",
      "Oyster Sauce Noodles",
      "Crab Louie",
      "Shrimp Scampi",
      "Prawn Curry",
      "Lobster Roll",
      "Seared Scallops",
      "Linguine with Clams",
      "Garlic Mussels",
    ]) {
      expect(isOptionEligibleForHousehold({ name, tags: [] }, SHELLFISH), name).toBe(false);
    }
  });

  it("lets a declared shellfish allergen block a title that does not say so", () => {
    expect(
      isOptionEligibleForHousehold(
        { name: "Weeknight noodles", tags: [], dietary_eligibility: { contains_shellfish: true } },
        SHELLFISH
      )
    ).toBe(false);
    expect(
      isOptionEligibleForHousehold({ name: "Weeknight noodles", tags: [], allergens: ["shellfish"] }, SHELLFISH)
    ).toBe(false);
  });

  it("trusts an explicit contains_shellfish false over the word oyster in oyster sauce", () => {
    expect(
      isOptionEligibleForHousehold(
        {
          name: "Oyster Sauce Noodles",
          tags: ["soy", "wheat"],
          dietary_eligibility: { contains_shellfish: false },
        },
        SHELLFISH
      )
    ).toBe(true);
  });

  it("does not read oyster crackers as the mollusk", () => {
    const tags = optionTags({ name: "Chowder with Oyster Crackers", tags: [] });
    expect(tags).not.toContain("oyster");
    expect(tags).not.toContain("shellfish");
  });
});

describe("catalog title audit", () => {
  it("covers all 250 meals", () => {
    expect(meals).toHaveLength(250);
    expect(meals.some((meal) => meal.slug === "taiwanese-three-cup-mushrooms")).toBe(true);
  });

  it("changes shellfish eligibility only for king oyster mushrooms", () => {
    const runtime = eligibilityDelta(meals, false);
    const withDeclaration = eligibilityDelta(meals, true);
    expect(runtime).toEqual([
      {
        slug: "taiwanese-three-cup-mushrooms",
        title: "Taiwanese Three-Cup King Oyster Mushrooms with Jasmine Rice",
        rule: "shellfish",
        before: "blocked",
        after: "allowed",
      },
    ]);
    expect(withDeclaration).toEqual(runtime);
  });

  it("keeps every meal the package marks as shellfish blocked", () => {
    const declared = meals.filter((meal) => meal.contains_shellfish === true);
    expect(declared.length).toBeGreaterThanOrEqual(15);
    for (const meal of declared) {
      expect(blocked(runtimeOption(meal, { withDeclaration: true }), "shellfish"), meal.slug).toBe(true);
      expect(blocked(runtimeOption(meal, { withDeclaration: false }), "shellfish"), meal.slug).toBe(true);
    }
  });

  it("lets a shellfish-restricted household have the king oyster mushrooms", () => {
    const meal = meals.find((row) => row.slug === "taiwanese-three-cup-mushrooms");
    const entry = {
      concept: { concept_id: meal.slug, title: meal.title, tags: meal.tags },
      pkg: {
        title: meal.title,
        allergens: meal.allergens,
        ingredients: meal.ingredients.map((item) => ({ name: item.name, note: item.note || null })),
        vocabulary_tag_ids: meal.vocabulary_tag_ids,
      },
    };
    expect(assessMealEligibility(entry, ["ana"], SHELLFISH, []).eligible).toBe(true);

    const shrimp = meals.find((row) => row.slug === "greek-shrimp-saganaki");
    const shrimpEntry = {
      concept: { concept_id: shrimp.slug, title: shrimp.title, tags: shrimp.tags },
      pkg: {
        title: shrimp.title,
        allergens: shrimp.allergens,
        ingredients: shrimp.ingredients.map((item) => ({ name: item.name, note: item.note || null })),
        vocabulary_tag_ids: shrimp.vocabulary_tag_ids,
      },
    };
    expect(assessMealEligibility(shrimpEntry, ["ana"], SHELLFISH, []).eligible).toBe(false);

    const chowder = meals.find((row) => row.slug === "new-england-clam-chowder");
    expect(optionTags({ name: chowder.title, tags: chowder.tags, allergens: chowder.allergens })).not.toContain(
      "oyster"
    );
    expect(blocked(runtimeOption(chowder, { withDeclaration: false }), "shellfish")).toBe(true);
  });
});
