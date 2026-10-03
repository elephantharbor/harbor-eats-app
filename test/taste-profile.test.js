import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { decideEligibility } from "../src/lib/preference-concepts.js";
import { catalogVocabularyCoverage } from "../src/lib/recipe-package.js";
import { createMemberSession } from "../src/lib/session.js";
import {
  STARTER_SLUGS,
  applyTasteChanges,
  hardRulesForMember,
  planTasteChanges,
  presentTasteProfile,
  recordInferredTaste,
  routeTasteRequest,
  searchTastes,
  tasteCatalog,
} from "../src/lib/taste-profile.js";
import { listVocabulary } from "../src/lib/taste-vocabulary.js";

const zeroSlugs = () => {
  const counts = catalogVocabularyCoverage();
  return listVocabulary()
    .filter((t) => t.active && !counts[t.slug])
    .map((t) => t.slug);
};

describe("taste catalog for onboarding and browse", () => {
  it("opens with a small, varied starter set", () => {
    const cat = tasteCatalog();
    expect(cat.starters.length).toBeGreaterThanOrEqual(6);
    expect(cat.starters.length).toBeLessThanOrEqual(12);
    expect(new Set(cat.starters.map((t) => t.category)).size).toBeGreaterThanOrEqual(4);
    expect(cat.starters.map((t) => t.slug)).toEqual(STARTER_SLUGS);
  });

  it("browse lists every active term, including ones with no dinners yet", () => {
    const cat = tasteCatalog();
    const browsed = cat.groups.flatMap((g) => g.terms.map((t) => t.slug)).sort();
    const active = listVocabulary().filter((t) => t.active).map((t) => t.slug).sort();
    expect(browsed).toEqual(active);
    expect(browsed).toContain("japanese");
    for (const slug of zeroSlugs()) expect(browsed).toContain(slug);
  });

  it("never offers finfish permission as a taste, but named fish are tastes", () => {
    const cat = tasteCatalog();
    const all = cat.groups.flatMap((g) => g.terms);
    expect(all.some((t) => /^(fish|finfish|no[_-]?finfish)$/i.test(t.slug))).toBe(false);
    expect(all.some((t) => /^fish$/i.test(t.name))).toBe(false);
    for (const slug of ["salmon", "swordfish", "cod", "arctic-char"]) {
      expect(all.find((t) => t.slug === slug)?.category).toBe("ingredient");
    }
  });

  it("exposes no counts, scores, or percents", () => {
    const text = JSON.stringify(tasteCatalog());
    expect(text).not.toMatch(/count|score|percent|confidence/i);
    for (const term of tasteCatalog().groups.flatMap((g) => g.terms)) {
      expect(Object.values(term).some((v) => typeof v === "number")).toBe(false);
    }
  });

  it("ships Love, Like, Less often and the four optional feedback chips", () => {
    const cat = tasteCatalog();
    expect(cat.ranks.map((r) => r.label)).toEqual(["Love", "Like", "Less often"]);
    expect(cat.feedback.map((f) => f.label)).toEqual([
      "Loved the crunch",
      "Too spicy",
      "Great sauce",
      "Too rich",
    ]);
  });
});

describe("taste search uses the deterministic resolver", () => {
  it("resolves aliases to one active term", () => {
    expect(searchTastes("BBQ").match.slug).toBe("smoky");
    expect(searchTastes("  Curry ").match.slug).toBe("curries");
    expect(searchTastes("salmon").match).toMatchObject({ slug: "salmon", category: "ingredient" });
    expect(searchTastes("grill").match.slug).toBe("grilled");
  });

  it("leaves unknown words unknown and never adds a term", () => {
    const before = listVocabulary().length;
    for (const q of ["dragonfruit smoke", "sheet", "weeknight", "tac"]) {
      const out = searchTastes(q);
      expect(out.status).toBe("unresolved");
      expect(out.match).toBeNull();
      expect(out.message).toMatch(/don’t have/);
    }
    expect(listVocabulary().length).toBe(before);
  });

  it("points fish at diet limits and suggests named fish instead", () => {
    const out = searchTastes("fish");
    expect(out.status).toBe("limit");
    expect(out.match).toBeNull();
    expect(out.message).toMatch(/diet limit/);
    expect(out.message).toMatch(/Salmon/);
    expect(searchTastes("vegan").status).toBe("limit");
  });

  it("empty search is quiet", () => {
    expect(searchTastes("   ")).toMatchObject({ status: "empty", match: null, message: null });
  });
});

