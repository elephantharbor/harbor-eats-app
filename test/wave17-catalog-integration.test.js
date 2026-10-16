import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listPublishedMealMedia } from "../src/lib/meal-catalog-media.js";

const root = process.cwd();
const wave = join(root, "factory/waves/wave-17");
const candidates = join(wave, "candidates");
const WAVE17 = readdirSync(candidates).filter((n) => existsSync(join(candidates, n, "v1.json"))).sort();
const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const cert = JSON.parse(readFileSync(join(wave, "audit/r4/CERTIFICATION.json"), "utf8"));
const bySlug = Object.fromEntries(cert.meals.map((m) => [m.slug, m]));

describe("Wave-17 certified catalog integration", () => {
  it("integrates exactly the 50 certified wave-17 meals (audit r4 CERTIFICATION 50/50)", () => {
    expect(WAVE17).toHaveLength(50);
    expect(cert.result).toBe("CERTIFIED");
    expect(cert.pass_count).toBe(50);
    expect(cert.fail_count).toBe(0);
    expect(cert.withheld).toEqual([]);
    expect(Object.keys(bySlug).sort()).toEqual(WAVE17);
    for (const slug of WAVE17) {
      expect(bySlug[slug].overall, slug).toBe("PASS");
      expect(bySlug[slug].fails_needing_revision, slug).toEqual([]);
    }
    expect(JSON.parse(readFileSync(join(wave, "WAVE.json"), "utf8")).certified).toBe(true);
  });

  for (const slug of WAVE17) {
    it(`${slug}: catalog copy is byte-identical to the certified package`, () => {
      const m = bySlug[slug];
      const pkg = JSON.parse(readFileSync(join(candidates, slug, "v1.json"), "utf8"));
      expect(pkg.dish.slug).toBe(slug);
      expect(pkg.package_revision).toBe(m.package_revision);
      expect(pkg.image.active_source_jpeg).toBe(m.active_source);
      expect(sha(join(root, "catalog", slug, m.active_source))).toBe(m.active_source_sha256);
      expect(sha(join(root, "catalog", slug, m.active_master))).toBe(m.active_master_sha256);
      expect(sha(join(root, "catalog", slug, m.active_card))).toBe(m.active_card_sha256);
      for (const f of ["v1.json", "d03-classification.json", "FREEZE_INTEGRITY.json", "README.md", m.active_source, m.active_master, m.active_card]) {
        expect(sha(join(root, "catalog", slug, f)), f).toBe(sha(join(candidates, slug, f)));
      }
      expect(sha(join(root, "catalog", slug, `AUDIT-${slug}.md`))).toBe(sha(join(root, "factory/waves", m.audit_file)));
      expect(existsSync(join(root, "catalog", slug, "rejected"))).toBe(false);
      for (const f of [m.active_master, m.active_card]) {
        const p = join(root, "public/images/meals", f);
        expect(sha(p), f).toBe(sha(join(candidates, slug, f)));
        expect(statSync(p).size).toBeGreaterThan(5000);
      }
      expect(JSON.parse(readFileSync(join(root, "catalog", slug, "FREEZE_INTEGRITY.json"), "utf8")).FREEZE_INTEGRITY).toBe("PASS");
    });
  }

  it("all 50 are published with media in the 250-meal catalog", () => {
    const published = listPublishedMealMedia();
    expect(published).toHaveLength(250);
    const slugs = new Set(published.map((r) => r.slug));
    for (const slug of WAVE17) expect(slugs.has(slug), slug).toBe(true);
  });

  it("staging import SQL carries every wave-17 dish", () => {
    const sql = readFileSync(join(root, "data/staging-catalog-import.sql"), "utf8");
    for (const slug of WAVE17) expect(sql).toContain(`VALUES ('${slug}', '${slug}',`);
  });
});
