import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { MEAL_CONCEPTS } from "../src/lib/recipe-store.js";

const publicDir = join(process.cwd(), "public");
const window = {};
runInNewContext(readFileSync(join(publicDir, "meal-media.js"), "utf8"), { window });
const Media = window.FlavorWeaveMedia;

describe("FW-08 deterministic meal image lookup", () => {
  it("resolves all 24 meals by slug, version id, and catalog title (cold path)", () => {
    expect(MEAL_CONCEPTS.length).toBe(24);
    for (const c of MEAL_CONCEPTS) {
      const slug = c.concept_id;
      const bySlug = Media.imageFor({ recipe_slug: slug });
      const byVersion = Media.imageFor({ recipe_version_id: c.current_version.recipe_version_id });
      const byTitle = Media.imageFor({ title: c.title });
      expect(bySlug?.slug, slug).toBe(slug);
      expect(byVersion?.slug, slug).toBe(slug);
      expect(byTitle?.slug, slug).toBe(slug);
      expect(bySlug.src).toBe(`/images/meals/${slug}.webp`);
    }
  });

  it("warm restore path: title-only shared plan still resolves slug", () => {
    for (const c of MEAL_CONCEPTS) {
      const img = Media.imageFor({ name: c.name, title: c.title });
      expect(img?.slug, c.concept_id).toBe(c.concept_id);
    }
  });

  it("slugFor matches imageFor for legacy version id parsing", () => {
    for (const c of MEAL_CONCEPTS) {
      const meal = { recipe_version_id: c.current_version.recipe_version_id };
      expect(Media.slugFor(meal)).toBe(c.concept_id);
      expect(Media.imageFor(meal)?.slug).toBe(c.concept_id);
    }
  });

  it("bundled webp assets exist for every slug", () => {
    for (const c of MEAL_CONCEPTS) {
      const slug = c.concept_id;
      for (const file of [`images/meals/${slug}.webp`, `images/meals/${slug}-640.webp`]) {
        expect(existsSync(join(publicDir, file)), file).toBe(true);
      }
    }
  });
});
