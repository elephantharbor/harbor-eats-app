import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { destinationAllowed } from "../src/lib/grocery/allowlist.js";
import { INSTACART_LOGO_PRESENT } from "../src/lib/grocery/branding.js";
import { groceryFixtureActive, instacartActivation, providerIds } from "../src/lib/grocery/config.js";
import { contentFingerprintInput, fingerprint, requestFingerprintInput } from "../src/lib/grocery/fingerprint.js";
import { createInstacartMock } from "../src/lib/grocery/instacart-mock.js";
import { createInstacartAdapter, resolveInstacartFetch } from "../src/lib/grocery/instacart.js";
import { createInStoreAdapter } from "../src/lib/grocery/instore.js";
import { instacartRequestBody, projectTransfer } from "../src/lib/grocery/projection.js";
import { GROCERY_REGISTRY, createGroceryAdapters, registryRow } from "../src/lib/grocery/registry.js";
import { sanitizeGroceryEvent } from "../src/lib/grocery/telemetry.js";
import { validateGroceryVars } from "../scripts/deploy/environments.mjs";

function line(overrides) {
  return {
    line_id: "hl_onion",
    display_name: "yellow onion",
    unit: "count",
    quantity_required: 2,
    quantity_manual: null,
    quantity_override: null,
    override_stale: 0,
    list_state: "open",
    still_needed: 1,
    unparsed: 0,
    note: null,
    preparation: null,
    ...overrides,
  };
}

function mockEnv(extra = {}) {
  return {
    ENVIRONMENT: "test",
    GROCERY_PROVIDERS: "instacart",
    GROCERY_FIXTURE: "instacart_mock",
    ...extra,
  };
}

