# S-07 Goal B: Proposed aggregate queries (NOT RUN)

**Status.** NOT RUN, requires Oversight authorisation. These are proposals for Oversight to authorise later, read-only. **None of them has been run against Preview or Production.** I wrote them against the migrations at `origin/main` e57f464.
- I checked that each one parses and runs on an **empty in-memory SQLite** built from the repo migrations.
- I ran them again on a **local synthetic fixture**: one real-by-marker household, one name-synthetic (`E2E Kitchen`), one `acquisition_source='e2e'` and one `unproven`.
- On that fixture every query counted only the real-by-marker household. A mark-then-undo meal netted to zero, and the server's `generated` export row was excluded.
- No Production data was touched and no backup was read.

## Rules every query follows
- **Counts only.** No query returns `household_id`, `member_id`, a display name, item text, a recipe, dietary data or a rating value. The local check confirmed that no output column is an identity column.
- **Synthetic excluded.** The household must pass `sqlRealHousehold` (`src/lib/evidence-origin.js:129`): `data_origin='household'` and `acquisition_source` not in {synthetic_qa, qa, e2e, smoke, test}.
  - It must also not match a fixture name pattern from `scripts/cleanup-synthetic-households.mjs` (`SYNTHETIC_NAME`). The name is read only inside WHERE and never selected.
  - Each activity row must be `data_origin='household'`.
- **Unproven (legacy) excluded** through the same household predicate. Q0 shows how many were excluded.
- **Read-only.** SELECT only. Parameters are `?1` = window start and `?2` = window end (ISO 8601 UTC, end exclusive). Q0 and Q12 take no window.
- **Small numbers.** While very few real households exist, publish only the totals as returned. Do not slice further by date, household or member. A per-type split (Q9) is a total across all real households. Oversight decides whether to suppress any cell below a threshold.
- **Proposed run path, for Oversight to decide.** An operator runs one query at a time with `wrangler d1 execute <db> --remote --command "<SQL>"` after explicit authorisation and records only the returned counts. I did not run this and do not propose running it from an agent.
- **External stages are not queryable.** Consumer Import and Cart Review (funnel F2) have no query. Never infer them from Q9 or Q11.

## Common household filter (inlined as a CTE in each query)
```sql
real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
)
```

## Index
| ID | Purpose | Answers |
|---|---|---|
| Q0 | Population buckets (makes exclusions visible) | #1 context |
| Q1 | Active real-by-marker households in window | #1 |
| Q2 | Plans created | #2 |
| Q3 | Shopping started | #3 |
| Q3b | Shopping activity signals | #3 (supporting) |
| Q4 | Meals cooked (state, net of Undo) | #4 |
| Q5 | Meals cooked (events, netted) | #4 cross-check |
| Q6 | Meals with at least one countable rating | #5 |
| Q6b | Countable rating rows (Taste evidence volume) | #5 / Taste |
| Q7 | Meals with all diners rated (completed meal loops) | #6 |
| Q7b | Rated but not all diners | #5/#6 gap; Risk 5 watch |
| Q8 | We made this vs guided Finish (after instrumentation) | #7 |
| Q9 | Exports that succeeded, by type and surface | #8 |
| Q10 | Funnel F1: Plan → Shop → Cook → Rate (plan-level) | F1 |
| Q11 | Funnel F2: List → Export attempted → Export succeeded | F2 (known stages only) |
| Q12 | Cook evidence divergence (distortion detector) | Risk 5b watch |

## Q0: Population buckets (makes exclusions visible)
**Answers:** #1 context. **Window:** none (all time).
**Purpose:** Household counts per origin bucket, so every report shows how many synthetic and unproven households were excluded. No window, no ids.

```sql
SELECT bucket, COUNT(*) AS households FROM (
  SELECT CASE
    WHEN h.data_origin = 'synthetic'
      OR COALESCE(h.acquisition_source, '') IN ('synthetic_qa','qa','e2e','smoke','test')
      OR h.display_name LIKE '[synthetic]%' OR h.display_name LIKE 'D06 Eval Synthetic %'
      OR h.display_name LIKE 'D06 eval %' OR h.display_name LIKE 'D05 prod smoke %'
      OR h.display_name IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic') THEN 'synthetic'
    WHEN h.data_origin = 'unproven' THEN 'unproven_legacy'
    WHEN h.data_origin = 'household' THEN 'real_by_marker'
    ELSE 'other' END AS bucket
  FROM household h
) GROUP BY bucket;
```

