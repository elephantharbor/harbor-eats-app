/** Normalize legacy smoke/tests input into the explanation packet shape. */
export function normalizeExplanationInput(input) {
  if (input && Array.isArray(input.facts)) return input;
  const reasons = (input && input.reasons) || [];
  const facts = reasons.map((phrase, index) => ({
    id: `legacy_${index}`,
    kind: "quick",
    phrase: String(phrase).slice(0, 60),
  }));
  return {
    recipe_version_id: input?.recipe_version_id ?? null,
    basis: facts.length ? "run" : "cold",
    strength: facts.length ? "strong" : "weak",
    facts,
    allowed_phrases: facts.map((f) => f.phrase),
    allowed_numbers: [],
    evidence_fingerprint: input?.cache_bust
      ? `legacy-${String(input.cache_bust).slice(0, 12)}`
      : `legacy-${JSON.stringify(reasons).slice(0, 40)}`,
  };
}
