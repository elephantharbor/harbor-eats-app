/**
 * Deterministic freeze-integrity checks for catalog packages (mechanical PASS/FAIL).
 * Mirrors flavorweave-catalog-factory freeze_integrity.py; does not reopen culinary audit.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRepoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const DENIAL_PATTERN = /missing[- ]image|image[- ]denied|no[- ]hero|hero[- ]missing/i;

/**
 * @param {Buffer} buf
 * @returns {{ width: number, height: number } | null}
 */
export function webpDimensions(buf) {
  if (buf.length < 30) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const tag = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (tag === "VP8 " && start + 10 <= buf.length) {
      return {
        width: buf.readUInt16LE(start + 6) & 0x3fff,
        height: buf.readUInt16LE(start + 8) & 0x3fff,
      };
    }
    if (tag === "VP8L" && start + 5 <= buf.length) {
      const bits = buf.readUInt32LE(start + 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (tag === "VP8X" && start + 10 <= buf.length) {
      return {
        width: 1 + buf.readUIntLE(start + 4, 3),
        height: 1 + buf.readUIntLE(start + 7, 3),
      };
    }
    offset = start + size + (size & 1);
  }
  return null;
}

function check(id, pass, detail) {
  return { id, result: pass ? "PASS" : "FAIL", detail: detail || "" };
}

function resolveImagePath(catalogDir, publicMealsDir, fileName) {
  const inPkg = join(catalogDir, fileName);
  if (existsSync(inPkg)) return inPkg;
  const inPublic = join(publicMealsDir, fileName);
  if (existsSync(inPublic)) return inPublic;
  return null;
}

/**
 * @param {string} catalogDir absolute path to catalog/<slug>
 * @param {{ publicMealsDir?: string, repoRoot?: string }} [opts]
 */
export function runFreezeIntegrity(catalogDir, opts = {}) {
  const repoRoot = opts.repoRoot || defaultRepoRoot;
  const publicMealsDir = opts.publicMealsDir || join(repoRoot, "public", "images", "meals");
  const slug = catalogDir.split("/").pop() || "";
  const checks = [];
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(catalogDir, "v1.json"), "utf8"));
    checks.push(check("package_file", true, "v1.json parses"));
  } catch (e) {
    checks.push(check("package_file", false, String(e.message || e)));
    return finalize(catalogDir, checks);
  }

  const dish = pkg.dish || {};
  const version = pkg.recipe_version || {};
  const image = pkg.image || {};
  const dishId = dish.dish_id || dish.slug;
  const packageRevision = pkg.package_revision || version.package_revision || "unknown";

  checks.push(check("identity_present", Boolean(dishId), `${dishId || slug} ${packageRevision}`));
  checks.push(check("identity_agree", dish.slug === dishId, "slug matches dish_id"));
  checks.push(check("recipe_id", dish.current_recipe_id === `rcp_${dishId}`, dish.current_recipe_id || "missing"));
  checks.push(
    check(
      "version_id",
      dish.current_version_id === version.recipe_version_id,
      version.recipe_version_id || "missing"
    )
  );
  checks.push(check("field_ingredients", Array.isArray(version.ingredients) && version.ingredients.length > 0, "present"));
  checks.push(check("field_steps", Array.isArray(version.steps) && version.steps.length > 0, "present"));
  checks.push(
    check(
      "field_taste_tags",
      Array.isArray(version.vocabulary_tag_ids) && version.vocabulary_tag_ids.length > 0,
      "present"
    )
  );
  checks.push(check("field_base_servings", Number(version.base_servings) > 0, "present"));
  checks.push(
    check(
      "field_dietary_eligibility",
      version.dietary_eligibility && typeof version.dietary_eligibility === "object",
      "present"
    )
  );
  checks.push(
    check(
      "eligibility_object",
      version.dietary_eligibility && typeof version.dietary_eligibility === "object",
      "dietary_eligibility is an object"
    )
  );
  const allergens = version.allergens || [];
  checks.push(check("field_allergens", Array.isArray(allergens), "present at recipe_version.allergens"));
  checks.push(check("allergens_list", Array.isArray(allergens), `${allergens.length} tokens`));

  const serialized = JSON.stringify(pkg);
  checks.push(
    check("no_denial_strings", !DENIAL_PATTERN.test(serialized), "no stale missing-image denials")
  );

  const gen = image.generation || {};
  checks.push(check("provenance_method", Boolean(gen.method), gen.method || "missing"));
  checks.push(check("provenance_generation_date", Boolean(gen.generation_date), gen.generation_date || "missing"));
  const generatorLabel = gen.generator || gen.generator_identity || null;
  checks.push(check("provenance_generator", Boolean(generatorLabel), generatorLabel || "missing"));
  checks.push(check("provenance_model", gen.model != null, gen.model || "missing"));

  const activePaths = JSON.stringify(image);
  checks.push(
    check("active_not_rejected", !activePaths.includes("rejected/"), "active refs do not mention rejected/")
  );

  const derivatives = image.derivatives || [];
  const master = derivatives.find((d) => d.role === "master") || derivatives[0];
  const card = derivatives.find((d) => d.role === "thumb") || derivatives.find((d) => d.path?.includes("-640"));

  function imageChecks(role, derivative, expectedW, expectedH) {
    if (!derivative?.path) {
      checks.push(check(`image_format_${role}`, false, "missing derivative"));
      checks.push(check(`image_dims_${role}`, false, "missing"));
      return;
    }
    const path = resolveImagePath(catalogDir, publicMealsDir, derivative.path.replace(/^\//, "").split("/").pop());
    const okPath = Boolean(path);
    checks.push(
      check(
        `image_format_${role}`,
        okPath && derivative.path.endsWith(".webp"),
        `${derivative.path} webp`
      )
    );
    if (!path) {
      checks.push(check(`image_dims_${role}`, false, "file missing"));
      return;
    }
    const dims = webpDimensions(readFileSync(path));
    const dimStr = dims ? `${dims.width}x${dims.height}` : "unknown";
    checks.push(check(`image_dims_${role}`, dims && dims.width === expectedW && dims.height === expectedH, dimStr));
    if (role === "master") {
      const declared =
        image.dimensions_target ||
        image.master_dimensions ||
        (derivative.width && derivative.height ? derivative : null);
      checks.push(
        check(
          "declared_master_dims",
          declared?.width === expectedW && declared?.height === expectedH,
          "declared master matches spec"
        )
      );
    }
    if (role === "card") {
      checks.push(
        check(
          "declared_card_dims",
          derivative.width === expectedW && derivative.height === expectedH,
          "declared card matches spec"
        )
      );
    }
  }

  imageChecks("master", master, 1200, 900);
  imageChecks("card", card, 640, 480);

  const rejectedDir = join(catalogDir, "rejected");
  let rejectedOk = true;
  if (existsSync(rejectedDir)) {
    const activeNames = new Set([master?.path, card?.path].filter(Boolean).map((p) => p.split("/").pop()));
    for (const name of readdirSync(rejectedDir)) {
      if (activeNames.has(name)) rejectedOk = false;
    }
  }
  checks.push(
    check("rejected_not_active_name", rejectedOk, "rejected files do not reuse active filenames")
  );

  return finalize(catalogDir, checks);
}

function finalize(catalogDir, checks) {
  const fail_count = checks.filter((c) => c.result === "FAIL").length;
  return {
    FREEZE_INTEGRITY: fail_count === 0 ? "PASS" : "FAIL",
    candidate_dir: catalogDir,
    fail_count,
    checks,
  };
}
