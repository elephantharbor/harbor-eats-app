import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  normalizeFactoryPackage,
  normalizeLegacyAuditDraftPackage,
  normalizeLegacyPackage,
  planImport,
} from "../src/lib/catalog-import.js";
import { LEGACY_AUDIT_DRAFT_CONTRACT, LEGACY_CONTRACT } from "../src/lib/catalog-legacy.js";
import { parityCatalog } from "../src/lib/catalog-parity.js";
import {
  loadPublishedCatalog,
  plannerEntryFromRecord,
  recommendationMealFromRecord,
} from "../src/lib/catalog-runtime.js";
import { applyCatalogWrites, loadExistingVersions, retireCatalogVersions } from "../src/lib/catalog-write.js";
import { assessMealEligibility, planDinners } from "../src/lib/dinner-planner.js";
import { createDinnerPlan, resolvedRecipe } from "../src/lib/plan-mutations.js";
import { rankMealsForHousehold } from "../src/lib/recommendations.js";
import { MEAL_CONCEPTS } from "../src/lib/recipe-store.js";
import { buildRankedChoiceSet } from "../src/lib/recommendation-pipeline.js";

const root = join(process.cwd(), "catalog");
const importedAt = "2026-10-04T00:00:00.000Z";

function sqliteShim(database) {
  return {
    prepare(sql) {
      const stmt = database.prepare(sql);
      const bound = (params) => ({
        all: async () => ({ results: params.length ? stmt.all(...params) : stmt.all() }),
        first: async () => (params.length ? stmt.get(...params) : stmt.get()) || null,
        run: async () => {
          if (params.length) stmt.run(...params);
          else stmt.run();
          return { success: true };
        },
      });
      return { bind: (...params) => bound(params) };
    },
  };
}

function applyMigrations(database) {
  database.exec("PRAGMA foreign_keys = ON;");
  const dir = join(process.cwd(), "migrations");
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".sql")).sort()) {
    database.exec(readFileSync(join(dir, name), "utf8"));
  }
}

function factorySidecar(slug) {
  const dir = join(root, slug);
  const names = readdirSync(dir);
  let freeze_integrity = "not_in_package";
  let freeze_detail = null;
  if (names.includes("FREEZE_INTEGRITY.json")) {
    const freeze = JSON.parse(readFileSync(join(dir, "FREEZE_INTEGRITY.json"), "utf8"));
    freeze_integrity = freeze.FREEZE_INTEGRITY || "present";
    freeze_detail = `fail_count=${freeze.fail_count}`;
  } else if (names.includes("FREEZE.txt")) {
    const text = readFileSync(join(dir, "FREEZE.txt"), "utf8");
    freeze_integrity = /awaiting/i.test(text) ? "awaiting_reaudit" : "present";
    freeze_detail = text.split("\n")[0];
  }
  const readme = names.includes("README.md") ? readFileSync(join(dir, "README.md"), "utf8") : "";
  return {
    source_path: `catalog/${slug}/v1.json`,
    freeze_integrity,
    freeze_detail,
    readme_declares_not_certified: /not certified/i.test(readme),
  };
}

function legacySidecar(slug, fileName) {
  const dir = join(root, slug);
  const names = readdirSync(dir);
  let freeze_integrity = "not_in_package";
  let freeze_detail = null;
  if (names.includes("FREEZE_INTEGRITY.json")) {
    const freeze = JSON.parse(readFileSync(join(dir, "FREEZE_INTEGRITY.json"), "utf8"));
    freeze_integrity = freeze.FREEZE_INTEGRITY || "present";
    freeze_detail = `fail_count=${freeze.fail_count}`;
  }
  let vale_audit = null;
  if (names.includes("VALE-AUDIT.json")) {
    vale_audit = JSON.parse(readFileSync(join(dir, "VALE-AUDIT.json"), "utf8"));
  }
  return {
    source_path: `catalog/${slug}/${fileName}`,
    freeze_integrity,
    freeze_detail,
    vale_audit,
  };
}

