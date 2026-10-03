/**
 * Separate real household learning from synthetic / campaign QA activity.
 *
 * A row or household counts as real only when it is explicitly household-origin.
 * Synthetic writes stay in D1 for audit but are omitted from HH taste evidence,
 * Completed Meal Loop counts, funnel traction, and alpha ops totals.
 */

export const REAL_ORIGIN = "household";
export const SYNTHETIC_ORIGIN = "synthetic";

/** acquisition_source values that mark an entire household as non-HH001 QA. */
export const SYNTHETIC_ACQUISITION_SOURCES = [
  "synthetic_qa",
  "qa",
  "e2e",
  "smoke",
  "test",
];

const SYNTHETIC_ACQUISITION = new Set(SYNTHETIC_ACQUISITION_SOURCES);

export function normalizeOrigin(value) {
  return value === SYNTHETIC_ORIGIN ? SYNTHETIC_ORIGIN : REAL_ORIGIN;
}

/**
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
 * Synthetic households contribute nothing to shared learning either —
 * their rows never feed another household, and callers that aggregate
 * across households must use `countsTowardOps` instead.
 * @template T
 * @param {T[]|null|undefined} rows
 * @param {{ data_origin?: string, acquisition_source?: string|null }|null} household
 * @returns {T[]}
 */
export function learningRows(rows, household) {
  if (householdIsSynthetic(household)) return [];
  return (rows || []).filter((row) => row && row.data_origin !== SYNTHETIC_ORIGIN);
}

/**
 * Product UI for the household that owns the rows.
 * Real households hide synthetic campaign rows. A synthetic household can
 * still see its own session so QA can exercise the loop without writing
 * into Household 001's learning set.
 * @template T
 * @param {T[]|null|undefined} rows
 * @param {{ data_origin?: string, acquisition_source?: string|null }|null} household
 */
export function productRows(rows, household) {
  if (householdIsSynthetic(household)) return rows || [];
  return (rows || []).filter((row) => row && row.data_origin !== SYNTHETIC_ORIGIN);
}

export function countsTowardOps(household, row) {
  if (householdIsSynthetic(household)) return false;
  if (row && row.data_origin === SYNTHETIC_ORIGIN) return false;
  return true;
}

const ACQUISITION_SQL = SYNTHETIC_ACQUISITION_SOURCES.map((s) => `'${s}'`).join(", ");

/** SQL predicate. `alias` is a household table alias. */
export function sqlRealHousehold(alias = "h") {
  return `${alias}.data_origin = 'household' AND COALESCE(${alias}.acquisition_source, '') NOT IN (${ACQUISITION_SQL})`;
}

/** SQL predicate for an activity row that must not be synthetic. */
export function sqlRealRow(alias) {
  return `${alias}.data_origin = 'household'`;
}
