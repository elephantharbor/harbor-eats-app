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
 * @param {number} guestCount
 * @param {number} participantCount
 */
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
