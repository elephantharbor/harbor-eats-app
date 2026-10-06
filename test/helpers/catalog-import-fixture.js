import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeFactoryPackage,
  normalizeLegacyAuditDraftPackage,
  normalizeLegacyPackage,
} from "../../src/lib/catalog-import.js";
import { LEGACY_AUDIT_DRAFT_CONTRACT, LEGACY_CONTRACT } from "../../src/lib/catalog-legacy.js";

const root = join(process.cwd(), "catalog");

function factorySidecar(slug) {
  const dir = join(root, slug);
  const names = readdirSync(dir);
  let freeze_integrity = "not_in_package";
  let freeze_detail = null;
  if (names.includes("FREEZE_INTEGRITY.json")) {
    const freeze = JSON.parse(readFileSync(join(dir, "FREEZE_INTEGRITY.json"), "utf8"));
    freeze_integrity = freeze.FREEZE_INTEGRITY || "present";
    freeze_detail = `fail_count=${freeze.fail_count}`;
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

export function loadCatalogRecordsForTest() {
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
  if (failures.length) {
    throw new Error(`catalog fixture load failed: ${JSON.stringify(failures)}`);
  }
  return { records, retireVersionIds };
}
