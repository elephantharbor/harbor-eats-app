/**
 * Source-controlled, versioned prompt templates. Changing a template REQUIRES bumping its
 * version (the version is part of the cache key and of every usage row). Templates ask for
 * JSON matching the task's output schema and never ask for reasoning/chain-of-thought.
 */
const SYSTEM = [
  "You are a structured-output helper inside a household meal planner.",
  "Return ONLY JSON matching the provided schema. No prose.",
  "You never decide allergens, dietary eligibility, servings, shopping quantities, membership, votes, recipe versions, plan constraints or taste scores; deterministic systems own those.",
].join(" ");

/**
 * Stable instruction prefix for OpenAI automatic prompt caching.
 * Everything before the user message is identical across calls of a task.
 * The variable request, state, and context are the user message only.
 * Keep this prefix long enough to cross the cache minimum (about 1024 tokens).
 */
const PLANNING_PREFIX = [
  "Task planning_intent. Return one planning delta object and nothing else.",
  "Null scalars and empty op arrays mean unchanged. Do not restate unchanged state. Do not invent dinners, titles, or ids.",
  "acknowledgement may be an empty string. The server writes the sentence the household sees. Do not copy the user's sentence into acknowledgement.",
  "dinner_count is an integer 1..14 or null. Set it only when the user names a count. Leave it null when they do not; the server applies the household usual count.",
  "date_start and date_end are YYYY-MM-DD or null. A named weekday is never a date_start.",
  "keep_it_easy true means mostly easy, a soft preference. It is not a hard pool filter.",
  "effort easy plus keep_it_easy true means only easy, and only when the user says only or nothing but. A single named day that should be easy is a slot_op, not this global effort.",
  "keep_ingredients_simple true is a soft lean. ingredient_complexity simple with ingredient_complexity_hard true means only simple ingredients.",
  "max_minutes is 5..240. max_minutes_hard true is a hard cap (under 30 minutes). max_minutes_hard false is a preference only.",
  "special_count is how many nights should feel special when no weekday is named. A named Friday or other weekday uses slot_ops with special true.",
  "clear is an array of field names to reset. Use it only when the user takes something back. Do not clear a field you are also setting.",
  "list_ops add or remove one closed value on cuisines, meal_styles, include_ingredients, exclude_ingredients, exclude_categories, or intent_cues.",
  "frequency_ops set or clear one token. fish twice means token fish, min_count 2, max_count 2. Do not use seafood for that. pasta no more than once means token pasta, min_count null, max_count 1. no pasta means max_count 0.",
  "Frequency tokens are the closed plan set: fish, seafood, shellfish, tacos, bowls, soups, pasta, grilled, curries, sandwiches, stews, stir-fries, plant, and the ingredient slugs the server already validates. Never invent a token.",
  "slot_ops target one night. target_kind is weekday, date, or position. target is the lowercase weekday, YYYY-MM-DD, or the 1-based position. op set merges the non-null fields onto that night. op clear removes that night's override.",
  "Make Tuesday easier: one slot_op, target_kind weekday, target tuesday, effort easy, every other slot field null. Do not set global effort. Do not emit slot_ops for the other nights.",
  "Make Friday special: one slot_op, target friday, special true, other fields null. The server maps that weekday onto the plan date and position. You do not number the nights yourself when context.dates is present.",
  "intent_cues are only cozy, fresh, filling, light, comforting, summery, special, restaurant_like, weeknight. not too heavy is light. cozy stays cozy. Do not put a cue in meal_styles.",
  "concepts is an array of up to four {id, polarity} objects. polarity is prefer or avoid. Use id healthy, light, hearty, fresh, comforting, cozy, filling, summery, special, restaurant_like, weeknight, quick, simple, adventurous, indulgent, vegetable_forward, fish_forward, fried, or deep_fried when the user is being vague. Unknown adjectives still go in concepts, never in text_residue, frequencies, or ingredients. An empty concepts array is correct when no vague word was said.",
  "healthy is only a concept id. Do not say a meal is healthy, nutritious, or low-calorie. nothing fried is concepts avoid fried. crispy but not deep fried is concepts avoid deep_fried. fish twice stays a frequency, not a concept. Do not guess a weekday when the user says weekend or the day is missing from context dates; leave slot_ops empty.",
  "Schema reminder. acknowledgement string. clear array. dinner_count integer or null. date_start string or null. date_end string or null. keep_it_easy boolean or null. keep_ingredients_simple boolean or null. max_minutes integer or null. max_minutes_hard boolean or null. effort easy, moderate, involved, or null. ingredient_complexity simple, standard, adventurous, or null. ingredient_complexity_hard boolean or null. special_count integer or null.",
  "list_ops items are {field, op, value}. frequency_ops items are {op, token, min_count, max_count}. slot_ops items are {target_kind, target, op, effort, ingredient_complexity, max_minutes, max_minutes_hard, special, cuisine, meal_style, ingredient, category}. Every key is present. Use null for a slot field you are not changing.",
  "Worked shapes, stable and exhaustive, so the prefix does not depend on the household. Three easy dinners: dinner_count 3, keep_it_easy true, other scalars null, arrays empty. Four dinners with fish twice and pasta at most once: dinner_count 4, frequency_ops fish min 2 max 2 and pasta min null max 1. Keep it easy with no count: dinner_count null, keep_it_easy true. Not too heavy: list_ops add intent_cues light, dinner_count null.",
  "Refinement shapes. The context dates array lists {position, date, weekday} for the saved plan. Use those weekdays. Change only the named night. Leave dinner_count null when the saved state already has one. Do not clear slots. Do not drop dates; you never write the date yourself on a weekday target.",
  "Conflict shapes you must not resolve. If the user asks for shrimp, still emit shrimp. The server removes a food the table cannot eat and substitutes. You do not decide who can eat what, and you do not name a medical reason.",
  "Output discipline. One JSON object. No markdown. No trailing comment. No extra keys. Counts stay inside 0..14. Strings stay inside the schema limits. Empty acknowledgement is better than a sentence that repeats the user or names a dish.",
].join(" ");