function loadRecords() {
  const failures = [];
  const records = [];
  /** @type {string[]} */
  const retireVersionIds = [];
  const stagingPolicy = JSON.parse(readFileSync(join(root, "staging-publication.json"), "utf8"));
  for (const entry of readdirSync(root, { withFileTypes: true }).filter((row) => row.isDirectory())) {
    const slug = entry.name;
    const dir = join(root, slug);
    const names = readdirSync(dir);
    if (!names.includes("v1.json")) continue;
    const pkg = JSON.parse(readFileSync(join(dir, "v1.json"), "utf8"));
    if (pkg.catalog_contract === "flavorweave-catalog-package") {
      const normalized = normalizeFactoryPackage(pkg, factorySidecar(slug), { publicationStatus: "published" });
      if (!normalized.ok) failures.push({ slug, errors: normalized.errors });
      else records.push(normalized.record);
      continue;
    }
    if (pkg.catalog_contract !== LEGACY_CONTRACT) continue;
    const retireV1 = names.includes("v2.json") && stagingPolicy.legacy_v1_retire_on_v2_import;
    const v1 = normalizeLegacyPackage(
      pkg,
      legacySidecar(slug, "v1.json"),
      retireV1 ? { publicationStatus: "retired" } : {}
    );
    if (!v1.ok) failures.push({ slug, file: "v1.json", errors: v1.errors });
    else records.push(v1.record);
    if (!names.includes("v2.json")) continue;
    const pkg2 = JSON.parse(readFileSync(join(dir, "v2.json"), "utf8"));
    const v2Policy = {
      publicationStatus: stagingPolicy.legacy_v2_publication_status || "published",
      relaxTimeMismatch: true,
    };
    const v2 =
      pkg2.catalog_contract === LEGACY_AUDIT_DRAFT_CONTRACT
        ? normalizeLegacyAuditDraftPackage(pkg2, legacySidecar(slug, "v2.json"), v2Policy)
        : pkg2.catalog_contract === LEGACY_CONTRACT
          ? normalizeLegacyPackage(pkg2, legacySidecar(slug, "v2.json"), v2Policy)
          : { ok: false, errors: [{ code: "unknown_contract", detail: pkg2.catalog_contract }] };
    if (!v2.ok) failures.push({ slug, file: "v2.json", errors: v2.errors });
    else {
      records.push(v2.record);
      if (stagingPolicy.legacy_v1_retire_on_v2_import) {
        retireVersionIds.push(v2.record.supersedes_version_id || `rv_${slug}_v1`);
      }
    }
  }
  return { failures, records, retireVersionIds };
}

async function importOnce(database, records, retireVersionIds = []) {
  const shim = sqliteShim(database);
  const existing = await loadExistingVersions(shim);
  const plan = planImport(existing, records);
  if (!plan.ok) return plan;
  await applyCatalogWrites(shim, plan.writes, importedAt);
  if (retireVersionIds.length) {
    await retireCatalogVersions(shim, [...new Set(retireVersionIds)]);
  }
  return plan;
}

const restricted = [
  { member_id: "ada", rule_key: "dairy", status: "prohibited" },
  { member_id: "ada", rule_key: "shellfish", status: "prohibited" },
  { member_id: "ada", rule_key: "meat", status: "prohibited" },
  { member_id: "ada", rule_key: "poultry", status: "prohibited" },
  { member_id: "ada", rule_key: "nuts", status: "prohibited" },
  { member_id: "ada", rule_key: "cashew", status: "permitted" },
  { member_id: "bea", rule_key: "dairy", status: "prohibited" },
  { member_id: "bea", rule_key: "shellfish", status: "prohibited" },
  { member_id: "bea", rule_key: "meat", status: "prohibited" },
  { member_id: "bea", rule_key: "poultry", status: "prohibited" },
  { member_id: "bea", rule_key: "nuts", status: "prohibited" },
  { member_id: "bea", rule_key: "cashew", status: "permitted" },
];

