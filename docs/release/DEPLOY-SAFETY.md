# Deploy safety and preflight

| Command | What it proves | Network |
|---|---|---|
| `npm run preflight` | Node ≥22; no root Pages config with a D1 binding; both deploy configs valid; staging Worker not prod D1; SW invariant | none |
| `npm run preflight:e2e` | + E2E mode contract (seed present for D1 mode; hosted target not prod) | none |
| `npm run preflight:preview` | + clean git tree | none |
| `npm run preflight:production` | + clean tree, HEAD == origin/main | none (uses local refs) |
| `npm run deploy:preview [-- --dry-run]` | preflight:preview, then canonical preview deploy | wrangler |
| `npm run deploy:production -- --confirm-production` | preflight:production, then canonical prod deploy | wrangler |
| `npm run deploy:verify-binding -- <env> <url>` | post-deploy health + D1 id + SW version | GET only |
| `npm run smoke:catalog [-- --api <url>] [--wave12]` | structural smoke of every published meal (DB + read-only API) | optional GET |
| `npm run release:sw-stamp` | record SW shell hash after bumping `fw-sw-vN` | none |

Refusals (all unit-tested): preview + prod D1; prod + preview D1; root ≠ `public/`; wrong project/branch; prod without
`--confirm-production`; `HARBOR_DEPLOY_FREEZE=1`. See `docs/release/hardening-1/DECISION-CARD-deploy-binding.md`.

Next-release binding check: after `deploy:preview`, run verify-binding against the deployment URL, then dispatch
`hosted-e2e.yml` with that URL and `REQUIRE_BINDING_VARS=1` behavior enabled.
