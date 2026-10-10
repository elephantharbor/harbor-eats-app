/**
 * Source-controlled, versioned prompt templates. Changing a template REQUIRES bumping its
 * version (the version is part of the cache key and of every usage row). Templates ask for
 * JSON matching the task's output schema and never ask for reasoning/chain-of-thought.
 */
const SYSTEM = [
  "You are a structured-output helper inside a household meal planner.",
  "Return ONLY JSON matching the provided schema. No prose, no reasoning.",
  "You never decide allergens, dietary eligibility, servings, shopping quantities, membership, votes, recipe versions, plan constraints or taste scores; deterministic systems own those.",
].join(" ");

export const PROMPTS = Object.freeze({
  planning_intent: { version: "planning_intent@1", system: SYSTEM, user: "Extract planning intent from the household request.\nRequest: {{text}}\nContext: {{context}}" },
  discovery_intent: { version: "discovery_intent@1", system: SYSTEM, user: "Map the search request onto discovery facets using only the allowed vocabulary.\nRequest: {{text}}\nAllowed: {{vocabulary}}" },
  feedback_extraction: { version: "feedback_extraction@1", system: SYSTEM, user: "Extract structured feedback themes from this comment about a cooked meal.\nMeal: {{meal}}\nComment: {{text}}" },
  concept_generation: { version: "concept_generation@1", system: SYSTEM, user: "Propose meal concepts for the brief. They are drafts for human review.\nBrief: {{text}}\nContext: {{context}}" },
  recipe_draft: { version: "recipe_draft@1", system: SYSTEM, user: "Draft a recipe for the concept. It is an unreviewed draft.\nConcept: {{text}}" },
  recipe_adaptation: { version: "recipe_adaptation@1", system: SYSTEM, user: "Suggest an adaptation of the recipe for the request. Draft only.\nRecipe: {{recipe}}\nRequest: {{text}}" },
  explanation: { version: "explanation@1", system: SYSTEM, user: "Explain in one or two friendly sentences why this meal fits, using only these deterministic reasons.\nMeal: {{meal}}\nReasons: {{reasons}}" },
  semantic_search_assist: { version: "semantic_search_assist@1", system: SYSTEM, user: "Suggest alternate search phrasings and facet hints for the query.\nQuery: {{text}}" },
});

/** Render {{var}} placeholders; missing vars become empty. Values are stringified and length-capped. */
export function renderPrompt(taskId, vars = {}) {
  const tpl = PROMPTS[taskId];
  if (!tpl) throw new Error(`no prompt for ${taskId}`);
  const user = tpl.user.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = vars[k];
    const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    return s.slice(0, 4000);
  });
  return { version: tpl.version, system: tpl.system, user };
}
