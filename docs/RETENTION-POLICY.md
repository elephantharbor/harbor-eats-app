# Synthetic household retention policy (D-06.1 §26–27)

**Script:** `scripts/cleanup-synthetic-households.mjs`. It does a dry run unless you pass `--apply`. Run it from the repo root.

## Marker (required for every fixture that creates a household)
- Set `data_origin: "synthetic"` on the household and on its members.
- Start `display_name` with `[synthetic] <suite> <runId>`, for example `[synthetic] d06-eval clear k3x9`.
- Legacy patterns are still recognised but deprecated: `D06 Eval Synthetic *`, `D06 eval *`, `D06 Prod Smoke Synthetic`, `D05 prod smoke <date>` and `E2E Kitchen`.
- Fixtures must never put a nonce or run id in content a model or user sees, such as meal reasons, prompts or acks. Cache-busting values go in a field the prompt excludes.

## Retention
| env | what | when | how |
|---|---|---|---|
| preview | eval households (`--marker d06-eval` or `--marker synthetic-prefix`) | delete at the end of each release cycle, or anything older than 7 days | `node scripts/cleanup-synthetic-households.mjs --env preview --marker synthetic-prefix --older-than-days 7 [--apply]` |
| preview | E2E suite fixtures | covered once the E2E helpers adopt the prefix; until then they stay untouched | n/a |
| production | smoke households | delete in the same release, right after the prod smoke (a release-checklist step) | `--env production --ids <exact ids> --apply --i-understand-production` |

## Guards
- **Production:** you must pass exact `--ids` (markers are refused) and `--i-understand-production`. Before the delete, take a backup: `wrangler d1 time-travel info <db>` for the bookmark, plus `wrangler d1 export`.
- **Protected ids** are always refused: `hh_3884c16f6606` (HH001, Tom & Renata). Add more with `CLEANUP_PROTECTED_IDS`.
- **Synthetic check:** every target must be `data_origin='synthetic'` or match a known synthetic name. If any target fails, the whole run aborts.
- **Cross-household references:** if another household references a target, the run aborts.
- **Atomic delete:** all deletes go in one file, ordered children first. After that, an orphan check runs (44 checks), and the script exits 1 if any orphans are found.
- **Kept:** `ai_usage` rows (spend audit; no FK). Pass `--delete-ai-usage` to drop them.
- **Deleted:** `ai_limit_counters` rows for the targets' household keys. The global and spend counters are never touched.

## Delete order
1. dinner_shop_line, dinner_shop_delta
2. dinner_plan_participant, dinner_plan_rating, dinner_plan_vote
3. dinner_plan_meal
4. dinner_plan
5. selection, cook, rating, meal_vote, shopped_plan_line, share_choice
6. meal_option
7. plan
8. invite, recovery_token, member_session, constraint_rule, diner_taste, diner_practical_hint, preference_evidence, targeted_feedback, recipe_package_version, recipe
9. event, client_error
10. member (clear `inviter_member_id` first)
11. household
12. ai_limit_counters (by household key)

## Restore
Restore with `wrangler d1 time-travel restore <db> --bookmark <bookmark>`. This rolls back the whole database, so use it only for a bad cleanup.
