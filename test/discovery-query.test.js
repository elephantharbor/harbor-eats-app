import { describe, expect, it } from "vitest";
import { preferenceTier } from "../src/lib/classification.js";
import { emptyNightCount, normalizeClientContext, resolveDiscoveryContext, selectionFor } from "../src/discovery/context.js";
import { EXPLICIT_EASY_FIXTURE, EMPTY_QUERY_FIXTURE, QUICK_NOT_EASY_FIXTURE } from "../src/discovery/fixtures.js";
import { parseDiscoveryHttp, routeDiscoveryRequest } from "../src/discovery/http.js";
import { matchMealText } from "../src/discovery/match.js";
import { interpretFreeText } from "../src/discovery/nlp.js";
import {
  canonicalQuery,
  emptyQuery,
  normalizeQuery,
  parseQuery,
  serializeQueryString,
  validateQuery,
} from "../src/discovery/query.js";

describe("discovery query", () => {
  it("starts from an empty browse", () => {
    const query = emptyQuery();
    expect(query.text).toBeNull();
    expect(query.criteria.quick).toBe(false);
    expect(query.criteria.effort_levels).toEqual([]);
    expect(query.criteria.ingredient_complexities).toEqual([]);
    expect(query.soft).toEqual({ keep_it_easy: false, keep_ingredients_simple: false });
    expect(query.soft_provided).toBe(false);
    expect(normalizeQuery({}).query).toEqual(query);
    expect(validateQuery({}).ok).toBe(true);
  });

  it("canonicalizes text and slug lists", () => {
    const result = normalizeQuery(EXPLICIT_EASY_FIXTURE.input);
    expect(result.ok).toBe(true);
    expect(result.query.text).toBe("lemon herb");
    expect(result.query.criteria.effort_levels).toEqual(["easy"]);
    expect(result.query.criteria.quick).toBe(false);
    expect(result.query.criteria.cuisines).toEqual(["american", "american-inspired"]);
    expect(result.query.soft_provided).toBe(true);
    expect(result.query.soft.keep_ingredients_simple).toBe(true);
    expect(result.query.criteria.effort_levels).not.toContain("quick");
  });

  it("does not turn Quick into Easy or Simple into a pantry field", () => {
    const quick = normalizeQuery(QUICK_NOT_EASY_FIXTURE.input);
    expect(quick.ok).toBe(true);
    expect(quick.query.criteria.quick).toBe(true);
    expect(quick.query.criteria.max_minutes).toBe(25);
    expect(quick.query.criteria.effort_levels).toEqual([]);
    expect(quick.query.criteria.ingredient_complexities).toEqual([]);

    expect(normalizeQuery({ criteria: { easy: true } }).error).toBe("unknown_field");
    expect(normalizeQuery({ criteria: { simple: true } }).error).toBe("unknown_field");
    expect(normalizeQuery({ pantry: ["onion"] }).error).toBe("pantry_not_a_filter");
    expect(normalizeQuery({ already_have: true }).error).toBe("pantry_not_a_filter");
    expect(normalizeQuery({ constraints: [] }).error).toBe("client_constraints_forbidden");
    expect(normalizeQuery({ eligible: true }).error).toBe("client_constraints_forbidden");
    expect(normalizeQuery({ criteria: { effort: "easy" } }).error).toBe("unknown_field");
  });

  it("rejects an unknown effort and a non-boolean quick flag", () => {
    expect(normalizeQuery({ criteria: { effort_levels: ["fast"] } }).error).toBe("effort_levels_invalid");
    expect(normalizeQuery({ criteria: { ingredient_complexities: ["pantry"] } }).error).toBe("ingredient_complexities_invalid");
    expect(normalizeQuery({ criteria: { quick: "yes" } }).error).toBe("quick_invalid");
    expect(normalizeQuery({ soft: { keep_it_easy: "yes" } }).error).toBe("keep_it_easy_invalid");
  });

  it("round-trips the fixtures through the query string", () => {
    for (const fixture of [EMPTY_QUERY_FIXTURE, EXPLICIT_EASY_FIXTURE, QUICK_NOT_EASY_FIXTURE]) {
      const normalized = normalizeQuery(fixture.input);
      expect(normalized.ok).toBe(true);
      const search = serializeQueryString(normalized.query);
      expect(search).toBe(fixture.search);
      const parsed = parseQuery(search);
      expect(parsed.ok).toBe(true);
      expect(parsed.query).toEqual(normalized.query);
      expect(canonicalQuery(parsed.query).schema_version).toBe(1);
    }
  });

  it("keeps an omitted soft chip distinct from an explicit off", () => {
    const omitted = parseQuery("schema=1&limit=20&offset=0");
    const explicitOff = parseQuery("schema=1&keep_it_easy=0&keep_ingredients_simple=0&limit=20&offset=0");
    expect(omitted.query.soft_provided).toBe(false);
    expect(explicitOff.query.soft_provided).toBe(true);
    expect(explicitOff.query.soft.keep_it_easy).toBe(false);
  });
});

