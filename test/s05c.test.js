/**
 * S-05C: grocery-app text, image layout, registry facts, export privacy,
 * synthetic cleanup order, and sign-out.
 */
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";
import { createMemberSession, resolveSession } from "../src/lib/session.js";
import { parseGeneralItem, storedEventProps } from "../src/lib/household-shop.js";
import { renderAppExport, splitAppExportParts } from "../src/lib/shop-app-export.js";
import { formatShopQuantityAmount, presentShopQuantity } from "../src/lib/shop-display.js";
import { shopCookingHeadline } from "../src/lib/diner-count.js";
import {
  GROCERY_REGISTRY,
  createGroceryAdapters,
  providersSafeToName,
  registryFacts,
  registryRow,
} from "../src/lib/grocery/registry.js";
import {
  imageHandoffFeedback,
  imageHandoffPlan,
  layoutShoppingList,
} from "../public/shop-list-image.js";
import {
  PROTECTED,
  buildCleanupSteps,
  householdShopCleanupSteps,
  householdShopCrossChecks,
} from "../scripts/cleanup-synthetic-households.mjs";

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
  function statement(sql, params) {
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
  }
  return {
    prepare(sql) {
      return {
        ...statement(sql, []),
        bind(...params) {
          return statement(sql, params);
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

function seedHousehold(sqlite, id, memberId) {
  sqlite
    .prepare(
      `INSERT INTO household
        (household_id, display_name, status, timezone, servings_default, acquisition_source, created_at, updated_at, data_origin)
       VALUES (?, ?, 'active', 'America/Chicago', 2, 'organic', '2026-10-17T00:00:00Z', '2026-10-17T00:00:00Z', 'household')`
    )
    .run(id, id);
  sqlite
    .prepare(
      `INSERT INTO member
        (member_id, household_id, display_name, role, status, created_at, updated_at)
       VALUES (?, ?, ?, 'owner', 'active', '2026-10-17T00:00:00Z', '2026-10-17T00:00:00Z')`
    )
    .run(memberId, id, memberId);
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
  return { status: res.status, body: parsed, headers: res.headers, text };
}

function line(partial) {
  return {
    line_id: partial.line_id || partial.display_name,
    display_name: partial.display_name,
    unit: partial.unit || "count",
    category: partial.category || "other",
    quantity_required: partial.quantity_required ?? null,
    quantity_manual: partial.quantity_manual ?? null,
    quantity_override: partial.quantity_override ?? null,
    override_stale: partial.override_stale || 0,
    list_state: partial.list_state || "open",
    still_needed: partial.still_needed !== false,
    note: partial.note || null,
    requirements: partial.requirements || [],
  };
}

const SYNTHETIC = [
  line({ display_name: "yellow onions", unit: "lb", category: "produce", quantity_required: 2 }),
  line({ display_name: "bananas", unit: "count", category: "produce", quantity_required: 3 }),
  line({ display_name: "flat-leaf parsley", unit: "bunch", category: "produce", quantity_required: 1 }),
  line({ display_name: "cilantro", unit: "cup", category: "produce", quantity_required: 0.5 }),
  line({ display_name: "Yukon Gold potatoes", unit: "lb", category: "produce", quantity_required: 1.5 }),
  line({ display_name: "limes", unit: "count", category: "produce", quantity_required: 2 }),
  line({ display_name: "fresh ramps", unit: "oz", category: "produce", quantity_required: 4 }),
  line({ display_name: "boneless chicken thighs", unit: "lb", category: "meat", quantity_required: 1.25 }),
  line({ display_name: "oat milk (64 fl oz)", unit: "carton", category: "dairy", quantity_required: 1 }),
  line({ display_name: "large eggs", unit: "dozen", category: "dairy", quantity_required: 1 }),
  line({ display_name: "black beans (15 oz each)", unit: "can", category: "pantry", quantity_required: 2 }),
  line({ display_name: "Rao's marinara sauce (24 oz)", unit: "jar", category: "pantry", quantity_required: 1 }),
  line({ display_name: "rolled oats", unit: "cup", category: "pantry", quantity_required: 0.667 }),
  line({ display_name: "smoked paprika", unit: "tbsp", category: "pantry", quantity_required: 1 }),
  line({ display_name: "kosher salt", unit: "tsp", category: "pantry", quantity_required: 0.125 }),
  line({ display_name: "paper towels", unit: "pack", category: "household", quantity_required: 1 }),
];

const SYNTHETIC_TEXT = [
  "3 bananas",
  "1/2 cup cilantro",
  "1 bunch flat-leaf parsley",
  "4 oz fresh ramps",
  "2 limes",
  "2 lb yellow onions",
  "1 1/2 lb Yukon Gold potatoes",
  "1 dozen large eggs",
  "1 carton oat milk (64 fl oz)",
  "1 1/4 lb boneless chicken thighs",
  "2 cans black beans (15 oz each)",
  "1/8 tsp kosher salt",
  "1 jar Rao's marinara sauce (24 oz)",
  "2/3 cup rolled oats",
  "1 tbsp smoked paprika",
  "1 pack paper towels",
].join("\n");

describe("app export text", () => {
  it("formats the synthetic list as a flat import payload", () => {
    const payload = renderAppExport({ lines: SYNTHETIC });
    expect(payload.parts).toEqual([SYNTHETIC_TEXT]);
    expect(payload.part_count).toBe(1);
    expect(payload.lines.join("\n")).not.toMatch(/FlavorWeave list|Produce|Pantry|MEAT|http|note/i);
    expect(payload.rows[0]).toMatchObject({ quantity: "3", quantity_unicode: "3", name: "bananas" });
    expect(payload.rows.find((row) => row.name === "cilantro").quantity_unicode).toBe("½ cup");
    expect(payload.rows.find((row) => row.name === "rolled oats").quantity_unicode).toBe("⅔ cup");
  });

  it("drops purchased, already-have, skipped, and no-longer-needed rows", () => {
    const payload = renderAppExport({
      lines: [
        line({ display_name: "still here", quantity_required: 1 }),
        line({ display_name: "bought", list_state: "purchased", quantity_required: 1 }),
        line({ display_name: "have", list_state: "already_have", quantity_required: 1 }),
        line({ display_name: "skip", list_state: "skipped", quantity_required: 1 }),
        line({ display_name: "gone", still_needed: false, quantity_required: 1 }),
      ],
    });
    expect(payload.lines).toEqual(["1 still here"]);
  });

  it("keeps a manual item with no quantity as a bare name and uses an override", () => {
    const payload = renderAppExport({
      lines: [
        line({ display_name: "coffee", quantity_required: null, quantity_manual: null }),
        line({ display_name: "rice", unit: "cup", quantity_required: 1, quantity_override: 2 }),
        line({ display_name: "salt", unit: "tsp", quantity_required: 1, quantity_override: 9, override_stale: 1 }),
      ],
    });
    expect(payload.lines).toEqual(["coffee", "2 cups rice", "1 tsp salt"]);
  });

  it("splits above 200 lines without putting a part label in the payload", () => {
    const names = Array.from({ length: 201 }, (_, i) => line({ display_name: `item ${String(i).padStart(3, "0")}`, quantity_required: 1 }));
    const payload = renderAppExport({ lines: names });
    expect(payload.part_count).toBe(2);
    expect(payload.parts[0].split("\n")).toHaveLength(200);
    expect(payload.parts[1].split("\n")).toHaveLength(1);
    expect(payload.parts.join("\n")).not.toMatch(/Part \d/);
    expect(splitAppExportParts([])).toEqual([]);
  });

  it("returns an empty payload for an empty list", () => {
    expect(renderAppExport({ lines: [] })).toMatchObject({ lines: [], parts: [], part_count: 0, line_count: 0 });
  });
});

describe("stored thirds and countable copy", () => {
  it("snaps only stored 1/3 and 2/3, including mixed numbers", () => {
    expect(formatShopQuantityAmount(0.333)).toBe("1/3");
    expect(formatShopQuantityAmount(0.667)).toBe("2/3");
    expect(formatShopQuantityAmount(1.333)).toBe("1 1/3");
    expect(formatShopQuantityAmount(2.667)).toBe("2 2/3");
    expect(formatShopQuantityAmount(0.332)).toBe("0.332");
    expect(formatShopQuantityAmount(0.334)).toBe("0.334");
    expect(formatShopQuantityAmount(0.33)).toBe("0.33");
    expect(formatShopQuantityAmount(0.666)).toBe("0.666");
    expect(presentShopQuantity({ quantity: 1.5, unit: "cup" }).accessible).toBe("1 1/2 cups");
    expect(presentShopQuantity({ quantity: 0.5, unit: "cup" }).display).toBe("½ cup");
    expect(shopCookingHeadline({ mealCount: 1, householdCount: 2 })).toBe("1 dinner · cooking for 2");
    expect(shopCookingHeadline({ mealCount: 3, householdCount: 2 })).toBe("3 dinners · cooking for 2");
  });
});

describe("typed package lead words", () => {
  it("keeps the shopper's noun when a package word leads the name", () => {
    expect(presentShopQuantity({ quantity: 1, unit: "unparsed", name: "dozen large eggs" }).display).toBe("1 dozen large eggs");
    expect(presentShopQuantity({ quantity: 1, unit: "unparsed", name: "pack paper towels" }).display).toBe("1 pack paper towels");
    expect(presentShopQuantity({ quantity: 2, unit: "unparsed", name: "bag carrots" }).display).toBe("2 bag carrots");
    expect(presentShopQuantity({ quantity: 1, unit: "each", name: "limes" }).display).toBe("1 lime");
    expect(presentShopQuantity({ quantity: 1, unit: "each", name: "yellow onions" }).display).toBe("1 yellow onion");
    const typed = ["1 dozen large eggs", "1 pack paper towels"].map((text) => {
      const parsed = parseGeneralItem(text);
      return line({ display_name: parsed.display_name, unit: parsed.unit, quantity_manual: parsed.quantity, category: "dairy" });
    });
    expect(renderAppExport({ lines: typed }).lines.sort()).toEqual(["1 dozen large eggs", "1 pack paper towels"]);
  });
});

describe("manual fractional parsing", () => {
  const cases = [
    ["1/2 lime", { quantity: 0.5, unit: "unparsed", name: "lime" }],
    ["½ lime", { quantity: 0.5, unit: "unparsed", name: "lime" }],
    ["1½ cups rice", { quantity: 1.5, unit: "cup", name: "rice" }],
    ["1 ½ cups rice", { quantity: 1.5, unit: "cup", name: "rice" }],
    ["1/3 cup parsley", { quantity: 0.333, unit: "cup", name: "parsley" }],
    ["⅓ cup parsley", { quantity: 0.333, unit: "cup", name: "parsley" }],
    ["2/3 cup oats", { quantity: 0.667, unit: "cup", name: "oats" }],
    ["⅔ cup oats", { quantity: 0.667, unit: "cup", name: "oats" }],
    ["1/4 teaspoon cumin", { quantity: 0.25, unit: "tsp", name: "cumin" }],
    ["¼ teaspoon cumin", { quantity: 0.25, unit: "tsp", name: "cumin" }],
    ["3/4 lb potatoes", { quantity: 0.75, unit: "lb", name: "potatoes" }],
    ["¾ lb potatoes", { quantity: 0.75, unit: "lb", name: "potatoes" }],
    ["1/8 teaspoon salt", { quantity: 0.125, unit: "tsp", name: "salt" }],
    ["⅛ teaspoon salt", { quantity: 0.125, unit: "tsp", name: "salt" }],
    ["coffee", { quantity: null, unit: "unparsed", name: "coffee" }],
  ];

  it.each(cases)("parses %s", (text, expected) => {
    const parsed = parseGeneralItem(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.quantity ?? null).toBe(expected.quantity);
    expect(parsed.unit ?? null).toBe(expected.unit);
    expect(parsed.display_name.toLowerCase()).toContain(expected.name);
  });
});

describe("shopping list image layout", () => {
  it("lays out a flat list as inline rows with a hanging indent", () => {
    const layout = layoutShoppingList([
      { quantity: "1 ½ lb", name: "Yukon Gold potatoes" },
      { quantity: "12 3/4 tbsp", name: "a very long ingredient name that has to wrap onto another line in the name column" },
      { quantity: "", name: "coffee" },
    ]);
    expect(layout.pages).toHaveLength(1);
    const page = layout.pages[0];
    expect(page.title).toBe("Shopping list");
    expect(page.rows.every((row) => !/produce|pantry/i.test(row.nameLines.join(" ")))).toBe(true);
    for (const row of page.rows.filter((item) => item.quantity)) {
      // The name starts one normal space after the bold quantity: no column gap.
      expect(row.xName).toBe(row.xQty + Math.ceil(row.quantityWidth + row.spaceWidth));
      expect(row.xName - (row.xQty + row.quantityWidth)).toBeLessThanOrEqual(row.spaceWidth + 1);
      expect(row.xName + row.nameWidth).toBeLessThanOrEqual(page.width - page.padX + 1);
    }
    const wide = page.rows[1];
    expect(wide.hanging).toBe(true);
    expect(wide.nameLines.length).toBeGreaterThan(1);
    const bare = page.rows[2];
    expect(bare.xName).toBe(page.padX);
    expect(bare.nameLines).toEqual(["coffee"]);
    expect(page.brandY).toBeGreaterThan(page.rows.at(-1).y);
  });

  it("breaks before a parenthetical group instead of inside it", () => {
    const measure = (text, size) => String(text).length * size * 0.5;
    const layout = layoutShoppingList(
      [{ quantity: "1 jar", name: "Rao's marinara sauce (24 oz)" }],
      { width: 700, padX: 40, itemSize: 40, measure }
    );
    const [row] = layout.pages[0].rows;
    expect(row.nameLines).toEqual(["Rao's marinara sauce", "(24 oz)"]);
    expect(row.nameLines.some((text) => /\($|^oz\)/.test(text))).toBe(false);
  });

  it("keeps a whole name on one line when it fits", () => {
    const measure = (text, size) => String(text).length * size * 0.5;
    const layout = layoutShoppingList([{ quantity: "3", name: "bananas" }], { measure });
    expect(layout.pages[0].rows[0].nameLines).toEqual(["bananas"]);
  });

  it("drops the hanging indent when a quantity is very wide", () => {
    const measure = (text, size) => String(text).length * size * 0.5;
    const layout = layoutShoppingList(
      [{ quantity: "12 3/4 tablespoons plus a pinch", name: "salt" }],
      { width: 600, padX: 40, itemSize: 40, measure }
    );
    const [row] = layout.pages[0].rows;
    expect(row.hanging).toBe(false);
    expect(row.xName).toBe(40);
    expect(row.nameLines).toEqual(["", "salt"]);
  });

  it("splits a tall list into more than one image", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({ quantity: String(i + 1), name: `item ${i}` }));
    const layout = layoutShoppingList(rows, { maxHeight: 420 });
    expect(layout.pages.length).toBeGreaterThan(1);
    expect(layout.pages.every((page) => page.height <= 420)).toBe(true);
    const painted = layout.pages.flatMap((page) => page.rows.map((row) => row.nameLines.join(" ")));
    expect(painted).toHaveLength(8);
  });

  it("chooses share, download, or a new tab and never claims the list was saved", () => {
    const fileNav = {
      canShare: () => true,
      share: () => Promise.resolve(),
    };
    expect(imageHandoffPlan(fileNav).method).toBe("share");
    expect(imageHandoffPlan({ canShare: () => false, share: () => {} }).method).toBe("download");
    expect(imageHandoffPlan({ canShare: () => false, downloadAvailable: false }).method).toBe("open-tab");
    for (const outcome of [
      { method: "share", completed: true },
      { method: "share", errorName: "AbortError" },
      { method: "download" },
      { method: "open-tab" },
      {},
    ]) {
      expect(imageHandoffFeedback(outcome).claimedSaved).toBe(false);
    }
    expect(imageHandoffFeedback({ method: "share", errorName: "AbortError" }).message).toBe(
      "Share cancelled. Your list is still here."
    );
    expect(imageHandoffFeedback({ method: "share", completed: true }).message).toMatch(/Review the matched items/);
  });
});

describe("registry facts", () => {
  it("keeps registry-only grocers out of the adapter map and unnamed", () => {
    expect(Object.keys(createGroceryAdapters()).sort()).toEqual(["instacart", "instore"]);
    expect(providersSafeToName()).toEqual([]);
    for (const id of ["schnucks", "dierbergs", "whisk", "walmart", "amazon"]) {
      const row = registryRow(id);
      expect(row.documented_capabilities).toEqual([]);
      expect(row.integration_status).toBe("none");
      expect(JSON.stringify(row)).not.toMatch(/export_image/);
      for (const fact of registryFacts(row)) {
        expect(fact.evidence).toBe("documented");
        expect(fact.last_verified).toBe("2026-10-17");
        expect(fact.source_url).toMatch(/^https:\/\//);
      }
    }
    const instacart = registryRow("instacart");
    expect(instacart.registration).toMatchObject({
      availability: "closed",
      waitlist: false,
      last_verified: "2026-10-17",
      evidence: "documented",
    });
    expect(instacart.last_verified).toBe("2026-10-16");
    expect(instacart.handoff_mechanisms).toEqual([]);
    expect(registryRow("walmart").handoff_mechanisms).toEqual(["cart_link"]);
    expect(GROCERY_REGISTRY.some((row) => (row.documented_capabilities || []).includes("export_image"))).toBe(false);
  });
});

describe("shop_export privacy and sign-out", () => {
  it("stores only the closed shop_export fields", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_s05c", "m_s05c");
    const env = { DB: asD1(sqlite), ENVIRONMENT: "test" };
    const session = await createMemberSession(env.DB, { household_id: "hh_s05c", member_id: "m_s05c" });
    const rejected = await call(env, "POST", "/api/events", {
      token: session.session_token,
      body: { event_name: "shop_export", ingredient: "salt", quantity: "2 lb" },
    });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error).toBe("invalid_event");
    expect(JSON.stringify(rejected.body)).not.toContain("salt");

    const accepted = await call(env, "POST", "/api/events", {
      token: session.session_token,
      body: {
        event_name: "shop_export",
        type: "copy_app",
        ok: true,
        surface: "shop_sheet",
        ingredient: "secret onions",
        note: "nut allergy",
        url: "https://example.test/list",
        plan_id: "plan_secret",
      },
    });
    expect(accepted.status).toBe(201);
    const stored = sqlite.prepare(`SELECT props_json, plan_id, invite_code, channel FROM event WHERE event_name = 'shop_export'`).get();
    expect(JSON.parse(stored.props_json)).toEqual({ type: "copy_app", ok: true, surface: "shop_sheet" });
    expect(stored.plan_id).toBeNull();
    expect(stored.invite_code).toBeNull();
    expect(stored.channel).toBeNull();
    expect(storedEventProps("shop_export", { type: "nope" }).error).toBe("invalid_event");
    expect(storedEventProps("shopping_list_exported", { format: "copy" }).handled).toBe(false);
  });

  it("records the app export fetch as image or copy_app, with closed fields only", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_exp", "m_exp");
    const env = { DB: asD1(sqlite), ENVIRONMENT: "test" };
    const session = await createMemberSession(env.DB, { household_id: "hh_exp", member_id: "m_exp" });
    const forImage = await call(env, "GET", "/api/household-shop/export?format=app&for=image", { token: session.session_token });
    expect(forImage.status).toBe(200);
    expect(forImage.headers.get("cache-control")).toContain("no-store");
    const forCopy = await call(env, "GET", "/api/household-shop/export?format=app", { token: session.session_token });
    expect(forCopy.status).toBe(200);
    const rows = sqlite.prepare(`SELECT props_json FROM event WHERE event_name = 'shop_export' ORDER BY created_at, rowid`).all();
    expect(rows.map((row) => JSON.parse(row.props_json))).toEqual([
      { type: "image", ok: true, surface: "api" },
      { type: "copy_app", ok: true, surface: "api" },
    ]);
    const anonymous = await call(env, "GET", "/api/household-shop/export?format=app");
    expect(anonymous.status).toBe(401);
  });

  it("revokes the session, clears the cookie, and blocks the next read", async () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_out", "m_out");
    const env = { DB: asD1(sqlite), ENVIRONMENT: "test" };
    const session = await createMemberSession(env.DB, { household_id: "hh_out", member_id: "m_out" });
    const before = await call(env, "GET", "/api/sessions/me", { token: session.session_token });
    expect(before.status).toBe(200);
    expect(before.headers.get("cache-control")).toContain("no-store");

    const logout = await call(env, "POST", "/api/sessions/logout", { token: session.session_token });
    expect(logout.status).toBe(200);
    expect(logout.body.ok).toBe(true);
    expect(logout.headers.get("set-cookie") || "").toMatch(/he_session=;/);
    expect(logout.headers.get("clear-site-data")).toContain("cache");

    const after = await call(env, "GET", "/api/sessions/me", { token: session.session_token });
    expect(after.status).toBe(401);
    expect(await resolveSession(env.DB, session.session_token)).toBeNull();
  });
});

