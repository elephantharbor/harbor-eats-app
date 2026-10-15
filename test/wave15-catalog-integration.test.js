import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listPublishedMealMedia } from "../src/lib/meal-catalog-media.js";

const root = process.cwd();
const wave = join(root, "factory/waves/wave-15");
const candidates = join(wave, "candidates");
const WAVE15 = readdirSync(candidates).filter((n) => existsSync(join(candidates, n, "v1.json"))).sort();
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

describe("Wave-15 certified catalog integration", () => {
  it("integrates exactly the 50 certified wave-15 meals (audit r1 + r2 combined CERTIFIED 50/50)", () => {
    expect(WAVE15).toHaveLength(50);
    const r2 = JSON.parse(readFileSync(join(wave, "audit/r2/AUDIT-r2.json"), "utf8"));
    expect(r2.combined_counts.certified).toBe(50);
    expect(r2.combined_counts.fail).toBe(0);
    expect(Object.keys(r2.combined_final_status).sort()).toEqual(WAVE15);
    for (const slug of WAVE15) expect(r2.combined_final_status[slug].certified, slug).toBe(true);
    expect(JSON.parse(readFileSync(join(wave, "WAVE.json"), "utf8")).audit.certified).toBe(true);
  });

  for (const slug of WAVE15) {
    it(`${slug}: catalog copy is byte-identical to the certified package`, () => {
      const r2 = JSON.parse(readFileSync(join(wave, "audit/r2/AUDIT-r2.json"), "utf8"));
      const pkg = JSON.parse(readFileSync(join(candidates, slug, "v1.json"), "utf8"));
      expect(pkg.dish.slug).toBe(slug);
      expect(pkg.package_revision).toBe(r2.combined_final_status[slug].package_revision);
      expect(pkg.package_revision).toMatch(/^author-r[23]$/);
      const src = pkg.image.active_source_jpeg;
      expect(src).toMatch(/^img_v[1-4]\.jpg$/);
      for (const f of ["v1.json", "d03-classification.json", "FREEZE_INTEGRITY.json", "README.md", src, `${slug}.webp`, `${slug}-640.webp`]) {
        expect(sha(join(root, "catalog", slug, f)), f).toBe(sha(join(candidates, slug, f)));
      }
      const record = existsSync(join(wave, "audit/r2", `${slug}.md`)) ? join(wave, "audit/r2", `${slug}.md`) : join(wave, "audit/r1", `${slug}.md`);
      expect(sha(join(root, "catalog", slug, `AUDIT-${slug}.md`))).toBe(sha(record));
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
    expect(published).toHaveLength(200);
    const slugs = new Set(published.map((r) => r.slug));
    for (const slug of WAVE15) expect(slugs.has(slug), slug).toBe(true);
  });

  it("staging import SQL carries every wave-15 dish", () => {
    const sql = readFileSync(join(root, "data/staging-catalog-import.sql"), "utf8");
    for (const slug of WAVE15) expect(sql).toContain(`VALUES ('${slug}', '${slug}',`);
  });
});