describe("discovery collections", () => {
  it("expands base cuisines and the plant collection without inventing synonyms", () => {
    const cuisine = normalizeQuery({ criteria: { cuisines: ["italian"] } });
    expect(cuisine.query.criteria.cuisines).toEqual(["italian", "italian-inspired"]);
    expect(normalizeQuery({ criteria: { cuisines: ["Italian-Inspired"] } }).query.criteria.cuisines).toEqual(["italian-inspired"]);
    const greek = normalizeQuery({ criteria: { cuisines: ["greek"] } });
    expect(greek.query.criteria.cuisines).toEqual(["greek", "greek-inspired"]);
    expect(greek.query.criteria.cuisines).not.toContain("mediterranean");

    expect(normalizeQuery({ criteria: { diet: ["plant"] } }).query.criteria.diet).toEqual(["plant", "plant_based", "vegetarian"]);
    expect(normalizeQuery({ criteria: { diet: ["vegetarian"] } }).query.criteria.diet).toEqual(["vegetarian"]);
    expect(normalizeQuery({ criteria: { diet: ["dairy_free"] } }).query.criteria.diet).toEqual(["dairy_free"]);
    expect(normalizeQuery({ criteria: { diet: ["vegan"] } }).error).toBe("diet_invalid");
    expect(normalizeQuery({ criteria: { protein_groups: ["seafood"] } }).query.criteria.protein_groups).toEqual(["seafood"]);
    expect(normalizeQuery({ criteria: { protein_groups: ["beef"] } }).error).toBe("protein_groups_invalid");
    expect(normalizeQuery({ criteria: { textures: ["crispy"] } }).ok).toBe(true);
    expect(normalizeQuery({ criteria: { textures: ["smoky"] } }).error).toBe("textures_invalid");
    expect(normalizeQuery({ criteria: { different: "yes" } }).error).toBe("different_invalid");

    const different = parseQuery("schema=1&different=1&protein=fish,shellfish&diet=plant&texture=creamy&limit=20&offset=0");
    expect(different.ok).toBe(true);
    expect(different.query.criteria.different).toBe(true);
    expect(different.query.criteria.protein_groups).toEqual(["fish", "shellfish"]);
    expect(different.query.criteria.diet).toEqual(["plant", "plant_based", "vegetarian"]);
    expect(different.query.criteria.textures).toEqual(["creamy"]);
    expect(serializeQueryString(different.query)).toBe(
      "schema=1&protein=fish%2Cshellfish&diet=plant%2Cplant_based%2Cvegetarian&texture=creamy&different=1&limit=20&offset=0"
    );
  });
});

