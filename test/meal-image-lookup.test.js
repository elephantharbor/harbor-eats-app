import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { listPublishedMealMedia } from "../src/lib/meal-catalog-media.js";

const publicDir = join(process.cwd(), "public");
const window = {};
runInNewContext(readFileSync(join(publicDir, "meal-media-manifest.js"), "utf8"), { window });
runInNewContext(readFileSync(join(publicDir, "meal-media.js"), "utf8"), { window });
const Media = window.FlavorWeaveMedia;
const published = listPublishedMealMedia();

describe("FW-08 deterministic meal image lookup", () => {
  it("resolves all published meals by slug, version id, and catalog title (cold path)", () => {
    expect(published.length).toBe(50);
    for (const row of published) {
      const slug = row.slug;
      const bySlug = Media.imageFor({ recipe_slug: slug });
      const byVersion = Media.imageFor({ recipe_version_id: row.recipe_version_id });
      const byTitle = Media.imageFor({ title: row.title });
      expect(bySlug?.slug, slug).toBe(slug);
      expect(byVersion?.slug, slug).toBe(slug);
      expect(byTitle?.slug, slug).toBe(slug);
      expect(bySlug.src).toBe(`/images/meals/${slug}.webp`);
    }
  });

  it("warm restore path: title-only shared plan still resolves slug", () => {
    for (const row of published) {
      const img = Media.imageFor({ name: row.title, title: row.title });
      expect(img?.slug, row.slug).toBe(row.slug);
    }
  });

  it("slugFor matches imageFor for legacy version id parsing", () => {
    for (const row of published) {
      const meal = { recipe_version_id: row.recipe_version_id };
      expect(Media.slugFor(meal)).toBe(row.slug);
      expect(Media.imageFor(meal)?.slug).toBe(row.slug);
    }
  });

  it("bundled webp assets exist for every slug", () => {
    for (const row of published) {
      const slug = row.slug;
      for (const file of [`images/meals/${slug}.webp`, `images/meals/${slug}-640.webp`]) {
        expect(existsSync(join(publicDir, file)), file).toBe(true);
      }
    }
  });
});