const DISCOVERY_PREFIX = [
  "Task discovery_intent. Return one discovery delta object and nothing else.",
  "Null scalars and empty op arrays mean unchanged. acknowledgement may be an empty string. The server writes the sentence the household sees. Do not copy the user's sentence into acknowledgement.",
  "list_ops add or remove one value on cuisines, meal_styles, flavors, ingredients, exclude_ingredients, methods, equipment, textures, effort_levels, ingredient_complexities, protein_groups, diet, or intent_cues.",
  "intent_cues are only cozy, fresh, filling, light, comforting, summery, special, restaurant_like, weeknight. not too heavy is light. fresh and easy with fish is intent_cues fresh plus ingredients or protein fish, and keep_it_easy true when easy is a lean rather than the only effort.",
  "concepts is an array of up to four {id, polarity} objects. polarity is prefer or avoid. Subjective words use id healthy, light, hearty, fresh, comforting, cozy, filling, summery, special, restaurant_like, weeknight, quick, simple, adventurous, indulgent, vegetable_forward, fish_forward, fried, or deep_fried. Unknown adjectives go in concepts and not in text_residue. Do not put a concept id into ingredients.",
  "Do not write the word healthy in acknowledgement. nothing fried is concepts avoid fried, not an ingredient. crispy but not deep fried is concepts avoid deep_fried. A bare lexicon word is handled before you run.",
  "quick true means the user asked for quick. max_minutes with max_minutes_hard true is a stated minute cap. different true is a novelty ask. keep_it_easy and keep_ingredients_simple are soft leans, not hard filters.",
  "text_residue is a short leftover noun phrase or null. Do not put the whole utterance there. Do not put function words there.",
  "A single lexicon word such as salmon or korean is handled before you run. When you do run, map the phrase onto list_ops and cues. Do not invent slugs.",
  "Schema reminder. acknowledgement string. clear array. text_residue string or null. max_minutes integer or null. max_minutes_hard boolean or null. quick boolean or null. different boolean or null. keep_it_easy boolean or null. keep_ingredients_simple boolean or null. list_ops items are {field, op, value}.",
  "Worked shapes. Something cozy but not too heavy: list_ops add intent_cues cozy and list_ops add intent_cues light. Something fresh and easy with fish: keep_it_easy true, list_ops add intent_cues fresh, and a fish ingredient or protein only if it is a closed value. Under 30: max_minutes 30, max_minutes_hard true, quick true.",
  "You never choose which meals match, never rank, and never drop a food for an allergy. The server owns eligibility. Emit the user's food even when a household limit may reject it.",
  "Output discipline. One JSON object. No markdown. No extra keys. Empty acknowledgement is better than a sentence that repeats the user or claims a meal is safe.",
  "Cue map, stable. cozy: warm, rich, soup-or-stew leaning. fresh: bright, citrus, herb. filling: stew, pasta, bowl, curry. light: the opposite of heavy, not a calorie claim. comforting: rich and soft. summery: fresh, grilled. special: a little more exploratory. restaurant_like: savoury and a bit more composed. weeknight: easier and shorter. Emit the enum slug, never a paraphrase.",
  "Effort and complexity enums. effort_levels: easy, moderate, involved. ingredient_complexities: simple, standard, adventurous. protein_groups: fish, seafood, shellfish. diet: dairy_free, plant, plant_based, vegetarian. methods and equipment are short slugs matching ^[a-z0-9_-]{1,40}$. Textures and flavors are closed vocabulary slugs the server checks; an unknown value is dropped, not repaired by you.",
  "More shapes. Korean grill: list_ops add cuisines korean and, only if grill is a method slug, list_ops add methods grill. Easy fish: keep_it_easy true and a fish protein or ingredient, not a global effort of easy unless the user said only easy. Something light: one intent_cues light op. No shrimp: list_ops add exclude_ingredients shrimp when shrimp is the closed slug. Show me tacos: list_ops add meal_styles tacos.",
  "Leave max_minutes null unless a number was said. Leave quick null unless the user said quick or a closed quick phrase. Leave different null unless they asked for something different. Leave clear empty unless they retract a chip. Do not emit dinner_count; this task has no dinner count.",
  "The context object may carry today, timezone, and diners. It does not carry names, allergens, or recipe titles. Do not ask for them and do not echo them. State is the previous discovery delta. Preserve it by leaving fields null and lists empty.",
].join(" ");

