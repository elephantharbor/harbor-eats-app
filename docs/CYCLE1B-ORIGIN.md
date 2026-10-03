# Cycle 1B — legacy evidence origin

Migration: `migrations/0009_evidence_origin_unproven.sql`.

This change does not deploy, does not merge to `main`, and does not read or write production D1 or Household 001. D-01 through D-06 stay unimplemented.

## Problem

`migrations/0008_evidence_origin.sql` adds `data_origin` with `DEFAULT 'household'` and a check that allows only `household` or `synthetic`. SQLite writes that default onto every existing row at the moment the column is added.

Those rows were not stamped by a writer. Untagged October 1 production rows and real Household 001 rows would look identical to an explicit household stamp. Taste learning, the Completed Meal Loop, funnel, traction, and alpha ops all treat `data_origin = 'household'` as real. The default would silently contaminate them.

Known synthetic QA rows also exist in legacy data. Marking every existing row synthetic would hide real household evidence and destroy the audit trail. Leaving the 0008 default in place would do the opposite.

The rule for this cycle: legacy evidence whose origin cannot be proven must not automatically become real household evidence.

## Chosen solution

0008 stays as it is. It already ran on the disposable preview database `harbor-eats-cycle1-preview`. D1 records a migration by filename, so editing 0008 would not re-run there, and a fresh database would diverge from that preview. 0009 is the forward fix. It runs after 0008 on every database, including a preview that already has 0008.

0009 rebuilds the tables that carry the check (stash, drop children, recreate, restore). Foreign keys stay on. The allowed values become `household`, `synthetic`, and `unproven`. The column default becomes `unproven`, so an insert that omits the column does not count.

Classification of rows that already exist when 0009 runs:

- A row already stored as `synthetic` stays `synthetic`.
- A household whose `acquisition_source` is `synthetic_qa`, `qa`, `e2e`, `smoke`, or `test` becomes `synthetic`. Activity for that household becomes `synthetic` too.
- Every other `household` value becomes `unproven`.

Nothing is deleted. `unproven` is not synthetic. It is kept for audit and excluded from taste learning, Completed Meal Loop counts, funnel, traction, and alpha ops. Only an explicit `household` stamp counts.

Live writers set `data_origin` themselves. A synthetic request header or body, or a household already known to be synthetic, stamps `synthetic`. Any other live request stamps `household`. That stamp is the writer's choice, not the column default.

An explicit `household` value written after 0008 and before 0009 cannot be told apart from the 0008 default, so 0009 quarantines it too. On the disposable preview, replay migrations `0001` through `0009` from an empty database before further QA. Do not point that rebuild at production. This change does not run it.

## Future production behavior

Production D1 does not have 0008 or 0009. When a later release is authorized to migrate production, apply **0008 and then 0009 in the same maintenance step**, before the new application code serves traffic. Do not stop between the two files. The intermediate 0008 default must not be read by the app.

After that step:

**Untagged October 1 rows.** Ordinary rows with no synthetic acquisition source and no explicit `synthetic` stamp are stored as `unproven`. They remain in D1. They do not train taste. They do not count as a completed meal loop. They do not count in the household funnel, in traction events (`household_created`, `onboarding_completed`, `invite_sent`, `invite_accepted`, `plan_generated`, `loop_completed`), or in alpha ops. They are not relabeled synthetic. They stay out of that household's product history until a reviewed stamp says otherwise.

**Known synthetic rows.** A household with `acquisition_source` of `synthetic_qa`, `qa`, `e2e`, `smoke`, or `test` is stored as `synthetic`, and so is its activity. A row that was already `synthetic` stays `synthetic`. Those rows stay excluded from taste, the meal loop, funnel, traction, and alpha ops.

**Real Household 001 rows.** This repository does not contain the production household id. HH001 is a diet profile, not a hardcoded id, and October 1 rows cannot be picked out from here. 0009 therefore stores those rows as `unproven` as well. They are not deleted and they are not marked synthetic. They do not count until a person identifies the household and runs the stamp below.

