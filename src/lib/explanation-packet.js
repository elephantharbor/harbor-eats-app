/**
 * Deterministic evidence packets for recommendation explanations.
 */

import { createHash } from "node:crypto";

const COLD_TEMPLATE = "This gives you something different while still keeping dinner easy.";

/**
 * @param {object} input
 * @param {object|null} input.row discovery result row
 * @param {object} [input.plan]
 * @param {object} [input.intent]
 */
export function buildExplanationPacket(input = {}) {
  const row = input.row || {};
  const facts = [];
  const allowed_numbers = new Set();

  const tasteHits = row.taste_hits || [];
  const shared = tasteHits.filter((h) => h.agreement);
  if (shared.length >= 2) {
    facts.push({
      id: "taste_agreement",
      kind: "taste_agreement",
      phrase: "smoky, savory dinners",
    });
  } else if (row.primary_reason === "taste_love" || row.primary_reason === "taste_like") {
    const hit = tasteHits[0];
    facts.push({
      id: "taste_like",
      kind: "taste_like",
      phrase: hit?.display_name || "a flavor you like",
    });
  }

  const intent = input.intent || input.plan?.intent || {};
  if (intent.keep_it_easy || row.effort_level === "easy") {
    facts.push({ id: "easy", kind: "easy", phrase: "easy on a weeknight" });
  }
  if (intent.keep_ingredients_simple || row.ingredient_complexity === "simple") {
    facts.push({ id: "simple", kind: "simple_ingredients", phrase: "simple ingredients" });
  }
  if (row.total_minutes != null && row.total_minutes <= 30) {
    facts.push({ id: "quick", kind: "quick", phrase: "on the table quickly" });
    allowed_numbers.add(String(row.total_minutes));
  }
  if ((row.reasons || []).includes("explicit_different")) {
    facts.push({ id: "novelty", kind: "novelty", phrase: "not on your table lately" });
  }
  if ((row.reasons || []).includes("fatigue")) {
    facts.push({ id: "fatigue", kind: "fatigue", phrase: "a break from the usual" });
  }

  const trimmed = facts.slice(0, 6);
  const hasTaste = trimmed.some((f) => f.kind.startsWith("taste"));
  let basis = "cold";
  if (hasTaste) basis = "learned";
  else if (input.onboarding?.length) basis = "onboarding";
  else if (trimmed.length) basis = "run";

  const tasteFacts = trimmed.filter((f) => f.kind.startsWith("taste"));
  const strength =
    tasteFacts.length || trimmed.filter((f) => !f.kind.startsWith("taste")).length >= 2 ? "strong" : "weak";

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        ids: trimmed.map((f) => f.id),
        phrases: trimmed.map((f) => f.phrase),
        basis,
      })
    )
    .digest("hex");

  return {
    recipe_version_id: row.recipe_version_id || input.recipe_version_id || null,
    basis,
    strength,
    facts: trimmed,
    allowed_phrases: trimmed.map((f) => f.phrase),
    allowed_numbers: [...allowed_numbers],
    evidence_fingerprint: fingerprint,
    template: strength === "weak" || basis === "cold" ? deterministicTemplate(trimmed) : null,
  };
}

function deterministicTemplate(facts) {
  if (!facts.length) return COLD_TEMPLATE;
  const parts = facts.slice(0, 3).map((f) => f.phrase);
  return `${parts.join(", ")}, and keeps tonight manageable.`.replace(/^, /, "");
}

export function explanationColdTemplate() {
  return COLD_TEMPLATE;
}

/**
 * @param {object} output
 * @param {object} packet
 */
export function postValidateExplanation(output, packet) {
  const used = output.used_fact_ids || [];
  const allowed = new Set((packet.facts || []).map((f) => f.id));
  if (used.some((id) => !allowed.has(id))) return { ok: false, reason: "fact_mismatch" };
  const text = output.text || "";
  if (/\b(allergen|safe for|nut-free|gluten-free)\b/i.test(text)) return { ok: false, reason: "authority_claim" };
  const digits = text.match(/\d+/g) || [];
  const allowedNums = new Set(packet.allowed_numbers || []);
  if (digits.some((d) => !allowedNums.has(d))) return { ok: false, reason: "digit" };
  if (/\bmushroom/i.test(text) && !(packet.facts || []).some((f) => /mushroom/i.test(f.phrase))) {
    return { ok: false, reason: "unsupported_food" };
  }
  if ((packet.basis === "cold" || packet.basis === "run") && /\b(you both|you tend|you love|you enjoy|your favorite)\b/i.test(text)) {
    return { ok: false, reason: "cold_voice" };
  }
  return { ok: true, value: output };
}
