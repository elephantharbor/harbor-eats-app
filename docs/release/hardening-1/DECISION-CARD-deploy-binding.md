# Decision Card — Deploy binding safety (hardening-1)

**Decision.** Pages deploys go only through `npm run deploy:preview` / `deploy:production`. Each target has its own
`deploy/pages/<env>/wrangler.toml`; the script stages `public/ functions/ src/` beside that file and runs
`wrangler pages deploy public --project-name <p> --branch <b>`. The root `wrangler.toml` is removed so an ad-hoc
`wrangler pages deploy` can no longer push the prod D1 binding onto another project.

**Invariants.**
- preview = `harbor-eats-cycle1-preview` @ `cycle1`, D1 `65bc636d…`; production = `harbor-eats-app` @ `main`, D1 `23aa3db3…`.
- Exactly one D1 binding per config; deploy root is `public/`; config `DEPLOY_ENV` + `D1_DATABASE_ID` vars equal the target.
- Production needs `--confirm-production` and `preflight:production` (clean tree, HEAD == origin/main). `HARBOR_DEPLOY_FREEZE=1` blocks all real deploys.
- Hosted E2E never targets `harbor-eats-app.pages.dev` or `*.harbor-eats-app.pages.dev` (the prod project's preview aliases share PROD D1).

**Behavior.** Wrong combinations exit 2 with `[deploy] REFUSED: …` before any wrangler call. After a deploy,
`npm run deploy:verify-binding -- <env> <url>` asserts `/api/health` `deploy_env`, `d1_database_id`, `catalog_source=d1`,
`catalog_runtime_meals`, and that `/sw.js` serves `release/release-metadata.json` `sw_cache_version`.

**Edge cases.** The vars are declared configuration, not read from the binding itself — they prove the config that
shipped, and the staged config is the only source of the binding. Until the next deploy ships the vars, the hosted-E2E
health step tolerates `deploy_env/d1_database_id = null` (set `REQUIRE_BINDING_VARS=1` after the next release).
The prod project's own *preview environment* binding (dashboard) still points at prod D1: human/dashboard gate.

**Non-goals.** No deploy this cycle; no Cloudflare dashboard changes; no secrets in configs; Worker (`wrangler.worker.toml`)
and staging Worker (`wrangler.staging.toml`) unchanged.

Proof: `test/deploy-safety.test.js` (refusals, mocked exec, dry-run, verify-binding mock fetch, workflow static checks, preflight).
