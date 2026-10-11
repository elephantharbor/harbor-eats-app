/**
 * Unmocked /api/recipes/adapt and /api/explain.
 * The fake provider is the only stand-in. The routes, gateway, and safety checks run.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createFakeProvider } from "../src/ai/providers/fake.js";
import { routeAlphaAiRequest } from "../src/ai/alpha-routes.js";
import { PRESSURE_COOKER_UNSUPPORTED } from "../src/lib/meal-adaptation.js";
import { canonicalIngredient } from "../src/lib/ingredient-identity.js";
import { plannerCatalog } from "../src/lib/dinner-planner.js";
import { getConceptBySlug } from "../src/lib/recipe-store.js";
import { createMemberSession } from "../src/lib/session.js";
import { getTasteTerm } from "../src/lib/taste-vocabulary.js";

function migrate() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(new URL("../migrations/", import.meta.url))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of files) sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  return sqlite;
}

function asD1(sqlite) {
  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              sqlite.prepare(sql).run(...params);
              return { success: true, meta: { changes: 1 } };
            },
            async first() {
              return sqlite.prepare(sql).get(...params) ?? null;
            },
            async all() {
              return { results: sqlite.prepare(sql).all(...params) };
            },
          };
        },
      };
    },
  };
}

function seedHousehold(sqlite, { nuts = false } = {}) {
  sqlite.prepare(
    `INSERT INTO household
      (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
     VALUES ('hh_alpha', 'Alpha', 'active', 'America/Chicago', 2, 'synthetic_qa', '2026-10-11T00:00:00Z', '2026-10-11T00:00:00Z', 'synthetic')`
  ).run();
  sqlite.prepare(
    `INSERT INTO member
      (member_id, household_id, display_name, role, status, created_at, updated_at)
     VALUES ('m_a', 'hh_alpha', 'A', 'owner', 'active', '2026-10-11T00:00:00Z', '2026-10-11T00:00:00Z')`
  ).run();
  if (nuts) {
    sqlite.prepare(
      `INSERT INTO constraint_rule
        (constraint_id, household_id, member_id, rule_key, status, created_at, updated_at)
       VALUES ('c_nuts', 'hh_alpha', 'm_a', 'nuts', 'prohibited', '2026-10-11T00:00:00Z', '2026-10-11T00:00:00Z')`
    ).run();
  }
}

function seedTaste(sqlite, slug) {
  const term = getTasteTerm(slug);
  sqlite.prepare(
    `INSERT INTO taste_vocabulary
      (slug, display_name, category, active, synonyms_json, created_at)
     VALUES (?, ?, ?, 1, '[]', '2026-10-11T00:00:00Z')`
  ).run(slug, term.display_name, term.category);
  sqlite.prepare(
    `INSERT INTO diner_taste
      (taste_id, household_id, member_id, vocabulary_slug, rank, stance, data_origin, created_at, updated_at)
     VALUES ('taste_1', 'hh_alpha', 'm_a', ?, 'love', 'explicit', 'household', '2026-10-11T00:00:00Z', '2026-10-11T00:00:00Z')`
  ).run(slug);
}

function explainedRecipe() {
  return plannerCatalog().find((row) => {
    const tags = row.pkg.vocabulary_tag_ids || [];
    return tags.some((slug) => getTasteTerm(slug)) && !tags.includes("smoky") && !tags.includes("savory");
  });
}

async function postJson(env, token, path, body) {
  const request = new Request(`https://example.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const res = await routeAlphaAiRequest(env, request, path);
  return { status: res.status, body: await res.json() };
}

function envFor(db, provider, extra = {}) {
  return {
    DB: db,
    AI_PROVIDER: provider ? "fake" : "none",
    AI_FAKE_PROVIDER: provider,
    AI_GATEWAY_ENABLED: "1",
    AI_TASKS_ENABLED: "recipe_adaptation,explanation",
    AI_DAILY_BUDGET_USD: "5",
    ...extra,
  };
}

const FALLBACK_ACK = "We're not sure that would work here, so we'd keep the original.";

describe("alpha routes through the fake provider", () => {
  it("adapts through the gateway and keeps a known swap", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_alpha", member_id: "m_a" });
    const concept = getConceptBySlug("miso-ginger-salmon");
    const ingredient = concept.current_version.ingredients[0];
    const fromId = canonicalIngredient(ingredient.name).ingredient_id;
    const provider = createFakeProvider({
      script: [{
        json: {
          acknowledgement: "Parsley works here.",
          kind: "substitution",
          support: "advice",
          ingredient_ops: [{ op: "replace", from_id: fromId, to_name: "parsley", policy: "keep_scaled" }],
          step_notes: [],
          equipment_supported: true,
          flavor_impact: "similar",
          warning: null,
        },
      }],
    });
    const res = await postJson(envFor(db, provider), session.session_token, "/api/recipes/adapt", {
      text: "no cilantro",
      recipe_slug: "miso-ginger-salmon",
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.support).toBe("advice");
    expect(res.body.override.ops.some((op) => op.to_name === "parsley")).toBe(true);
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].schema_name).toBe("recipe_adaptation");
  });

  it("skips the provider when the cook asks to drop the pressure cooker", async () => {
    const concept = getConceptBySlug("miso-ginger-salmon");
    const previous = concept.current_version.equipment;
    concept.current_version.equipment = ["pressure cooker"];
    try {
      const sqlite = migrate();
      seedHousehold(sqlite);
      const db = asD1(sqlite);
      const session = await createMemberSession(db, { household_id: "hh_alpha", member_id: "m_a" });
      const provider = createFakeProvider({
        script: [{ json: { acknowledgement: "Use a pot.", support: "advice", kind: "method", ingredient_ops: [], step_notes: [], equipment_supported: true, flavor_impact: "similar", warning: null } }],
      });
      const res = await postJson(envFor(db, provider), session.session_token, "/api/recipes/adapt", {
        text: "Make this without the pressure cooker.",
        recipe_slug: "miso-ginger-salmon",
      });
      expect(res.status).toBe(200);
      expect(res.body.support).toBe("unsupported");
      expect(res.body.acknowledgement).toBe(PRESSURE_COOKER_UNSUPPORTED);
      expect(res.body.ingredient_ops).toEqual([]);
      expect(res.body.usage.provider_calls).toBe(0);
      expect(provider.calls).toHaveLength(0);
    } finally {
      concept.current_version.equipment = previous;
    }
  });

  it("keeps the pressure-cooker refusal when the gateway would have fallen back", async () => {
    const concept = getConceptBySlug("miso-ginger-salmon");
    const previous = concept.current_version.equipment;
    concept.current_version.equipment = ["pressure cooker"];
    try {
      const sqlite = migrate();
      seedHousehold(sqlite);
      const db = asD1(sqlite);
      const session = await createMemberSession(db, { household_id: "hh_alpha", member_id: "m_a" });
      const provider = createFakeProvider({ script: [{ json: { acknowledgement: "should not run" } }] });
      const res = await postJson(
        envFor(db, provider, { AI_TASKS_ENABLED: "planning_intent,discovery_intent" }),
        session.session_token,
        "/api/recipes/adapt",
        { text: "Make this without the pressure cooker.", recipe_slug: "miso-ginger-salmon" }
      );
      expect(res.status).toBe(200);
      expect(res.body.support).toBe("unsupported");
      expect(res.body.acknowledgement).toBe(PRESSURE_COOKER_UNSUPPORTED);
      expect(res.body.usage.provider_calls).toBe(0);
      expect(provider.calls).toHaveLength(0);
    } finally {
      concept.current_version.equipment = previous;
    }
  });

  it("does not offer Apply when the replace source is missing", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_alpha", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [{
        json: {
          acknowledgement: "Parsley works here.",
          kind: "substitution",
          support: "advice",
          ingredient_ops: [{ op: "replace", from_id: null, to_name: "parsley", policy: "keep_scaled" }],
          step_notes: [],
          equipment_supported: true,
          flavor_impact: "similar",
          warning: null,
        },
      }],
    });
    const res = await postJson(envFor(db, provider), session.session_token, "/api/recipes/adapt", {
      text: "use parsley",
      recipe_slug: "miso-ginger-salmon",
    });
    expect(res.status).toBe(200);
    expect(res.body.ingredient_ops).toEqual([]);
    expect(res.body.override).toBeUndefined();
    expect(res.body.support).toBe("unsupported");
    expect(provider.calls).toHaveLength(1);
    expect(res.body.usage.provider_calls).toBe(1);
  });

  it("rejects peanuts for every active diner when the request has no meal", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, { nuts: true });
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_alpha", member_id: "m_a" });
    const concept = getConceptBySlug("miso-ginger-salmon");
    const fromId = canonicalIngredient(concept.current_version.ingredients[0].name).ingredient_id;
    const provider = createFakeProvider({
      script: [{
        json: {
          acknowledgement: "Peanuts would be crunchy.",
          kind: "substitution",
          support: "advice",
          ingredient_ops: [{ op: "replace", from_id: fromId, to_name: "peanuts", policy: "keep_scaled" }],
          step_notes: [],
          equipment_supported: true,
          flavor_impact: "richer",
          warning: null,
        },
      }],
    });
    const res = await postJson(envFor(db, provider), session.session_token, "/api/recipes/adapt", {
      text: "use peanuts",
      recipe_slug: "miso-ginger-salmon",
    });
    expect(res.status).toBe(200);
    expect(res.body.support).toBe("rejected_safety");
    expect(res.body.ingredient_ops).toEqual([]);
    expect(provider.calls).toHaveLength(1);
  });

  it.each([
    ["disabled", { AI_TASKS_ENABLED: "planning_intent,discovery_intent" }],
    ["unavailable", { AI_PROVIDER: "none", AI_FAKE_PROVIDER: undefined }],
    ["rate_limited", { AI_GLOBAL_PER_DAY: "0" }],
  ])("adapt returns the fallback reply when the gateway is %s", async (_label, extra) => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_alpha", member_id: "m_a" });
    const provider = createFakeProvider({ script: [{ json: { acknowledgement: "should not run" } }] });
    const res = await postJson(envFor(db, provider, extra), session.session_token, "/api/recipes/adapt", {
      text: "less spicy",
      recipe_slug: "miso-ginger-salmon",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, support: "fallback", acknowledgement: FALLBACK_ACK, kind: "unsupported" });
    expect(provider.calls).toHaveLength(0);
  });

  it("adapt returns the fallback reply when the model output is invalid", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_alpha", member_id: "m_a" });
    const provider = createFakeProvider({ script: [{ json: { nope: true } }] });
    const res = await postJson(envFor(db, provider), session.session_token, "/api/recipes/adapt", {
      text: "less spicy",
      recipe_slug: "miso-ginger-salmon",
    });
    expect(res.status).toBe(200);
    expect(res.body.support).toBe("fallback");
    expect(res.body.acknowledgement).toBe(FALLBACK_ACK);
    expect(res.body.usage.provider_calls).toBe(1);
    expect(provider.calls.length).toBeGreaterThan(0);
  });

  it("explains from server evidence and does not return the packet", async () => {
    const entry = explainedRecipe();
    const tag = entry.pkg.vocabulary_tag_ids.find((slug) => getTasteTerm(slug) && slug !== "smoky");
    const display = getTasteTerm(tag).display_name;
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedTaste(sqlite, tag);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_alpha", member_id: "m_a" });
    const provider = createFakeProvider({
      script: [{ json: { text: `${display} fits this dinner.`, used_fact_ids: ["taste_like"] } }],
    });
    const res = await postJson(envFor(db, provider), session.session_token, "/api/explain", {
      recipe_slug: entry.concept.concept_id,
      row: {
        primary_reason: "taste_love",
        taste_hits: [
          { agreement: true, display_name: "Smoky" },
          { agreement: true, display_name: "Savory" },
        ],
      },
      intent: { keep_it_easy: true },
      facts: [{ id: "forged", kind: "taste_agreement", phrase: "smoky, savory dinners" }],
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.source).toBe("provider");
    expect(res.body.text).toBe(`${display} fits this dinner.`);
    expect(res.body.packet).toBeUndefined();
    expect(res.body.facts).toBeUndefined();
    expect(res.body.allowed_phrases).toBeUndefined();
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].schema_name).toBe("explanation");
    expect(provider.calls[0].user).not.toMatch(/smoky/i);
    expect(provider.calls[0].user).toMatch(new RegExp(display, "i"));
  });

  it.each([
    ["disabled", { AI_TASKS_ENABLED: "planning_intent" }],
    ["unavailable", { AI_PROVIDER: "none", AI_FAKE_PROVIDER: undefined }],
    ["rate_limited", { AI_GLOBAL_PER_DAY: "0" }],
  ])("explain returns the template when the gateway is %s", async (_label, extra) => {
    const entry = explainedRecipe();
    const tag = entry.pkg.vocabulary_tag_ids.find((slug) => getTasteTerm(slug));
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedTaste(sqlite, tag);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_alpha", member_id: "m_a" });
    const provider = createFakeProvider({ script: [{ json: { text: "should not run", used_fact_ids: ["taste_like"] } }] });
    const res = await postJson(envFor(db, provider, extra), session.session_token, "/api/explain", {
      recipe_slug: entry.concept.concept_id,
    });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.source).toBe("fallback");
    expect(res.body.packet).toBeUndefined();
    expect(res.body.text).not.toMatch(/smoky/i);
    expect(provider.calls).toHaveLength(0);
  });

  it("explain returns the template when the gateway output is invalid", async () => {
    const entry = explainedRecipe();
    const tag = entry.pkg.vocabulary_tag_ids.find((slug) => getTasteTerm(slug));
    const sqlite = migrate();
    seedHousehold(sqlite);
    seedTaste(sqlite, tag);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_alpha", member_id: "m_a" });
    const provider = createFakeProvider({ script: [{ json: { text: "Totally smoky dinners.", used_fact_ids: ["taste_like"] } }] });
    const res = await postJson(envFor(db, provider), session.session_token, "/api/explain", {
      recipe_slug: entry.concept.concept_id,
    });
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("fallback");
    expect(res.body.text).not.toMatch(/smoky/i);
    expect(res.body.packet).toBeUndefined();
    expect(res.body.usage.provider_calls).toBe(1);
  });
});
