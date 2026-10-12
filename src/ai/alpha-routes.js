/**
 * Alpha readiness AI routes: recipe adaptation advice and recommendation explanations.
 */

import { createHash } from "node:crypto";
import { createD1Store, createGenerationService, resolveProvider } from "./index.js";
import { requireSession } from "../lib/auth.js";
import {
  buildExplanationPacket,
  explanationColdTemplate,
  postValidateExplanation,
} from "../lib/explanation-packet.js";
import {
  ADAPTATION_FALLBACK_REFUSAL,
  ADAPTATION_SAFETY_REFUSAL,
  equipmentUnsupportedResponse,
  reconcileEquipmentUnsupported,
  requestedSubstituteConflict,
  validateAdaptationSafety,
} from "../lib/meal-adaptation.js";
import {
  findCurrentDinnerPlanId,
  householdConstraints,
  householdMemberIds,
  householdTastes,
  loadDinnerPlan,
} from "../lib/dinner-plan-store.js";
import { catalogReadsFromD1, loadPublishedCatalog } from "../lib/catalog-runtime.js";
import { canonicalIngredient } from "../lib/ingredient-identity.js";
import { projectLegacyConcept } from "../lib/recipe-package.js";
import { getConceptBySlug, getRecipeVersion } from "../lib/recipe-store.js";
import { postValidateRecipeAdaptation } from "./adaptation-schema.js";

const ADAPT_FALLBACK = {
  ok: true,
  support: "fallback",
  acknowledgement: ADAPTATION_FALLBACK_REFUSAL,
  kind: "unsupported",
};

function providerUsage(gen) {
  if (gen?.source === "provider") return { provider_calls: 1 };
  const attempts = Number(gen?.metadata?.attempts);
  if (Number.isFinite(attempts) && attempts > 0) return { provider_calls: 1 };
  return { provider_calls: 0 };
}

function adaptationFallback(text, meal, gen) {
  const usage = providerUsage(gen);
  const blocked = equipmentUnsupportedResponse(text, meal);
  if (blocked) return respond({ ...blocked, usage });
  return respond({ ...ADAPT_FALLBACK, source: "fallback", usage });
}

function adviceWithoutApply(validated, gen) {
  const notes = (validated.value.step_notes || []).filter((note) => note && note.step_number);
  const source = gen?.source === "cache" ? "cache" : "provider";
  const usage = providerUsage(gen);
  const shared = {
    ok: true,
    acknowledgement: validated.value.acknowledgement,
    ingredient_ops: [],
    flavor_impact: validated.value.flavor_impact ?? null,
    warning: validated.value.warning ?? null,
    source,
    usage,
  };
  if (notes.length) {
    return respond({
      ...shared,
      support: "advice",
      kind: "prep",
      step_notes: notes,
      equipment_supported: validated.value.equipment_supported !== false,
    });
  }
  const proposed = validated.value.ingredient_ops || [];
  if (proposed.length === 0 && validated.value.support !== "unsupported" && validated.value.equipment_supported === true) {
    return respond({
      ...shared,
      support: "advice",
      kind: validated.value.kind || "equipment",
      step_notes: [],
      equipment_supported: true,
    });
  }
  return respond({
    ok: true,
    support: "unsupported",
    acknowledgement: validated.value.acknowledgement || ADAPTATION_FALLBACK_REFUSAL,
    kind: "unsupported",
    ingredient_ops: [],
    step_notes: [],
    equipment_supported: false,
    source,
    usage,
  });
}

function withIngredientIds(ingredients) {
  return (ingredients || []).map((ing) => ({
    ...ing,
    ingredient_id: ing.ingredient_id || canonicalIngredient(ing.name).ingredient_id,
  }));
}