describe("grocery registry and config", () => {
  it("registers only instore and instacart", () => {
    const map = createGroceryAdapters({ env: mockEnv() });
    expect(Object.keys(map).sort()).toEqual(["instacart", "instore"]);
    for (const adapter of Object.values(map)) {
      expect(adapter.id).toBeTruthy();
      expect(adapter.capabilities().length).toBeGreaterThan(0);
      expect(adapter.fulfillmentMethods().length).toBeGreaterThan(0);
      expect(typeof adapter.configured).toBe("function");
    }
  });

  it("keeps Instacart documented and mock-tested, not provider-tested", () => {
    const row = registryRow("instacart");
    expect(row.lifecycle).toBe("documented");
    expect(row.integration_status).toBe("mock_only");
    expect(row.credential_status).toBe("none");
    expect(row.verified_capabilities).toEqual([]);
    expect(row.provider_tested_capabilities).toEqual([]);
    expect(row.mock_tested_capabilities).toEqual(["retailer_discovery", "list_handoff"]);
    expect(row.last_verified).toBe("2026-10-16");
    expect(row.sources[0]).toContain("create_shopping_list_page");
    expect(registryRow("instore").lifecycle).toBe("production-enabled");
    expect(registryRow("walmart").integration_status).toBe("none");
    expect(row.category).toBe("integrated_provider");
    expect(row.adapter_implemented).toBe(true);
    expect(row.status).toMatchObject({
      documented: true,
      credentials_obtained: false,
      mock_tested: true,
      provider_tested: false,
      production_enabled: false,
    });
    expect(row.status.registration.value).toBe("unavailable");
    expect(registryRow("instore").category).toBe("native");
    expect(registryRow("instore").status).toEqual({ production_enabled: true });
    const adapterIds = Object.keys(createGroceryAdapters());
    for (const entry of GROCERY_REGISTRY) {
      expect(entry.adapter_implemented).toBe(adapterIds.includes(entry.id));
      if (entry.category === "provider_research") expect(entry.status).toBeUndefined();
      if (entry.status && Object.prototype.hasOwnProperty.call(entry.status, "mock_tested")) {
        expect(entry.status.mock_tested).toBe(entry.mock_tested_capabilities.length > 0);
        expect(entry.status.provider_tested).toBe(entry.provider_tested_capabilities.length > 0);
      }
    }
  });

  it("refuses Instacart unless config is complete, and refuses the fixture in production", () => {
    expect(instacartActivation({ GROCERY_PROVIDERS: "", ENVIRONMENT: "test" }).configured).toBe(false);
    expect(instacartActivation({ GROCERY_PROVIDERS: "instacart", ENVIRONMENT: "test" }).configured).toBe(false);
    expect(instacartActivation(mockEnv()).mode).toBe("mock");
    expect(
      instacartActivation({
        GROCERY_PROVIDERS: "instacart",
        GROCERY_FIXTURE: "instacart_mock",
        ENVIRONMENT: "production",
        DEPLOY_ENV: "production",
      }).configured
    ).toBe(false);
    expect(groceryFixtureActive({ GROCERY_FIXTURE: "instacart_mock", ENVIRONMENT: "production" })).toBe(false);
    expect(
      instacartActivation({
        GROCERY_PROVIDERS: "instacart",
        INSTACART_API_KEY: "dev-key",
        ENVIRONMENT: "development",
      }).mode
    ).toBe("live");
    expect(instacartActivation({ GROCERY_PROVIDERS: "instacart", INSTACART_API_KEY: "dev-key" }).configured).toBe(false);
    const live = resolveInstacartFetch({
      ENVIRONMENT: "production",
      DEPLOY_ENV: "production",
      GROCERY_PROVIDERS: "instacart",
      GROCERY_FIXTURE: "instacart_mock",
      GROCERY_MOCK_MODE: "timeout",
      INSTACART_API_KEY: "dev-key",
      GROCERY_FETCH: () => {
        throw new Error("fixture fetch");
      },
    });
    expect(String(live)).not.toContain("fixture fetch");
    expect(providerIds({ GROCERY_PROVIDERS: "" })).toEqual([]);
  });

  it("production config must declare GROCERY_PROVIDERS empty; preview may omit it", () => {
    const preview = readFileSync("deploy/pages/preview/wrangler.toml", "utf8");
    const production = readFileSync("deploy/pages/production/wrangler.toml", "utf8");
    expect(validateGroceryVars(production, "production").GROCERY_PROVIDERS).toBe("");
    expect(preview).not.toMatch(/^\s*GROCERY_PROVIDERS\s*=/m);
    expect("GROCERY_PROVIDERS" in validateGroceryVars(preview, "preview")).toBe(false);
    expect(validateGroceryVars(`${preview}\nGROCERY_PROVIDERS = ""`, "preview").GROCERY_PROVIDERS).toBe("");
    expect(preview).not.toMatch(/^\s*INSTACART_API_KEY\s*=/m);
    expect(preview).not.toMatch(/^\s*GROCERY_FIXTURE\s*=/m);
    expect(production).not.toMatch(/^\s*GROCERY_FIXTURE\s*=/m);
  });

  it("production check fails when GROCERY_PROVIDERS is missing, non-empty, or a fixture or key is present", () => {
    const production = readFileSync("deploy/pages/production/wrangler.toml", "utf8");
    const without = production.replace(/^\s*GROCERY_PROVIDERS\s*=.*$/m, "");
    expect(without).not.toMatch(/GROCERY_PROVIDERS\s*=/);
    expect(() => validateGroceryVars(without, "production")).toThrow(/missing GROCERY_PROVIDERS/);
    expect(() => validateGroceryVars(without)).toThrow(/missing GROCERY_PROVIDERS/);
    expect(() => validateGroceryVars(without, "staging")).toThrow(/missing GROCERY_PROVIDERS/);
    const nonEmpty = production.replace(/^\s*GROCERY_PROVIDERS\s*=.*$/m, 'GROCERY_PROVIDERS = "instacart"');
    expect(() => validateGroceryVars(nonEmpty, "production")).toThrow(/must be empty/);
    expect(() => validateGroceryVars(`${production}\nGROCERY_FIXTURE = "instacart_mock"`, "production")).toThrow(/GROCERY_FIXTURE/);
    expect(() => validateGroceryVars(`${production}\nGROCERY_FIXTURE = ""`, "production")).toThrow(/GROCERY_FIXTURE/);
    expect(() => validateGroceryVars(`${production}\nINSTACART_API_KEY = "secret"`, "production")).toThrow(/secret/);
    expect(() => validateGroceryVars(`${production}\nGROCERY_RUNTIME = "dev"`, "production")).toThrow(/GROCERY_RUNTIME/);
  });

  it("preview still refuses a non-empty provider list, a fixture, or a key in committed config", () => {
    const preview = readFileSync("deploy/pages/preview/wrangler.toml", "utf8");
    expect(() => validateGroceryVars(`${preview}\nGROCERY_PROVIDERS = "instacart"`, "preview")).toThrow(/empty/);
    expect(() => validateGroceryVars(`${preview}\nGROCERY_FIXTURE = "instacart_mock"`, "preview")).toThrow(/GROCERY_FIXTURE/);
    expect(() => validateGroceryVars(`${preview}\nINSTACART_API_KEY = "secret"`, "preview")).toThrow(/secret/);
  });
});

