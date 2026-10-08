import { existsSync, readFileSync, statSync } from "node:fs";
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

describe("FlavorWeave meal imagery", () => {
  it("manifest covers all 75 published catalog meals", () => {
    expect(published).toHaveLength(75);
    expect(Object.keys(Media.catalog)).toHaveLength(75);
    for (const row of published) {
      expect(Media.catalog[row.slug], row.slug).toBe(row.title);
    }
  });

  it("every published meal has bundled hero photography via slug path", () => {
    for (const row of published) {
      const slug = row.slug;
      const img = Media.imageFor({ recipe_slug: slug });
      expect(img, slug).toBeTruthy();
      for (const file of [`images/meals/${slug}.webp`, `images/meals/${slug}-640.webp`]) {
        expect(existsSync(join(publicDir, file)), file).toBe(true);
        expect(statSync(join(publicDir, file)).size, file).toBeGreaterThan(5000);
      }
      expect(img.src).toBe(`/images/meals/${slug}.webp`);
      expect(img.alt).toBeTruthy();
    }
  });

  it("resolves by recipe version id and by catalog title", () => {
    const row = published[0];
    expect(Media.imageFor({ recipe_version_id: row.recipe_version_id }).slug).toBe(row.slug);
    expect(Media.imageFor({ recipe_slug: row.slug, title: row.title }).slug).toBe(row.slug);
    expect(Media.imageFor({ title: row.title }).slug).toBe(row.slug);
  });

  it("returns null for unknown meals (placeholder, no hotlinks)", () => {
    expect(Media.imageFor({ title: "Mystery stew" })).toBeNull();
    const html = readFileSync(join(publicDir, "index.html"), "utf8");
    expect(html).not.toMatch(/<img[^>]+src="https?:\/\//);
  });

  it("resolves legacy Blackstone display title to miso-ginger-salmon", () => {
    const img = Media.imageFor({ title: "Blackstone Miso-Ginger Salmon" });
    expect(img).toBeTruthy();
    expect(img.slug).toBe("miso-ginger-salmon");
    expect(img.src).toBe("/images/meals/miso-ginger-salmon.webp");
  });

  it("session restore query includes recipe_slug for meal options", () => {
    const sessionSrc = readFileSync(join(process.cwd(), "src/lib/session.js"), "utf8");
    expect(sessionSrc).toMatch(/SELECT meal_option_id, letter, name, recipe_slug, recipe_version/);
  });
});