## Q1: Active real-by-marker households in window
**Answers:** #1. **Window:** ?1 to ?2.
**Purpose:** Distinct real households with at least one household-origin event or dinner-plan write in [?1, ?2).

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
)
SELECT COUNT(DISTINCT hid) AS active_real_households FROM (
  SELECT e.household_id AS hid FROM event e JOIN real_h r ON r.household_id = e.household_id
  WHERE e.data_origin = 'household' AND e.created_at >= ?1 AND e.created_at < ?2
  UNION
  SELECT p.household_id FROM dinner_plan p JOIN real_h r ON r.household_id = p.household_id
  WHERE p.data_origin = 'household' AND p.updated_at >= ?1 AND p.updated_at < ?2
);
```

## Q2: Plans created
**Answers:** #2. **Window:** ?1 to ?2.
**Purpose:** Cycle 3 dinner plans created in window, households that created at least one, and how many were later superseded (drafts not kept).

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
)
SELECT COUNT(*) AS plans_created,
       COUNT(DISTINCT p.household_id) AS households_creating,
       SUM(CASE WHEN p.superseded_at IS NOT NULL THEN 1 ELSE 0 END) AS plans_superseded
FROM dinner_plan p JOIN real_h r ON r.household_id = p.household_id
WHERE p.data_origin = 'household' AND p.created_at >= ?1 AND p.created_at < ?2;
```

## Q3: Shopping started
**Answers:** #3. **Window:** ?1 to ?2.
**Purpose:** Plans whose shopping started in window (server-set shopping_started_at), and households.

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
)
SELECT COUNT(*) AS plans_shopping_started,
       COUNT(DISTINCT p.household_id) AS households_shopping
FROM dinner_plan p JOIN real_h r ON r.household_id = p.household_id
WHERE p.data_origin = 'household' AND p.shopping_started_at IS NOT NULL AND p.shopping_started_at >= ?1 AND p.shopping_started_at < ?2;
```

## Q3b: Shopping activity signals
**Answers:** #3 (supporting). **Window:** ?1 to ?2.
**Purpose:** Households with an item checked off, with an export attempt, and with an export success in window. Supporting signals, not the primary 'use' measure.

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
)
SELECT
  COUNT(DISTINCT CASE WHEN e.event_name = 'shopping_item_completed' THEN e.household_id END) AS households_item_completed,
  COUNT(DISTINCT CASE WHEN e.event_name = 'shop_export' AND json_extract(e.props_json, '$.stage') = 'attempted' THEN e.household_id END) AS households_export_attempted,
  COUNT(DISTINCT CASE WHEN e.event_name = 'shop_export' AND json_extract(e.props_json, '$.stage') = 'succeeded' THEN e.household_id END) AS households_export_succeeded
FROM event e JOIN real_h r ON r.household_id = e.household_id
WHERE e.data_origin = 'household' AND e.created_at >= ?1 AND e.created_at < ?2;
```

## Q4: Meals cooked (state, net of Undo)
**Answers:** #4. **Window:** ?1 to ?2.
**Purpose:** Recipe meals currently in a cooked state, on plans created in window. Undo already restored state. The meal has no cook timestamp, so the window is the plan's created_at.

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
)
SELECT COUNT(*) AS meals_cooked, COUNT(DISTINCT p.household_id) AS households_cooking
FROM dinner_plan_meal m
JOIN dinner_plan p ON p.dinner_plan_id = m.dinner_plan_id
JOIN real_h r ON r.household_id = p.household_id
WHERE m.kind = 'recipe' AND m.state IN ('cooked','partially_rated','fully_rated')
  AND p.data_origin = 'household' AND m.data_origin = 'household'
  AND p.created_at >= ?1 AND p.created_at < ?2;
```

## Q5: Meals cooked (events, netted)
**Answers:** #4 cross-check. **Window:** ?1 to ?2.
**Purpose:** cook_recorded minus cook_undone per meal, each meal counted once when net > 0 (same rule as funnelCookCompletionSql, across real households). Window on event time.

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
),
net AS (
  SELECT e.meal_option_id AS k, SUM(CASE WHEN e.event_name = 'cook_undone' THEN -1 ELSE 1 END) AS n
  FROM event e JOIN real_h r ON r.household_id = e.household_id
  WHERE e.event_name IN ('cook_recorded', 'cook_undone') AND e.data_origin = 'household'
    AND COALESCE(e.meal_option_id, '') <> '' AND e.created_at >= ?1 AND e.created_at < ?2
  GROUP BY e.meal_option_id
)
SELECT COUNT(*) AS meals_cooked_by_events FROM net WHERE n > 0;
```

