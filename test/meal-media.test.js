import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { MEAL_CONCEPTS } from "../src/lib/recipe-store.js";

const publicDir = join(process.cwd(), "public");
const window = {};
runInNewContext(readFileSync(join(publicDir, "meal-media.js"), "utf8"), { window });
const Media = window.FlavorWeaveMedia;

describe("FlavorWeave meal imagery", () => {
  it("every catalog meal has bundled hero photography", () => {
    expect(MEAL_CONCEPTS.length).toBeGreaterThanOrEqual(24);
    for (const c of MEAL_CONCEPTS) {
      const slug = c.concept_id;
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

  it("resolves by recipe version id and by title", () => {
    const c = MEAL_CONCEPTS[0];
    expect(Media.imageFor({ recipe_version_id: `rv_${c.concept_id}_v1` }).slug).toBe(c.concept_id);
    expect(Media.imageFor({ title: Media.catalog[c.concept_id] }).slug).toBe(c.concept_id);
  });

  it("returns null for unknown meals (placeholder, no hotlinks)", () => {
    expect(Media.imageFor({ title: "Mystery stew" })).toBeNull();
    const html = readFileSync(join(publicDir, "index.html"), "utf8");
    expect(html).not.toMatch(/<img[^>]+src="https?:\/\//);
  });
});
