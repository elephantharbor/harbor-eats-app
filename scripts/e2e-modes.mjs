/**
 * E2E environment modes (docs/release/E2E-MODES.md). Resolved from env vars:
 *   E2E_MODE=local-d1 (default) | local-store | hosted-preview
 * Each mode fixes catalog source, D1, migrations, seed, expected catalog state, target and health assertion.
 */
import { assertHostedE2ETarget } from "./deploy/environments.mjs";

export const SEED_SQL = "data/staging-catalog-import.sql";

export const E2E_MODES = Object.freeze({
  "local-d1": {
    catalogSource: "d1",
    d1: "wrangler local (.wrangler/state), never remote",
    migrations: "npm run db:migrate:local (all migrations/)",
    seed: `node scripts/seed-local-d1-catalog.mjs (${SEED_SQL}) — REQUIRED`,
    expectedCatalog: "75 published versions",
    target: "http://127.0.0.1:8787 (wrangler dev, wrangler.worker.toml + --var CATALOG_SOURCE:d1)",
    health: "catalog_source=d1, catalog_runtime_meals=75, d1=ok",
  },
  "local-store": {
    catalogSource: "recipe-store",
    d1: "wrangler local, migrations only",
    migrations: "npm run db:migrate:local",
    seed: "none (catalog from bundled recipe store)",
    expectedCatalog: "bundled store (legacy unit-test catalog)",
    target: "http://127.0.0.1:8787",
    health: "catalog_source=recipe-store",
  },
  "hosted-preview": {
    catalogSource: "d1",
    d1: "harbor-eats-cycle1-preview (65bc636d…) — must already be migrated + imported",
    migrations: "none applied by E2E",
    seed: "none (preview D1 already imported); E2E creates synthetic households only",
    expectedCatalog: "75 published versions",
    target: "PLAYWRIGHT_BASE_URL (https, never a harbor-eats-app prod host)",
    health: "deploy_env=preview (next release), catalog_runtime_meals=75",
  },
});

export function resolveE2EMode(env, { exists, read }) {
  const name = env.E2E_MODE || (env.PLAYWRIGHT_BASE_URL && env.PLAYWRIGHT_SKIP_WEBSERVER ? "hosted-preview" : "local-d1");
  const mode = E2E_MODES[name];
  if (!mode) throw new Error(`unknown E2E_MODE ${name}`);
  if (name === "local-d1") {
    if (!exists(SEED_SQL)) throw new Error(`D1-mode E2E requires seed ${SEED_SQL}; refusing to run unseeded`);
    const published = (read(SEED_SQL).match(/'published'/g) || []).length;
    if (published === 0) throw new Error(`seed ${SEED_SQL} contains no published catalog versions`);
    if (env.CATALOG_SOURCE && env.CATALOG_SOURCE !== "d1") throw new Error("local-d1 mode requires CATALOG_SOURCE=d1");
  }
  if (name === "hosted-preview") {
    if (!env.PLAYWRIGHT_BASE_URL) throw new Error("hosted-preview requires PLAYWRIGHT_BASE_URL");
    assertHostedE2ETarget(env.PLAYWRIGHT_BASE_URL);
  }
  return { name, ...mode, summary: `${mode.catalogSource}; ${mode.expectedCatalog}; ${mode.target}` };
}
