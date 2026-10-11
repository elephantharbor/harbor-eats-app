#!/usr/bin/env node
/**
 * Author structural preflight. Not certification and not freeze integrity.
 *
 * Checks the importer contract and the authoring rules that do not need
 * pixels: identity, times, ingredients, steps, taste tags, allergens,
 * dietary eligibility, D-03 enums, equipment, plating brief, and D-06.1
 * cooking agreement with src/weave/semantics.js.
 *
 * A pending image slot (asset_generated false, slot_status pending_image_pass)
 * can pass here. A finished image pass passes only when asset_generated is
 * true, the declared image files are on disk, and FREEZE_INTEGRITY.json is
 * PASS. A half-done slot fails. factory/tools/freeze_integrity.py still fails
 * a pending slot until the WebP pair is on disk.
 *
 * Usage, from the repo root:
 *   node factory/tools/structural_preflight.mjs factory/waves/<wave>/candidates
 *   node factory/tools/structural_preflight.mjs factory/waves/<wave>/candidates/<slug>
 *
 * Writes STRUCTURAL_PREFLIGHT.json in each candidate directory.
 * Exit 0 when every candidate passes, 1 otherwise.
 */
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeFactoryPackage } from "../../src/lib/catalog-import.js";
import { deriveCookingMethod } from "../../src/weave/semantics.js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const BRIEF_HEADINGS = [
  "hero subject",
  "vessel",
  "camera angle",
  "required visible components",
  "texture cues",
  "forbidden elements",
  "crop strategy",
];

const CONDITIONAL = /\b(?:dairy[- ]free if|nut[- ]free if|gluten[- ]free if|if you use|if using a)\b/i;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function candidateDirs(target) {
  const names = await readdir(target, { withFileTypes: true });
  if (names.some((entry) => entry.isFile() && entry.name === "v1.json")) return [target];
  const dirs = [];
  for (const entry of names) {
    if (!entry.isDirectory()) continue;
    const dir = join(target, entry.name);
    if (await exists(join(dir, "v1.json"))) dirs.push(dir);
  }
  return dirs.sort();
}

function check(checks, id, ok, detail) {
  checks.push({ id, result: ok ? "PASS" : "FAIL", detail });
}

function imageFileName(value, fallback) {
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallback;
  if (!raw) return null;
  return basename(raw);
}

