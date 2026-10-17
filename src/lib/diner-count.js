/**
 * Authoritative diner count for a planned dinner: eligible participants + guest covers.
 */

export const MIN_DINER_COUNT = 1;
export const MAX_DINER_COUNT = 8;
export const MAX_GUEST_COUNT = 6;

/**
 * @param {{ participant_ids?: string[], guest_count?: number }} meal
 */
export function guestCountForMeal(meal) {
  const g = Number(meal?.guest_count);
  if (!Number.isFinite(g) || g < 0) return 0;
  return Math.min(MAX_GUEST_COUNT, Math.floor(g));
}

/**
 * @param {{ participant_ids?: string[], guest_count?: number }} meal
 */
export function dinerCountForMeal(meal) {
  const participants = (meal?.participant_ids || []).length;
  const guests = guestCountForMeal(meal);
  const total = participants + guests;
  if (total < MIN_DINER_COUNT) return 0;
  return Math.min(MAX_DINER_COUNT, total);
}

/**
 * Shopping header. The household count is the quiet default. Up to two
 * dinners that differ are named; more than that collapses to one line.
 * @param {{ mealCount: number, householdCount: number, exceptions?: { label: string, count: number }[] }} input
 */
export function shopCookingHeadline({ mealCount, householdCount, exceptions = [] }) {
  const dinners = Number(mealCount) === 1 ? "dinner" : "dinners";
  const base = `${mealCount} ${dinners} · cooking for ${householdCount}`;
  if (!exceptions.length) return base;
  if (exceptions.length > 2) return `${base} · amounts match each dinner`;
  return base + exceptions.map((row) => `, ${row.label} for ${row.count}`).join("");
}

/**
 * Plan-card exception copy. Null when the dinner matches the household.
 * Names the one person who is out. Never names a limit.
 * @param {{
 *   householdCount: number,
 *   dinerCount: number,
 *   guestCount?: number,
 *   eatingNames?: string[],
 *   absentNames?: string[],
 * }} input
 */
export function dinerExceptionCopy({
  householdCount,
  dinerCount,
  guestCount = 0,
  eatingNames = [],
  absentNames = [],
}) {
  if (dinerCount === householdCount) return null;
  const guests = Math.max(0, Number(guestCount) || 0);
  if (guests > 0) {
    return `For ${dinerCount} · ${guests} ${guests === 1 ? "guest" : "guests"}`;
  }
  if (eatingNames.length === 1 && dinerCount === 1) return `For 1 · just ${eatingNames[0]}`;
  if (absentNames.length === 1) return `For ${dinerCount} · ${absentNames[0]}’s out`;
  return `For ${dinerCount}`;
}

export function assertDinerCountValid(participantCount, guestCount = 0) {
  const guests = Math.min(MAX_GUEST_COUNT, Math.max(0, Math.floor(Number(guestCount) || 0)));
  const participants = Math.max(0, Math.floor(Number(participantCount) || 0));
  if (participants < 1) return { ok: false, error: "participant_required", status: 400 };
  const total = participants + guests;
  if (total < MIN_DINER_COUNT || total > MAX_DINER_COUNT) {
    return { ok: false, error: "diner_count_invalid", status: 400 };
  }
  return { ok: true, guest_count: guests, diner_count: total };
}