## Q6: Meals with at least one countable rating
**Answers:** #5. **Window:** ?1 to ?2.
**Purpose:** Cooked recipe meals with at least one household-origin rating from an active participant. Taste-evidence meals.

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
)
SELECT COUNT(*) AS meals_with_rating, COUNT(DISTINCT p.household_id) AS households_rating
FROM dinner_plan_meal m
JOIN dinner_plan p ON p.dinner_plan_id = m.dinner_plan_id
JOIN real_h r ON r.household_id = p.household_id
WHERE m.kind = 'recipe' AND m.state IN ('cooked','partially_rated','fully_rated')
  AND p.data_origin = 'household' AND m.data_origin = 'household'
  AND p.created_at >= ?1 AND p.created_at < ?2
  AND EXISTS (
      SELECT 1 FROM dinner_plan_rating r
      JOIN dinner_plan_participant part ON part.meal_id = r.meal_id AND part.member_id = r.member_id AND part.active = 1
      WHERE r.meal_id = m.meal_id AND r.data_origin = 'household');
```

## Q6b: Countable rating rows (Taste evidence volume)
**Answers:** #5 / Taste. **Window:** ?1 to ?2.
**Purpose:** Number of per-diner rating rows that Taste may learn from. Counts only; never values.

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
)
SELECT COUNT(*) AS countable_ratings
FROM dinner_plan_rating rt
JOIN dinner_plan p ON p.dinner_plan_id = rt.dinner_plan_id
JOIN real_h r ON r.household_id = p.household_id
JOIN dinner_plan_participant part ON part.meal_id = rt.meal_id AND part.member_id = rt.member_id AND part.active = 1
WHERE rt.data_origin = 'household' AND p.data_origin = 'household' AND rt.created_at >= ?1 AND rt.created_at < ?2;
```

## Q7: Meals with all diners rated (completed meal loops)
**Answers:** #6. **Window:** ?1 to ?2.
**Purpose:** Same predicate as dinnerCompletedLoopSql (plan-contract.js:326), windowed on plan created_at.

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
)
SELECT COUNT(*) AS meals_fully_rated, COUNT(DISTINCT p.household_id) AS households_full_loop
FROM dinner_plan_meal m
JOIN dinner_plan p ON p.dinner_plan_id = m.dinner_plan_id
JOIN real_h r ON r.household_id = p.household_id
WHERE m.kind = 'recipe' AND m.state = 'fully_rated'
  AND p.data_origin = 'household' AND m.data_origin = 'household'
  AND p.created_at >= ?1 AND p.created_at < ?2
  AND (SELECT COUNT(*) FROM dinner_plan_participant part WHERE part.meal_id = m.meal_id AND part.active = 1) > 0
  AND (SELECT COUNT(*) FROM dinner_plan_participant part WHERE part.meal_id = m.meal_id AND part.active = 1) = (
    SELECT COUNT(*) FROM dinner_plan_rating rt
    WHERE rt.meal_id = m.meal_id AND rt.data_origin = 'household'
      AND rt.member_id IN (SELECT part.member_id FROM dinner_plan_participant part WHERE part.meal_id = m.meal_id AND part.active = 1));
```

## Q7b: Rated but not all diners
**Answers:** #5/#6 gap; Risk 5 watch. **Window:** ?1 to ?2.
**Purpose:** Cooked meals left partially_rated. A rise after multi-diner sessions is the only aggregate hint of Risk 5 today.

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
)
SELECT COUNT(*) AS meals_partially_rated
FROM dinner_plan_meal m
JOIN dinner_plan p ON p.dinner_plan_id = m.dinner_plan_id
JOIN real_h r ON r.household_id = p.household_id
WHERE m.kind = 'recipe' AND m.state = 'partially_rated'
  AND p.data_origin = 'household' AND m.data_origin = 'household' AND p.created_at >= ?1 AND p.created_at < ?2;
```

## Q8: We made this vs guided Finish (after instrumentation)
**Answers:** #7. **Window:** ?1 to ?2.
**Purpose:** Net-cooked meals split by completion_source of their latest cook_recorded. Rows from before the change are 'unknown'; never back-filled.

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
),
ev AS (
  SELECT e.meal_option_id AS k, e.event_name, e.created_at,
         json_extract(e.props_json, '$.completion_source') AS src
  FROM event e JOIN real_h r ON r.household_id = e.household_id
  WHERE e.event_name IN ('cook_recorded', 'cook_undone') AND e.data_origin = 'household'
    AND COALESCE(e.meal_option_id, '') <> '' AND e.created_at >= ?1 AND e.created_at < ?2
),
net AS (
  SELECT k, SUM(CASE WHEN event_name = 'cook_undone' THEN -1 ELSE 1 END) AS n,
         (SELECT e2.src FROM ev e2 WHERE e2.k = ev.k AND e2.event_name = 'cook_recorded'
          ORDER BY e2.created_at DESC LIMIT 1) AS last_src
  FROM ev GROUP BY k
)
SELECT CASE WHEN last_src IN ('mark_cooked', 'finish_cook') THEN last_src ELSE 'unknown' END AS completion_source,
       COUNT(*) AS meals