describe("Love, Like, Less often, remove (pure)", () => {
  it("writes explicit ranks and does not cap the diner at three", () => {
    const slugs = ["tacos", "curries", "pasta", "crispy", "smoky", "japanese", "korean", "swordfish"];
    const out = planTasteChanges([], "m_a", slugs.map((s) => ({ vocabulary_slug: s, rank: "love" })), "household");
    expect(out.results.every((r) => r.ok)).toBe(true);
    expect(out.tastes).toHaveLength(8);
    expect(out.tastes.every((t) => t.stance === "explicit" && t.member_id === "m_a")).toBe(true);
  });

  it("changes rank in place and removes without writing a limit", () => {
    let rows = planTasteChanges([], "m_a", [{ vocabulary_slug: "tacos", rank: "love" }], "household").tastes;
    rows = planTasteChanges(rows, "m_a", [{ vocabulary_slug: "tacos", rank: "less_often" }], "household").tastes;
    expect(rows).toEqual([expect.objectContaining({ vocabulary_slug: "tacos", rank: "less_often" })]);
    const removed = planTasteChanges(rows, "m_a", [{ vocabulary_slug: "tacos", rank: "remove" }], "household");
    expect(removed.tastes).toEqual([]);
    expect(removed.results[0]).toMatchObject({ removed: true, hard_limit_written: false });
  });

  it("rejects unknown terms and ranks, including bare fish", () => {
    const out = planTasteChanges(
      [],
      "m_a",
      [
        { vocabulary_slug: "fish", rank: "love" },
        { term: "dragonfruit smoke", rank: "like" },
        { vocabulary_slug: "tacos", rank: "ban" },
        { term: "bbq", rank: "like" },
      ],
      "household"
    );
    expect(out.results.map((r) => r.ok)).toEqual([false, false, false, true]);
    expect(out.results[2].error).toBe("invalid_rank");
    expect(out.tastes).toEqual([expect.objectContaining({ vocabulary_slug: "smoky", rank: "like" })]);
  });

  it("Less often never excludes a meal", () => {
    const tastes = [{ member_id: "m_a", vocabulary_slug: "tacos", rank: "less_often", stance: "explicit" }];
    const verdict = decideEligibility({
      limits: [{ member_id: "m_a", rules: [] }],
      recipe: { vocabulary_tag_ids: ["tacos"] },
      tastes,
    });
    expect(verdict.eligible).toBe(true);
    const profile = presentTasteProfile({ memberId: "m_a", rows: tastes, rules: [] });
    expect(profile.told[0]).toMatchObject({ rank_label: "Less often", limit_note: null });
  });
});

