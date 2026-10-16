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
export function instacartActivation(env) {
  const listed = providerIds(env).includes("instacart");
  if (!listed) return { configured: false, mode: "off", reason: "not_listed" };
  if (groceryFixtureActive(env)) return { configured: true, mode: "mock", reason: "fixture" };
  const key = String(env?.INSTACART_API_KEY || "").trim();
  const host = instacartApiHost(env);
  if (!key || !host) return { configured: false, mode: "off", reason: "incomplete" };
  return { configured: true, mode: "live", reason: "key" };
}

export function instacartKey(env) {
  if (instacartActivation(env).mode !== "live") return "";
  return String(env?.INSTACART_API_KEY || "").trim();
}

export function groceryMockMode(env) {
  if (productionLocked(env)) return "ok";
  if (!groceryFixtureActive(env) && environmentName(env) !== "test") return "ok";
  const mode = String(env?.GROCERY_MOCK_MODE || "ok");
  return MOCK_MODES.has(mode) ? mode : "ok";
}

export function groceryTimeoutMs(env) {
  if (productionLocked(env)) return 8000;
  const raw = Number(env?.GROCERY_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw >= 50 && raw <= 15000) return raw;
  return 8000;
}
