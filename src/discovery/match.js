/**
 * Stage 3. Literal token match. Not an interpretation and not a model.
 * Every query token must hit. An empty query matches the whole set.
 */

const TOKEN_RE = /[a-z0-9]+/g;

export function tokenize(value) {
  return String(value || "").toLowerCase().match(TOKEN_RE) || [];
}

function mealTokens(meal) {
  const parts = [
    meal.title,
    meal.cuisine,
    meal.meal_format,
    meal.primary_ingredient,
    meal.flavor_profile,
    ...(meal.vocabulary_tag_ids || []),
    ...(meal.ingredient_names || []),
    ...(meal.ingredient_ids || []),
    ...(meal.methods || []),
    ...(meal.equipment || []),
  ];
  return tokenize(parts.join(" "));
}

/**
 * A query token of 3+ characters may be a prefix ("taco" → "tacos").
 * Two-character tokens have to match a whole meal token.
 * @param {string} queryToken
 * @param {string[]} tokens
 */
function tokenHits(queryToken, tokens) {
  for (const token of tokens) {
    if (token === queryToken) return true;
    if (queryToken.length >= 3 && token.startsWith(queryToken)) return true;
  }
  return false;
}

/**
 * @param {object} meal
 * @param {string|null} text normalized query text
 * @returns {{ match: boolean, score: number }}
 */
export function matchMealText(meal, text) {
  const wanted = tokenize(text);
  if (!wanted.length) return { match: true, score: 0 };
  const tokens = mealTokens(meal);
  let score = 0;
  for (const token of wanted) {
    if (!tokenHits(token, tokens)) return { match: false, score: 0 };
    score += 1;
  }
  const title = tokenize(meal.title);
  if (wanted.every((token) => tokenHits(token, title))) score += 1;
  return { match: true, score };
}