describe("catalog import", () => {
  it("keeps factory packages byte-for-byte and refuses a collision", () => {
    const { failures, records } = loadRecords();
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
    const upload = "/tmp/fw-wave1";
    if (existsSync(upload) && statSync(upload).isDirectory() && readdirSync(upload).length) {
      for (const name of readdirSync(upload)) {
        const left = readFileSync(join(upload, name, "v1.json"));
        const right = readFileSync(join(root, name, "v1.json"));
        expect(createHash("sha256").update(left).digest("hex")).toBe(createHash("sha256").update(right).digest("hex"));
      }
    }
    expect(records).toHaveLength(99);
    expect(records.filter((record) => record.version_number === 1 && record.source_contract === LEGACY_CONTRACT)).toHaveLength(
      24
    );
    expect(records.filter((record) => record.version_number === 2)).toHaveLength(24);
    expect(records.filter((record) => record.provenance.factory_certified === 1)).toHaveLength(51);
    expect(records.filter((record) => record.provenance.certification_class === "legacy_structural")).toHaveLength(48);
    const swordfish = records.find((record) => record.slug === "grilled-swordfish-olive-caper");
    expect(swordfish.provenance.kitchen_tested).toBe(0);
    expect(swordfish.provenance.household_cook_count).toBe(0);
    expect(swordfish.provenance.rating_count).toBe(0);
    expect(swordfish.provenance.freeze_integrity).toBe("PASS");
    expect(swordfish.provenance.gates_a_o).toBe("not_recorded_in_package");
    expect(swordfish.provenance.factory_certified).toBe(1);
    const legacy = records.find((record) => record.slug === "miso-ginger-salmon" && record.version_number === 1);
    expect(legacy.provenance.factory_certified).toBe(0);
    expect(legacy.provenance.household_cook_count).toBeNull();
    const collision = planImport(new Map(), [records[0], { ...records[0], content_hash: "different" }]);
    expect(collision.ok).toBe(false);
    expect(collision.errors.some((error) => error.code === "identity_collision")).toBe(true);
    const conflict = planImport(
      new Map([[records[0].recipe_version_id, { content_hash: "other", version_number: 1 }]]),
      [records[0]]
    );
    expect(conflict.ok).toBe(false);
    expect(conflict.errors[0].code).toBe("immutable_version_conflict");
  });

  it("imports 75 published meals idempotently and matches the original 24", async () => {
    const { failures, records, retireVersionIds } = loadRecords();
    expect(failures).toEqual([]);
    const parity = parityCatalog(
      records.filter((record) => record.source_contract === LEGACY_CONTRACT && record.version_number === 1)
    );
    expect(parity.ok, JSON.stringify(parity.results.filter((row) => !row.ok), null, 2)).toBe(true);

    const database = new DatabaseSync(":memory:");
    applyMigrations(database);
    const first = await importOnce(database, records, retireVersionIds);
    expect(first.ok).toBe(true);
    const shim = sqliteShim(database);
    const loaded = await loadPublishedCatalog(shim);
    expect(loaded.ok).toBe(true);
    expect(loaded.count).toBe(75);
    const again = await importOnce(database, records, retireVersionIds);
    expect(again.ok).toBe(true);
    expect(again.unchanged).toHaveLength(99);
    const reloaded = await loadPublishedCatalog(shim);
    expect(reloaded.count).toBe(75);
    expect(database.prepare("SELECT COUNT(*) AS c FROM catalog_version").get().c).toBe(99);
    expect(database.prepare("SELECT COUNT(*) AS c FROM catalog_ingredient").get().c).toBe(
      records.reduce((sum, record) => sum + record.ingredients.length, 0)
    );
    const misoCurrent = database
      .prepare(`SELECT current_version_id FROM catalog_dish WHERE dish_id = 'miso-ginger-salmon'`)
      .get();
    expect(misoCurrent.current_version_id).toBe("rv_miso-ginger-salmon_v2");
    const misoV1 = database
      .prepare(`SELECT publication_status FROM catalog_version WHERE recipe_version_id = 'rv_miso-ginger-salmon_v1'`)
      .get();
    expect(misoV1.publication_status).toBe("retired");
    const mushroomTags = JSON.parse(
      database.prepare(`SELECT tags_json FROM catalog_dish WHERE dish_id = 'mushroom-walnut-bolognese'`).get().tags_json
    );
    expect(mushroomTags).toEqual(["plant", "dairy-free"]);

    const storeMeals = MEAL_CONCEPTS.map((concept) => {
      const version = concept.current_version;
      return {
        recipe_slug: concept.concept_id,
        recipe_version_id: version.recipe_version_id,
        tags: concept.tags,
        sparks: concept.sparks,
        exploration: concept.exploration,
        cuisine: concept.cuisine,
        meal_format: concept.meal_format,
        primary_ingredient: concept.primary_ingredient,
        minutes: version.prep_minutes + version.cook_minutes,
        name: concept.name,
        title: concept.title,
      };
    });
    const d1Legacy = reloaded.meals.filter((meal) => MEAL_CONCEPTS.some((concept) => concept.concept_id === meal.recipe_slug));
    const context = {
      constraints: [],
      evidence: [],
      ratings: [],
      recent_recipe_slugs: [],
      settings: { meal_choice_count: 3, prefs: {} },
      active_member_count: 2,
      diner_tastes: [],
    };
    const fromStore = buildRankedChoiceSet({ ...context, catalog_meals: storeMeals }).map((row) => row.meal.recipe_slug);
    const fromD1 = rankMealsForHousehold({ ...context, catalog_meals: d1Legacy }).map((row) => row.meal.recipe_slug);
    expect(fromD1).toEqual(fromStore);
  });

  it("keeps swordfish eligible and blocks beef, poultry, pork, and mussels for the synthetic household", async () => {
    const { records, retireVersionIds } = loadRecords();
    const database = new DatabaseSync(":memory:");
    applyMigrations(database);
    await importOnce(database, records, retireVersionIds);
    const loaded = await loadPublishedCatalog(sqliteShim(database));
    const bySlug = new Map(loaded.planner.map((entry) => [entry.concept.concept_id, entry]));
    const participants = ["ada", "bea"];
    function eligible(slug) {
      return assessMealEligibility(bySlug.get(slug), participants, restricted, []).eligible;
    }
    expect(eligible("grilled-swordfish-olive-caper")).toBe(true);
    expect(eligible("gochujang-grilled-flank-steak")).toBe(false);
    expect(eligible("crispy-skillet-chicken-sandwiches")).toBe(false);
    expect(eligible("cider-braised-pork-shoulder")).toBe(false);
    expect(eligible("garlic-tomato-mussels")).toBe(false);

    const swordfish = bySlug.get("grilled-swordfish-olive-caper");
    const created = createDinnerPlan(
      {
        household_id: "hh_synthetic_catalog",
        dinner_plan_id: "dp_synthetic_catalog",
        meal_count: 1,
        entry_point: "plan_dinners",
        participant_ids: participants,
        meals: [{ kind: "recipe", recipe_version_id: swordfish.pkg.recipe_version_id, participant_ids: participants }],
      },
      {
        now: importedAt,
        actor_member_id: "ada",
        household_member_ids: participants,
        constraints: restricted,
        data_origin: "synthetic",
        catalog: loaded.planner,
        versions: loaded.versionsById,
        id: (prefix) => `${prefix}_fixed`,
      }
    );
    expect(created.ok, JSON.stringify(created)).toBe(true);
    expect(created.plan.meals[0].recipe_version_id).toBe("rv_grilled-swordfish-olive-caper_v1");
    expect(created.plan.meals[0].pinned_ingredients[0].name).toBe(swordfish.pkg.ingredients[0].name);
    expect(created.plan.shop_lines.some((line) => line.ingredient_id === "swordfish-steak")).toBe(true);
    const mutated = {
      ...swordfish,
      pkg: {
        ...swordfish.pkg,
        ingredients: [{ name: "not the pinned fish", quantity: 1, unit: "lb", note: null }],
      },
    };
    expect(resolvedRecipe(created.plan.meals[0], mutated).ingredients[0].name).toBe(swordfish.pkg.ingredients[0].name);
    const blocked = planDinners(
      { dinner_count: 1, entry_point: "plan_dinners", participant_ids: participants, meal_styles: [], practical_hints: [] },
      { catalog: [bySlug.get("cider-braised-pork-shoulder")], constraints: restricted }
    );
    expect(blocked.slots[0].result).toBe("constrained");
    expect(recommendationMealFromRecord(loaded.records.find((record) => record.slug === "lentil-stuffed-cabbage")).recipe_slug).toBe(
      "lentil-stuffed-cabbage"
    );
    expect(plannerEntryFromRecord(loaded.records[0]).pkg.recipe_version_id).toBe(loaded.records[0].recipe_version_id);
  });
});

