/**
 * Derive client lifecycle + next screen from D1 plan activity.
 */

/**
 * @param {{
 *   plan?: { plan_id?: string, status?: string }|null,
 *   selection?: { meal_option_id?: string }|null,
 *   cook?: object|null,
 *   ratings?: { member_id: string, score: number }[],
 *   active_member_count?: number,
 *   onboarded?: boolean,
 * }} input
 */
export function deriveHouseholdState(input) {
  const plan = input.plan || null;
  const selection = input.selection || null;
  const cook = input.cook || null;
  const ratings = input.ratings || [];
  const activeCount = input.active_member_count ?? 0;
  const ratedCount = ratings.filter((r) => r.score != null).length;

  let lifecycle = "Unselected";
  if (plan && plan.status) {
    lifecycle = plan.status === "Generated" ? "Unselected" : plan.status;
  }
  if (selection && !cook) lifecycle = "Selected";
  if (cook && ratedCount < Math.max(1, activeCount)) lifecycle = "Cooked";
  if (plan && plan.status === "Rated") lifecycle = "Rated";

  let next_action = "home";
  let next_view = "home";
  if (!input.onboarded) {
    next_action = "onboarding";
    next_view = "create";
  } else if (!plan) {
    next_action = "start_choices";
    next_view = "choices";
  } else if (!selection) {
    next_action = "pick_meal";
    next_view = "choices";
  } else if (!cook) {
    next_action = "cook_meal";
    next_view = "detail";
  } else if (ratedCount < Math.max(1, activeCount)) {
    next_action = "rate_meal";
    next_view = "rate";
  } else if (lifecycle === "Rated") {
    next_action = "loop_complete";
    next_view = "home";
  } else {
    next_action = "home";
    next_view = "home";
  }

  return {
    lifecycle,
    next_action,
    next_view,
    plan_id: plan && plan.plan_id,
    selected_meal_option_id: selection && selection.meal_option_id,
    rated_count: ratedCount,
    active_member_count: activeCount,
  };
}