describe("discovery context", () => {
  it("rejects a plan id on standalone search", () => {
    expect(normalizeClientContext({ mode: "standalone", dinner_plan_id: "dp_1" }).error).toBe("dinner_plan_not_allowed");
    expect(normalizeClientContext({ constraints: [] }).error).toBe("client_constraints_forbidden");
    expect(normalizeClientContext({ mode: "replace_plan_meal", dinner_plan_id: "dp_1" }).error).toBe("meal_required");
  });

  it("loads replace-mode participants, the current slug, and plan chips from the server", () => {
    const client = normalizeClientContext({
      mode: "replace_plan_meal",
      dinner_plan_id: "dp_1",
      meal_id: "dpm_1",
    });
    const resolved = resolveDiscoveryContext(client.context, {
      household_id: "hh_1",
      member_ids: ["m1"],
      constraints: [{ member_id: "m1", rule_key: "dairy", status: "prohibited" }],
      tastes: [],
      recent_slugs: ["soup"],
      plan: {
        dinner_plan_id: "dp_1",
        household_id: "hh_1",
        meal_count: 2,
        intent: { keep_it_easy: true, keep_ingredients_simple: false },
        meals: [
          { meal_id: "dpm_1", kind: "recipe", state: "planned", position: 1, recipe_slug: "tacos", participant_ids: ["m1"] },
          { meal_id: "dpm_2", kind: "recipe", state: "planned", position: 2, recipe_slug: "soup", participant_ids: ["m1"] },
        ],
      },
    }, { soft_provided: false, soft: { keep_it_easy: false, keep_ingredients_simple: false } });
    expect(resolved.ok).toBe(true);
    expect(resolved.context.exclude_slugs).toEqual(["tacos"]);
    expect(resolved.context.plan_slugs).toEqual(["soup"]);
    expect(resolved.context.participant_ids).toEqual(["m1"]);
    expect(resolved.context.soft).toEqual({ keep_it_easy: true, keep_ingredients_simple: false });
    expect(resolved.context.soft_source).toBe("plan_intent");
    expect(resolved.context.constraints).toHaveLength(1);
    const selection = selectionFor(resolved.context);
    expect(selection.action).toBe("swap_meal");
    expect(selection.op).toBe("swap_meal");
    expect(selection.recipe_version_id_from).toBe("result");
    expect(selection.path).toBe("/api/dinner-plans/dp_1/mutations");
  });

  it("adds a meal when choose-for-plan has room and no slot id", () => {
    const client = normalizeClientContext({ mode: "choose_for_plan", dinner_plan_id: "dp_1" });
    const resolved = resolveDiscoveryContext(client.context, {
      household_id: "hh_1",
      member_ids: ["m1"],
      constraints: [],
      tastes: [],
      plan: {
        dinner_plan_id: "dp_1",
        household_id: "hh_1",
        meal_count: 2,
        intent: {},
        meals: [
          { meal_id: "dpm_1", kind: "recipe", state: "planned", recipe_slug: "soup", participant_ids: ["m1"] },
        ],
      },
    }, emptyQuery());
    expect(resolved.ok).toBe(true);
    expect(resolved.context.exclude_slugs).toEqual(["soup"]);
    expect(selectionFor(resolved.context).action).toBe("add_meal");
    expect(resolved.context.soft_source).toBe("plan_intent");
    expect(resolved.context.position).toBeNull();
  });

  it("fills an empty night with add_meal and ignores a client position", () => {
    const plan = {
      dinner_plan_id: "dp_1",
      household_id: "hh_1",
      meal_count: 3,
      intent: {},
      meals: [
        { meal_id: "dpm_1", kind: "recipe", state: "planned", position: 1, recipe_slug: "soup", participant_ids: ["m1"] },
      ],
    };
    expect(emptyNightCount(plan)).toBe(2);
    const client = normalizeClientContext({
      mode: "choose_for_plan",
      dinner_plan_id: "dp_1",
      position: 2,
    });
    const resolved = resolveDiscoveryContext(client.context, {
      household_id: "hh_1",
      member_ids: ["m1"],
      constraints: [],
      tastes: [],
      plan,
    }, emptyQuery());
    expect(resolved.ok).toBe(true);
    expect(resolved.context.position).toBeNull();
    expect(resolved.context.meal_id).toBeNull();
    expect(selectionFor(resolved.context).action).toBe("add_meal");

    const full = resolveDiscoveryContext(client.context, {
      household_id: "hh_1",
      member_ids: ["m1"],
      constraints: [],
      tastes: [],
      plan: { ...plan, meal_count: 1 },
    }, emptyQuery());
    expect(full.error).toBe("plan_full");
  });

  it("swaps a stored recipe row and refuses leftovers", () => {
    const base = {
      household_id: "hh_1",
      member_ids: ["m1"],
      constraints: [],
      tastes: [],
    };
    const recipe = resolveDiscoveryContext(
      normalizeClientContext({ mode: "choose_for_plan", dinner_plan_id: "dp_1", meal_id: "dpm_1" }).context,
      {
        ...base,
        plan: {
          dinner_plan_id: "dp_1",
          household_id: "hh_1",
          meal_count: 1,
          intent: {},
          meals: [
            { meal_id: "dpm_1", kind: "recipe", state: "planned", position: 1, recipe_slug: "soup", participant_ids: ["m1"] },
          ],
        },
      },
      emptyQuery()
    );
    expect(recipe.context.position).toBe(1);
    expect(selectionFor(recipe.context).action).toBe("swap_meal");

    const leftovers = resolveDiscoveryContext(
      normalizeClientContext({ mode: "choose_for_plan", dinner_plan_id: "dp_1", meal_id: "dpm_1" }).context,
      {
        ...base,
        plan: {
          dinner_plan_id: "dp_1",
          household_id: "hh_1",
          meal_count: 2,
          intent: {},
          meals: [
            { meal_id: "dpm_1", kind: "leftovers", state: "planned", position: 1, recipe_slug: null, participant_ids: ["m1"] },
          ],
        },
      },
      emptyQuery()
    );
    expect(leftovers.error).toBe("outcome_locked");
  });
});

