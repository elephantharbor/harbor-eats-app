import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  FACTORY_CONTRACT,
  normalizeFactoryPackage,
  normalizeLegacyAuditDraftPackage,
  normalizeLegacyPackage,
} from "../src/lib/catalog-import.js";
import { LEGACY_AUDIT_DRAFT_CONTRACT, LEGACY_CONTRACT } from "../src/lib/catalog-legacy.js";
import { loadPublishedCatalog } from "../src/lib/catalog-runtime.js";
import { applyCatalogWrites } from "../src/lib/catalog-write.js";
import { assessMealEligibility } from "../src/lib/dinner-planner.js";
import { constraintRowsFromKeys } from "../src/lib/eligibility.js";

const root = join(process.cwd(), "catalog");
const HH001 = constraintRowsFromKeys(["dairy", "meat", "poultry", "shellfish", "nuts", "cashew_ok"]);

const WAVE12_ELIGIBLE = [
  "sheet-pan-gnocchi-brussels-apples",
  "miso-mushroom-ramen",
  "brazilian-fish-moqueca",
  "vegetable-biryani-cashews",
  "pumpkin-pinto-bean-chili",
  "salade-nicoise-seared-tuna",
  "japanese-okonomiyaki",
  "vietnamese-turmeric-dill-fish",
  "spaghetti-puttanesca",
  "mushroom-hominy-pozole-rojo",
  "sabich-pita-sandwiches",
  "thai-fish-cakes-cucumber-relish",
];

const WAVE12_INELIGIBLE = [
  "filipino-chicken-adobo",
  "chicken-enchiladas-verdes",
  "pressure-cooker-butter-chicken",
  "thai-turkey-larb-lettuce-wraps",
  "cashew-chicken-stir-fry",
  "classic-smash-burgers",
  "peruvian-lomo-saltado",
  "baked-ziti-italian-sausage",
  "turkish-lahmacun",
  "cottage-pie",
  "sheet-pan-shrimp-boil",
  "seared-scallops-parsnip-puree",
  "tomato-soup-grilled-cheese",
];

function sqliteShim(database) {
  return {
    prepare(sql) {
      const stmt = database.prepare(sql);
      return {
        bind: (...params) => ({
          all: async () => ({ results: params.length ? stmt.all(...params) : stmt.all() }),
          first: async () => (params.length ? stmt.get(...params) : stmt.get()) || null,
          run: async () => {
            if (params.length) stmt.run(...params);
            else stmt.run();
            return { success: true };
          },
        }),
      };
    },
  };
}

function loadRecords() {
  const stagingPolicy = JSON.parse(readFileSync(join(root, "staging-publication.json"), "utf8"));
  const records = [];
  for (const entry of readdirSync(root, { withFileTypes: true }).filter((row) => row.isDirectory())) {
    const slug = entry.name;
    const dir = join(root, slug);
    const names = readdirSync(dir);
    if (!names.includes("v1.json")) continue;
    const pkg = JSON.parse(readFileSync(join(dir, "v1.json"), "utf8"));
    if (pkg.catalog_contract === FACTORY_CONTRACT) {
      const normalized = normalizeFactoryPackage(
        pkg,
        { source_path: `catalog/${slug}/v1.json`, freeze_integrity: "present" },
        { publicationStatus: stagingPolicy.publication_status || "published" }
      );
      if (!normalized.ok) throw new Error(`${slug}: ${JSON.stringify(normalized.errors)}`);
      records.push(normalized.record);
      continue;
    }
    if (pkg.catalog_contract !== LEGACY_CONTRACT) continue;
    const v1 = normalizeLegacyPackage(
      pkg,
      { source_path: `catalog/${slug}/v1.json` },
      stagingPolicy.legacy_v1_retire_on_v2_import ? { publicationStatus: "retired" } : {}
    );
    if (v1.ok) records.push(v1.record);
    if (!names.includes("v2.json")) continue;
    const pkg2 = JSON.parse(readFileSync(join(dir, "v2.json"), "utf8"));
    const sidecar = { source_path: `catalog/${slug}/v2.json` };
    const v2Policy = {
      publicationStatus: stagingPolicy.legacy_v2_publication_status || "published",
      relaxTimeMismatch: true,
    };
    const v2 =
      pkg2.catalog_contract === LEGACY_AUDIT_DRAFT_CONTRACT
        ? normalizeLegacyAuditDraftPackage(pkg2, sidecar, v2Policy)
        : normalizeLegacyPackage(pkg2, sidecar, v2Policy);
    if (!v2.ok) throw new Error(`${slug} v2: ${JSON.stringify(v2.errors)}`);
    records.push(v2.record);
  }
  return records;
}

describe("Wave-12 HH001 eligibility via loadPublishedCatalog", () => {
  it("matches expected eligible and ineligible slugs for HH001 hard limits", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON;");
    for (const name of readdirSync(join(process.cwd(), "migrations")).filter((f) => f.endsWith(".sql")).sort()) {
      database.exec(readFileSync(join(process.cwd(), "migrations", name), "utf8"));
    }
    await applyCatalogWrites(sqliteShim(database), loadRecords(), "2026-10-04T00:00:00.000Z");
    const loaded = await loadPublishedCatalog(sqliteShim(database));
    expect(loaded.count).toBe(75);
    const bySlug = new Map(loaded.planner.map((entry) => [entry.concept.concept_id, entry]));

    const eligible = [];
    const ineligible = [];
    for (const slug of [...WAVE12_ELIGIBLE, ...WAVE12_INELIGIBLE]) {
      const entry = bySlug.get(slug);
      expect(entry, `missing wave-12 slug ${slug}`).toBeTruthy();
      const decision = assessMealEligibility(entry, ["tom"], HH001, []);
      (decision.eligible ? eligible : ineligible).push(slug);
    }
    expect(eligible.sort()).toEqual([...WAVE12_ELIGIBLE].sort());
    expect(ineligible.sort()).toEqual([...WAVE12_INELIGIBLE].sort());
  });

  it("keeps ginger-scallion-fish-packets and maple-mustard-glazed-salmon HH001-eligible", async () => {
    const database = new DatabaseSync(":memory:");
    database.exec("PRAGMA foreign_keys = ON;");
    for (const name of readdirSync(join(process.cwd(), "migrations")).filter((f) => f.endsWith(".sql")).sort()) {
      database.exec(readFileSync(join(process.cwd(), "migrations", name), "utf8"));
    }
    await applyCatalogWrites(sqliteShim(database), loadRecords(), "2026-10-04T00:00:00.000Z");
    const loaded = await loadPublishedCatalog(sqliteShim(database));
    const bySlug = new Map(loaded.planner.map((entry) => [entry.concept.concept_id, entry]));
    for (const slug of ["ginger-scallion-fish-packets", "maple-mustard-glazed-salmon"]) {
      const entry = bySlug.get(slug);
      expect(assessMealEligibility(entry, ["tom"], HH001, []).eligible).toBe(true);
    }
  });
});
