/**
 * Write catalog/<slug>/v1.json for the current 24 meals.
 * Does not touch factory packages.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { legacyPackagesFromStore } from "../src/lib/catalog-legacy.js";

const root = join(process.cwd(), "catalog");
const packages = legacyPackagesFromStore();
for (const pkg of packages) {
  const dir = join(root, pkg.dish.slug);
  await mkdir(dir, { recursive: true });
  const target = join(dir, "v1.json");
  await writeFile(target, `${JSON.stringify(pkg, null, 2)}\n`);
}
console.log(`wrote ${packages.length} legacy packages`);
