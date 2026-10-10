# harbor-eats-app (consumer product)

Authoritative **Harbor Eats consumer** source: Cloudflare **Pages + Functions + Worker + D1**.

- **Not** the Operating Desk ([`elephantharbor/harbor-eats`](https://github.com/elephantharbor/harbor-eats) → github.io/harbor-eats/).
- **Product entrypoint:** `public/` (UI) + `functions/api` (same-origin `/api/*`) + `src/index.js` (Worker).
- **Legacy static prototype:** `legacy/github-io/` — archived source only. The repo's GitHub Pages site was disabled on 2026-10-10; it is not published anywhere.

## Live URLs

| Surface | URL |
|---------|-----|
| **Pages (alpha target)** | https://harbor-eats-app.pages.dev |
| Legacy Worker mirror | Retired — `workers_dev` off; deploy returns `410` (see `docs/DEPLOYMENT.md`) |
| Health | `GET /api/health` → `{ ok, d1: "ok" }` |
| GitHub Pages (legacy) | Disabled 2026-10-10 — the old `elephantharbor.github.io/harbor-eats-app/` URL serves nothing |

D1: `harbor-eats-db` (`23aa3db3-1090-471b-8c8a-b6fe71f5c053`).

## Quick start

```bash
npm ci
npm run db:migrate:local
npm run dev
# → http://127.0.0.1:8787
```

## Tests & CI

```bash
npm test              # migrations + unit + lint
npm run test:e2e      # Playwright (starts wrangler dev)
```

GitHub Actions runs the same on PRs and `main`. **Branch protection (human):** require CI green before merge to `main` (repo Settings → Branches → rule on `main` → require status check `CI / verify`).

## API (MVO)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/health` | D1 ping |
| POST | `/api/households` | Create household |
| GET | `/api/households/:id` | Household + members + constraints |
| GET | `/api/households/:id/state` | Lifecycle + next action |
| POST | `/api/sessions` | Create session (`Set-Cookie: he_session`) |
| GET | `/api/sessions/me` | Restore returning user |
| POST | `/api/households/:id/members` | Add member |
| POST | `/api/members/:id/constraints` | Hard constraints |
| POST | `/api/plans` | Plan + 3 options |
| POST | `/api/selections` | Select meal |
| POST | `/api/cooks` | Mark cooked |
| POST | `/api/ratings` | Score **1–10** |
| POST | `/api/eligibility/check` | Filter options by prohibited rules |
| POST/GET | `/api/shares`, `/api/invites` | PLG durable tokens |

**Alpha auth:** session cookie identifies the member for restore; most write APIs remain open by household id — see `PRODUCT-STATE.md`.

## Deploy

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Log each deploy in [`DEPLOYMENTS.md`](DEPLOYMENTS.md).

```bash
export CLOUDFLARE_API_TOKEN=...  # never commit
npm run db:migrate:remote
npm run deploy
npm run pages:deploy
```

## Docs

- [`PRODUCT-STATE.md`](PRODUCT-STATE.md) — flows, invariants, alpha readiness
- [`docs/DATABASE.md`](docs/DATABASE.md) — migration discipline
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — environments & rollback

## Legacy github.io staging (archived)

GitHub Pages is disabled for this repo. The script below only stages files locally; do not re-enable Pages without Oversight sign-off.

```bash
bash scripts/prepare-github-io.sh
# stages public/ → .github-io-stage for manual publish
```
