/**
 * /api/discovery/interpret through the real route and fake provider.
 * resolveDiscoveryContext is not mocked: a wrong call signature returns constraints_required.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { createFakeProvider } from "../src/ai/providers/fake.js";
import { createMemberSession } from "../src/lib/session.js";
import { routeWeaveRequest } from "../src/weave/routes.js";

function migrate() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  const files = readdirSync(new URL("../migrations/", import.meta.url)).filter((name) => name.endsWith(".sql")).sort();
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

function seed(sqlite) {
  sqlite.prepare(
    `INSERT INTO household
      (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
     VALUES ('hh_d06', 'D06', 'active', 'America/Chicago', 2, 'synthetic_qa', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z', 'synthetic')`
  ).run();
  sqlite.prepare(
    `INSERT INTO member
      (member_id, household_id, display_name, role, status, created_at, updated_at)
     VALUES ('m_a', 'hh_d06', 'A', 'owner', 'active', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`
  ).run();
  sqlite.prepare(
    `INSERT INTO catalog_dish
      (dish_id, slug, title, name, cuisine, meal_format, primary_ingredient, tags_json, sparks_json, chips_json, created_at)
     VALUES ('dish_salmon', 'miso-salmon', 'Miso Salmon', 'Miso Salmon', 'japanese', 'bowls', 'salmon', '[]', '[]', '[]', '2026-10-10T00:00:00Z')`
  ).run();
  sqlite.prepare(
    `INSERT INTO catalog_version
      (recipe_version_id, recipe_id, dish_id, version_number, title, base_servings, total_minutes,
       effort_level, ingredient_complexity, methods_json, dietary_tags_json, publication_status,
       visibility, content_hash, source_contract, source_path, created_at)
     VALUES ('rv_salmon_v1', 'rec_salmon', 'dish_salmon', 1, 'Miso Salmon', 2, 30,
       'easy', 'simple', '[]', '[]', 'published', 'global', 'hash', 'test', 'test/salmon', '2026-10-10T00:00:00Z')`
  ).run();
}

const DISCOVERY_DELTA = {
  acknowledgement: "Cozy and easy.",
  clear: [],
  text_residue: null,
  max_minutes: null,
  max_minutes_hard: null,
  quick: null,
  different: null,
  keep_it_easy: true,
  keep_ingredients_simple: null,
  list_ops: [{ field: "intent_cues", op: "add", value: "cozy" }],
};

async function postInterpret(env, token, body) {
  const request = new Request("https://example.test/api/discovery/interpret", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ schema_version: 1, mode: "standalone", state: null, ...body }),
  });
  const res = await routeWeaveRequest(env, request, "/api/discovery/interpret");
  return { status: res.status, body: await res.json() };
}

describe("/api/discovery/interpret", () => {
  it("runs a non-bypass utterance through the fake provider and the real discovery context", async () => {
    const sqlite = migrate();
    seed(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_d06", member_id: "m_a" });
    const provider = createFakeProvider({ script: [{ json: DISCOVERY_DELTA }] });
    const env = {
      DB: db,
      CATALOG_SOURCE: "d1",
      AI_PROVIDER: "fake",
      AI_FAKE_PROVIDER: provider,
      AI_GATEWAY_ENABLED: "1",
      AI_TASKS_ENABLED: "discovery_intent",
      AI_DAILY_BUDGET_USD: "5",
    };
    const res = await postInterpret(env, session.session_token, { text: "Something cozy but not too heavy." });
    expect(res.status).toBe(200);
    expect(res.body.error).toBeUndefined();
    expect(res.body.ok).toBe(true);
    expect(res.body.source).toBe("provider");
    expect(res.body.state.intent_cues).toEqual(["cozy"]);
    expect(res.body.fallback_code).toBeNull();
    expect(provider.calls).toHaveLength(1);
    expect(provider.calls[0].schema_name).toBe("discovery_intent");
    expect(Array.isArray(res.body.results)).toBe(true);
  });

  it("bypasses a lexicon term without a provider call and without constraints_required", async () => {
    const sqlite = migrate();
    seed(sqlite);
    const db = asD1(sqlite);
    const session = await createMemberSession(db, { household_id: "hh_d06", member_id: "m_a" });
    const provider = createFakeProvider({ script: [{ throw: { message: "provider should not run" } }] });
    const env = {
      DB: db,
      CATALOG_SOURCE: "d1",
      AI_PROVIDER: "fake",
      AI_FAKE_PROVIDER: provider,
      AI_GATEWAY_ENABLED: "1",
      AI_TASKS_ENABLED: "discovery_intent",
      AI_DAILY_BUDGET_USD: "5",
    };
    const res = await postInterpret(env, session.session_token, { text: "salmon" });
    expect(res.status).toBe(200);
    expect(res.body.error).toBeUndefined();
    expect(res.body.ok).toBe(true);
    expect(res.body.source).toBe("bypass");
    expect(res.body.state.ingredients).toEqual(["salmon"]);
    expect(provider.calls).toHaveLength(0);
    expect(Array.isArray(res.body.results)).toBe(true);
  });
});
