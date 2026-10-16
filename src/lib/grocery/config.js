/**
 * GROCERY_PROVIDERS is a comma list, default empty.
 * Empty leaves in-store available. Instacart stays off until the list names it
 * AND configuration is complete. A fixture cannot turn on in production.
 */

import { INSTACART_API_HOSTS } from "./allowlist.js";

const FIXTURE = "instacart_mock";
const MOCK_MODES = new Set([
  "ok",
  "timeout",
  "provider_error",
  "bad_url",
  "invalid_body",
  "unauthorized",
  "rate_limited",
  "quantity_error",
]);

export function environmentName(env) {
  return String(env?.ENVIRONMENT || env?.DEPLOY_ENV || "").trim().toLowerCase();
}

export function providerIds(env) {
  return String(env?.GROCERY_PROVIDERS || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function productionLocked(env) {
  const environment = environmentName(env);
  const deploy = String(env?.DEPLOY_ENV || "").trim().toLowerCase();
  return environment === "production" || environment === "prod" || deploy === "production";
}

export function groceryFixtureActive(env) {
  if (String(env?.GROCERY_FIXTURE || "") !== FIXTURE) return false;
  if (productionLocked(env)) return false;
  return ["preview", "test", "development", "dev", "e2e"].includes(environmentName(env));
}

export function instacartApiHost(env) {
  if (productionLocked(env)) return INSTACART_API_HOSTS.production;
  if (["preview", "test", "development", "dev", "e2e"].includes(environmentName(env))) {
    return INSTACART_API_HOSTS.development;
  }
  return null;
}

/**
 * Complete Instacart config is the flag plus either a non-empty server key
 * and a known host, or the preview/test fixture. The key itself is never returned.
 */
function activation(fields) {
  return { configured: false, mode: "off", reason: "incomplete", channel: "off", ...fields };
}

/**
 * Request-time resolution. A Pages secret is read on each request, so
 * GROCERY_RUNTIME can move Preview between mock and development without a code deploy.
 * Production never honors the fixture, GROCERY_RUNTIME, or GROCERY_MOCK_MODE.
 */
export function instacartActivation(env) {
  const listed = providerIds(env).includes("instacart");
  if (!listed) return activation({ reason: "not_listed" });

  if (productionLocked(env)) {
    const key = String(env?.INSTACART_API_KEY || "").trim();
    const host = instacartApiHost(env);
    if (!key || !host) return activation({ reason: "incomplete" });
    return activation({ configured: true, mode: "live", reason: "key", channel: "consumer" });
  }

  const runtime = String(env?.GROCERY_RUNTIME || "").trim().toLowerCase();
  if (runtime === "off") return activation({ reason: "runtime_off" });
  if (runtime === "dev") {
    const key = String(env?.INSTACART_API_KEY || "").trim();
    const host = instacartApiHost(env);
    if (!key || !host) return activation({ reason: "dev_key_missing", channel: "development" });
    return activation({ configured: true, mode: "live", reason: "dev", channel: "development" });
  }
  if (runtime === "mock" || groceryFixtureActive(env)) {
    if (!["preview", "test", "development", "dev", "e2e"].includes(environmentName(env))) {
      return activation({ reason: "incomplete" });
    }
    return activation({ configured: true, mode: "mock", reason: runtime === "mock" ? "runtime" : "fixture", channel: "mock" });
  }

  const key = String(env?.INSTACART_API_KEY || "").trim();
  const host = instacartApiHost(env);
  if (!key || !host) return activation({ reason: "incomplete" });
  return activation({ configured: true, mode: "live", reason: "key", channel: "development" });
}

export function instacartKey(env) {
  if (instacartActivation(env).mode !== "live") return "";
  return String(env?.INSTACART_API_KEY || "").trim();
}

export function groceryMockMode(env) {
  if (productionLocked(env)) return "ok";
  const runtime = String(env?.GROCERY_RUNTIME || "").trim().toLowerCase();
  const mock = runtime === "mock" || groceryFixtureActive(env) || environmentName(env) === "test";
  if (!mock) return "ok";
  const mode = String(env?.GROCERY_MOCK_MODE || "ok").trim().toLowerCase().replace(/-/g, "_");
  return MOCK_MODES.has(mode) ? mode : "ok";
}

const MODE_HEADER = "x-flavorweave-grocery-mode";

function headerChoice(request) {
  const raw = request?.headers?.get?.(MODE_HEADER);
  if (!raw) return null;
  const choice = String(raw).trim().toLowerCase().replace(/-/g, "_");
  if (choice === "dev" || choice === "development") return { kind: "dev" };
  if (choice === "mock") return { kind: "mock", mode: "ok" };
  if (MOCK_MODES.has(choice)) return { kind: "mock", mode: choice };
  return null;
}

/**
 * Per-request overlay. Production returns the same env.
 * A preview/test/dev header can select a mock mode or development without a redeploy.
 * The header cannot set a key, a host, or a provider list.
 */
export function groceryEnvForRequest(env, request) {
  if (!env || productionLocked(env)) return env;
  if (!["preview", "test", "development", "dev", "e2e"].includes(environmentName(env))) return env;
  const choice = headerChoice(request);
  if (!choice) return env;
  if (choice.kind === "dev") {
    return { ...env, GROCERY_FIXTURE: "", GROCERY_RUNTIME: "dev" };
  }
  return {
    ...env,
    GROCERY_FIXTURE: "instacart_mock",
    GROCERY_MOCK_MODE: choice.mode,
    GROCERY_RUNTIME: "mock",
  };
}

/**
 * Live development calls are only for a household with data_origin synthetic.
 * Production is returned unchanged. A non-synthetic household uses the mock
 * when the original env has the fixture, and is blocked otherwise.
 * The blocked env carries no key and no fetch, so a later adapter cannot call out.
 * @param {object} baseEnv env before the per-request header overlay
 * @param {object} requestEnv env after groceryEnvForRequest
 * @param {{ data_origin?: string|null }|null|undefined} household
 */
export function groceryEnvForHousehold(baseEnv, requestEnv, household) {
  if (!requestEnv || productionLocked(requestEnv) || productionLocked(baseEnv)) {
    return { env: requestEnv, blocked: false };
  }
  if (household && household.data_origin === "synthetic") return { env: requestEnv, blocked: false };
  const activation = instacartActivation(requestEnv);
  if (activation.mode !== "live" || activation.channel !== "development") {
    return { env: requestEnv, blocked: false };
  }
  if (groceryFixtureActive(baseEnv)) {
    const mode = String(baseEnv?.GROCERY_MOCK_MODE || "ok").trim().toLowerCase().replace(/-/g, "_");
    const next = {
      ...requestEnv,
      GROCERY_FIXTURE: "instacart_mock",
      GROCERY_RUNTIME: "mock",
      GROCERY_MOCK_MODE: MOCK_MODES.has(mode) ? mode : "ok",
    };
    delete next.GROCERY_FETCH;
    delete next.GROCERY_DEV_BLOCKED;
    return { env: next, blocked: false };
  }
  const next = {
    ...requestEnv,
    GROCERY_DEV_BLOCKED: "1",
    GROCERY_RUNTIME: "off",
    INSTACART_API_KEY: "",
  };
  delete next.GROCERY_FETCH;
  return { env: next, blocked: true };
}

export function groceryTimeoutMs(env) {
  if (productionLocked(env)) return 8000;
  const raw = Number(env?.GROCERY_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw >= 50 && raw <= 15000) return raw;
  return 8000;
}
