/**
 * Separate real household learning from synthetic QA and from legacy rows
 * whose origin was never proven.
 *
 * A row counts as real household evidence only when data_origin is exactly
 * 'household'. 'synthetic' stays in D1 for audit and is excluded.
 * 'unproven' (and any missing or unknown value) also stays in D1 and is
 * excluded from taste learning, Completed Meal Loop counts, funnel, traction,
 * and alpha ops. It is not relabeled synthetic.
 *
 * Live writers stamp 'household' or 'synthetic' themselves. The column
 * default after 0009 is 'unproven', so an omitted stamp cannot contaminate
 * those totals.
 */

export const REAL_ORIGIN = "household";
export const SYNTHETIC_ORIGIN = "synthetic";
export const UNPROVEN_ORIGIN = "unproven";

/** acquisition_source values that mark an entire household as non-HH001 QA. */
export const SYNTHETIC_ACQUISITION_SOURCES = [
  "synthetic_qa",
  "qa",
  "e2e",
  "smoke",
  "test",
];

/**
 * Funnel events that describe adoption. They use the same household-only
 * predicate as the rest of the funnel.
 */
export const TRACTION_EVENT_NAMES = [
  "household_created",
  "onboarding_completed",
  "invite_sent",
  "invite_accepted",
  "plan_generated",
  "loop_completed",
];

const SYNTHETIC_ACQUISITION = new Set(SYNTHETIC_ACQUISITION_SOURCES);

const ACQUISITION_SQL = SYNTHETIC_ACQUISITION_SOURCES.map((s) => `'${s}'`).join(", ");

export function isExplicitHouseholdOrigin(value) {
  return value === REAL_ORIGIN;
}

/**
 * Read-path normalization. Unknown values stay unproven.
 * Writers that mean "this live request is a real household" must pass
 * REAL_ORIGIN themselves (see originFromRequest). Do not use this to fill
 * a missing stamp on the way into taste or metrics.
 */
export function normalizeOrigin(value) {
  if (value === SYNTHETIC_ORIGIN) return SYNTHETIC_ORIGIN;
  if (value === REAL_ORIGIN) return REAL_ORIGIN;
  return UNPROVEN_ORIGIN;
}

/**
 * Explicit stamp for a live HTTP write.
 * A synthetic header or body is synthetic. Anything else on this request
 * is an explicit household stamp, not a legacy default.
 * @param {{ headers?: { get?: (name: string) => string|null } }|null} request
 * @param {{ data_origin?: string }|null} body
 */
export function originFromRequest(request, body) {
  const header =
    request?.headers?.get?.("x-flavorweave-data-origin") ||
    request?.headers?.get?.("X-FlavorWeave-Data-Origin") ||
    "";
  if (String(header).toLowerCase() === SYNTHETIC_ORIGIN) return SYNTHETIC_ORIGIN;
  if (body && body.data_origin === SYNTHETIC_ORIGIN) return SYNTHETIC_ORIGIN;
  return REAL_ORIGIN;
}

/**
 * @param {{ data_origin?: string, acquisition_source?: string|null }|null} household
 */
export function householdIsSynthetic(household) {
  if (!household) return false;
  if (household.data_origin === SYNTHETIC_ORIGIN) return true;
  const src = String(household.acquisition_source || "");
  return SYNTHETIC_ACQUISITION.has(src);
}

/**
 * Learning inputs (ratings, cooks, evidence) for a real household.
 * Synthetic households contribute nothing. Unproven and unknown rows
 * contribute nothing. Only an explicit household stamp counts.
 * @template T
 * @param {T[]|null|undefined} rows
 * @param {{ data_origin?: string, acquisition_source?: string|null }|null} household
 * @returns {T[]}
 */
export function learningRows(rows, household) {
  if (householdIsSynthetic(household)) return [];
  return (rows || []).filter((row) => row && isExplicitHouseholdOrigin(row.data_origin));
}

/**
 * Product UI for the household that owns the rows.
 * Real households see only explicit household rows, so unproven legacy
 * meals stay out of history until a reviewed stamp. A synthetic household
 * can still see its own session.
 * @template T
 * @param {T[]|null|undefined} rows
 * @param {{ data_origin?: string, acquisition_source?: string|null }|null} household
 */
export function productRows(rows, household) {
  if (householdIsSynthetic(household)) return rows || [];
  return (rows || []).filter((row) => row && isExplicitHouseholdOrigin(row.data_origin));
}

/**
 * Alpha ops, funnel, traction, and completed-meal-loop inclusion.
 * Both the household and the activity row must be explicit household,
 * and the household must not be a known QA acquisition source.
 */
