/**
 * Published catalog meals → display titles for client meal imagery.
 * Source: catalog packages (75 live dishes), not recipe-store.js.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const defaultCatalogRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "catalog");

export const LEGACY_CATALOG_CONTRACT = "flavorweave-legacy-catalog-package";
export const FACTORY_CATALOG_CONTRACT = "flavorweave-catalog-package";

/**
 * @param {string} [catalogRoot]
 * @returns {{ slug: string, title: string, recipe_version_id: string }[]}
 */
export function listPublishedMealMedia(catalogRoot = defaultCatalogRoot) {
  /** @type {{ slug: string, title: string, recipe_version_id: string }[]} */
  const meals = [];
  for (const entry of readdirSync(catalogRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "legacy-24") continue;
    const dir = join(catalogRoot, entry.name);
    const v1Path = join(dir, "v1.json");
    if (!existsSync(v1Path)) continue;
    const v1 = JSON.parse(readFileSync(v1Path, "utf8"));
    if (v1.catalog_contract === FACTORY_CATALOG_CONTRACT) {
      meals.push({
        slug: v1.dish.slug,
        title: v1.dish.title,
        recipe_version_id: v1.dish.current_version_id,
      });
      continue;
    }
    if (v1.catalog_contract !== LEGACY_CATALOG_CONTRACT) continue;
    const v2Path = join(dir, "v2.json");
    if (existsSync(v2Path)) {
      const v2 = JSON.parse(readFileSync(v2Path, "utf8"));
      meals.push({
        slug: v2.dish.slug,
        title: v2.dish.title,
        recipe_version_id: v2.dish.current_version_id,
      });
    } else {
      meals.push({
        slug: v1.dish.slug,
        title: v1.dish.title,
        recipe_version_id: v1.dish.current_version_id,
      });
    }
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