FROM net WHERE n > 0
GROUP BY 1;
```

## Q9: Exports that succeeded, by type and surface
**Answers:** #8. **Window:** ?1 to ?2.
**Purpose:** Completed exports per countCompletedShopExports rules (stage 'succeeded', or a legacy no-stage shop_sheet ok row). The server's 'generated' row is excluded. Totals across all real households only.

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
)
SELECT json_extract(e.props_json, '$.type') AS export_type,
       json_extract(e.props_json, '$.surface') AS surface,
       COUNT(*) AS exports_succeeded
FROM event e JOIN real_h r ON r.household_id = e.household_id
WHERE e.event_name = 'shop_export' AND e.data_origin = 'household' AND e.created_at >= ?1 AND e.created_at < ?2
  AND json_extract(e.props_json, '$.type') IN ('copy_app', 'image', 'copy', 'share', 'print', 'download')
  AND (
    json_extract(e.props_json, '$.stage') = 'succeeded'
    OR (json_extract(e.props_json, '$.stage') IS NULL
        AND json_extract(e.props_json, '$.surface') = 'shop_sheet'
        AND json_extract(e.props_json, '$.ok') IN (1, 'true'))
  )
GROUP BY 1, 2;
```

## Q10: Funnel F1: Plan → Shop → Cook → Rate (plan-level)
**Answers:** F1. **Window:** ?1 to ?2.
**Purpose:** For plans created in window: how many reached each stage. Stages are not strictly nested; cooking without shopping is valid.

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
),
pl AS (
  SELECT p.dinner_plan_id, p.household_id, p.shopping_started_at
  FROM dinner_plan p JOIN real_h r ON r.household_id = p.household_id
  WHERE p.data_origin = 'household' AND p.created_at >= ?1 AND p.created_at < ?2
),
st AS (
  SELECT pl.dinner_plan_id, pl.household_id,
    CASE WHEN pl.shopping_started_at IS NOT NULL THEN 1 ELSE 0 END AS shop,
    CASE WHEN EXISTS (SELECT 1 FROM dinner_plan_meal m WHERE m.dinner_plan_id = pl.dinner_plan_id
         AND m.kind = 'recipe' AND m.state IN ('cooked','partially_rated','fully_rated')) THEN 1 ELSE 0 END AS cook,
    CASE WHEN EXISTS (SELECT 1 FROM dinner_plan_meal m WHERE m.dinner_plan_id = pl.dinner_plan_id
         AND m.kind = 'recipe' AND m.state IN ('cooked','partially_rated','fully_rated') AND EXISTS (
      SELECT 1 FROM dinner_plan_rating r
      JOIN dinner_plan_participant part ON part.meal_id = r.meal_id AND part.member_id = r.member_id AND part.active = 1
      WHERE r.meal_id = m.meal_id AND r.data_origin = 'household')) THEN 1 ELSE 0 END AS rate_any,
    CASE WHEN EXISTS (SELECT 1 FROM dinner_plan_meal m WHERE m.dinner_plan_id = pl.dinner_plan_id
         AND m.kind = 'recipe' AND m.state = 'fully_rated') THEN 1 ELSE 0 END AS rate_all_state
  FROM pl
)
SELECT COUNT(*) AS plans,
       SUM(shop) AS plans_shopped,
       SUM(cook) AS plans_cooked,
       SUM(rate_any) AS plans_rated_any,
       SUM(rate_all_state) AS plans_rated_all,
       COUNT(DISTINCT household_id) AS households_planning,
       COUNT(DISTINCT CASE WHEN cook = 1 THEN household_id END) AS households_cooked,
       COUNT(DISTINCT CASE WHEN rate_any = 1 THEN household_id END) AS households_rated
