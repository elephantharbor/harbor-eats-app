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
- `0004_auth_security.sql` — session token hashing, recovery tokens
- `0005_phase3_household_intel.sql` — household settings, taste evidence, client errors, meal_option letters A–E
- `0006_session_token_retire.sql` — align legacy session_token column with hash

### D1 foreign keys when altering referenced tables

Cloudflare D1 applies each migration file as **multiple statements**; `PRAGMA foreign_keys = OFF` is **not** reliable across those steps. If you change a parent table that has FK children (e.g. `meal_option` ← `selection`, `cook`, `rating`), use the pattern in **0005**:

1. `CREATE TABLE _stash AS SELECT * FROM …` for parent and all FK dependents  
2. `DROP TABLE` dependents first, then parent  
3. `CREATE TABLE` parent with new definition; `INSERT` from stash  
4. `CREATE TABLE` dependents; `INSERT` from stash; `DROP` stash tables  

Do not `DROP TABLE meal_option` while child tables still exist unless FK enforcement is truly off for that entire migration run.

### Dry-run before remote apply

1. **Local full chain:** `npm run db:migrate:local` on a clean dev checkout (Playwright `webServer` does this automatically).  
2. **Re-run check:** `npm run test:migrations` and `npm run test:unit` (includes migration order guard for 0005).  
3. **Remote:** export / snapshot remote D1 from the Cloudflare dashboard, then `npm run db:migrate:remote`. If a migration fails, D1 usually leaves schema unchanged for that file; fix forward in the same numbered file only if it was **never** recorded in `d1_migrations`.

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