function authoritativeRecipe(loaded, meal) {
  const version = loaded?.version || {};
  const recipe = {
    recipe_version_id: meal?.recipe_version_id || version.recipe_version_id || null,
    recipe_slug: meal?.recipe_slug || loaded?.slug || null,
    effort_level: meal?.effort_level || version.effort_level || null,
    ingredient_complexity: meal?.ingredient_complexity || version.ingredient_complexity || null,
    total_minutes: version.total_minutes ?? null,
    vocabulary_tag_ids: [...(meal?.vocabulary_tag_ids || version.vocabulary_tag_ids || [])],
  };
  if (!recipe.vocabulary_tag_ids.length && loaded?.concept?.current_version) {
    const projected = projectLegacyConcept(loaded.concept);
    recipe.vocabulary_tag_ids = projected.vocabulary_tag_ids || [];
    recipe.effort_level = recipe.effort_level || projected.effort_level || null;
    recipe.ingredient_complexity = recipe.ingredient_complexity || projected.ingredient_complexity || null;
    if (recipe.total_minutes == null) recipe.total_minutes = projected.total_minutes ?? null;
  }
  return recipe;
}

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
    const [constraints, tastes, members] = await Promise.all([
      householdConstraints(env.DB, auth.session.household_id),
      householdTastes(env.DB, auth.session.household_id),
      householdMemberIds(env.DB, auth.session.household_id),
    ]);
    const ctx = { constraints, tastes, catalog: null };
    if (catalogReadsFromD1(env)) {
      const cat = await loadPublishedCatalog(env.DB);
      if (cat.ok) ctx.catalog = cat.planner;
    }
    let meal = null;
    if (body.meal_id && body.dinner_plan_id) {
      const plan = await loadDinnerPlan(env.DB, body.dinner_plan_id);
      if (plan && plan.household_id !== auth.session.household_id) return fail("forbidden_cross_household", 403);
      meal = plan?.meals?.find((row) => row.meal_id === body.meal_id) || null;
    }
    const pinMeal = {
      kind: "recipe",
      recipe_slug: meal?.recipe_slug || loaded.slug,
      recipe_version_id: meal?.recipe_version_id || loaded.version.recipe_version_id,
      title: meal?.title || loaded.concept.title,
      pinned_ingredients: withIngredientIds(meal?.pinned_ingredients || loaded.version.ingredients),
      pinned_steps: meal?.pinned_steps || loaded.version.steps,
      equipment: meal?.equipment || loaded.version.equipment || [],
      participant_ids: meal?.participant_ids?.length ? meal.participant_ids : members,
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
    const blocked = equipmentUnsupportedResponse(body.text, pinMeal);
    if (blocked) return respond(blocked);
    const substituteBlocked = requestedSubstituteConflict(body.text, pinMeal, ctx);
    if (substituteBlocked) return respond(substituteBlocked);
    let modelOutput;
    let support = "advice";
    let gen;
    try {
      gen = await service.run("recipe_adaptation", runInput, {
        householdId: auth.session.household_id,
        fallback: {
          acknowledgement: ADAPT_FALLBACK.acknowledgement,
          kind: ADAPT_FALLBACK.kind,
          support: "unsupported",
          ingredient_ops: [],
          step_notes: [],
          equipment_supported: false,
          flavor_impact: null,
          warning: null,
        },
      });
    } catch {
      return adaptationFallback(body.text, pinMeal);
    }
    if (!gen?.ok || gen.output == null) return adaptationFallback(body.text, pinMeal, gen);
    modelOutput = gen.output;
    modelOutput = reconcileEquipmentUnsupported(body.text, pinMeal, modelOutput);
    const validated = postValidateRecipeAdaptation(modelOutput);
    if (!validated.ok) return adaptationFallback(body.text, pinMeal, gen);
    const safety = validateAdaptationSafety(validated.value, pinMeal, ctx);
    if (!safety.ok) {
      return respond({
        ok: true,
        support: "rejected_safety",
        acknowledgement: ADAPTATION_SAFETY_REFUSAL,
        kind: validated.value.kind,
        ingredient_ops: [],
        source: gen.source === "cache" ? "cache" : "provider",
        usage: providerUsage(gen),
      });
    }
    const kept = safety.override?.ops || [];
    if (!kept.length) return adviceWithoutApply(validated, gen);
    if (validated.value.support === "unsupported") support = "unsupported";
    const source = gen.source === "cache" ? "cache" : "provider";
    return respond({
      ok: true,
      support,
      ...validated.value,
      ingredient_ops: kept.map((op) => ({
        op: op.op,
        from_id: op.from_id,
        to_name: op.to_name,
        policy: op.policy,
      })),
      override: safety.override,
      source,
      usage: providerUsage(gen),
      recipe_slug: loaded.slug,
    });
  }

  if (path === "/api/explain" && request.method === "POST") {
    const auth = await requireSession(env.DB, request);
    if (auth.error) return auth.error;
    const body = await readJson(request);
    if (body === null) return fail("invalid_json");
    let plan = null;
    if (body.dinner_plan_id) {
      plan = await loadDinnerPlan(env.DB, body.dinner_plan_id);
      if (!plan) return fail("plan_not_found", 404);
      if (plan.household_id !== auth.session.household_id) return fail("forbidden_cross_household", 403);
    } else {
      const currentId = await findCurrentDinnerPlanId(env.DB, auth.session.household_id);
      plan = currentId ? await loadDinnerPlan(env.DB, currentId) : null;
    }
    const meal = body.meal_id && plan ? plan.meals.find((row) => row.meal_id === body.meal_id) || null : null;
    const slug = meal?.recipe_slug || body.recipe_slug;
    const versionId = meal?.recipe_version_id || body.recipe_version_id;
    if (!slug && !versionId) return fail("recipe_required");
    const loaded = await loadRecipeShape(env, slug, versionId);
    if (loaded.error) return loaded.error;
    const tastes = await householdTastes(env.DB, auth.session.household_id);
    let packet = buildExplanationPacket({
      recipe: authoritativeRecipe(loaded, meal),
      intent: plan?.intent || {},
      tastes,
    });
    if (body.cache_bust) {
      packet = {
        ...packet,
        evidence_fingerprint: createHash("sha256")
          .update(`${packet.evidence_fingerprint}|${String(body.cache_bust).slice(0, 48)}`)
          .digest("hex"),
      };
    }
    const templateText = packet.template || explanationColdTemplate();
    if (packet.strength === "weak" || packet.basis === "cold") {
      return respond({ ok: true, text: templateText, source: "template", basis: packet.basis });
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
    let gen;
    try {
      gen = await service.run("explanation", runInput, {
        householdId: auth.session.household_id,
        fallback: { text: templateText, used_fact_ids: [] },
      });
    } catch {
      return respond({ ok: true, text: templateText, source: "fallback", basis: packet.basis });
    }
    if (!gen?.ok || gen.output == null) {
      return respond({
        ok: true,
        text: templateText,
        source: "fallback",
        basis: packet.basis,
        usage: providerUsage(gen),
      });
    }
    const checked = postValidateExplanation(gen.output, packet);
    if (!checked.ok) {
      return respond({
        ok: true,
        text: templateText,
        source: "fallback",
        basis: packet.basis,
        usage: providerUsage(gen),
      });
    }
    const source = gen.source === "cache" ? "cache" : "provider";
    return respond({
      ok: true,
      text: checked.value.text,
      used_fact_ids: checked.value.used_fact_ids,
      source,
      basis: packet.basis,
      usage: providerUsage(gen),
    });
  }

  return null;
}
