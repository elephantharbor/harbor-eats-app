/**
 * One development Instacart shopping-list call.
 * An operator runs this after INSTACART_API_KEY exists. This file does not
 * contain a key, and importing it does not call the network.
 *
 * Refuse (exit 2, no request):
 *   node scripts/grocery/instacart-dev-smoke.mjs
 *
 * Show the request shape without calling (exit 0):
 *   INSTACART_API_KEY=... node scripts/grocery/instacart-dev-smoke.mjs --confirm-dev --dry-run
 *
 * Call the development host from this machine (the key stays in the environment):
 *   INSTACART_API_KEY=... node scripts/grocery/instacart-dev-smoke.mjs --confirm-dev
 *
 * Call Preview, where the key stays in the Pages secret:
 *   node scripts/grocery/instacart-dev-smoke.mjs --confirm-dev \
 *     --preview-url https://<preview-host> --cookie "he_session=<token>"
 *
 * The process never prints the key. Production is refused.
 */

import { instacartApiHost } from "../../src/lib/grocery/config.js";
import { createInstacartAdapter } from "../../src/lib/grocery/instacart.js";

const SMOKE_LINE = Object.freeze([
  { name: "banana", display_text: "1 banana", measurements: [{ quantity: 1, unit: "each" }] },
]);

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  return process.argv[index + 1] || "";
}

function stop(message) {
  console.error(message);
  process.exit(2);
}

function redact(value, key) {
  const text = JSON.stringify(value);
  if (key && text.includes(key)) {
    stop("Refusing to print a response that contains the API key.");
  }
  return text;
}

function devEnv(key) {
  return {
    ENVIRONMENT: "development",
    DEPLOY_ENV: "development",
    GROCERY_PROVIDERS: "instacart",
    GROCERY_RUNTIME: "dev",
    GROCERY_FIXTURE: "",
    INSTACART_API_KEY: key,
  };
}

async function main() {
  if (!process.argv.includes("--confirm-dev")) {
    stop(
      "Refusing to call Instacart. Re-run with --confirm-dev after a person has approved one development smoke. No request was sent."
    );
  }
  const environment = String(process.env.ENVIRONMENT || process.env.DEPLOY_ENV || "").toLowerCase();
  if (environment === "production" || environment === "prod") {
    stop("Refusing a development smoke when ENVIRONMENT or DEPLOY_ENV is production. No Instacart call was made.");
  }

  const preview = arg("--preview-url");
  const key = String(process.env.INSTACART_API_KEY || "").trim();
  if (!preview && !key) {
    stop(
      "INSTACART_API_KEY is not set in this process, and --preview-url was not given. No Instacart call was made."
    );
  }

  if (preview) {
    let url;
    try {
      url = new URL("/api/grocery/dev-smoke", preview);
    } catch {
      stop("The preview URL is not valid. No Instacart call was made.");
    }
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      stop("The preview URL must be https. No Instacart call was made.");
    }
    const cookie = arg("--cookie");
    if (!cookie) stop("A --cookie for a synthetic household session is required. No Instacart call was made.");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        "x-flavorweave-grocery-mode": "dev",
      },
      body: "{}",
    });
    const body = await response.json().catch(() => ({ ok: false, error: "invalid_response" }));
    console.log(redact(body, key));
    process.exit(body && body.ok ? 0 : 1);
  }

  const env = devEnv(key);
  if (process.argv.includes("--dry-run")) {
    console.log(
      JSON.stringify({
        dry_run: true,
        called: false,
        host_class: "development",
        host: instacartApiHost(env),
        authorization: "Bearer",
        path: "/idp/v1/products/products_link",
        link_type: "shopping_list",
        line_count: SMOKE_LINE.length,
      })
    );
    return;
  }

  const adapter = createInstacartAdapter({ env });
  const result = await adapter.createListHandoff({
    title: "FlavorWeave list",
    linkback_url: "https://harbor-eats-app.pages.dev/shop",
    lines: SMOKE_LINE,
    expires_in_days: 14,
  });
  const report = {
    ok: !!result.ok,
    called: true,
    host_class: "development",
    host: instacartApiHost(env),
    error: result.ok ? null : result.code || "provider_rejected",
    url_valid: !!(result.ok && result.products_link_url),
    products_link_url: result.ok ? result.products_link_url : undefined,
    diagnostic: {
      http_status: result.diagnostic?.http_status ?? null,
      request_id: result.diagnostic?.request_id ?? null,
    },
    purchased: false,
  };
  console.log(redact(report, key));
  process.exit(report.ok ? 0 : 1);
}

const isDirect = process.argv[1] && process.argv[1].endsWith("instacart-dev-smoke.mjs");
if (isDirect) {
  main().catch((error) => {
    console.error(error && error.name ? error.name : "smoke_failed");
    process.exit(1);
  });
}
