/**
 * Leftover discovery text is ANDed into search. Filler ("for dinner tonight",
 * "something") matches nothing and zeroes the page. Real tokens stay.
 */
const FILLER = new Set([
  "a",
  "an",
  "and",
  "any",
  "at",
  "but",
  "dinner",
  "dinners",
  "feel",
  "feels",
  "food",
  "for",
  "give",
  "i",
  "in",
  "it",
  "just",
  "like",
  "make",
  "meal",
  "meals",
  "me",
  "more",
  "less",
  "not",
  "of",
  "on",
  "our",
  "over",
  "please",
  "really",
  "restaurant",
  "show",
  "some",
  "something",
  "style",
  "styled",
  "that",
  "the",
  "this",
  "to",
  "tonight",
  "too",
  "under",
  "us",
  "very",
  "want",
  "we",
  "week",
  "with",
  "without",
  "your",
  "find",
]);

export function stripFillerResidue(text) {
  if (!text) return null;
  const tokens = String(text).toLowerCase().match(/[a-z0-9]+/g) || [];
  const kept = tokens.filter((token) => !FILLER.has(token));
  if (!kept.length) return null;
  return kept.join(" ").slice(0, 40);
}