describe("synthetic household cleanup", () => {
  it("deletes shop children before the list and leaves the other household", () => {
    const sqlite = migrate();
    seedHousehold(sqlite, "hh_drop", "m_drop");
    seedHousehold(sqlite, "hh_keep", "m_keep");
    const now = "2026-10-17T00:00:00Z";
    for (const [hh, member, list, lineId] of [
      ["hh_drop", "m_drop", "list_drop", "line_drop"],
      ["hh_keep", "m_keep", "list_keep", "line_keep"],
    ]) {
      sqlite.prepare(
        `INSERT INTO household_shop_list (shop_list_id, household_id, status, revision, content_revision, created_at, updated_at)
         VALUES (?, ?, 'open', 1, 1, ?, ?)`
      ).run(list, hh, now, now);
      sqlite.prepare(
        `INSERT INTO household_shop_line
          (line_id, shop_list_id, general_key, display_name, unit, list_state, still_needed, created_at, updated_at)
         VALUES (?, ?, 'towels', 'paper towels', 'count', 'open', 1, ?, ?)`
      ).run(lineId, list, now, now);
      sqlite.prepare(
        `INSERT INTO household_shop_requirement
          (requirement_id, line_id, shop_list_id, origin, quantity, unit, source_key, created_at, updated_at)
         VALUES (?, ?, ?, 'general', 1, 'count', ?, ?, ?)`
      ).run(`req_${lineId}`, lineId, list, `src_${lineId}`, now, now);
      sqlite.prepare(`INSERT INTO household_shop_cas (shop_list_id, token) VALUES (?, 't')`).run(list);
      sqlite.prepare(
        `INSERT INTO shop_share
          (share_id, shop_list_id, household_id, created_by_member_id, expires_at, created_at, snapshot_json, snapshot_revision)
         VALUES (?, ?, ?, ?, ?, ?, '{}', 1)`
      ).run(`share_${hh}`, list, hh, member, now, now);
      sqlite.prepare(
        `INSERT INTO grocery_handoff
          (handoff_id, shop_list_id, household_id, provider_id, revision_sent, content_revision_sent, request_hash, content_fingerprint, status, created_by_member_id, created_at, updated_at)
         VALUES (?, ?, ?, 'instore', 1, 1, 'h', 'f', 'prepared', ?, ?, ?)`
      ).run(`hand_${hh}`, list, hh, member, now, now);
    }

    const IN = "('hh_drop')";
    const MB = "(SELECT member_id FROM member WHERE household_id IN ('hh_drop'))";
    const cross = householdShopCrossChecks(IN, MB).map((sql) => sqlite.prepare(sql).get());
    expect(cross.every((row) => row.n === 0)).toBe(true);

    sqlite.prepare(
      `INSERT INTO grocery_handoff
        (handoff_id, shop_list_id, household_id, provider_id, revision_sent, content_revision_sent, request_hash, content_fingerprint, status, created_by_member_id, created_at, updated_at)
       VALUES ('hand_bad', 'list_keep', 'hh_keep', 'instore', 1, 1, 'h', 'f', 'prepared', 'm_drop', ?, ?)`
    ).run(now, now);
    const dirty = householdShopCrossChecks(IN, MB).map((sql) => sqlite.prepare(sql).get());
    expect(dirty.some((row) => row.t === "grocery_handoff_member" && row.n === 1)).toBe(true);
    sqlite.prepare(`DELETE FROM grocery_handoff WHERE handoff_id = 'hand_bad'`).run();

    const steps = buildCleanupSteps({
      IN,
      MB,
      DP: "(SELECT dinner_plan_id FROM dinner_plan WHERE household_id IN ('hh_drop'))",
      PL: "(SELECT plan_id FROM plan WHERE household_id IN ('hh_drop'))",
      MO: "(SELECT meal_option_id FROM meal_option WHERE plan_id IN (SELECT plan_id FROM plan WHERE household_id IN ('hh_drop')))",
      DPM: "(SELECT meal_id FROM dinner_plan_meal WHERE dinner_plan_id IN (SELECT dinner_plan_id FROM dinner_plan WHERE household_id IN ('hh_drop')))",
      KEYS: ["abc"],
      deleteAiUsage: false,
    });
    expect(steps.slice(0, 6).map((row) => row[0])).toEqual([
      "household_shop_requirement",
      "household_shop_line",
      "grocery_handoff",
      "shop_share",
      "household_shop_cas",
      "household_shop_list",
    ]);
    const memberAt = steps.findIndex((row) => row[0] === "member");
    const householdAt = steps.findIndex((row) => row[0] === "household");
    expect(memberAt).toBeGreaterThan(0);
    expect(householdAt).toBe(memberAt + 1);
    expect(steps.at(-1)[0]).toBe("ai_limit_counters");
    expect(PROTECTED.has("hh_3884c16f6606")).toBe(true);
    expect(householdShopCleanupSteps(IN, MB)[0][0]).toBe("household_shop_requirement");

    sqlite.exec("BEGIN");
    for (const [table, where] of steps) sqlite.prepare(`DELETE FROM ${table} WHERE ${where}`).run();
    sqlite.exec("COMMIT");

    expect(sqlite.prepare(`SELECT count(*) n FROM household WHERE household_id = 'hh_drop'`).get().n).toBe(0);
    expect(sqlite.prepare(`SELECT count(*) n FROM household_shop_list WHERE household_id = 'hh_keep'`).get().n).toBe(1);
    expect(sqlite.prepare(`SELECT count(*) n FROM household_shop_line WHERE line_id = 'line_keep'`).get().n).toBe(1);
    expect(sqlite.prepare(`SELECT count(*) n FROM grocery_handoff WHERE household_id = 'hh_keep'`).get().n).toBe(1);
    expect(sqlite.prepare(`SELECT count(*) n FROM household WHERE household_id = 'hh_keep'`).get().n).toBe(1);
  });
});