FROM st;
```

## Q11: Funnel F2: List → Export attempted → Export succeeded
**Answers:** F2 (known stages only). **Window:** ?1 to ?2.
**Purpose:** Households with an open list that has lines, and with export attempts and successes in window. Consumer Import and Cart Review are UNKNOWN and have no query.

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
)
SELECT
  (SELECT COUNT(DISTINCT l.household_id) FROM household_shop_list l
     JOIN real_h r ON r.household_id = l.household_id
     WHERE l.status = 'open' AND EXISTS (SELECT 1 FROM household_shop_line ln WHERE ln.shop_list_id = l.shop_list_id)
  ) AS households_with_list,
  (SELECT COUNT(DISTINCT e.household_id) FROM event e JOIN real_h r ON r.household_id = e.household_id
     WHERE e.event_name = 'shop_export' AND e.data_origin = 'household' AND e.created_at >= ?1 AND e.created_at < ?2
       AND json_extract(e.props_json, '$.stage') = 'attempted') AS households_export_attempted,
  (SELECT COUNT(DISTINCT e.household_id) FROM event e JOIN real_h r ON r.household_id = e.household_id
     WHERE e.event_name = 'shop_export' AND e.data_origin = 'household' AND e.created_at >= ?1 AND e.created_at < ?2
       AND json_extract(e.props_json, '$.stage') = 'succeeded') AS households_export_succeeded;
```

## Q12: Cook evidence divergence (distortion detector)
**Answers:** Risk 5b watch. **Window:** none (all time).
**Purpose:** Meals where events and state disagree: net-cooked by events but not cooked in state (possible silent revert, Risk 5b), and cooked in state with no net event (telemetry loss). Counts only, all time.

```sql
WITH real_h AS (
  SELECT h.household_id FROM household h
  WHERE h.data_origin = 'household'
    AND COALESCE(h.acquisition_source, '') NOT IN ('synthetic_qa','qa','e2e','smoke','test')
    AND h.display_name NOT LIKE '[synthetic]%'
    AND h.display_name NOT LIKE 'D06 Eval Synthetic %'
    AND h.display_name NOT LIKE 'D06 eval %'
    AND h.display_name NOT LIKE 'D05 prod smoke %'
    AND h.display_name NOT IN ('E2E Kitchen', 'D06 Prod Smoke Synthetic')
),
net AS (
  SELECT e.meal_option_id AS k, SUM(CASE WHEN e.event_name = 'cook_undone' THEN -1 ELSE 1 END) AS n
  FROM event e JOIN real_h r ON r.household_id = e.household_id
  WHERE e.event_name IN ('cook_recorded', 'cook_undone') AND e.data_origin = 'household'
    AND COALESCE(e.meal_option_id, '') <> ''
  GROUP BY e.meal_option_id
),
cooked AS (
  SELECT m.meal_id FROM dinner_plan_meal m
  JOIN dinner_plan p ON p.dinner_plan_id = m.dinner_plan_id
  JOIN real_h r ON r.household_id = p.household_id
  WHERE m.kind = 'recipe' AND m.state IN ('cooked','partially_rated','fully_rated') AND p.data_origin = 'household'
)
SELECT
  (SELECT COUNT(*) FROM net WHERE n > 0
     AND k IN (SELECT meal_id FROM dinner_plan_meal)
     AND k NOT IN (SELECT meal_id FROM cooked)) AS event_cooked_state_not,
  (SELECT COUNT(*) FROM cooked c WHERE NOT EXISTS (SELECT 1 FROM net WHERE net.k = c.meal_id AND net.n > 0)) AS state_cooked_no_event;
```

## Caveats to print next to every result
- **Q4, Q6, Q7, Q7b and Q10** window on the plan's `created_at`, because a meal has no cook timestamp: `saveDinnerPlan` rewrites the meal's `created_at`/`updated_at` on every save (`src/lib/dinner-plan-store.js:337–364`).
- **Q5, Q8, Q9, Q3b and Q11** depend on client-sent events, which fail silently (`public/app.js:496–520`). Treat them as lower bounds.
- **Q6, Q6b and Q7** are lower bounds until Risk 5 (concurrent rating loss) is fixed. **Q4** can be lower than what households actually did, because of Risk 5b. **Q12** measures that gap.
- **Q8** reports `unknown` for every meal cooked before the completion-source instrumentation ships. Those rows must not be back-filled or guessed.
- **Q1** "real" means real by marker. It is not human-confirmed (OUTCOME-MEASUREMENT.md §1.3).
- The existing `/api/ops/alpha-metrics` and `/api/health?metrics=alpha` (`src/index.js:2496`, `:206`) use `alphaOpsQueries`. That reads the **legacy** `plan`/`cook`/`rating` tables and does not measure Cycle 3. Do not compare those numbers with these.
