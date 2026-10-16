import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listPublishedMealMedia } from "../src/lib/meal-catalog-media.js";
import { normalizeFactoryPackage } from "../src/lib/catalog-import.js";

const root = process.cwd();
const candidates = join(root, "factory/waves/wave-13/candidates");
const WAVE13 = readdirSync(candidates).filter((n) => existsSync(join(candidates, n, "v1.json"))).sort();
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

describe("Wave-13 certified catalog integration", () => {
  it("integrates exactly the 10 audited wave-13 meals", () => {
    expect(WAVE13).toHaveLength(10);
    const summary = readFileSync(join(root, "factory/waves/wave-13/audit/SUMMARY.md"), "utf8");
    expect(summary).toMatch(/10 PASS, 0 FAIL/);
  });

  for (const slug of WAVE13) {
    it(`${slug}: catalog copy is byte-identical to the certified package`, () => {
      for (const f of ["v1.json", "d03-classification.json", "FREEZE_INTEGRITY.json", "img_v1.jpg", `${slug}.webp`, `${slug}-640.webp`]) {
        expect(sha(join(root, "catalog", slug, f)), f).toBe(sha(join(candidates, slug, f)));
      }
      for (const f of [`${slug}.webp`, `${slug}-640.webp`]) {
        const p = join(root, "public/images/meals", f);
        expect(sha(p), f).toBe(sha(join(candidates, slug, f)));
        expect(statSync(p).size).toBeGreaterThan(5000);
      }
      const freeze = JSON.parse(readFileSync(join(root, "catalog", slug, "FREEZE_INTEGRITY.json"), "utf8"));
      expect(freeze.FREEZE_INTEGRITY).toBe("PASS");
      const pkg = JSON.parse(readFileSync(join(root, "catalog", slug, "v1.json"), "utf8"));
      expect(pkg.dish.slug).toBe(slug);
    });
  }

  it("all 10 are published with media in the catalog", () => {
    const published = listPublishedMealMedia();
    expect(published).toHaveLength(250);
    const slugs = new Set(published.map((r) => r.slug));
    for (const slug of WAVE13) expect(slugs.has(slug), slug).toBe(true);
  });

  it("staging import SQL carries every wave-13 dish", () => {
    const sql = readFileSync(join(root, "data/staging-catalog-import.sql"), "utf8");
    for (const slug of WAVE13) expect(sql).toContain(`INTO catalog_dish (dish_id, slug, title, name, description, cuisine, meal_format, primary_ingredient, texture, flavor_profile, weeknight, exploration, plate, tone, tags_json, sparks_json, chips_json, current_recipe_id, current_version_id, created_at) VALUES ('${slug}'`);
  });
});
