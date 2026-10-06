/**
 * Load the 50-meal staging catalog into wrangler local D1 (post-migrate).
 * Used by Playwright so /api/discovery/search works with CATALOG_SOURCE=d1.
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const sqlPath = join(root, "data/staging-catalog-import.sql");

function findLocalD1Sqlite() {
  const base = join(root, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  if (!existsSync(base)) return null;
  const files = readdirSync(base).filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite");
  return files.length ? join(base, files[0]) : null;
}

const db = findLocalD1Sqlite();
if (!db) {
  console.error("seed-local-d1-catalog: local D1 sqlite not found; run npm run db:migrate:local first");
  process.exit(1);
}
if (!existsSync(sqlPath)) {
  console.error("seed-local-d1-catalog: missing", sqlPath);
  process.exit(1);
}

execSync(`sqlite3 "${db}" < "${sqlPath}"`, { stdio: "inherit", cwd: root });
const count = execSync(`sqlite3 "${db}" "SELECT COUNT(*) FROM catalog_version WHERE publication_status='published'"`, {
  encoding: "utf8",
}).trim();
console.log(`seed-local-d1-catalog: ${count} published catalog versions in local D1`);
if (Number(count) < 4) {
  console.error("seed-local-d1-catalog: expected at least 4 published meals for discovery shelves");
  process.exit(1);
}
