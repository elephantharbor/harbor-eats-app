import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeFactoryPackage } from "../src/lib/catalog-import.js";
import {
  mapFactoryDietaryLabel,
  mapFactoryPackageAllergens,
  mapFactoryProvenance,
  normalizeD03ComplexityFactors,
  normalizeFactoryPublicationStatus,
} from "../src/lib/factory-package-tokens.js";

const catalogRoot = join(process.cwd(), "catalog");

function loadCatalogPkg(slug) {
  return JSON.parse(readFileSync(join(catalogRoot, `${slug}/v1.json`), "utf8"));
}

describe("factory package token mapping", () => {
  it("maps plant_based to plant and keeps vegetarian", () => {
    expect(mapFactoryDietaryLabel("plant_based")).toEqual({ ok: true, value: "plant" });
    expect(mapFactoryDietaryLabel("vegetarian")).toEqual({ ok: true, value: "vegetarian" });
    expect(mapFactoryDietaryLabel("dairy_free")).toEqual({ ok: true, value: "dairy_free" });
  });

  it("maps original_ai_assisted provenance to ai_assisted", () => {
    expect(mapFactoryProvenance("original_ai_assisted")).toEqual({ ok: true, value: "ai_assisted" });
  });

  it("normalizes draft publication status case", () => {
    expect(normalizeFactoryPublicationStatus("Draft")).toBe("draft");
    expect(normalizeFactoryPublicationStatus("draft")).toBe("draft");
  });

  it("maps cashew-only tree_nut meals to cashew without nuts", () => {
    const pkg = loadCatalogPkg("vegetable-biryani-cashews");
    const mapped = mapFactoryPackageAllergens(pkg);
    expect(mapped.ok).toBe(true);
    expect(mapped.allergens).toEqual(["cashew"]);
    const normalized = normalizeFactoryPackage(pkg, { source_path: "x", freeze_integrity: "present" }, {
      publicationStatus: "published",
    });
    expect(normalized.ok).toBe(true);
    expect(normalized.record.allergens).toEqual(["cashew"]);
    expect(normalized.record.eligibility_tags).toEqual(["cashew"]);
  });

  it("maps non-cashew tree_nut to nuts", () => {
    const pkg = structuredClone(loadCatalogPkg("vegetable-biryani-cashews"));
    pkg.recipe_version.dietary_eligibility.nut_policy = "none";
    pkg.recipe_version.allergens = ["tree_nut", "wheat"];
    const mapped = mapFactoryPackageAllergens(pkg);
    expect(mapped.ok).toBe(true);
    expect(mapped.allergens).toEqual(["nuts", "wheat"]);
  });

  it("fails on unknown allergen tokens", () => {
    const pkg = structuredClone(loadCatalogPkg("miso-mushroom-ramen"));
    pkg.recipe_version.allergens.push("mystery_spice");
    const mapped = mapFactoryPackageAllergens(pkg);
    expect(mapped.ok).toBe(false);
    expect(mapped.unknown).toContain("mystery_spice");
    const normalized = normalizeFactoryPackage(pkg, { source_path: "x", freeze_integrity: "present" }, {
      publicationStatus: "published",
    });
    expect(normalized.ok).toBe(false);
    expect(normalized.errors.some((e) => e.code === "unknown_factory_allergen")).toBe(true);
  });

  it("accepts sourcing_difficulty as pantry_familiarity alias in D-03 sidecars", () => {
    const factors = normalizeD03ComplexityFactors({
      classification: { complexity_factors: { sourcing_difficulty: 2, ingredient_count_band: 1 } },
    });
    expect(factors.pantry_familiarity).toBe(2);
    expect(factors.sourcing_difficulty).toBeUndefined();
  });
});
