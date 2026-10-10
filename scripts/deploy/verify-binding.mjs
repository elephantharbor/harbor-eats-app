#!/usr/bin/env node
/** Post-deploy binding check: node scripts/deploy/verify-binding.mjs <preview|production> <baseUrl> */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkHealthBinding } from "./environments.mjs";

export async function verifyBinding(env, baseUrl, { fetchImpl = fetch, expectedMeals } = {}) {
  const res = await fetchImpl(new URL("/api/health", baseUrl).href, { headers: { accept: "application/json" } });
  if (!res.ok) return { ok: false, problems: [`GET /api/health -> ${res.status}`] };
  const sw = await fetchImpl(new URL("/sw.js", baseUrl).href);
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
