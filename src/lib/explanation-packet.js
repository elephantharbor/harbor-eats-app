/**
 * Deterministic evidence packets for recommendation explanations.
 * Phrases come from household tastes, the pinned recipe, and the plan.
 * Client-supplied taste hits and fact lists are not evidence.
 */

import { createHash } from "node:crypto";
import { scoreDinerTastes } from "./diner-taste-rank.js";
import { getTasteTerm, listVocabulary } from "./taste-vocabulary.js";

const COLD_TEMPLATE = "This gives you something different while still keeping dinner easy.";

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termLabels(term) {
  return [term.display_name, String(term.slug || "").replace(/-/g, " "), ...(term.synonyms || [])]
    .map((label) => String(label || "").trim())
    .filter((label) => label.length >= 3);
}

function textMentionsTerm(text, term) {
  return termLabels(term).some((label) => new RegExp(`\\b${escapeRegExp(label)}\\b`, "i").test(text));
}

function tasteFacts(recipe, tastes) {
  const scored = scoreDinerTastes(
    {
      recipe_slug: recipe.recipe_slug,
      vocabulary_tag_ids: recipe.vocabulary_tag_ids || [],
    },
    tastes || []
  );
  const positive = scored.hits.filter((hit) => hit.rank === "love" || hit.rank === "like");
  /** @type {Map<string, Set<string>>} */
  const membersBySlug = new Map();
  for (const hit of positive) {
    const members = membersBySlug.get(hit.vocabulary_slug) || new Set();
    members.add(hit.member_id);
    membersBySlug.set(hit.vocabulary_slug, members);
  }
  const shared = [...membersBySlug.entries()].filter(([, members]) => members.size >= 2);
  if (shared.length) {
    const names = shared
      .map(([slug]) => getTasteTerm(slug)?.display_name)
      .filter(Boolean)
      .slice(0, 2);
    if (names.length) {
      return [
        {
          id: "taste_agreement",
          kind: "taste_agreement",
          phrase: names.join(" and ").slice(0, 60),
        },
      ];
    }
  }
  const hit = positive.find((row) => row.rank === "love") || positive[0];
  const name = hit ? getTasteTerm(hit.vocabulary_slug)?.display_name : null;
  if (!name) return [];
  return [{ id: "taste_like", kind: "taste_like", phrase: name.slice(0, 60) }];
}

/**
 * @param {object} input
 * @param {object} [input.recipe] authoritative recipe classification
 * @param {object} [input.intent] plan intent loaded on the server
 * @param {object[]} [input.tastes] diner_taste rows
 * @param {string[]} [input.reasons] server reason codes
 * @param {object} [input.row] structural recipe fields only; taste hits are ignored
 */
export function buildExplanationPacket(input = {}) {
  const recipe = input.recipe || {};
  const row = input.row || {};
  const facts = [];
  const allowed_numbers = new Set();
  const vocabulary_tag_ids = recipe.vocabulary_tag_ids || row.vocabulary_tag_ids || [];
  const recipe_slug = recipe.recipe_slug || row.recipe_slug || null;

  facts.push(
    ...tasteFacts(
      { recipe_slug, vocabulary_tag_ids },
      input.tastes || []
    )
  );

  const intent = input.intent || {};
  const effort = recipe.effort_level || row.effort_level;
  const complexity = recipe.ingredient_complexity || row.ingredient_complexity;
  const minutes = recipe.total_minutes ?? row.total_minutes;
  if (intent.keep_it_easy || effort === "easy") {
    facts.push({ id: "easy", kind: "easy", phrase: "easy on a weeknight" });
  }
  if (intent.keep_ingredients_simple || complexity === "simple") {
    facts.push({ id: "simple", kind: "simple_ingredients", phrase: "simple ingredients" });
  }
  if (minutes != null && minutes <= 30) {
    facts.push({ id: "quick", kind: "quick", phrase: "on the table quickly" });
    allowed_numbers.add(String(minutes));
  }
  const reasons = input.reasons || [];
  if (reasons.includes("explicit_different")) {
    facts.push({ id: "novelty", kind: "novelty", phrase: "not on your table lately" });
  }
  if (reasons.includes("fatigue")) {
    facts.push({ id: "fatigue", kind: "fatigue", phrase: "a break from the usual" });
  }

  const trimmed = facts.slice(0, 6);
  const hasTaste = trimmed.some((fact) => fact.kind.startsWith("taste"));
  const householdTastes = (input.tastes || []).filter(
    (taste) => taste && taste.data_origin === "household" && taste.stance !== "inferred"
  );
  let basis = "cold";
  if (hasTaste) basis = "learned";
  else if (householdTastes.length) basis = "onboarding";
  else if (trimmed.length) basis = "run";

  const tasteFactCount = trimmed.filter((fact) => fact.kind.startsWith("taste")).length;
  const otherFacts = trimmed.filter((fact) => !fact.kind.startsWith("taste")).length;
  const strength = tasteFactCount || otherFacts >= 2 ? "strong" : "weak";

  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        ids: trimmed.map((fact) => fact.id),
        phrases: trimmed.map((fact) => fact.phrase),
        basis,
      })
    )
    .digest("hex");

  return {
    recipe_version_id: recipe.recipe_version_id || row.recipe_version_id || input.recipe_version_id || null,
    basis,
    strength,
    facts: trimmed,
    allowed_phrases: trimmed.map((fact) => fact.phrase),
    allowed_numbers: [...allowed_numbers],
    evidence_fingerprint: fingerprint,
    template: deterministicTemplate(trimmed),
  };
}

function deterministicTemplate(facts) {
  if (!facts.length) return COLD_TEMPLATE;
  const parts = facts.slice(0, 3).map((fact) => fact.phrase);
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
  const allowed = new Set((packet.facts || []).map((fact) => fact.id));
  if (used.some((id) => !allowed.has(id))) return { ok: false, reason: "fact_mismatch" };
  const text = output.text || "";
  if (/\b(allergen|safe for|nut-free|gluten-free)\b/i.test(text)) return { ok: false, reason: "authority_claim" };
  const digits = text.match(/\d+/g) || [];
  const allowedNums = new Set(packet.allowed_numbers || []);
  if (digits.some((digit) => !allowedNums.has(digit))) return { ok: false, reason: "digit" };
  if (/;/.test(text)) return { ok: false, reason: "semicolon_fragment" };
  const phraseBlob = (packet.facts || []).map((fact) => fact.phrase).join("\n");
  for (const term of listVocabulary()) {
    if (textMentionsTerm(text, term) && !textMentionsTerm(phraseBlob, term)) {
      return { ok: false, reason: "unsupported_term" };
    }
  }
  if ((packet.basis === "cold" || packet.basis === "run") && /\b(you both|you tend|you love|you enjoy|your favorite)\b/i.test(text)) {
    return { ok: false, reason: "cold_voice" };
  }
  return { ok: true, value: output };
}
