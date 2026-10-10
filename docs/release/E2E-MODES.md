# E2E modes (encoded in `scripts/e2e-modes.mjs`, enforced by `npm run preflight:e2e`)

| Mode | Catalog source | Env vars | D1 | Migrations | Seed / import | Expected catalog | Target | Health assertion |
|---|---|---|---|---|---|---|---|---|
| `local-d1` (default, CI) | `d1` | `CATALOG_SOURCE=d1` via `--var` | wrangler local `.wrangler/state` (never remote) | `npm run db:migrate:local` (all) | `scripts/seed-local-d1-catalog.mjs` ← `data/staging-catalog-import.sql` — **required** | 75 published | `http://127.0.0.1:8787` (`wrangler.worker.toml`) | `catalog_source=d1`, `catalog_runtime_meals=75`, `d1=ok` |
| `local-store` (`npm run dev`) | bundled recipe store | none | wrangler local | local | none | legacy store | `127.0.0.1:8787` | `catalog_source=recipe-store` (no E2E spec targets this) |
| `hosted-preview` | `d1` | `E2E_MODE=hosted-preview`, `PLAYWRIGHT_BASE_URL`, `PLAYWRIGHT_SKIP_WEBSERVER=1` | `harbor-eats-cycle1-preview` (already migrated + imported) | none by E2E | none (synthetic households only) | 75 published | https preview URL; prod hosts rejected | `catalog_runtime_meals=75`; next release: `deploy_env=preview`, `d1_database_id=65bc636d…` |

Rules: D1-mode E2E never runs unseeded (`e2e-web-server.sh` runs `preflight:e2e` first and the seed script fails under 4
published meals). Hosted E2E only via `.github/workflows/hosted-e2e.yml` (workflow_dispatch) or the same env locally.
Each household in a spec gets a fresh request context (`apiCreateIsolatedHousehold`).