describe("profile presentation", () => {
  const rows = [
    { member_id: "m_a", vocabulary_slug: "tacos", rank: "love", stance: "explicit", confidence: null },
    { member_id: "m_a", vocabulary_slug: "crispy", rank: "like", stance: "inferred", confidence: 0.83 },
    { member_id: "m_b", vocabulary_slug: "curries", rank: "love", stance: "explicit", confidence: null },
  ];

  it("labels explicit as You told us and inferred as We're learning", () => {
    const p = presentTasteProfile({ memberId: "m_a", rows, rules: [] });
    expect(p.told.map((i) => [i.slug, i.stance_label])).toEqual([["tacos", "You told us"]]);
    expect(p.learning.map((i) => [i.slug, i.stance_label])).toEqual([["crispy", "We're learning"]]);
  });

  it("never shows confidence or numbers", () => {
    const text = JSON.stringify(presentTasteProfile({ memberId: "m_a", rows, rules: [] }));
    expect(text).not.toMatch(/confidence|0\.83|%|score/i);
  });

  it("only shows the requesting diner's rows", () => {
    const a = presentTasteProfile({ memberId: "m_a", rows, rules: [] });
    const b = presentTasteProfile({ memberId: "m_b", rows, rules: [] });
    expect([...a.told, ...a.learning].map((i) => i.slug)).not.toContain("curries");
    expect(b.told.map((i) => i.slug)).toEqual(["curries"]);
    expect(b.learning).toEqual([]);
  });

  it("a hard limit wins: explicit fish taste gets a plain note, inferred one is dropped", () => {
    const rules = hardRulesForMember([{ member_id: "m_a", rule_key: "fish", status: "prohibited" }], "m_a");
    expect(rules).toEqual([{ id: "no_finfish", status: "prohibited" }]);
    const p = presentTasteProfile({
      memberId: "m_a",
      rules,
      rows: [
        { member_id: "m_a", vocabulary_slug: "salmon", rank: "love", stance: "explicit" },
        { member_id: "m_a", vocabulary_slug: "cod", rank: "like", stance: "inferred", confidence: 0.9 },
      ],
    });
    expect(p.told[0].limit_note).toMatch(/No fish limit still comes first/);
    expect(p.learning).toEqual([]);
  });

  it("another diner's limit does not touch my tastes; household-wide limits do", () => {
    const stored = [
      { member_id: "m_b", rule_key: "fish", status: "prohibited" },
      { member_id: null, rule_key: "shellfish", status: "prohibited" },
    ];
    const rules = hardRulesForMember(stored, "m_a");
    expect(rules.map((r) => r.id)).toEqual(["no_shellfish"]);
    const p = presentTasteProfile({
      memberId: "m_a",
      rules,
      rows: [
        { member_id: "m_a", vocabulary_slug: "salmon", rank: "love", stance: "explicit" },
        { member_id: "m_a", vocabulary_slug: "shrimp", rank: "love", stance: "explicit" },
      ],
    });
    expect(p.told.find((i) => i.slug === "salmon").limit_note).toBeNull();
    expect(p.told.find((i) => i.slug === "shrimp").limit_note).toMatch(/No shellfish/);
  });

  it("says plainly when a loved term has no dinners yet", () => {
    const zero = zeroSlugs().find((s) => !["salmon", "cod", "swordfish", "arctic-char", "shrimp", "chicken"].includes(s));
    if (!zero) return;
    const p = presentTasteProfile({
      memberId: "m_a",
      rules: [],
      rows: [{ member_id: "m_a", vocabulary_slug: zero, rank: "love", stance: "explicit" }],
    });
    expect(p.told[0].on_menu).toBe(false);
    expect(p.told[0].menu_note).toMatch(/Nothing on the menu has this yet/);
  });
});

// ——— D1-backed route tests on the real migration chain ———

function d1(db) {
  const stmt = (sql, params = []) => ({
    bind: (...args) => stmt(sql, args),
    run: async () => {
      db.prepare(sql).run(...params);
      return { success: true };
    },
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    first: async () => db.prepare(sql).get(...params) ?? null,
  });
  return { prepare: (sql) => stmt(sql) };
}

function migrated() {
  const db = new DatabaseSync(":memory:");
  const files = readdirSync(new URL("../migrations/", import.meta.url)).filter((n) => n.endsWith(".sql")).sort();
  for (const name of files) db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  db.exec("PRAGMA foreign_keys = ON");
  const ts = "2026-10-03T00:00:00Z";
  db.prepare(
    `INSERT INTO household (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
     VALUES ('hh_t', 'Test kitchen', 'active', 'UTC', 2, 'synthetic_qa', ?, ?, 'synthetic')`
  ).run(ts, ts);
  for (const [id, name] of [["m_a", "Ana"], ["m_b", "Ben"]]) {
    db.prepare(
      `INSERT INTO member (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES (?, 'hh_t', ?, 'member', 'active', ?, ?)`
    ).run(id, name, ts, ts);
  }
  db.prepare(
    `INSERT INTO constraint_rule (constraint_id, household_id, member_id, rule_key, status, created_at, updated_at)
     VALUES ('c1', 'hh_t', 'm_a', 'fish', 'prohibited', ?, ?)`
  ).run(ts, ts);
  return db;
}

const deps = { writeOrigin: async () => "synthetic" };