describe("instacart contract", () => {
  it("returns capability_unsupported without a network call", async () => {
    let called = false;
    const adapter = createInstacartAdapter({
      env: mockEnv(),
      fetch: () => {
        called = true;
        throw new Error("network");
      },
    });
    const result = await adapter.invoke("cart_create", {});
    expect(result.code).toBe("capability_unsupported");
    expect(result.retryable).toBe(false);
    expect(called).toBe(false);
  });

  it("never lets instore call fetch", async () => {
    const fetch = vi.fn();
    globalThis.fetch = fetch;
    const adapter = createInStoreAdapter();
    expect(adapter.configured()).toBe(true);
    expect(adapter.capabilities()).toEqual(["in_store"]);
    const ok = await adapter.invoke("in_store");
    const missing = await adapter.invoke("list_handoff");
    expect(ok.ok).toBe(true);
    expect(missing.code).toBe("capability_unsupported");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends line_item_measurements and not the deprecated quantity pair", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ products_link_url: "https://www.instacart.com/store/shopping-list/1" }), { status: 200 }));
    const adapter = createInstacartAdapter({
      env: { ...mockEnv(), ENVIRONMENT: "development", GROCERY_FIXTURE: "", INSTACART_API_KEY: "dev-key", GROCERY_PROVIDERS: "instacart" },
      fetch,
    });
    const result = await adapter.createListHandoff({
      title: "FlavorWeave list",
      linkback_url: "https://example.test/shop",
      lines: [{ name: "yellow onion", display_text: "Yellow onion", measurements: [{ quantity: 2, unit: "each" }] }],
    });
    expect(result.ok).toBe(true);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.link_type).toBe("shopping_list");
    expect(body.expires_in).toBe(14);
    expect(body.line_items[0].line_item_measurements).toEqual([{ quantity: 2, unit: "each" }]);
    expect(body.line_items[0].quantity).toBeUndefined();
    expect(body.line_items[0].unit).toBeUndefined();
    expect(body.enable_pantry_items).toBeUndefined();
    expect(body.line_items[0].filters).toBeUndefined();
    expect(body.line_items[0].upcs).toBeUndefined();
    expect(fetch.mock.calls[0][0]).toBe("https://connect.dev.instacart.tools/idp/v1/products/products_link");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer dev-key");
  });

  it("blocks a non-positive quantity before fetch", async () => {
    const fetch = vi.fn();
    const adapter = createInstacartAdapter({ env: mockEnv(), fetch });
    const result = await adapter.createListHandoff({
      linkback_url: "https://example.test/shop",
      lines: [{ name: "onion", measurements: [{ quantity: 0, unit: "each" }] }],
    });
    expect(result.code).toBe("invalid_request");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("matches the documented mock shapes and invents no cart or order", async () => {
    const mock = createInstacartMock();
    const ok = await mock("https://connect.dev.instacart.tools/idp/v1/products/products_link", {
      method: "POST",
      headers: { Authorization: "Bearer mock" },
      body: JSON.stringify({
        link_type: "shopping_list",
        line_items: [{ name: "onion", line_item_measurements: [{ quantity: 2, unit: "each" }] }],
      }),
    });
    const body = await ok.json();
    expect(body).toEqual({ products_link_url: "https://www.instacart.com/store/shopping-list/mock" });
    expect(body.cart_id).toBeUndefined();
    expect(body.order_id).toBeUndefined();
    const bad = await createInstacartMock({ mode: "quantity_error" })("https://connect.dev.instacart.tools/idp/v1/products/products_link", {
      method: "POST",
      body: JSON.stringify({ line_items: [{ line_item_measurements: [{ quantity: -0.1, unit: "each" }] }] }),
    });
    expect(bad.status).toBe(400);
    const error = await bad.json();
    expect(error.error.code).toBe(1001);
    expect(error.meta.key).toBe("line_items[0].line_item_measurements[0].quantity");
    const retailers = await mock("https://connect.dev.instacart.tools/idp/v1/retailers?postal_code=94105&country_code=US");
    const listed = await retailers.json();
    expect(listed.retailers[0].retailer_key).toBe("test-retailer");
    expect(listed.retailers[0].price).toBeUndefined();
    expect(listed.retailers[0].in_stock).toBeUndefined();
  });

  it("rejects unsafe destination urls", () => {
    expect(destinationAllowed("https://www.instacart.com/store/shopping-list/1").ok).toBe(true);
    expect(destinationAllowed("https://instacart.com/store/x").ok).toBe(true);
    expect(destinationAllowed("https://evil.example/phish").ok).toBe(false);
    expect(destinationAllowed("https://www.instacart.com.evil.example/x").ok).toBe(false);
    expect(destinationAllowed("http://www.instacart.com/x").ok).toBe(false);
    expect(destinationAllowed("https://user:pass@www.instacart.com/x").ok).toBe(false);
    expect(destinationAllowed("https://notinstacart.com/www.instacart.com").ok).toBe(false);
    expect(INSTACART_LOGO_PRESENT).toBe(false);
  });

  it("drops a non-https retailer logo and maps retailer 401 to not_configured", async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ retailers: [{ retailer_key: "test-retailer", name: "Test Retailer", retailer_logo_url: "www.logoUrl.com" }] }), { status: 200 })
    );
    const adapter = createInstacartAdapter({ env: mockEnv(), fetch });
    const result = await adapter.discoverRetailers({ postal_code: "94105", country_code: "US" });
    expect(result.retailers[0].logo_url).toBeNull();
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "no", code: 4001 }, meta: {} }), { status: 401 }));
    const denied = await adapter.discoverRetailers({ postal_code: "94105", country_code: "US" });
    expect(denied.code).toBe("not_configured");
  });
});