describe("discovery http outline", () => {
  it("leaves other paths alone and refuses a non-d1 catalog", async () => {
    const request = new Request("http://localhost/api/discovery/search");
    const url = new URL(request.url);
    expect(await routeDiscoveryRequest({}, request, "/api/health", url)).toBeNull();
    const missing = await routeDiscoveryRequest({ CATALOG_SOURCE: "recipe-store" }, request, "/api/discovery/search", url);
    expect(missing.status).toBe(503);
    const body = await missing.json();
    expect(body.error).toBe("catalog_source_required");
    const put = new Request(request.url, { method: "PUT" });
    const method = await routeDiscoveryRequest({ CATALOG_SOURCE: "d1" }, put, "/api/discovery/search", url);
    expect(method.status).toBe(405);
  });

  it("parses a GET into the same query object as POST", async () => {
    const getUrl = new URL("http://localhost/api/discovery/search?q=taco&quick=1&effort=easy&mode=standalone");
    const got = await parseDiscoveryHttp(new Request(getUrl), getUrl);
    expect(got.ok).toBe(true);
    expect(got.query.criteria.quick).toBe(true);
    expect(got.query.criteria.effort_levels).toEqual(["easy"]);
    expect(got.query.text).toBe("taco");
    const post = await parseDiscoveryHttp(
      new Request("http://localhost/api/discovery/search", {
        method: "POST",
        body: JSON.stringify({
          mode: "standalone",
          query: { text: "taco", criteria: { quick: true, effort_levels: ["easy"] } },
        }),
      }),
      getUrl
    );
    expect(post.ok).toBe(true);
    expect(post.query.criteria).toEqual(got.query.criteria);
    expect(post.client.mode).toBe("standalone");
    expect(got.client.mode).toBe("standalone");
    const textWins = new URL("http://localhost/api/discovery/search?q=soup&text=taco");
    const won = await parseDiscoveryHttp(new Request(textWins), textWins);
    expect(won.query.text).toBe("taco");
  });
});

describe("discovery text match", () => {
  const tacos = { title: "Crispy Chipotle Tofu Tacos", cuisine: "mexican", vocabulary_tag_ids: [], ingredient_names: ["tofu"] };
  const soup = { title: "White Bean Kale Soup", cuisine: "american", vocabulary_tag_ids: [], ingredient_names: ["kale"] };

  it("matches every token and lets a prefix of three characters hit", () => {
    expect(matchMealText(tacos, null).match).toBe(true);
    expect(matchMealText(tacos, "taco").match).toBe(true);
    expect(matchMealText(tacos, "crispy tofu").match).toBe(true);
    expect(matchMealText(soup, "taco").match).toBe(false);
    expect(matchMealText(tacos, "zz").match).toBe(false);
  });
});

describe("nlp adapter", () => {
  it("does not interpret free text in D-07", () => {
    const result = interpretFreeText({ text: "something easy and quick with chicken" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("nlp_not_in_d07");
    expect(result.owner).toBe("D-06");
  });
});

describe("soft tier parity", () => {
  it("uses classification.preferenceTier for both chips", () => {
    const prefs = { keep_it_easy: true, keep_ingredients_simple: true };
    expect(preferenceTier("easy", "simple", prefs)).toBe(0);
    expect(preferenceTier("easy", "standard", prefs)).toBe(1);
    expect(preferenceTier("moderate", "simple", prefs)).toBe(3);
  });
});