describe("recipe detail equipment (canonical metadata only)", () => {
  it("exposes Butter Chicken's pressure cooker from catalog_equipment and never from step prose", async () => {
    const { recipeShapeFromEntry, canonicalEquipment } = await import("../src/lib/catalog-runtime.js");
    const { records, retireVersionIds } = loadRecords();
    const database = new DatabaseSync(":memory:");
    applyMigrations(database);
    await importOnce(database, records, retireVersionIds);
    const loaded = await loadPublishedCatalog(sqliteShim(database));
    const entry = loaded.planner.find((row) => row.concept.concept_id === "pressure-cooker-butter-chicken");
    const shape = recipeShapeFromEntry(entry);
    expect(shape.version.equipment.some((item) => /pressure cooker/i.test(item))).toBe(true);
    const dbRows = database
      .prepare("SELECT item FROM catalog_equipment WHERE recipe_version_id = ?")
      .all(entry.pkg.recipe_version_id)
      .map((row) => row.item);
    expect([...shape.version.equipment].sort()).toEqual([...new Set(dbRows)].sort());
    const prosey = { ...entry, pkg: { ...entry.pkg, equipment: [], steps: [{ title: "Use a pressure cooker", body: "Pressure cook" }] } };
    expect(recipeShapeFromEntry(prosey).version.equipment).toEqual([]);
    expect(canonicalEquipment([" Skillet ", "skillet", "", null])).toEqual(["Skillet"]);
    expect(canonicalEquipment(undefined)).toEqual([]);
  });

  it("recipe view renders equipment from recipe.equipment, hides when empty, escapes", () => {
    const app = readFileSync(join(process.cwd(), "public/app.js"), "utf8");
    const html = readFileSync(join(process.cwd(), "public/index.html"), "utf8");
    expect(html).toContain('id="detailEquipmentWrap" hidden');
    const fn = app.slice(app.indexOf("function renderEquipment"), app.indexOf("function escapeHtml"));
    expect(fn).toContain("recipe.equipment");
    expect(fn).toContain("escapeHtml(e)");
    expect(fn).toContain("wrap.hidden = items.length === 0");
    expect(fn).not.toMatch(/steps|body|instructions/);
  });
});
