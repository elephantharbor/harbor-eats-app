/**
 * Grocery routes through the worker entry, with a mock adapter.
 * Browser interception is not used.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";
import { createMemberSession } from "../src/lib/session.js";
import { saveDinnerPlan } from "../src/lib/dinner-plan-store.js";
import { projectSavedPlan } from "../src/lib/household-shop-routes.js";
import { plannerCatalog } from "../src/lib/dinner-planner.js";
import { createDinnerPlan } from "../src/lib/plan-mutations.js";

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
            sql,
            params,
            async run() {
              const result = sqlite.prepare(sql).run(...params);
              return { success: true, meta: { changes: result.changes } };
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
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        try {
          sqlite.exec("ROLLBACK");
        } catch {
          /* already rolled back */
        }
        throw error;
      }
    },
  };
}

function seed(sqlite) {
  sqlite
    .prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin, settings_json)
       VALUES ('hh_g', 'Peanut House', 'active', 'America/Chicago', 2, 'organic', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z', 'synthetic', '{"shopping":{"usual_store":"Market Street"}}')`
    )
    .run();
  sqlite
    .prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES ('m_a', 'hh_g', 'Alex Peanut', 'owner', 'active', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')`
    )
    .run();
  sqlite
    .prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES ('m_off', 'hh_g', 'Off', 'member', 'active', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')`
    )
    .run();
  sqlite
    .prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES ('hh_other', 'Other', 'active', 'America/Chicago', 2, 'organic', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z', 'synthetic')`
    )
    .run();
  sqlite
    .prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES ('m_b', 'hh_other', 'Bea', 'owner', 'active', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')`
    )
    .run();
  sqlite
    .prepare(
      `INSERT INTO constraint_rule
        (constraint_id, household_id, member_id, rule_key, status, created_at, updated_at)
       VALUES ('c_nuts', 'hh_g', 'm_a', 'peanut_allergy_secret', 'prohibited', '2026-10-16T00:00:00Z', '2026-10-16T00:00:00Z')`
    )
    .run();
}

