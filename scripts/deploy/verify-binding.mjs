#!/usr/bin/env node
/** Post-deploy binding check: node scripts/deploy/verify-binding.mjs <preview|production> <baseUrl> */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkHealthBinding } from "./environments.mjs";

const DEFAULT_404_ATTEMPTS = 3;
const DEFAULT_404_DELAY_MS = 400;

function sleepDefault(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Cloudflare can answer 404 for a few hundred milliseconds after a deploy
 * while the new deployment is attached. Retry only that status.
 */
async function fetchRetry404(fetchImpl, url, init, { attempts, delayMs, sleep }) {
  const tries = Math.max(1, attempts);
  let res;
  for (let i = 0; i < tries; i += 1) {
    res = await fetchImpl(url, init);
    if (res?.status !== 404 || i === tries - 1) return res;
    await sleep(delayMs);
  }
  return res;
}

export async function verifyBinding(env, baseUrl, {
  fetchImpl = fetch,
  expectedMeals,
  attempts = DEFAULT_404_ATTEMPTS,
  delayMs = DEFAULT_404_DELAY_MS,
  sleep = sleepDefault,
} = {}) {
  const get = (url, init) => fetchRetry404(fetchImpl, url, init, { attempts, delayMs, sleep });
  const res = await get(new URL("/api/health", baseUrl).href, { headers: { accept: "application/json" } });
  if (!res.ok) return { ok: false, problems: [`GET /api/health -> ${res.status}`] };
  const sw = await get(new URL("/sw.js", baseUrl).href);
  const result = checkHealthBinding(env, await res.json(), { expectedMeals });
  const meta = JSON.parse(readFileSync(new URL("../../release/release-metadata.json", import.meta.url), "utf8"));
  const swText = sw.ok ? await sw.text() : "";
  if (!swText.includes(`"${meta.sw_cache_version}"`)) result.problems.push(`sw.js does not serve ${meta.sw_cache_version}`);
  result.ok = result.problems.length === 0;
  return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [env, base] = process.argv.slice(2);
  const meta = JSON.parse(readFileSync(new URL("../../release/release-metadata.json", import.meta.url), "utf8"));
  const r = await verifyBinding(env, base, { expectedMeals: meta.catalog_runtime_meals });
  console.log(JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
}
