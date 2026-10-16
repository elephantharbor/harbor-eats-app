/**
 * Instacart Developer Platform adapter.
 * POST /idp/v1/products/products_link with link_type shopping_list.
 * Measurements go in line_item_measurements. Deprecated quantity/unit are not sent.
 * Docs re-read 2026-10-16:
 * https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page/
 * https://docs.instacart.com/developer_platform_api/api/retailers/get_nearby_retailers/
 * https://docs.instacart.com/developer_platform_api/api/units_of_measurement
 */

import { destinationAllowed } from "./allowlist.js";
import { groceryMockMode, groceryTimeoutMs, instacartActivation, instacartApiHost, instacartKey } from "./config.js";
import { capabilityUnsupported, fromProviderHttp, groceryError, notConfigured } from "./errors.js";
import { createInstacartMock } from "./instacart-mock.js";
import { instacartRequestBody } from "./projection.js";

const CAPABILITIES = Object.freeze(["retailer_discovery", "list_handoff"]);
const FULFILLMENT = Object.freeze(["provider_checkout"]);
const LINK_DAYS = 14;

export function resolveInstacartFetch(env, injected) {
  if (typeof injected === "function") return injected;
  const environment = String(env?.ENVIRONMENT || "").toLowerCase();
  const deploy = String(env?.DEPLOY_ENV || "").toLowerCase();
  const locked = environment === "production" || environment === "prod" || deploy === "production";
  if (typeof env?.GROCERY_FETCH === "function" && !locked) return env.GROCERY_FETCH;
  if (String(env?.GROCERY_DEV_BLOCKED || "") === "1") {
    return async () => {
      const error = new Error("dev_not_allowed");
      error.code = "dev_not_allowed";
      throw error;
    };
  }
  const activation = instacartActivation(env);
  // Unit tests stay on the mock unless they inject a fetch. Preview development uses the real fetch.
  if (activation.mode === "mock" || environment === "test") {
    return createInstacartMock({ mode: groceryMockMode(env) });
  }
  return globalThis.fetch.bind(globalThis);
}

export function instacartFetchIsMock(env, injected) {
  const impl = resolveInstacartFetch(env, injected);
  return Array.isArray(impl?.calls);
}

const REQUEST_ID_HEADERS = ["x-request-id", "x-instacart-request-id", "request-id"];

export function safeInstacartRequestId(headers) {
  if (!headers || typeof headers.get !== "function") return null;
  for (const name of REQUEST_ID_HEADERS) {
    const raw = headers.get(name);
    if (!raw) continue;
    const clean = String(raw).trim().slice(0, 80);
    if (/^[A-Za-z0-9._:-]+$/.test(clean)) return clean;
  }
  return null;
}

