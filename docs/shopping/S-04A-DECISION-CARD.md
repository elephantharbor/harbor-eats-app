# S-04A Decision card

**Status.** Implemented in one runtime change. Not deployed. Instacart was not called. Production stays on native shopping with `GROCERY_PROVIDERS = ""`.

This unit does not reopen the S-01, S-02, or S-03 design. It hardens identity and errors, makes the client-error count actionable, and makes Preview mock and development modes switchable at request time.

## A2 — General item identity

A general item’s `household_shop_requirement.requirement_id` was `hrg_` plus the client request id only. That column is the primary key for every household, so two households reusing one request id collided. The loser got a 500 whose body included the database error.

New rows use `hrg_<list-token>_<request-token>`.

- `generalRequirementId(shopListId, clientRequestId)` runs each part through the existing `safeToken` helper, which lowercases and turns every non-alphanumeric character into a hyphen. The underscore between the list token and the request token is the only extra underscore.
- A legacy id is `hrg_<request-token>`. `safeToken` removes underscores, so a legacy id has exactly one underscore. It cannot equal a new id.
- No migration changes the primary key. Existing rows stay as stored. Migration 0019 was not added.
- A repeat in the same household still matches `client_request_id` on that open list and returns the existing line. The stored requirement id is not rewritten, including a legacy `hrg_<request>` row.
- The unique index on `(shop_list_id, client_request_id)` still makes one request id idempotent inside one list. A second household gets its own requirement id.
- Two overlapping commits of the same request id: one commit wins. The other reloads the list and, when that request id is already there, returns the same line. The response does not include SQL.

## Database errors

Every API path that used to copy `error.message` into `detail` now returns only a stable code. `stripDatabaseDetail` drops a `detail` or `message` that looks like SQL, a constraint failure, or a driver error. The server log is `{ event: "db_error", scope, kind }` with kind `unique`, `not_null`, `foreign_key`, `check`, `schema`, `database`, or `internal`. The log does not include the statement or bound values.

A duplicate `member_id` on create is `409 member_exists`. Other member insert failures stay `500 member_create_failed` with no database text. The same rule applies to invite join.

## A3 — Actionable client errors

`GET /api/health` still returns `client_errors_24h`, the raw count of `client_error` rows in the last 24 hours. It also returns `client_errors_24h_actionable` and `client_errors_24h_by_class`.

Classes are exclusive and sum to the raw count:

| Class | Rule |
|---|---|
| `expected_logged_out` | Stored message is `/api/sessions/me 401` or `/api/events 401` |
| `negative_path` | Otherwise, the household is synthetic (origin, acquisition source, or a `[synthetic]` display name) and the message is an API path with status 400–499 |
| `synthetic` | Otherwise synthetic, including a synthetic 5xx |
| `actionable` | Everything else |

No rows are deleted. There is no backfill column. Old rows are classified from the message they already have and a join to `household`. New reports store only a closed shape: a token surface, a token code, a message that is exactly an `/api/...` path plus a 3-digit status, and a path with no query string. Response bodies and free text are not stored. The household id comes from the session, not from the body.

A real logged-out session check stays in the raw count and out of the actionable count. A real 500 on a household that is not synthetic stays actionable.

## A4 — Origin and duplicate members

Creating a household whose display name starts with `[synthetic]` stamps `data_origin = synthetic` and `acquisition_source = synthetic_qa`, even when the client omits `data_origin` and sends `acquisition_source: organic`. That is the E2E onboarding path. A name that does not start with that marker is unchanged.

Member ids are still chosen the way onboarding chooses them. A second insert of the same id is a conflict, not a 500.

## A5 — No superseded_at backfill

`dinner_plan.superseded_at` stays as S-03 left it. Creating a plan still stamps `superseded_at` on that household’s other unfinished plans that are not already superseded. Completed plans are left alone. Historical rows that are still NULL are not updated. No migration in this change writes that column. The current-plan rule already ignores superseded plans and still treats a NULL historical row under the S-03 rule.

## Preview mock and development mode

Read on each request, in this order. Production stops at the first step.

1. `ENVIRONMENT` or `DEPLOY_ENV` of `production` ignores `GROCERY_FIXTURE`, `GROCERY_RUNTIME`, `GROCERY_MOCK_MODE`, `GROCERY_FETCH`, and `X-FlavorWeave-Grocery-Mode`. A key, if one were ever present, would use `https://connect.instacart.com`. Committed Production config keeps `GROCERY_PROVIDERS = ""`, so that path stays off.
2. On preview, test, development, dev, or e2e, the header `X-FlavorWeave-Grocery-Mode` may be `ok`, `timeout`, `provider-error` (and the other existing mock modes), or `dev`. The header cannot send a key, a host, or a provider id.
3. Otherwise the Pages secret `GROCERY_RUNTIME` (`mock`, `dev`, or `off`) is read from the request environment. Changing that secret does not require a code deploy.
4. Otherwise the existing fixture still selects mock, and a key with a known host selects live.

`dev` uses `https://connect.dev.instacart.tools` and `Authorization: Bearer` with the server `INSTACART_API_KEY`. If the key is missing, the mode is off with reason `dev_key_missing`. The mock is not reported as a successful live call.

A live development call, including the `dev` header, `GROCERY_RUNTIME=dev`, and key-plus-host auto-live, runs only when the session household has `data_origin = synthetic`. Any other household uses the mock when the fixture is set. Otherwise the call returns `403 dev_not_allowed` and does not use the network. Production does not consult this rule.

The UI channel is `mock`, `development`, or `consumer`. Development copy says the list can go to Instacart’s development API and that nothing is ordered. The Shop on Instacart control stays disabled, with the existing off treatment, until an official logo file is committed and `INSTACART_LOGO_PRESENT` is set in that same change.

## Development smoke

`POST /api/grocery/dev-smoke` exists only outside production. Production returns 404 and does not call the adapter. The caller must be a member of a synthetic household. The activation must be development, not mock. The handler sends one fixed line, banana, 1 each, `link_type` shopping_list. It does not read the household list and does not mark anything bought. The response includes HTTP status, a sanitized request id, and whether the URL is on the navigation allowlist. It does not include the key.

The operator script is `scripts/grocery/instacart-dev-smoke.mjs`. Without `--confirm-dev` it exits 2 and does not call. Without a key and without `--preview-url` it exits 2 and names `INSTACART_API_KEY` as the blocker. `--dry-run` prints the host and `Bearer` without the key. This change did not run the live path.

## What did not move

Instacart lifecycle stays **Documented**. `verified_capabilities` and `provider_tested_capabilities` stay empty. No logo was drawn. No terms were accepted. No Cloudflare or D1 remote command was run.