New meals after the release are explicit writer stamps. A live household request stores `household` on the new plan, cook, rating, and event. Those new rows count in that household's taste learning and funnel immediately. Alpha ops totals also require the household row itself to be `household`, so the household is absent from those cross-household totals until the stamp below. October history stays hidden until the same stamp.

The stamp is not part of 0009. Run it only after a human review, and only for the identified id. Before running it, mark any known QA rows inside that household as `synthetic`. The stamp does not touch synthetic rows, and it does not touch any other household.

```sql
UPDATE household
SET data_origin = 'household', updated_at = :reviewed_at
WHERE household_id = :household_id
  AND data_origin = 'unproven'
  AND COALESCE(acquisition_source, '') NOT IN ('synthetic_qa', 'qa', 'e2e', 'smoke', 'test');

UPDATE plan SET data_origin = 'household'
WHERE household_id = :household_id AND data_origin = 'unproven';

UPDATE selection SET data_origin = 'household'
WHERE household_id = :household_id AND data_origin = 'unproven';

UPDATE cook SET data_origin = 'household'
WHERE household_id = :household_id AND data_origin = 'unproven';

UPDATE rating SET data_origin = 'household'
WHERE household_id = :household_id AND data_origin = 'unproven';

UPDATE preference_evidence SET data_origin = 'household'
WHERE household_id = :household_id AND data_origin = 'unproven';

UPDATE event SET data_origin = 'household'
WHERE household_id = :household_id AND data_origin = 'unproven';

UPDATE meal_vote SET data_origin = 'household'
WHERE household_id = :household_id AND data_origin = 'unproven';
```

`:household_id` and `:reviewed_at` are filled by the operator at release time. Do not guess them from this repository.

## Household 001 cashews

Not a blocker. Do not write production Household 001 from this change.

The product can represent "No nuts" plus "Cashews are OK". The client key `cashew_ok` is stored as a permitted `cashew` row. It only relaxes that diner's own `nuts` prohibition, and only for the cashew tag. Without the `nuts` prohibition, the client drops the exception. No other nut is permitted. Fish stays allowed: do not insert a fish prohibition.

The same list the app already uses for this diet is:

`dairy`, `meat`, `poultry`, `shellfish`, `nuts`, `cashew_ok`

which is stored as:

| rule_key | status |
|----------|--------|
| dairy | prohibited |
| meat | prohibited |
| poultry | prohibited |
| shellfish | prohibited |
| nuts | prohibited |
| cashew | permitted |

When the production release is authorized, apply that set for each Household 001 diner. Replace the diner's rules so an older nuts row cannot stay prohibited without the cashew permission, and so no other nut is permitted. Use the household id and member id identified out of band.

```sql
INSERT INTO constraint_rule (
  constraint_id, household_id, member_id, rule_key, status,
  includes_json, note, created_at, updated_at
) VALUES
  (:id_dairy, :household_id, :member_id, 'dairy', 'prohibited', NULL, 'HH001 diet', :ts, :ts),
  (:id_meat, :household_id, :member_id, 'meat', 'prohibited', NULL, 'HH001 diet', :ts, :ts),
  (:id_poultry, :household_id, :member_id, 'poultry', 'prohibited', NULL, 'HH001 diet', :ts, :ts),
  (:id_shellfish, :household_id, :member_id, 'shellfish', 'prohibited', NULL, 'HH001 diet', :ts, :ts),
  (:id_nuts, :household_id, :member_id, 'nuts', 'prohibited', NULL, 'HH001 diet', :ts, :ts),
  (:id_cashew, :household_id, :member_id, 'cashew', 'permitted', NULL, 'HH001 cashews are OK', :ts, :ts)
ON CONFLICT(household_id, member_id, rule_key) DO UPDATE SET
  status = excluded.status,
  note = excluded.note,
  updated_at = excluded.updated_at;
```

Do not insert `peanut`, `walnut`, `almond`, or any other nut as `permitted`. The `nuts` prohibition continues to block them. `cashew` is the only permitted exception.
