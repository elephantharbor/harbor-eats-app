#!/usr/bin/env node
/** Guard for .github/workflows/hosted-e2e.yml. `--health` also checks /api/health. */
import { fileURLToPath } from "node:url";
import { assertHostedE2ETarget, checkHealthBinding } from "../deploy/environments.mjs";

export async function assertTarget(baseUrl, { health = false, fetchImpl = fetch, requireBindingVars = false } = {}) {
  const origin = assertHostedE2ETarget(baseUrl);
  if (!health) return { origin };
  const res = await fetchImpl(`${origin}/api/health`);
  if (!res.ok) throw new Error(`/api/health -> ${res.status}`);
  const body = await res.json();
  const r = checkHealthBinding("preview", body, { expectedMeals: 75 });
  // Until the next deploy ships DEPLOY_ENV/D1_DATABASE_ID vars, only the var checks may be absent.
  const problems = r.problems.filter(
    (p) => requireBindingVars || !(p.startsWith("deploy_env=null") || p.startsWith("d1_database_id=null"))
  );
  if (body.d1_database_id && body.d1_database_id !== "65bc636d-7048-4e58-900b-9066edf6509f")
    problems.push("preview is bound to a non-preview D1");
  if (problems.length) throw new Error(`health: ${problems.join("; ")}`);
  return { origin, health: body };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const r = await assertTarget(process.argv[2], {
      health: process.argv.includes("--health"),
      requireBindingVars: process.env.REQUIRE_BINDING_VARS === "1",
    });
    console.log(`hosted target OK: ${r.origin}`);
  } catch (e) {
    console.error(`hosted target REFUSED: ${e.message}`);
    process.exit(1);
  }
}