describe("diner taste routes (D1 on migrations through 0010)", () => {
  let db;
  let env;
  let tokens;

  async function call(method, path, { token, body } = {}) {
    const url = new URL(`https://fw.test${path}`);
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const request = new Request(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const res = await routeTasteRequest(env, request, url.pathname, url, deps);
    return res ? { status: res.status, body: await res.json() } : null;
  }

  beforeEach(async () => {
    db = migrated();
    env = { DB: d1(db) };
    tokens = {};
    for (const id of ["m_a", "m_b"]) {
      const s = await createMemberSession(env.DB, { household_id: "hh_t", member_id: id });
      tokens[id] = s.session_token;
    }
  });

  it("ignores unrelated paths", async () => {
    expect(await call("GET", "/api/households/hh_t/state")).toBeNull();
  });

  it("serves catalog and search without touching the vocabulary table", async () => {
    const cat = await call("GET", "/api/tastes/catalog");
    expect(cat.status).toBe(200);
    expect(cat.body.starters.length).toBeGreaterThan(0);
    const hit = await call("GET", "/api/tastes/search?q=barbecue");
    expect(hit.body.match.slug).toBe("smoky");
    expect(db.prepare("SELECT COUNT(*) AS c FROM taste_vocabulary").get().c).toBe(0);
  });

  it("requires a session and the diner's own member id", async () => {
    expect((await call("GET", "/api/members/m_a/tastes")).status).toBe(401);
    const other = await call("POST", "/api/members/m_b/tastes", {
      token: tokens.m_a,
      body: { changes: [{ vocabulary_slug: "tacos", rank: "love" }] },
    });
    expect(other.status).toBe(403);
    expect(other.body.error).toBe("forbidden_other_diner");
    expect(db.prepare("SELECT COUNT(*) AS c FROM diner_taste").get().c).toBe(0);
  });

  it("onboarding saves many loves for the signed-in diner only", async () => {
    const changes = ["tacos", "curries", "pasta", "crispy", "korean"].map((s) => ({ vocabulary_slug: s, rank: "love" }));
    const res = await call("POST", "/api/members/m_a/tastes", { token: tokens.m_a, body: { changes } });
    expect(res.status).toBe(200);
    expect(res.body.profile.told).toHaveLength(5);
    const rows = db.prepare("SELECT member_id, rank, stance, data_origin FROM diner_taste").all();
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.member_id === "m_a" && r.rank === "love" && r.stance === "explicit")).toBe(true);
    expect(rows.every((r) => r.data_origin === "synthetic")).toBe(true);
    const ben = await call("GET", "/api/members/m_b/tastes", { token: tokens.m_b });
    expect(ben.body.profile.told).toEqual([]);
  });

  it("Love, Like, Less often, remove round-trip; nothing lands in limits", async () => {
    const send = (rank) =>
      call("POST", "/api/members/m_a/tastes", { token: tokens.m_a, body: { changes: [{ vocabulary_slug: "tacos", rank }] } });
    const limitsBefore = db.prepare("SELECT COUNT(*) AS c FROM constraint_rule").get().c;
    for (const [rank, label] of [["love", "Love"], ["like", "Like"], ["less_often", "Less often"]]) {
      const res = await send(rank);
      expect(res.body.profile.told).toEqual([expect.objectContaining({ slug: "tacos", rank_label: label })]);
    }
    const removed = await send("remove");
    expect(removed.body.results[0]).toMatchObject({ removed: true, hard_limit_written: false });
    expect(removed.body.profile.told).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS c FROM diner_taste").get().c).toBe(0);
    expect(db.prepare("SELECT COUNT(*) AS c FROM constraint_rule").get().c).toBe(limitsBefore);
  });

  it("two diners keep separate ranks for the same term", async () => {
    await call("POST", "/api/members/m_a/tastes", { token: tokens.m_a, body: { vocabulary_slug: "smoky", rank: "love" } });
    await call("POST", "/api/members/m_b/tastes", { token: tokens.m_b, body: { vocabulary_slug: "smoky", rank: "less_often" } });
    const a = await call("GET", "/api/members/m_a/tastes", { token: tokens.m_a });
    const b = await call("GET", "/api/members/m_b/tastes", { token: tokens.m_b });
    expect(a.body.profile.told[0].rank).toBe("love");
    expect(b.body.profile.told[0].rank).toBe("less_often");
  });

  it("inferred rows show as We're learning, yield to explicit, and stay behind limits", async () => {
    await recordInferredTaste(env.DB, {
      householdId: "hh_t", memberId: "m_b", vocabularySlug: "crispy", rank: "like", confidence: 0.7, dataOrigin: "synthetic",
    });
    await recordInferredTaste(env.DB, {
      householdId: "hh_t", memberId: "m_a", vocabularySlug: "salmon", rank: "love", confidence: 0.9, dataOrigin: "synthetic",
    });
    const b = await call("GET", "/api/members/m_b/tastes", { token: tokens.m_b });
    expect(b.body.profile.learning).toEqual([expect.objectContaining({ slug: "crispy", stance_label: "We're learning" })]);
    expect(JSON.stringify(b.body)).not.toMatch(/confidence|0\.7/);
    const a = await call("GET", "/api/members/m_a/tastes", { token: tokens.m_a });
    expect(a.body.profile.learning).toEqual([]);

    await call("POST", "/api/members/m_b/tastes", { token: tokens.m_b, body: { vocabulary_slug: "crispy", rank: "love" } });
    const again = await recordInferredTaste(env.DB, {
      householdId: "hh_t", memberId: "m_b", vocabularySlug: "crispy", rank: "less_often", confidence: 0.4, dataOrigin: "synthetic",
    });
    expect(again).toEqual({ written: false, reason: "explicit_wins" });
    const row = db.prepare("SELECT rank, stance, confidence FROM diner_taste WHERE member_id = 'm_b'").get();
    expect(row).toEqual({ rank: "love", stance: "explicit", confidence: null });
  });

  it("explicit fish taste survives but the No fish limit note shows", async () => {
    const res = await call("POST", "/api/members/m_a/tastes", { token: tokens.m_a, body: { vocabulary_slug: "salmon", rank: "love" } });
    expect(res.body.profile.told[0].limit_note).toMatch(/No fish/);
    expect(db.prepare("SELECT rule_key FROM constraint_rule WHERE member_id = 'm_a'").all()).toEqual([{ rule_key: "fish" }]);
  });

  it("rejects bare fish as a taste", async () => {
    const res = await call("POST", "/api/members/m_b/tastes", { token: tokens.m_b, body: { vocabulary_slug: "fish", rank: "love" } });
    expect(res.status).toBe(400);
    expect(res.body.results[0].error).toBe("unknown_taste");
  });

  it("targeted feedback is optional, per diner, and writes no taste or limit", async () => {
    const res = await call("POST", "/api/members/m_a/taste-feedback", {
      token: tokens.m_a,
      body: { recipe_version_id: "rv_crispy-chipotle-tofu-tacos_v1", code: "too_spicy" },
    });
    expect(res.status).toBe(201);
    expect(res.body.feedback).toMatchObject({ code: "too_spicy", writes_taste_rank: false, writes_hard_limit: false, required: false });
    expect(db.prepare("SELECT COUNT(*) AS c FROM targeted_feedback WHERE member_id = 'm_a'").get().c).toBe(1);
    expect(db.prepare("SELECT COUNT(*) AS c FROM diner_taste").get().c).toBe(0);
    const bad = await call("POST", "/api/members/m_a/taste-feedback", { token: tokens.m_a, body: { recipe_version_id: "rv_x", code: "survey" } });
    expect(bad.status).toBe(400);
    const notMine = await call("POST", "/api/members/m_b/taste-feedback", {
      token: tokens.m_a,
      body: { recipe_version_id: "rv_x", code: "great_sauce" },
    });
    expect(notMine.status).toBe(403);
  });

  it("degrades to 503 when migration 0010 is not applied", async () => {
    const bare = new DatabaseSync(":memory:");
    const files = readdirSync(new URL("../migrations/", import.meta.url)).filter((n) => n.endsWith(".sql") && n < "0010").sort();
    for (const name of files) bare.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
    const ts = "2026-10-03T00:00:00Z";
    bare.prepare(
      `INSERT INTO household (household_id, display_name, status, timezone, servings_default, created_at, updated_at, data_origin)
       VALUES ('hh_t', 'T', 'active', 'UTC', 2, ?, ?, 'synthetic')`
    ).run(ts, ts);
    bare.prepare(
      `INSERT INTO member (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES ('m_a', 'hh_t', 'Ana', 'member', 'active', ?, ?)`
    ).run(ts, ts);
    env = { DB: d1(bare) };
    const s = await createMemberSession(env.DB, { household_id: "hh_t", member_id: "m_a" });
    const res = await call("GET", "/api/members/m_a/tastes", { token: s.session_token });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("taste_store_unavailable");
  });

  it("applyTasteChanges is usable without HTTP", async () => {
    const out = await applyTasteChanges(env.DB, {
      householdId: "hh_t",
      memberId: "m_b",
      changes: [{ term: "stir fry", rank: "like" }],
      dataOrigin: "synthetic",
    });
    expect(out.results[0]).toMatchObject({ ok: true, vocabulary_slug: "stir-fries" });
  });
});
