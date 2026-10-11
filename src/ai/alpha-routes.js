/**
 * Alpha readiness AI routes: recipe adaptation advice and recommendation explanations.
 */

import { createD1Store, createGenerationService, resolveProvider } from "./index.js";
import { requireSession } from "../lib/auth.js";
import {
  buildExplanationPacket,
  explanationColdTemplate,
  postValidateExplanation,
} from "../lib/explanation-packet.js";
import {
  reconcileEquipmentUnsupported,
  validateAdaptationSafety,
} from "../lib/meal-adaptation.js";
import { loadDinnerPlan, householdConstraints, householdTastes } from "../lib/dinner-plan-store.js";
import { catalogReadsFromD1, loadPublishedCatalog } from "../lib/catalog-runtime.js";
import { getConceptBySlug, getRecipeVersion } from "../lib/recipe-store.js";
import { postValidateRecipeAdaptation } from "./adaptation-schema.js";

function respond(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" },
  });
}

function fail(error, status = 400, extra = {}) {
  return respond({ ok: false, error, ...extra }, status);
}

async function readJson(request) {
  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return null;
  }
}

function redactedRecipeInput(recipe) {
  return {
    recipe_version_id: recipe.recipe_version_id,
    title: recipe.title,
    equipment: (recipe.equipment || []).slice(0, 12),
    ingredients: (recipe.ingredients || []).map((ing) => ({
      ingredient_id: ing.ingredient_id || ing.name,
      name: ing.name,
    })),
    steps: (recipe.steps || []).map((s, idx) => ({
      step_number: s.step_number || idx + 1,
      title: s.title || `Step ${idx + 1}`,
    })),
  };
}

async function loadRecipeShape(env, slug, versionId) {
  if (catalogReadsFromD1(env)) {
    const loaded = await loadPublishedCatalog(env.DB);
    if (!loaded.ok) return { error: fail(loaded.error || "catalog_unavailable", 503) };
    const entry = versionId
      ? loaded.versionsById[versionId]
      : loaded.planner.find((row) => row.concept.concept_id === slug);
    if (!entry) return { error: fail("recipe_not_found", 404) };
    return {
      slug: entry.concept.concept_id,
      version: entry.pkg,
      concept: entry.concept,
    };
  }
  const concept = getConceptBySlug(slug);
  if (!concept) return { error: fail("recipe_not_found", 404) };
  const version = versionId ? getRecipeVersion(versionId) : concept.current_version;
  if (!version) return { error: fail("recipe_not_found", 404) };
  return { slug: concept.concept_id, version, concept };
}

export async function routeAlphaAiRequest(env, request, path) {
  if (path === "/api/recipes/adapt" && request.method === "POST") {
    const auth = await requireSession(env.DB, request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    if (body === null) return fail("invalid_json");
    const loaded = await loadRecipeShape(env, body.recipe_slug, body.recipe_version_id);
    if (loaded.error) return loaded.error;
    const [constraints, tastes] = await Promise.all([
      householdConstraints(env.DB, auth.session.household_id),
      householdTastes(env.DB, auth.session.household_id),
    ]);
    const ctx = { constraints, tastes, catalog: null };
    if (catalogReadsFromD1(env)) {
      const cat = await loadPublishedCatalog(env.DB);
      if (cat.ok) ctx.catalog = cat.planner;
    }
    const meal = body.meal_id
      ? (await loadDinnerPlan(env.DB, body.dinner_plan_id))?.meals?.find((m) => m.meal_id === body.meal_id)
      : null;
    const pinMeal = meal || {
      kind: "recipe",
      recipe_slug: loaded.slug,
      recipe_version_id: loaded.version.recipe_version_id,
      title: loaded.concept.title,
      pinned_ingredients: loaded.version.ingredients,
      pinned_steps: loaded.version.steps,
      participant_ids: body.participant_ids || [],
    };
    const provider = resolveProvider(env);
    const service = createGenerationService({ provider, store: createD1Store(env.DB), env });
    const runInput = {
      text: String(body.text || "").slice(0, 300),
      recipe: redactedRecipeInput({
        recipe_version_id: loaded.version.recipe_version_id,
        title: loaded.concept.title,
        equipment: loaded.version.equipment,
        ingredients: loaded.version.ingredients,
        steps: loaded.version.steps,
      }),
    };
    let modelOutput;
    let support = "advice";
    try {
      const gen = await service.run("recipe_adaptation", runInput, {
        householdId: auth.session.household_id,
        fallback: null,
      });
      modelOutput = gen.output;
    } catch {
      return respond({
        ok: true,
        support: "fallback",
        acknowledgement: "We're not sure that would work here, so we'd keep the original.",
        kind: "unsupported",
      });
    }
    modelOutput = reconcileEquipmentUnsupported(body.text, pinMeal, modelOutput);
    const validated = postValidateRecipeAdaptation(modelOutput);
    if (!validated.ok) {
      return respond({
        ok: true,
        support: "fallback",
        acknowledgement: "We're not sure that would work here, so we'd keep the original.",
        kind: "unsupported",
      });
    }
    const safety = validateAdaptationSafety(validated.value, pinMeal, ctx);
    if (!safety.ok) {
      return respond({
        ok: true,
        support: "rejected_safety",
        acknowledgement: "That swap doesn't work for everyone eating this dinner, so we'd leave it out.",
        kind: validated.value.kind,
        ingredient_ops: [],
      });
    }
    if (validated.value.support === "unsupported") support = "unsupported";
    return respond({
      ok: true,
      support,
      ...validated.value,
      override: safety.override,
      recipe_slug: loaded.slug,
    });
  }

  if (path === "/api/explain" && request.method === "POST") {
    const auth = await requireSession(env.DB, request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    if (body === null) return fail("invalid_json");
    const packet = buildExplanationPacket({
      row: body.row || body,
      plan: body.plan,
      intent: body.intent,
      recipe_version_id: body.recipe_version_id,
    });
    if (packet.strength === "weak" || packet.basis === "cold") {
      const text = packet.template || explanationColdTemplate();
      return respond({ ok: true, text, source: "template", basis: packet.basis, packet });
    }
    const provider = resolveProvider(env);
    const service = createGenerationService({ provider, store: createD1Store(env.DB), env });
    const runInput = {
      recipe_version_id: packet.recipe_version_id,
      basis: packet.basis,
      strength: packet.strength,
      facts: packet.facts,
      allowed_phrases: packet.allowed_phrases,
      allowed_numbers: packet.allowed_numbers,
      evidence_fingerprint: packet.evidence_fingerprint,
    };
    try {
      const gen = await service.run("explanation", runInput, {
        householdId: auth.session.household_id,
        fallback: { text: packet.template || explanationColdTemplate(), used_fact_ids: [] },
      });
      const checked = postValidateExplanation(gen.output, packet);
      if (!checked.ok) {
        return respond({
          ok: true,
          text: packet.template || explanationColdTemplate(),
          source: "fallback",
          basis: packet.basis,
        });
      }
      return respond({
        ok: true,
        text: checked.value.text,
        used_fact_ids: checked.value.used_fact_ids,
        source: gen.from_cache ? "cache" : "provider",
        basis: packet.basis,
      });
    } catch {
      return respond({
        ok: true,
        text: packet.template || explanationColdTemplate(),
        source: "fallback",
        basis: packet.basis,
      });
    }
  }

  return null;
}
