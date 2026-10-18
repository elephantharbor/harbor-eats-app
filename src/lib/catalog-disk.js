/**
 * Read catalog/<slug>/vN.json in order. The highest version is the one
 * staging import publishes. Earlier versions stay in the file and are
 * marked retired. v1.json bytes are not edited here.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FACTORY_CONTRACT,
  normalizeFactoryPackage,
  normalizeLegacyAuditDraftPackage,
  normalizeLegacyPackage,
} from "./catalog-import.js";
import { LEGACY_AUDIT_DRAFT_CONTRACT, LEGACY_CONTRACT } from "./catalog-legacy.js";

export function versionNumberFromName(fileName) {
  return Number(String(fileName).match(/\d+/)?.[0] || 0);
}

export function versionJsonNames(names) {
  return names
    .filter((name) => /^v\d+\.json$/.test(name))
    .sort((a, b) => versionNumberFromName(a) - versionNumberFromName(b));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sidecar(dir, slug, fileName) {
  const names = readdirSync(dir);
  let freezeIntegrity = "not_in_package";
  let freezeDetail = null;
  if (names.includes("FREEZE_INTEGRITY.json")) {
    const freeze = readJson(join(dir, "FREEZE_INTEGRITY.json"));
    freezeIntegrity = freeze.FREEZE_INTEGRITY || "present";
    freezeDetail = `fail_count=${freeze.fail_count}`;
  } else if (names.includes("FREEZE.txt")) {
    const text = readFileSync(join(dir, "FREEZE.txt"), "utf8");
    freezeIntegrity = /awaiting/i.test(text) ? "awaiting_reaudit" : "present";
    freezeDetail = text.split("\n")[0];
  }
  let valeAudit = null;
  if (names.includes("VALE-AUDIT.json")) {
    valeAudit = readJson(join(dir, "VALE-AUDIT.json"));
  }
  let readmeDeclares = false;
  if (names.includes("README.md")) {
    readmeDeclares = /not certified/i.test(readFileSync(join(dir, "README.md"), "utf8"));
  }
  return {
    source_path: `catalog/${slug}/${fileName}`,
    freeze_integrity: freezeIntegrity,
    freeze_detail: freezeDetail,
    readme_declares_not_certified: readmeDeclares,
    vale_audit: valeAudit,
  };
}

function normalizeOne(pkg, source, policy) {
  if (pkg?.catalog_contract === FACTORY_CONTRACT) return normalizeFactoryPackage(pkg, source, policy);
  if (pkg?.catalog_contract === LEGACY_AUDIT_DRAFT_CONTRACT) return normalizeLegacyAuditDraftPackage(pkg, source, policy);
  if (pkg?.catalog_contract === LEGACY_CONTRACT) return normalizeLegacyPackage(pkg, source, policy);
  return { ok: false, errors: [{ code: "unknown_contract", field: "catalog_contract", detail: pkg?.catalog_contract || null }], record: null };
}

/**
 * @param {string} catalogRoot
 * @param {object} stagingPolicy
 */
export function loadCatalogFromDisk(catalogRoot, stagingPolicy) {
  /** @type {object[]} */
  const records = [];
  /** @type {object[]} */
  const failures = [];
  /** @type {string[]} */
  const retireVersionIds = [];
  const published = stagingPolicy.publication_status || "published";
  const entries = readdirSync(catalogRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const slug = entry.name;
    const dir = join(catalogRoot, slug);
    const names = readdirSync(dir);
    const versions = versionJsonNames(names);
    if (!versions.includes("v1.json")) continue;
    const files = versions.map((fileName) => ({
      fileName,
      pkg: readJson(join(dir, fileName)),
    }));
    const first = files[0].pkg;
    if (first.catalog_contract !== FACTORY_CONTRACT && first.catalog_contract !== LEGACY_CONTRACT) {
      failures.push({ slug, errors: [{ code: "unknown_contract", detail: first.catalog_contract || null }] });
      continue;
    }
    if (first.dish?.slug !== slug || (first.catalog_contract === FACTORY_CONTRACT && first.dish?.dish_id !== slug)) {
      failures.push({ slug, errors: [{ code: "directory_slug_mismatch", detail: slug }] });
      continue;
    }
    const legacy = first.catalog_contract === LEGACY_CONTRACT;
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const last = index === files.length - 1;
      const versionNumber = versionNumberFromName(file.fileName);
      /** @type {object} */
      const policy = { publicationStatus: last ? published : "retired" };
      if (legacy && versionNumber === 2) policy.relaxTimeMismatch = true;
      if (legacy && last && versionNumber >= 2) {
        policy.publicationStatus = stagingPolicy.legacy_v2_publication_status || published;
      }
      const normalized = normalizeOne(file.pkg, sidecar(dir, slug, file.fileName), policy);
      if (!normalized.ok) {
        failures.push({ slug, file: file.fileName, errors: normalized.errors });
        continue;
      }
      if (index > 0) {
        const expected = `rv_${slug}_v${versionNumber - 1}`;
        const got = normalized.record.supersedes_version_id;
        const required = versionNumber > 2 || !legacy;
        if ((required || got) && got !== expected) {
          failures.push({
            slug,
            file: file.fileName,
            errors: [{ code: "supersedes_mismatch", detail: got }],
          });
          continue;
        }
      }
      records.push(normalized.record);
      if (!last && (!legacy || stagingPolicy.legacy_v1_retire_on_v2_import !== false)) {
        retireVersionIds.push(normalized.record.recipe_version_id);
      }
    }
  }

  return { records, failures, retireVersionIds };
}
