/**
 * Published catalog meals → display titles for client meal imagery.
 * Source: catalog packages (75 live dishes), not recipe-store.js.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function catalogRootFromModule() {
  try {
    const url = import.meta.url;
    if (typeof url === "string" && url) {
      return join(dirname(fileURLToPath(url)), "..", "..", "catalog");
    }
  } catch {
    // The worker bundle has no module URL. Fall through to the process directory.
  }
  try {
    const runtime = globalThis.process;
    if (runtime && typeof runtime.cwd === "function") {
      const candidate = join(runtime.cwd(), "catalog");
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    // No filesystem in this runtime.
  }
  return null;
}

export const LEGACY_CATALOG_CONTRACT = "flavorweave-legacy-catalog-package";
export const FACTORY_CATALOG_CONTRACT = "flavorweave-catalog-package";

/**
 * @param {string} [catalogRoot]
 * @returns {{ slug: string, title: string, recipe_version_id: string }[]}
 */
export function listPublishedMealMedia(catalogRoot = catalogRootFromModule()) {
  /** @type {{ slug: string, title: string, recipe_version_id: string }[]} */
  const meals = [];
  if (!catalogRoot) return meals;
  let entries;
  try {
    entries = readdirSync(catalogRoot, { withFileTypes: true });
  } catch {
    return meals;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "legacy-24") continue;
    const dir = join(catalogRoot, entry.name);
    const v1Path = join(dir, "v1.json");
    if (!existsSync(v1Path)) continue;
    const v1 = JSON.parse(readFileSync(v1Path, "utf8"));
    if (v1.catalog_contract !== FACTORY_CATALOG_CONTRACT && v1.catalog_contract !== LEGACY_CATALOG_CONTRACT) continue;
    const versions = readdirSync(dir)
      .filter((name) => /^v\d+\.json$/.test(name))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    const current = JSON.parse(readFileSync(join(dir, versions[versions.length - 1]), "utf8"));
    const dish = current.dish || v1.dish;
    meals.push({
      slug: dish.slug,
      title: dish.title,
      recipe_version_id: dish.current_version_id || current.recipe_version?.recipe_version_id,
    });
  }
  meals.sort((a, b) => a.slug.localeCompare(b.slug));
  return meals;
}

/**
 * @param {string} [catalogRoot]
 * @returns {Record<string, string>}
 */
export function mealTitleBySlug(catalogRoot) {
  const map = {};
  for (const row of listPublishedMealMedia(catalogRoot)) {
    map[row.slug] = row.title;
  }
  return map;
}
