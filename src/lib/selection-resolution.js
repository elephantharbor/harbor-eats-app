/**
 * Multi-person meal selection: plurality, taste tie-break, deterministic final tie.
 */

/**
 * @typedef {{ member_id: string, meal_option_id: string }} VoteRow
 * @typedef {{ meal_option_id: string, letter: string, household_score?: number }} OptionRow
 */

/**
 * @param {VoteRow[]} votes
 * @param {OptionRow[]} options — must include letter + optional household_score (Taste total)
 * @returns {{ winner: OptionRow|null, rule: string, tallies: Record<string, number> }}
 */
export function resolveMealSelection(votes, options) {
  const optById = new Map(options.map((o) => [o.meal_option_id, o]));
  /** @type {Record<string, number>} */
  const tallies = {};
  for (const v of votes) {
    if (!optById.has(v.meal_option_id)) continue;
    tallies[v.meal_option_id] = (tallies[v.meal_option_id] || 0) + 1;
  }

  const voteValues = Object.values(tallies);
  if (!voteValues.length) {
    return { winner: null, rule: "no_votes", tallies };
  }

  const maxVotes = Math.max(...voteValues);
  const leaders = Object.entries(tallies)
    .filter(([, c]) => c === maxVotes)
    .map(([id]) => optById.get(id))
    .filter(Boolean);

  if (leaders.length === 1) {
    return { winner: leaders[0], rule: "plurality", tallies };
  }

  leaders.sort((a, b) => (b.household_score ?? 0) - (a.household_score ?? 0));
  const topScore = leaders[0].household_score ?? 0;
  const scoreTied = leaders.filter((o) => (o.household_score ?? 0) === topScore);

  if (scoreTied.length === 1) {
    return { winner: scoreTied[0], rule: "taste_tiebreak", tallies };
  }

  scoreTied.sort((a, b) => String(a.letter).localeCompare(String(b.letter)));
  return { winner: scoreTied[0], rule: "letter_tiebreak", tallies };
}

/**
 * Active members who have not voted yet.
 * @param {string[]} activeMemberIds
 * @param {VoteRow[]} votes
 */
export function membersWithoutVote(activeMemberIds, votes) {
  const voted = new Set(votes.map((v) => v.member_id));
  return activeMemberIds.filter((id) => !voted.has(id));
}
