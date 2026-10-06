# Deployment — Harbor Eats consumer app

## Environments

| Name | Purpose | URL |
|------|---------|-----|
| **local** | Dev + CI E2E | `http://127.0.0.1:8787` (`npm run dev`) |
| **preview** | Optional Pages preview branches | `*.pages.dev` (project settings) |
| **alpha** | Persistent pilot | https://harbor-eats-app.pages.dev |

**Authoritative product surface:** `harbor-eats-app.pages.dev` only.

The legacy `harbor-eats-app.elephantharbor.workers.dev` Workers mirror is **retired** (repo: `workers_dev = false`, Worker returns `410` with canonical link). After merging, run one final `npm run deploy` so the account stops serving the stale 24-meal mirror, or disable the workers.dev route in Cloudflare if an old version remains cached.

## Prerequisites

- Node ≥ 22
- `CLOUDFLARE_API_TOKEN` with Pages + Workers + D1 access (never commit)
- D1 binding id in `wrangler.toml` / `wrangler.worker.toml`

## Deploy from a commit SHA

```bash
git checkout <sha>
npm ci
npm run db:migrate:remote   # forward-only; record level in DEPLOYMENTS.md
npm run deploy              # Worker + assets
npm run pages:deploy        # Pages static + Functions
```

Record in `DEPLOYMENTS.md`:

- SHA
- UTC timestamp
- Target (pages / worker / both)
- Migration level applied (e.g. `0003_member_sessions`)

## Rollback

1. Identify last known-good SHA from `DEPLOYMENTS.md`.
2. `git checkout <good-sha>` and redeploy (commands above).
3. **Do not** down-migrate D1 in alpha; forward-only SQL. If a migration was bad, ship a corrective forward migration.

## Health check

```bash
curl -sS "https://harbor-eats-app.pages.dev/api/health"
# expect: {"ok":true,"d1":"ok",...}
```

After session deploy:

```bash
curl -sS -c /tmp/he.jar -X POST "https://harbor-eats-app.pages.dev/api/sessions" \
  -H 'content-type: application/json' \
  -d '{"household_id":"<hh>","member_id":"<member>"}'
curl -sS -b /tmp/he.jar "https://harbor-eats-app.pages.dev/api/sessions/me"
```