function envFor(sqlite, extra = {}) {
  const calls = [];
  return {
    calls,
    env: {
      DB: asD1(sqlite),
      ENVIRONMENT: "test",
      GROCERY_PROVIDERS: "instacart",
      GROCERY_FIXTURE: "instacart_mock",
      INSTACART_API_KEY: "keys.should-not-leak",
      GROCERY_FETCH: async (url, init) => {
        calls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null, authorization: init?.headers?.Authorization || "" });
        return new Response(JSON.stringify({ products_link_url: "https://www.instacart.com/store/shopping-list/mock" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      ...extra,
    },
  };
}

async function call(env, method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await worker.fetch(
    new Request(new URL(`https://fw.test${path}`), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
    env
  );
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, body: parsed, text };
}

async function session(sqlite, memberId, householdId) {
  return createMemberSession(asD1(sqlite), { household_id: householdId, member_id: memberId }, { secure: false });
}

describe("grocery server integration", () => {
  it("covers handoff, privacy, staleness, and failures without mutating the list", async () => {
    const sqlite = migrate();
    seed(sqlite);
    const { env, calls } = envFor(sqlite);
    const auth = await session(sqlite, "m_a", "hh_g");
    const other = await session(sqlite, "m_b", "hh_other");
    const removed = await session(sqlite, "m_off", "hh_g");
    sqlite.prepare(`UPDATE member SET status = 'left' WHERE member_id = 'm_off'`).run();

    const capsOff = await call({ ...env, GROCERY_PROVIDERS: "" }, "GET", "/api/grocery/capabilities", { token: auth.session_token });
    expect(capsOff.status).toBe(200);
    expect(capsOff.body.providers.map((row) => row.id)).toEqual(["instore"]);

    const anon = await call(env, "GET", "/api/grocery/capabilities");
    expect(anon.status).toBe(401);
    const inactive = await call(env, "POST", "/api/grocery/review", { token: removed.session_token, body: { provider_id: "instacart" } });
    expect(inactive.status).toBe(403);

    const caps = await call(env, "GET", "/api/grocery/capabilities", { token: auth.session_token });
    expect(caps.body.providers.map((row) => row.id)).toEqual(["instore", "instacart"]);
    expect(caps.body.providers.find((row) => row.id === "instacart").launch_enabled).toBe(false);
    expect(JSON.stringify(caps.body)).not.toContain("keys.should-not-leak");

    const unsupported = await call(env, "POST", "/api/grocery/operation", {
      token: auth.session_token,
      body: { provider_id: "instacart", capability: "cart_create" },
    });
    expect(unsupported.body.code).toBe("capability_unsupported");
    expect(calls).toHaveLength(0);

    const bypass = await call(env, "POST", "/api/grocery/operation", {
      token: auth.session_token,
      body: {
        provider_id: "instacart",
        capability: "list_handoff",
        title: "x",
        linkback_url: "https://fw.test/shop",
        lines: [{ name: "unreviewed", measurements: [{ quantity: 1, unit: "each" }] }],
      },
    });
    expect(bypass.status).toBe(400);
    expect(bypass.body.code).toBe("invalid_request");
    expect(bypass.text).not.toContain("products_link_url");
    expect(calls).toHaveLength(0);

    const version = plannerCatalog()[0].pkg.recipe_version_id;
    const created = createDinnerPlan(
      {
        household_id: "hh_g",
        dinner_plan_id: "dp_g",
        meal_count: 2,
        entry_point: "plan_dinners",
        participant_ids: ["m_a"],
        meals: [
          { kind: "recipe", recipe_version_id: version, guest_count: 1 },
          { kind: "recipe", recipe_version_id: version, guest_count: 2 },
        ],
      },
      {
        now: "2026-10-16T12:00:00.000Z",
        actor_member_id: "m_a",
        household_member_ids: ["m_a"],
        constraints: [],
        data_origin: "synthetic",
        tastes: [],
        catalog: plannerCatalog(),
        id: (() => {
          let n = 0;
          return (prefix) => `${prefix}_g${n++}`;
        })(),
      }
    );
    expect(created.ok).toBe(true);
    created.plan.created_by_member_id = "m_a";
    created.plan.data_origin = "synthetic";
    const guestsBefore = created.plan.meals.map((meal) => meal.guest_count);
    await saveDinnerPlan(env.DB, created.plan);
    await projectSavedPlan(env.DB, created.plan, "2026-10-16T12:00:00.000Z");

    async function shop(body) {
      const current = await call(env, "GET", "/api/household-shop", { token: auth.session_token });
      return call(env, "POST", "/api/household-shop", {
        token: auth.session_token,
        body: { expected_revision: current.body.list.revision, ...body },
      });
    }

    const towels = await shop({ op: "add_item", text: "2 rolls paper towels", client_request_id: "towels" });
    expect(towels.body.ok).toBe(true);
    const garlic = await shop({ op: "add_item", text: "3 cloves garlic", client_request_id: "garlic" });
    expect(garlic.body.ok).toBe(true);
    const onion = await shop({ op: "add_item", text: "2 count yellow onion", client_request_id: "onion" });
    expect(onion.body.ok).toBe(true);
    const noted = garlic.body.list.lines.find((row) => /garlic/i.test(row.display_name));
    await shop({
      op: "edit_line",
      line_id: noted.line_id,
      patch: { note: "peanut allergy secret note" },
    });
    const onionLine = (await call(env, "GET", "/api/household-shop", { token: auth.session_token })).body.list.lines.find((row) => /onion/i.test(row.display_name));
    await shop({ op: "edit_line", line_id: onionLine.line_id, patch: { quantity: 5 } });

    const listBefore = await call(env, "GET", "/api/household-shop", { token: auth.session_token });
    const review = await call(env, "POST", "/api/grocery/review", {
      token: auth.session_token,
      body: { provider_id: "instacart", expected_revision: listBefore.body.list.revision },
    });
    expect(review.status).toBe(200);
    expect(review.body.copy.going_title).toBe("Going to Instacart");
    expect(review.body.copy.staying_title).toBe("Staying on your FlavorWeave list");
    expect(review.body.usual_store_note).toContain("Market Street");
    expect(review.body.staying.some((row) => /garlic/i.test(row.display_text))).toBe(true);
    expect(review.body.included.some((row) => /onion/i.test(row.display_text) && row.quantity_label === "5 each")).toBe(true);
    expect(review.body.included.some((row) => /paper towels/i.test(row.display_text))).toBe(true);
    expect(review.body.launch_enabled).toBe(false);
    expect(JSON.stringify(review.body)).not.toContain("peanut");
    expect(JSON.stringify(review.body)).not.toContain("Alex");

    const staleReview = await call(env, "POST", "/api/grocery/review", {
      token: auth.session_token,
      body: { provider_id: "instacart", expected_revision: 1 },
    });
    expect(staleReview.status).toBe(409);
    expect(staleReview.body.code).toBe("revision_conflict");
    expect(calls).toHaveLength(0);

    const handoff = await call(env, "POST", "/api/grocery/handoff", {
      token: auth.session_token,
      body: {
        provider_id: "instacart",
        expected_revision: review.body.revision,
        reviewed_fingerprint: review.body.fingerprint,
      },
    });
    expect(handoff.status).toBe(200);
    expect(handoff.body.purchased).toBe(false);
    expect(handoff.body.products_link_url).toBeUndefined();
    expect(handoff.body.destination_accepted).toBe(true);
    expect(calls).toHaveLength(1);
    const sent = JSON.stringify(calls[0].body);
    expect(sent).not.toContain("peanut");
    expect(sent).not.toContain("Alex");
    expect(sent).not.toContain("Market Street");
    expect(sent).not.toContain("gluten");
    expect(sent).not.toContain("clove");
    expect(calls[0].body.link_type).toBe("shopping_list");
    expect(calls[0].body.line_items.every((item) => item.quantity == null && item.line_item_measurements)).toBe(true);
    expect(calls[0].authorization).toBe("Bearer mock");
    expect(calls[0].url).toContain("connect.dev.instacart.tools");

    const again = await call(env, "POST", "/api/grocery/handoff", {
      token: auth.session_token,
      body: {
        provider_id: "instacart",
        expected_revision: review.body.revision,
        reviewed_fingerprint: review.body.fingerprint,
      },
    });
    expect(again.body.reused).toBe(true);
    expect(again.body.handoff_id).toBe(handoff.body.handoff_id);
    expect(calls).toHaveLength(1);

    const states = sqlite.prepare(`SELECT list_state, COUNT(*) c FROM household_shop_line GROUP BY list_state`).all();
    expect(states.every((row) => row.list_state !== "purchased" || row.c >= 0)).toBe(true);
    const purchasedByHandoff = sqlite.prepare(`SELECT COUNT(*) c FROM household_shop_line WHERE list_state = 'purchased'`).get().c;
    expect(purchasedByHandoff).toBe(0);
    const guestsAfter = sqlite.prepare(`SELECT guest_count FROM dinner_plan_meal WHERE dinner_plan_id = 'dp_g' ORDER BY position`).all();
    expect(guestsAfter.map((row) => row.guest_count)).toEqual(guestsBefore);

    const current = await call(env, "GET", "/api/household-shop", { token: auth.session_token });
    const towel = current.body.list.lines.find((row) => /paper towels/i.test(row.display_name));
    const edited = await call(env, "POST", "/api/household-shop", {
      token: auth.session_token,
      body: { expected_revision: current.body.list.revision, op: "edit_line", line_id: towel.line_id, patch: { quantity: 9 } },
    });
    expect(edited.body.ok).toBe(true);
    const resent = await call(env, "POST", "/api/grocery/review", {
      token: auth.session_token,
      body: { provider_id: "instacart", expected_revision: edited.body.list.revision },
    });
    expect(resent.body.handoff.status).toBe("stale");
    const fresh = await call(env, "POST", "/api/grocery/handoff", {
      token: auth.session_token,
      body: {
        provider_id: "instacart",
        expected_revision: resent.body.revision,
        reviewed_fingerprint: resent.body.fingerprint,
      },
    });
    expect(fresh.body.handoff_id).not.toBe(handoff.body.handoff_id);
    expect(sqlite.prepare(`SELECT status FROM grocery_handoff WHERE handoff_id = ?`).get(handoff.body.handoff_id).status).toBe("stale");
    expect(calls).toHaveLength(2);

    sqlite.prepare(`UPDATE grocery_handoff SET expires_at = '2000-01-01T00:00:00.000Z', status = 'link_created', content_fingerprint = ? WHERE handoff_id = ?`).run(
      sqlite.prepare(`SELECT content_fingerprint FROM grocery_handoff WHERE handoff_id = ?`).get(fresh.body.handoff_id).content_fingerprint,
      fresh.body.handoff_id
    );
    const expired = await call(env, "POST", "/api/grocery/handoff", {
      token: auth.session_token,
      body: {
        provider_id: "instacart",
        expected_revision: resent.body.revision,
        reviewed_fingerprint: resent.body.fingerprint,
      },
    });
    expect(expired.body.reused).toBe(false);
    expect(sqlite.prepare(`SELECT status FROM grocery_handoff WHERE handoff_id = ?`).get(fresh.body.handoff_id).status).toBe("expired");

    const conflict = await call(env, "POST", "/api/grocery/handoff", {
      token: auth.session_token,
      body: { provider_id: "instacart", expected_revision: 1, reviewed_fingerprint: resent.body.fingerprint },
    });
    expect(conflict.status).toBe(409);
    expect(calls).toHaveLength(3);

    const foreign = await call(env, "POST", "/api/grocery/handoff/cancel", {
      token: other.session_token,
      body: { handoff_id: expired.body.handoff_id },
    });
    expect(foreign.status).toBe(404);

    const beforeFailList = await call(env, "GET", "/api/household-shop", { token: auth.session_token });
    const towelAgain = beforeFailList.body.list.lines.find((row) => /paper towels/i.test(row.display_name));
    const bumped = await call(env, "POST", "/api/household-shop", {
      token: auth.session_token,
      body: { expected_revision: beforeFailList.body.list.revision, op: "edit_line", line_id: towelAgain.line_id, patch: { quantity: 4 } },
    });
    expect(bumped.body.ok).toBe(true);
    env.GROCERY_FETCH = async () => new Response(JSON.stringify({ error: { message: "later", code: 5000 }, meta: {} }), { status: 500 });
    const brokenReview = await call(env, "POST", "/api/grocery/review", {
      token: auth.session_token,
      body: { provider_id: "instacart", expected_revision: (await call(env, "GET", "/api/household-shop", { token: auth.session_token })).body.list.revision },
    });
    const linesBeforeFail = sqlite.prepare(`SELECT line_id, list_state, quantity_override FROM household_shop_line`).all();
    const failed = await call(env, "POST", "/api/grocery/handoff", {
      token: auth.session_token,
      body: {
        provider_id: "instacart",
        expected_revision: brokenReview.body.revision,
        reviewed_fingerprint: brokenReview.body.fingerprint,
      },
    });
    expect(failed.body.code).toBe("provider_rejected");
    expect(failed.body.retryable).toBe(true);
    expect(sqlite.prepare(`SELECT line_id, list_state, quantity_override FROM household_shop_line`).all()).toEqual(linesBeforeFail);

    env.GROCERY_FETCH = async () => {
      throw new DOMException("timeout", "TimeoutError");
    };
    const timeoutReview = await call(env, "POST", "/api/grocery/review", {
      token: auth.session_token,
      body: { provider_id: "instacart", expected_revision: brokenReview.body.revision },
    });
    const timed = await call(env, "POST", "/api/grocery/handoff", {
      token: auth.session_token,
      body: {
        provider_id: "instacart",
        expected_revision: timeoutReview.body.revision,
        reviewed_fingerprint: timeoutReview.body.fingerprint,
      },
    });
    expect(timed.body.code).toBe("timeout");
    expect(sqlite.prepare(`SELECT COUNT(*) c FROM household_shop_line WHERE list_state = 'purchased'`).get().c).toBe(0);

    env.GROCERY_FETCH = async () => new Response(JSON.stringify({ products_link_url: "https://evil.example/phish" }), { status: 200 });
    const badReview = await call(env, "POST", "/api/grocery/review", {
      token: auth.session_token,
      body: { provider_id: "instacart", expected_revision: timeoutReview.body.revision },
    });
    const badUrl = await call(env, "POST", "/api/grocery/handoff", {
      token: auth.session_token,
      body: {
        provider_id: "instacart",
        expected_revision: badReview.body.revision,
        reviewed_fingerprint: badReview.body.fingerprint,
      },
    });
    expect(badUrl.body.code).toBe("invalid_request");
    expect(JSON.stringify(badUrl.body)).not.toContain("evil.example");
    expect(sqlite.prepare(`SELECT products_link_url FROM grocery_handoff WHERE status = 'rejected'`).all().every((row) => !row.products_link_url)).toBe(true);

    env.GROCERY_FETCH = async () => new Response(JSON.stringify({ cart_id: "cart_x", order_id: "ord_x" }), { status: 200 });
    const invalidReview = await call(env, "POST", "/api/grocery/review", {
      token: auth.session_token,
      body: { provider_id: "instacart", expected_revision: badReview.body.revision },
    });
    const invalid = await call(env, "POST", "/api/grocery/handoff", {
      token: auth.session_token,
      body: {
        provider_id: "instacart",
        expected_revision: invalidReview.body.revision,
        reviewed_fingerprint: invalidReview.body.fingerprint,
      },
    });
    expect(invalid.body.code).toBe("invalid_request");
    expect(JSON.stringify(invalid.body)).not.toContain("cart_x");
    expect(JSON.stringify(invalid.body)).not.toContain("ord_x");

    const events = sqlite.prepare(`SELECT event_name, props_json FROM event WHERE event_name LIKE 'shop_%'`).all();
    const names = events.map((row) => row.event_name);
    expect(names).toContain("shop_review_opened");
    expect(names).toContain("shop_handoff_requested");
    expect(names).toContain("shop_handoff_created");
    expect(names).toContain("shop_handoff_failed");
    expect(names).toContain("shop_handoff_stale");
    const dumped = JSON.stringify(events);
    expect(dumped).not.toContain("instacart.com");
    expect(dumped).not.toContain("peanut");
    expect(dumped).not.toContain("keys.should");
    expect(dumped).not.toContain("Market Street");
    expect(dumped).not.toMatch(/order_completed|purchased via/i);

    const returned = await call(env, "POST", "/api/grocery/return", { token: auth.session_token, body: { provider_id: "instacart", products_link_url: "https://www.instacart.com/secret" } });
    expect(returned.body.message).toBe("Your list is still here.");
    const returnEvent = sqlite.prepare(`SELECT props_json FROM event WHERE event_name = 'shop_handoff_returned'`).get();
    expect(returnEvent.props_json).not.toContain("http");
  });
});

describe("health grocery block", () => {
  it("reports providers off by default, mock only outside production, never a key", async () => {
    const off = await worker.fetch(new Request("https://fw.test/api/health"), { ENVIRONMENT: "production", DEPLOY_ENV: "production", GROCERY_PROVIDERS: "" });
    const offBody = await off.json();
    expect(offBody.grocery).toEqual({ providers_listed: [], instacart: "off", fixture_active: false });

    const copied = await worker.fetch(new Request("https://fw.test/api/health"), {
      ENVIRONMENT: "production",
      DEPLOY_ENV: "production",
      GROCERY_PROVIDERS: "instacart",
      GROCERY_FIXTURE: "instacart_mock",
    });
    expect((await copied.json()).grocery).toEqual({ providers_listed: ["instacart"], instacart: "off", fixture_active: false });

    const mock = await worker.fetch(new Request("https://fw.test/api/health"), {
      ENVIRONMENT: "preview",
      DEPLOY_ENV: "preview",
      GROCERY_PROVIDERS: "instacart",
      GROCERY_FIXTURE: "instacart_mock",
      INSTACART_API_KEY: "keys.should-not-leak",
    });
    const text = await mock.text();
    expect(JSON.parse(text).grocery).toEqual({ providers_listed: ["instacart"], instacart: "mock", fixture_active: true });
    expect(text).not.toContain("keys.should-not-leak");
  });
});