export const PROMPTS = Object.freeze({
  planning_intent: {
    version: "planning_intent@4",
    system: `${SYSTEM}\n\n${PLANNING_PREFIX}`,
    user: "Request: {{text}}\nState: {{state}}\nContext: {{context}}",
  },
  discovery_intent: {
    version: "discovery_intent@4",
    system: `${SYSTEM}\n\n${DISCOVERY_PREFIX}`,
    user: "Request: {{text}}\nState: {{state}}\nContext: {{context}}",
  },
  feedback_extraction: { version: "feedback_extraction@1", system: SYSTEM, user: "Extract structured feedback themes from this comment about a cooked meal.\nMeal: {{meal}}\nComment: {{text}}" },
  concept_generation: { version: "concept_generation@1", system: SYSTEM, user: "Propose meal concepts for the brief. They are drafts for human review.\nBrief: {{text}}\nContext: {{context}}" },
  recipe_draft: { version: "recipe_draft@1", system: SYSTEM, user: "Draft a recipe for the concept. It is an unreviewed draft.\nConcept: {{text}}" },
  recipe_adaptation: {
    version: "recipe_adaptation@2",
    system: `${SYSTEM}\n\nTask recipe_adaptation. Return structured ops only. Never output quantities, servings, or safety claims.`,
    user: "Request: {{text}}\nRecipe: {{recipe}}",
  },
  explanation: {
    version: "explanation@2",
    system: `${SYSTEM}\n\nTask explanation. Phrase only the supplied facts. used_fact_ids must list fact ids you relied on.`,
    user: "Facts: {{facts}}\nBasis: {{basis}}\nAllowed phrases: {{allowed_phrases}}",
  },
  semantic_search_assist: { version: "semantic_search_assist@1", system: SYSTEM, user: "Suggest alternate search phrasings and facet hints for the query.\nQuery: {{text}}" },
});

const VARIABLE_TASKS = new Set(["planning_intent", "discovery_intent"]);

/** Drop nulls, empty lists, and vocabulary so the uncached tail stays small. */
function compactPromptValue(value) {
  if (Array.isArray(value)) {
    return value.map(compactPromptValue).filter((item) => {
      if (item == null || item === "") return false;
      if (Array.isArray(item) && item.length === 0) return false;
      if (item && typeof item === "object" && !Array.isArray(item) && Object.keys(item).length === 0) return false;
      return true;
    });
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (key === "vocabulary") continue;
      const next = compactPromptValue(value[key]);
      if (next == null || next === "") continue;
      if (Array.isArray(next) && next.length === 0) continue;
      if (next && typeof next === "object" && !Array.isArray(next) && Object.keys(next).length === 0) continue;
      out[key] = next;
    }
    return out;
  }
  return value;
}

/** Render {{var}} placeholders; missing vars become empty. Values are stringified and length-capped. */
export function renderPrompt(taskId, vars = {}) {
  const tpl = PROMPTS[taskId];
  if (!tpl) throw new Error(`no prompt for ${taskId}`);
  const promptVars = { ...vars };
  if (taskId === "explanation") delete promptVars.cache_bust;
  const user = tpl.user.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    let v = promptVars[k];
    if (VARIABLE_TASKS.has(taskId) && v && typeof v === "object") v = compactPromptValue(v);
    const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
    return s.slice(0, 4000);
  });
  return { version: tpl.version, system: tpl.system, user };
}