/**
 * Pending slots stay valid. A finished image pass passes only when
 * asset_generated is true, the image files exist, and freeze integrity is PASS.
 * Anything short of that on a generated slot is half-done.
 *
 * @param {string} dir
 * @param {object} image
 * @param {string} [slug]
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
export async function assessImageSlot(dir, image = {}, slug = "") {
  if (image.asset_generated !== true) {
    const pending = image.asset_generated === false && image.slot_status === "pending_image_pass";
    return {
      ok: pending,
      detail: pending ? "pending_image_pass" : image.slot_status || "unset",
    };
  }

  const master = imageFileName(image.master_filename, slug ? `${slug}.webp` : "");
  const card = imageFileName(image.card_filename, slug ? `${slug}-640.webp` : "");
  const source = imageFileName(image.active_source_jpeg, "");
  const required = [master, card, source].filter(Boolean);
  const missing = [];
  for (const name of required) {
    if (!(await exists(join(dir, name)))) missing.push(name);
  }
  if (!master) missing.push("master");
  if (!card) missing.push("card");

  let freezeStatus = "missing";
  const freezePath = join(dir, "FREEZE_INTEGRITY.json");
  if (await exists(freezePath)) {
    try {
      const freeze = JSON.parse(await readFile(freezePath, "utf8"));
      freezeStatus = freeze?.FREEZE_INTEGRITY === "PASS" ? "PASS" : freeze?.FREEZE_INTEGRITY || "unreadable";
    } catch {
      freezeStatus = "unreadable";
    }
  }

  const filesOk = missing.length === 0;
  const freezeOk = freezeStatus === "PASS";
  if (filesOk && freezeOk) {
    const listed = required.join(", ");
    return { ok: true, detail: `asset_generated; files ${listed}; freeze integrity PASS` };
  }

  const reasons = [];
  if (!filesOk) reasons.push(`missing ${missing.join(", ")}`);
  if (!freezeOk) reasons.push(`freeze integrity ${freezeStatus}`);
  return { ok: false, detail: `half-done image slot: ${reasons.join("; ")}` };
}

function cookingView(cooking) {
  return {
    frying: asArray(cooking?.frying),
    crispy_non_fry: asArray(cooking?.crispy_non_fry),
    stir_fry: cooking?.stir_fry === true,
    source: cooking?.source || null,
  };
}

async function preflightDir(dir) {
  const checks = [];
  const pkgPath = join(dir, "v1.json");
  let pkg;
  try {
    pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  } catch (error) {
    check(checks, "package_json", false, String(error.message || error));
    return finish(dir, checks);
  }
  check(checks, "package_json", true, "v1.json parses");

  const normalized = normalizeFactoryPackage(pkg, {
    source_path: pkgPath,
    freeze_integrity: "not_this_gate",
    readme_declares_not_certified: true,
  });
  if (!normalized.ok) {
    const detail = normalized.errors.map((item) => `${item.code}${item.detail ? `:${item.detail}` : ""}`).join("; ");
    check(checks, "importer_normalize", false, detail);
  } else {
    check(checks, "importer_normalize", true, normalized.record.recipe_version_id);
  }

  const version = pkg.recipe_version || {};
  const dish = pkg.dish || {};
  const confidence = pkg.catalog_confidence || {};
  check(checks, "kitchen_tested", version.kitchen_tested === false && confidence.kitchen_tested === false, `version=${version.kitchen_tested} confidence=${confidence.kitchen_tested}`);
  check(checks, "cook_counts", confidence.household_cooks === 0 && confidence.household_completed_ratings === 0, "household cooks and ratings are 0");
  check(
    checks,
    "d03_enums",
    ["easy", "moderate", "involved"].includes(version.effort_level) &&
      ["simple", "standard", "adventurous"].includes(version.ingredient_complexity),
    `${version.effort_level} / ${version.ingredient_complexity}`
  );
  check(checks, "equipment", asArray(version.equipment).length > 0, `${asArray(version.equipment).length} items`);
  check(checks, "methods", asArray(version.methods).length > 0, asArray(version.methods).join(", ") || "none");

  const eligibility = version.dietary_eligibility || {};
  const eligKeys = ["contains_meat", "contains_poultry", "contains_finfish", "contains_shellfish", "contains_dairy", "plant_based_compatible", "vegetarian_compatible"];
  const eligOk = eligKeys.every((key) => typeof eligibility[key] === "boolean") && typeof eligibility.nut_policy === "string";
  check(checks, "dietary_eligibility", eligOk, eligibility.nut_policy || "incomplete");

  const hh = version.hh001_eligible === true || eligibility.hh001_eligible === true;
  if (version.hh001_eligible === true) {
    const hard =
      eligibility.contains_meat === false &&
      eligibility.contains_poultry === false &&
      eligibility.contains_shellfish === false &&
      eligibility.contains_dairy === false &&
      (eligibility.nut_policy === "none" || eligibility.nut_policy === "cashews_only_ok");
    check(checks, "hh001_contract", hard, version.hh001_reason || eligibility.nut_policy || "");
  } else {
    check(checks, "hh001_contract", version.hh001_eligible === false, "not HH001");
  }

  const blob = JSON.stringify(version);
  check(checks, "no_conditional_claims", !CONDITIONAL.test(blob), CONDITIONAL.test(blob) ? "conditional dietary wording" : "none");

  const ids = new Set(asArray(version.ingredients).map((item) => item.ingredient_id).filter(Boolean));
  const referenced = new Set();
  for (const step of asArray(version.steps)) {
    for (const ref of asArray(step.ingredient_refs)) referenced.add(ref);
  }
  const dangling = [...referenced].filter((id) => !ids.has(id));
  const unused = [...ids].filter((id) => !referenced.has(id));
  check(checks, "ingredient_refs", dangling.length === 0 && unused.length === 0, dangling.length || unused.length ? `dangling=${dangling.join(",")} unused=${unused.join(",")}` : `${ids.size} ingredients referenced`);

  const derived = deriveCookingMethod({
    methods: version.methods || [],
    steps: version.steps || [],
    description: version.description || dish.description || "",
    title: version.title || dish.title || "",
  });
  const stored = cookingView(version.cooking);
  const got = cookingView(derived);
  const same = JSON.stringify(stored) === JSON.stringify(got);
  check(checks, "cooking_d061", same && version.cooking?.intent, same ? `${got.source} frying=${got.frying.join(",") || "-"} crisp=${got.crispy_non_fry.join(",") || "-"} stir=${got.stir_fry}` : `stored ${JSON.stringify(stored)} derived ${JSON.stringify(got)}`);

  const briefPath = join(dir, "image-plating-brief.md");
  if (!(await exists(briefPath))) {
    check(checks, "plating_brief", false, "image-plating-brief.md missing");
  } else {
    const brief = (await readFile(briefPath, "utf8")).toLowerCase();
    const missing = BRIEF_HEADINGS.filter((heading) => !brief.includes(heading));
    check(checks, "plating_brief", missing.length === 0, missing.length ? `missing ${missing.join(", ")}` : "required sections present");
  }
  check(checks, "image_prompt", await exists(join(dir, "image-prompt.md")), "image-prompt.md");
  const image = pkg.image || {};
  const slot = await assessImageSlot(dir, image, dish.slug || "");
  check(checks, "image_slot", slot.ok, slot.detail);

  const sidecar = join(dir, "d03-classification.json");
  if (!(await exists(sidecar))) {
    check(checks, "d03_sidecar", false, "d03-classification.json missing");
  } else {
    const side = JSON.parse(await readFile(sidecar, "utf8"));
    check(
      checks,
      "d03_sidecar",
      side.effort_level === version.effort_level && side.ingredient_complexity === version.ingredient_complexity,
      `${side.effort_level} / ${side.ingredient_complexity}`
    );
  }

  return finish(dir, checks, hh);
}

function finish(dir, checks, hh001 = false) {
  const failed = checks.filter((item) => item.result === "FAIL");
  return {
    dir,
    slug: dir.split("/").pop(),
    STRUCTURAL_PREFLIGHT: failed.length ? "FAIL" : "PASS",
    hh001_eligible: hh001 === true,
    fail_count: failed.length,
    checks,
  };
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: structural_preflight.mjs <candidates-dir-or-candidate-dir>");
    process.exit(2);
  }
  const dirs = await candidateDirs(target.startsWith("/") ? target : join(repoRoot, target));
  if (!dirs.length) {
    console.error(`no v1.json under ${target}`);
    process.exit(1);
  }
  let failed = 0;
  /** @type {object[]} */
  const reports = [];
  for (const dir of dirs) {
    const report = await preflightDir(dir);
    reports.push(report);
    await writeFile(join(dir, "STRUCTURAL_PREFLIGHT.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${report.slug}: STRUCTURAL_PREFLIGHT ${report.STRUCTURAL_PREFLIGHT} (${report.fail_count} fails)`);
    for (const item of report.checks.filter((row) => row.result === "FAIL")) {
      console.log(`  FAIL ${item.id}: ${item.detail}`);
    }
    if (report.STRUCTURAL_PREFLIGHT !== "PASS") failed += 1;
  }
  const hh = reports.filter((report) => report.hh001_eligible).length;
  console.log(`structural_preflight ${failed ? "FAIL" : "PASS"} ${reports.length - failed}/${reports.length} hh001=${hh}`);
  process.exit(failed ? 1 : 0);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  await main();
}