export function countsTowardOps(household, row) {
  if (householdIsSynthetic(household)) return false;
  if (!row || !isExplicitHouseholdOrigin(row.data_origin)) return false;
  return true;
}

/** SQL predicate. `alias` is a household table alias. */
export function sqlRealHousehold(alias = "h") {
  return `${alias}.data_origin = 'household' AND COALESCE(${alias}.acquisition_source, '') NOT IN (${ACQUISITION_SQL})`;
}

/** SQL predicate for an activity row that must be an explicit household stamp. */
export function sqlRealRow(alias) {
  return `${alias}.data_origin = 'household'`;
}

/** Per-household funnel event count. Unproven and synthetic rows are excluded. */
export function funnelEventCountSql() {
  return `SELECT COUNT(*) AS c FROM event WHERE household_id = ? AND event_name = ? AND ${sqlRealRow("event")}`;
}

/** Per-household completed meal loops. Only explicit household plans count. */
export function completedMealLoopSql() {
  return `SELECT COUNT(*) AS c FROM plan WHERE household_id = ? AND status = 'Rated' AND ${sqlRealRow("plan")}`;
}

/**
 * Cross-household alpha ops totals. A household row and each activity row
 * must be explicit household. Known synthetic acquisition sources are out.
 */
export function alphaOpsQueries() {
  const hh = sqlRealHousehold("h");
  return {
    households: `SELECT COUNT(*) AS c FROM household h WHERE ${hh}`,
    active_members: `SELECT COUNT(*) AS c FROM member m
       JOIN household h ON h.household_id = m.household_id
       WHERE m.status = 'active' AND ${hh}`,
    plans: `SELECT COUNT(*) AS c FROM plan p
       JOIN household h ON h.household_id = p.household_id
       WHERE ${sqlRealRow("p")} AND ${hh}`,
    selections: `SELECT COUNT(*) AS c FROM selection s
       JOIN household h ON h.household_id = s.household_id
       WHERE ${sqlRealRow("s")} AND ${hh}`,
    cooks: `SELECT COUNT(*) AS c FROM cook c
       JOIN household h ON h.household_id = c.household_id
       WHERE ${sqlRealRow("c")} AND ${hh}`,
    ratings: `SELECT COUNT(*) AS c FROM rating r
       JOIN household h ON h.household_id = r.household_id
       WHERE ${sqlRealRow("r")} AND ${hh}`,
    completed_meal_loops: `SELECT COUNT(*) AS c FROM plan p
       JOIN household h ON h.household_id = p.household_id
       WHERE p.status = 'Rated' AND ${sqlRealRow("p")} AND ${hh}`,
    invites_sent: `SELECT COUNT(*) AS c FROM event e
       JOIN household h ON h.household_id = e.household_id
       WHERE e.event_name = 'invite_sent' AND ${sqlRealRow("e")} AND ${hh}`,
    invites_accepted: `SELECT COUNT(*) AS c FROM event e
       JOIN household h ON h.household_id = e.household_id
       WHERE e.event_name = 'invite_accepted' AND ${sqlRealRow("e")} AND ${hh}`,
    plan_generated: `SELECT COUNT(*) AS c FROM event e
       JOIN household h ON h.household_id = e.household_id
       WHERE e.event_name = 'plan_generated' AND ${sqlRealRow("e")} AND ${hh}`,
    recommendation_failures: `SELECT COUNT(*) AS c FROM event e
       JOIN household h ON h.household_id = e.household_id
       WHERE e.event_name = 'recommendation_failed' AND ${sqlRealRow("e")} AND ${hh}`,
  };
}

/**
 * Statements for the later, human-reviewed production stamp.
 * Not run by migration 0009. The operator substitutes the identified
 * Household 001 id. Rows already synthetic are left alone.
 * @param {string} table
 */
export function reviewedHouseholdStampSql(table) {
  const allowed = new Set([
    "household",
    "plan",
    "selection",
    "cook",
    "rating",
    "preference_evidence",
    "event",
    "meal_vote",
  ]);
  if (!allowed.has(table)) {
    throw new Error(`refusing stamp for table ${table}`);
  }
  if (table === "household") {
    return `UPDATE household
SET data_origin = 'household', updated_at = ?
WHERE household_id = ?
  AND data_origin = 'unproven'
  AND COALESCE(acquisition_source, '') NOT IN (${ACQUISITION_SQL})`;
  }
  return `UPDATE ${table}
SET data_origin = 'household'
WHERE household_id = ?
  AND data_origin = 'unproven'`;
}
