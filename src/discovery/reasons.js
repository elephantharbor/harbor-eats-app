/**
 * Ranking reason codes for a meal that survived the filters.
 * primary_reason is the first code in PRIMARY_REASON_PRIORITY that applies.
 */

import { PRIMARY_REASON_PRIORITY } from "./constants.js";

/**
 * @param {object} row pipeline row
 * @param {object} query normalized query
 */
export function reasonCodesFor(row, query) {
  /** @type {string[]} */
  const codes = [];
  const hits = row.taste_hits || [];
  if (hits.some((hit) => hit.rank === "love")) codes.push("taste_love");
  else if (hits.some((hit) => hit.rank === "like")) codes.push("taste_like");
  else if (hits.some((hit) => hit.rank === "less_often")) codes.push("taste_less_often");

  for (const code of row.matched_criteria || []) codes.push(code);
  if (query.text) codes.push("text_match");
  if (row.soft_keep_easy) codes.push("soft_keep_easy");
  if (row.soft_keep_simple) codes.push("soft_keep_simple");
  if (row.preference_relaxed) codes.push("soft_pref_relaxed");
  if (row.recent) codes.push("recent_demoted");
  if (row.diversity_preferred) codes.push("diversity_preferred");
  if (row.novelty_tiebreak) codes.push("novelty_tiebreak");
  if (!codes.length) codes.push("eligible_catalog_fit");

  const unique = [];
  for (const code of codes) {
    if (!unique.includes(code)) unique.push(code);
  }
  const primary = PRIMARY_REASON_PRIORITY.find((code) => unique.includes(code)) || "eligible_catalog_fit";
  return { reasons: unique, primary_reason: primary };
}