describe("transfer projection", () => {
  it("maps compatible units and holds unsupported ones", () => {
    const projection = projectTransfer({
      lines: [
        line({}),
        line({ line_id: "hl_towels", display_name: "paper towels", unit: "package", quantity_required: 1, quantity_override: 2 }),
        line({ line_id: "hl_garlic", display_name: "garlic", unit: "clove", quantity_required: 3 }),
        line({ line_id: "hl_jar", display_name: "salsa", unit: "jar", quantity_required: 1 }),
        line({ line_id: "hl_serve", display_name: "rice", unit: "serving", quantity_required: 4 }),
        line({ line_id: "hl_zero", display_name: "salt", unit: "tsp", quantity_required: 0 }),
        line({ line_id: "hl_neg", display_name: "pepper", unit: "tsp", quantity_required: -1 }),
        line({ line_id: "hl_have", display_name: "butter", unit: "oz", quantity_required: 4, list_state: "already_have" }),
        line({ line_id: "hl_bought", display_name: "milk", unit: "cup", quantity_required: 1, list_state: "purchased" }),
        line({ line_id: "hl_note", display_name: "soy sauce", unit: "tbsp", quantity_required: 1, note: "gluten free household" }),
      ],
    });
    const sent = instacartRequestBody({ title: projection.title, included: projection.included, linkback: "https://example.test/shop" });
    const names = sent.line_items.map((item) => item.name);
    expect(names).toEqual(["soy sauce", "yellow onion", "paper towels"]);
    expect(sent.line_items.find((item) => item.name === "yellow onion").line_item_measurements).toEqual([{ quantity: 2, unit: "each" }]);
    expect(sent.line_items.find((item) => item.name === "paper towels").line_item_measurements[0]).toEqual({ quantity: 2, unit: "package" });
    expect(JSON.stringify(sent)).not.toContain("gluten");
    expect(JSON.stringify(sent)).not.toContain("clove");
    expect(projection.staying.map((row) => row.line_id).sort()).toEqual(["hl_bought", "hl_garlic", "hl_have", "hl_jar", "hl_neg", "hl_serve", "hl_zero"]);
    expect(projection.staying.find((row) => row.line_id === "hl_garlic").reason).toBe("invalid_qty_unit");
  });

  it("fingerprints transfer semantics without timestamps or check-off state", async () => {
    const base = [line({})];
    const first = await fingerprint(requestFingerprintInput("instacart", projectTransfer({ lines: base }).included));
    const second = await fingerprint(requestFingerprintInput("instacart", projectTransfer({ lines: [...base].reverse() }).included));
    expect(first).toBe(second);
    const checked = await fingerprint(contentFingerprintInput([{ line_id: "hl_onion", display_name: "yellow onion", unit: "count", buy_quantity: 2, override_stale: 0, still_needed: 1 }]));
    const still = await fingerprint(contentFingerprintInput([{ line_id: "hl_onion", display_name: "yellow onion", unit: "count", buy_quantity: 2, override_stale: 0, still_needed: 1 }]));
    const edited = await fingerprint(contentFingerprintInput([{ line_id: "hl_onion", display_name: "yellow onion", unit: "count", buy_quantity: 3, override_stale: 0, still_needed: 1 }]));
    expect(checked).toBe(still);
    expect(edited).not.toBe(checked);
    expect(checked).not.toMatch(/^\d{4}-/);
  });
});

describe("grocery telemetry", () => {
  it("drops payloads, urls, notes, and credentials", () => {
    const safe = sanitizeGroceryEvent("shop_handoff_failed", {
      provider_id: "instacart",
      capability: "list_handoff",
      code: "timeout",
      provider_code: "5000",
      revision_sent: 4,
      line_count: 3,
      lifecycle_state: "failed",
      products_link_url: "https://www.instacart.com/secret",
      note: "peanut allergy",
      key: "keys.live",
    });
    expect(JSON.stringify(safe)).not.toContain("instacart.com");
    expect(JSON.stringify(safe)).not.toContain("peanut");
    expect(JSON.stringify(safe)).not.toContain("keys.live");
    expect(safe.code).toBe("timeout");
    expect(sanitizeGroceryEvent("order_completed", { provider_id: "instacart" })).toBeNull();
  });
});
