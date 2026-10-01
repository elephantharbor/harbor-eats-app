# D1 database discipline — Harbor Eats

## Database

- **Name:** `harbor-eats-db`
- **Binding:** `DB` in Worker and Pages Functions
- **Migrations:** `migrations/` — applied with Wrangler only

## Forward-only migrations

1. Add new file `NNNN_description.sql` (4-digit prefix, monotonic).
2. Test locally: `npm run db:migrate:local`
3. Apply remote before or during deploy: `npm run db:migrate:remote`
4. Never edit applied migration files on main; add a new migration instead.

Current chain:

- `0001_init.sql` — core tenancy, plan loop, ratings 1–10
- `0002_share_invite_durable.sql` — HE-SHARE / HE-INV durability
- `0003_member_sessions.sql` — returning-user sessions

## Protecting real household data (alpha)

- Treat remote D1 as **production pilot data** — no destructive SQL in alpha.
- Avoid `DELETE FROM household` / bulk clears without coordinator approval.
- Session rows may accumulate; safe to add retention job later (not in MVO).
- Backups: use Cloudflare D1 export / dashboard backup before risky migrations. Document export time in `DEPLOYMENTS.md`.

## Data access isolation

- App code accesses D1 only via `env.DB` in `src/index.js` (Worker handler).
- Pages Functions re-export the same handler (`functions/api/[[path]].js`).
- No secondary analytics DB in this repo; events table is append-only telemetry.

## CI

`npm run test:migrations` validates naming and non-empty SQL. E2E applies migrations to **local** D1 automatically via Playwright `webServer` hook.
