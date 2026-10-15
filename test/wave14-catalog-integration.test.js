import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listPublishedMealMedia } from "../src/lib/meal-catalog-media.js";

const root = process.cwd();
const wave = join(root, "factory/waves/wave-14");
const candidates = join(wave, "candidates");
const WAVE14 = readdirSync(candidates).filter((n) => existsSync(join(candidates, n, "v1.json"))).sort();
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

describe("Wave-14 certified catalog integration", () => {
  it("integrates exactly the 50 certified wave-14 meals (audit r3 PASS 50/50)", () => {
    expect(WAVE14).toHaveLength(50);
    const r3 = JSON.parse(readFileSync(join(wave, "audit/AUDIT-r3.json"), "utf8"));
    expect(Object.keys(r3).sort()).toEqual(WAVE14);
    for (const slug of WAVE14) expect(r3[slug].verdict, slug).toBe("PASS");
    expect(JSON.parse(readFileSync(join(wave, "WAVE.json"), "utf8")).audit.certified).toBe(true);
  });

  for (const slug of WAVE14) {
    it(`${slug}: catalog copy is byte-identical to the certified package`, () => {
      const pkg = JSON.parse(readFileSync(join(candidates, slug, "v1.json"), "utf8"));
      expect(pkg.dish.slug).toBe(slug);
      expect(pkg.package_revision).toBe("freeze-r2");
      const src = pkg.image.active_source_jpeg;
      expect(src).toMatch(/^img_v[1-3]\.jpg$/);
      for (const f of ["v1.json", "d03-classification.json", "FREEZE_INTEGRITY.json", "README.md", src, `${slug}.webp`, `${slug}-640.webp`]) {
        expect(sha(join(root, "catalog", slug, f)), f).toBe(sha(join(candidates, slug, f)));
      }
      expect(sha(join(root, "catalog", slug, `${slug}.webp`))).toBe(pkg.image.file_hashes.master_sha256);
      expect(sha(join(root, "catalog", slug, `${slug}-640.webp`))).toBe(pkg.image.file_hashes.card_sha256);
      for (const f of [`${slug}.webp`, `${slug}-640.webp`]) {
        const p = join(root, "public/images/meals", f);
        expect(sha(p), f).toBe(sha(join(candidates, slug, f)));
        expect(statSync(p).size).toBeGreaterThan(5000);
      }
      const freeze = JSON.parse(readFileSync(join(root, "catalog", slug, "FREEZE_INTEGRITY.json"), "utf8"));
      expect(freeze.FREEZE_INTEGRITY).toBe("PASS");
    });
  }

  it("all 50 are published with media in the catalog", () => {
    const published = listPublishedMealMedia();
    expect(published).toHaveLength(185);
    const slugs = new Set(published.map((r) => r.slug));
    for (const slug of WAVE14) expect(slugs.has(slug), slug).toBe(true);
  });

  it("staging import SQL carries every wave-14 dish", () => {
    const sql = readFileSync(join(root, "data/staging-catalog-import.sql"), "utf8");
    for (const slug of WAVE14) expect(sql).toContain(`VALUES ('${slug}', '${slug}',`);
  });
});
