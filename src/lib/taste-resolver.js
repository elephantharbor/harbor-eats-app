/**
 * Taste search. The same input always resolves to the same active term.
 * An unknown word stays unknown. This module never inserts a vocabulary row
 * and never calls a model.
 */

import { getTasteTerm, listVocabulary, normalizeTasteTerm } from "./taste-vocabulary.js";

/**
 * @param {import("./taste-vocabulary.js").TasteTerm[]} vocabulary
 */
export function aliasIndex(vocabulary) {
  /** @type {Map<string, string>} */
  const index = new Map();
  for (const row of vocabulary) {
    const keys = [row.slug, row.display_name, ...row.synonyms];
    for (const key of keys) {
      const norm = normalizeTasteTerm(key);
      if (!norm) continue;
      const prior = index.get(norm);
      if (prior && prior !== row.slug) {
        throw new Error(`alias ${norm} maps to ${prior} and ${row.slug}`);
      }
      index.set(norm, row.slug);
    }
  }
  return index;
}

const CURATED_INDEX = aliasIndex(listVocabulary());

/**
 * @param {unknown} input
 * @param {import("./taste-vocabulary.js").TasteTerm[]} [vocabulary]
 * @returns {{
 *   status: "resolved"|"inactive"|"unresolved",
 *   term: string,
 *   vocabulary_slug: string|null,
 *   concept: import("./taste-vocabulary.js").TasteTerm|null,
 * }}
 */
export function resolveTasteTerm(input, vocabulary) {
  const term = normalizeTasteTerm(input);
  const source = vocabulary || listVocabulary();
  const index = vocabulary ? aliasIndex(vocabulary) : CURATED_INDEX;
  if (!term) {
    return { status: "unresolved", term: "", vocabulary_slug: null, concept: null };
  }
  const slug = index.get(term) || null;
  if (!slug) {
    return { status: "unresolved", term, vocabulary_slug: null, concept: null };
  }
  const concept = getTasteTerm(slug, source);
  if (!concept || !concept.active) {
    return { status: "inactive", term, vocabulary_slug: slug, concept: concept || null };
  }
  return { status: "resolved", term, vocabulary_slug: slug, concept };
}

/**
 * Parent is a rollup pointer, not a search alias. Resolving a child
 * returns the child.
 * @param {string} slug
 */
export function parentOf(slug) {
  const concept = getTasteTerm(slug);
  if (!concept || !concept.parent_slug) return null;
  return getTasteTerm(concept.parent_slug);
}
