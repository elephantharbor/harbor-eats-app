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
  const participating = Math.max(1, activeCount);

  let lifecycle = "Unselected";
  if (plan && plan.status) {
    lifecycle = plan.status === "Generated" ? "Unselected" : plan.status;
  }
  if (selection && !cook) lifecycle = "Selected";
  if (cook && ratedCount < participating) lifecycle = "Cooked";
  // A later inspect used to rewrite plan.status to Selected. Cook + full ratings still mean Rated.
  if ((cook && ratedCount >= participating) || (plan && plan.status === "Rated")) {
    lifecycle = "Rated";
  }

  let rating_state = "none";
  if (cook && ratedCount === 0) rating_state = "awaiting";
  else if (cook && ratedCount > 0 && ratedCount < participating) rating_state = "partial";
  else if (ratedCount >= participating && cook) rating_state = "full";

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
  } else if (ratedCount < participating) {
    next_action = "rate_meal";
    next_view = "rate";
  } else if (lifecycle === "Rated" || rating_state === "full") {
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
    rating_state,
    cml_complete: rating_state === "full" && !!cook,
  };
}