export function logInstacartDiagnostic(diagnostic) {
  console.error(
    JSON.stringify({
      event: "instacart_http",
      http_status: diagnostic?.http_status ?? null,
      request_id: diagnostic?.request_id ?? null,
      timeout: diagnostic?.timeout === true,
    })
  );
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createInstacartAdapter({ env = {}, fetch: injected } = {}) {
  const fetchImpl = resolveInstacartFetch(env, injected);
  const adapter = {
    id: "instacart",
    capabilities() {
      return CAPABILITIES;
    },
    fulfillmentMethods() {
      return FULFILLMENT;
    },
    configured(nextEnv) {
      return instacartActivation(nextEnv || env).configured;
    },
    async invoke(capability, input) {
      if (!CAPABILITIES.includes(capability)) return capabilityUnsupported("instacart", capability);
      if (!adapter.configured()) return notConfigured("instacart", capability);
      if (capability === "retailer_discovery") return adapter.discoverRetailers(input || {});
      if (capability === "list_handoff") return adapter.createListHandoff(input || {});
      return capabilityUnsupported("instacart", capability);
    },
    async discoverRetailers({ postal_code, country_code } = {}) {
      if (String(env?.GROCERY_DEV_BLOCKED || "") === "1") {
        return groceryError({
          code: "dev_not_allowed",
          provider_id: "instacart",
          capability: "retailer_discovery",
          status: 403,
          message: "Development Instacart calls are only available for a synthetic household.",
        });
      }
      if (!adapter.configured()) return notConfigured("instacart", "retailer_discovery");
      const postal = String(postal_code || "").trim();
      const country = String(country_code || "").trim().toUpperCase();
      if (!postal || postal.length > 12 || (country !== "US" && country !== "CA")) {
        return groceryError({
          code: "invalid_request",
          provider_id: "instacart",
          capability: "retailer_discovery",
          message: "Enter a US or Canada postal code.",
        });
      }
      const host = instacartApiHost(env);
      const activation = instacartActivation(env);
      const url = `${host}/idp/v1/retailers?postal_code=${encodeURIComponent(postal)}&country_code=${country}`;
      const result = await call(fetchImpl, url, { method: "GET", headers: headers(env, activation) }, env);
      if (!result.ok) {
        return { ...fromProviderHttp({ providerId: "instacart", capability: "retailer_discovery", ...result }), diagnostic: result.diagnostic };
      }
      const rows = Array.isArray(result.body?.retailers) ? result.body.retailers : null;
      if (!rows) {
        return groceryError({
          code: "invalid_request",
          provider_id: "instacart",
          capability: "retailer_discovery",
          message: "Instacart’s reply was not a retailer list.",
        });
      }
      return {
        ok: true,
        retailers: rows.map((row) => ({
          retailer_key: String(row.retailer_key || ""),
          name: String(row.name || ""),
          logo_url: httpsOnly(row.retailer_logo_url),
        })),
      };
    },
    async createListHandoff({ title, linkback_url, lines, expires_in_days } = {}) {
      if (String(env?.GROCERY_DEV_BLOCKED || "") === "1") {
        return groceryError({
          code: "dev_not_allowed",
          provider_id: "instacart",
          capability: "list_handoff",
          status: 403,
          message: "Development Instacart calls are only available for a synthetic household.",
        });
      }
      if (!adapter.configured()) return notConfigured("instacart", "list_handoff");
      const expires = Number(expires_in_days || LINK_DAYS);
      if (!Array.isArray(lines) || !lines.length) {
        return groceryError({
          code: "invalid_request",
          provider_id: "instacart",
          capability: "list_handoff",
          message: "Nothing on this list can go to Instacart yet.",
        });
      }
      if (!linkback_url || !Number.isInteger(expires) || expires < 1 || expires > 365) {
        return groceryError({
          code: "invalid_request",
          provider_id: "instacart",
          capability: "list_handoff",
          message: "The list could not be prepared.",
        });
      }
      for (const line of lines) {
        const measurements = line.measurements || line.line_item_measurements;
        if (!line.name || !Array.isArray(measurements) || measurements.length !== 1) {
          return groceryError({
            code: "invalid_request",
            provider_id: "instacart",
            capability: "list_handoff",
            message: "An item needs one Instacart measurement.",
          });
        }
        const measurement = measurements[0];
        if (!(Number(measurement.quantity) > 0) || !measurement.unit) {
          return groceryError({
            code: "invalid_request",
            provider_id: "instacart",
            capability: "list_handoff",
            message: "An item needs a quantity Instacart accepts.",
          });
        }
      }
      const included = lines.map((line) => ({
        name: line.name,
        display_text: line.display_text || line.name,
        measurements: (line.measurements || line.line_item_measurements).map((m) => ({
          quantity: Number(m.quantity),
          unit: m.unit,
        })),
      }));
      const payload = instacartRequestBody({
        title: title || "FlavorWeave list",
        included,
        linkback: linkback_url,
        expiresIn: expires,
      });
      const host = instacartApiHost(env);
      const activation = instacartActivation(env);
      const result = await call(
        fetchImpl,
        `${host}/idp/v1/products/products_link`,
        {
          method: "POST",
          headers: { ...headers(env, activation), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        env
      );
      if (!result.ok && result.timeout) {
        return groceryError({
          code: "timeout",
          retryable: true,
          provider_id: "instacart",
          capability: "list_handoff",
          message: "Instacart took too long. Your list was not changed.",
          extra: { diagnostic: result.diagnostic },
        });
      }
      if (!result.ok) {
        return { ...fromProviderHttp({ providerId: "instacart", capability: "list_handoff", ...result }), diagnostic: result.diagnostic };
      }
      const rawUrl = result.body && result.body.products_link_url;
      if (typeof rawUrl !== "string" || !rawUrl) {
        return groceryError({
          code: "invalid_request",
          provider_id: "instacart",
          capability: "list_handoff",
          message: "Instacart’s reply was not a list link.",
        });
      }
      const allowed = destinationAllowed(rawUrl);
      if (!allowed.ok) {
        return groceryError({
          code: "invalid_request",
          provider_id: "instacart",
          capability: "list_handoff",
          message: "Instacart returned a link we won’t open.",
          extra: { destination_rejected: true },
        });
      }
      const expiresAt = new Date(Date.now() + expires * 86400000).toISOString();
      return {
        ok: true,
        products_link_url: allowed.url,
        expires_at: expiresAt,
        diagnostic: result.diagnostic,
      };
    },
  };
  return adapter;
}

function headers(env, activation) {
  const key = activation.mode === "live" ? instacartKey(env) : "mock";
  return {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
}

function httpsOnly(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function diagnosticFor(response, extra = {}) {
  const diagnostic = {
    http_status: response?.status ?? extra.http_status ?? null,
    request_id: safeInstacartRequestId(response?.headers),
    timeout: extra.timeout === true,
  };
  logInstacartDiagnostic(diagnostic);
  return diagnostic;
}

async function call(fetchImpl, url, init, env) {
  const timeout = groceryTimeoutMs(env);
  const signal = AbortSignal.timeout(timeout);
  try {
    const response = await fetchImpl(url, { ...init, signal });
    const body = await readBody(response);
    const diagnostic = diagnosticFor(response);
    if (!response.ok) return { ok: false, httpStatus: response.status, body, diagnostic };
    return { ok: true, httpStatus: response.status, body, diagnostic };
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      const diagnostic = diagnosticFor(null, { http_status: 408, timeout: true });
      return { ok: false, timeout: true, httpStatus: 408, body: null, diagnostic };
    }
    const diagnostic = diagnosticFor(null, { http_status: 502 });
    return { ok: false, httpStatus: 502, body: null, diagnostic };
  }
}
