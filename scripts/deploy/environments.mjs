/**
 * Canonical deploy targets. Single source of truth for deploy scripts, preflight,
 * hosted-E2E guards and post-deploy binding checks. See docs/release/DEPLOY-SAFETY.md.
 */
export const PROD_D1_ID = "23aa3db3-1090-471b-8c8a-b6fe71f5c053";
export const PREVIEW_D1_ID = "65bc636d-7048-4e58-900b-9066edf6509f";

export const ENVIRONMENTS = Object.freeze({
  preview: Object.freeze({
    name: "preview",
    project: "harbor-eats-cycle1-preview",
    branch: "cycle1",
    root: "public",
    d1Id: PREVIEW_D1_ID,
    d1Name: "harbor-eats-cycle1-preview",
    config: "deploy/pages/preview/wrangler.toml",
    host: "harbor-eats-cycle1-preview.pages.dev",
  }),
  production: Object.freeze({
    name: "production",
    project: "harbor-eats-app",
    branch: "main",
    root: "public",
    d1Id: PROD_D1_ID,
    d1Name: "harbor-eats-db",
    config: "deploy/pages/production/wrangler.toml",
    host: "harbor-eats-app.pages.dev",
  }),
});

/** Hostnames that must never be a hosted-E2E target (prod + prod project's aliases). */
export const PROD_HOST_PATTERNS = [
  /^harbor-eats-app\.pages\.dev$/i,
  /\.harbor-eats-app\.pages\.dev$/i, // prod project preview aliases share PROD D1
];
// Add custom prod domains here when one is attached to harbor-eats-app.

export class DeploySafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = "DeploySafetyError";
  }
}

/** Parse the bits of a Pages wrangler.toml we enforce (no TOML dependency needed). */
export function parsePagesConfig(text) {
  const get = (re) => (re.exec(text) || [])[1] || null;
  const d1Ids = [...text.matchAll(/^\s*database_id\s*=\s*"([^"]+)"/gm)].map((m) => m[1]);
  return {
    name: get(/^\s*name\s*=\s*"([^"]+)"/m),
    outputDir: get(/^\s*pages_build_output_dir\s*=\s*"([^"]+)"/m),
    d1Ids,
    deployEnv: get(/^\s*DEPLOY_ENV\s*=\s*"([^"]+)"/m),
    d1Var: get(/^\s*D1_DATABASE_ID\s*=\s*"([^"]+)"/m),
  };
}

export const AI_REQUIRED_VARS = Object.freeze([
  "AI_PROVIDER", "AI_GATEWAY_ENABLED", "AI_TASKS_ENABLED", "AI_DAILY_BUDGET_USD",
  "AI_GLOBAL_PER_DAY", "AI_HOUSEHOLD_PER_MINUTE", "AI_HOUSEHOLD_PER_DAY", "AI_SOL_HOUSEHOLD_PER_DAY",
]);
export const AI_RETIRED_VARS = Object.freeze(["AI_GLOBAL_PER_HOUR"]);

/** Parse `KEY = "value"` lines (vars only; no TOML dependency). */
export function parseVars(text) {
  return Object.fromEntries([...String(text || "").matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*"([^"]*)"/gm)].map((m) => [m[1], m[2]]));
}

/**
 * D-05 AI var guard: all limiter/budget vars present and valid, no denylisted model (astra)
 * anywhere, no retired hourly vars, and no secret material in a committed config.
 */
export function validateAiVars(configText) {
  const text = String(configText || "");
  const vars = parseVars(text);
  const problems = [];
  if (/astra/i.test(text)) problems.push("denylisted model gpt-6-astra referenced");
  if (/^\s*OPENAI_API_KEY\s*=/m.test(text) || /\bsk-[A-Za-z0-9_-]{16,}/.test(text)) problems.push("secret material in config (OPENAI_API_KEY must be a Pages secret)");
  for (const k of AI_REQUIRED_VARS) if (!(k in vars)) problems.push(`missing ${k}`);
  for (const k of AI_RETIRED_VARS) if (k in vars) problems.push(`${k} is retired (use the per-day limiter vars)`);
  if ("AI_PROVIDER" in vars && !["openai", "none"].includes(vars.AI_PROVIDER)) problems.push(`AI_PROVIDER=${vars.AI_PROVIDER} unsupported`);
  if ("AI_GATEWAY_ENABLED" in vars && !["0", "1"].includes(vars.AI_GATEWAY_ENABLED)) problems.push("AI_GATEWAY_ENABLED must be \"0\" or \"1\"");
  for (const k of ["AI_GLOBAL_PER_DAY", "AI_HOUSEHOLD_PER_MINUTE", "AI_HOUSEHOLD_PER_DAY", "AI_SOL_HOUSEHOLD_PER_DAY"]) {
    if (k in vars && !(/^\d+$/.test(vars[k]) && Number(vars[k]) > 0)) problems.push(`${k} must be a positive integer`);
  }
  if ("AI_DAILY_BUDGET_USD" in vars && !(/^\d+(\.\d+)?$/.test(vars.AI_DAILY_BUDGET_USD))) problems.push("AI_DAILY_BUDGET_USD must be a non-negative number");
  if (problems.length) throw new DeploySafetyError(`AI vars: ${problems.join("; ")}`);
  return vars;
}

/**
 * Validate a requested deploy against the canonical target. Throws DeploySafetyError
 * for any wrong combination; returns the normalized plan otherwise.
 * @param {{env:string, project?:string, branch?:string, root?:string, d1Id?:string, configText:string}} req
 */
export function validateDeployPlan(req) {
  const target = ENVIRONMENTS[req.env];
  if (!target) throw new DeploySafetyError(`unknown environment "${req.env}" (expected preview|production)`);
  const project = req.project ?? target.project;
  const branch = req.branch ?? target.branch;
  const root = (req.root ?? target.root).replace(/^\.\//, "").replace(/\/$/, "");
  const cfg = parsePagesConfig(req.configText || "");
  const d1Id = req.d1Id ?? cfg.d1Ids[0];

  if (root !== "public") throw new DeploySafetyError(`deploy root must be public/, got "${root}"`);
  if (project !== target.project)
    throw new DeploySafetyError(`${target.name} must deploy project ${target.project}, got ${project}`);
  if (branch !== target.branch)
    throw new DeploySafetyError(`${target.name} must deploy branch ${target.branch}, got ${branch}`);
  if (target.name === "preview" && (d1Id === PROD_D1_ID || cfg.d1Ids.includes(PROD_D1_ID)))
    throw new DeploySafetyError("preview deploy with PRODUCTION D1 binding refused");
  if (target.name === "production" && (d1Id === PREVIEW_D1_ID || cfg.d1Ids.includes(PREVIEW_D1_ID)))
    throw new DeploySafetyError("production deploy with PREVIEW D1 binding refused");
  if (d1Id !== target.d1Id) throw new DeploySafetyError(`${target.name} expects D1 ${target.d1Id}, got ${d1Id}`);
  if (cfg.d1Ids.length !== 1) throw new DeploySafetyError(`config must declare exactly one D1 binding, found ${cfg.d1Ids.length}`);
  if (cfg.name !== target.project) throw new DeploySafetyError(`config name ${cfg.name} != project ${target.project}`);
  if ((cfg.outputDir || "").replace(/^\.\//, "") !== "public")
    throw new DeploySafetyError(`config pages_build_output_dir must be ./public, got ${cfg.outputDir}`);
  if (cfg.deployEnv !== target.name || cfg.d1Var !== target.d1Id)
    throw new DeploySafetyError("config DEPLOY_ENV / D1_DATABASE_ID vars must match the target (post-deploy binding check)");
  validateAiVars(req.configText);
  return { ...target, project, branch, root, d1Id };
}

/** Reject production hosts for hosted E2E. Returns the normalized URL. */
export function assertHostedE2ETarget(baseUrl) {
  let u;
  try {
    u = new URL(baseUrl);
  } catch {
    throw new DeploySafetyError(`invalid base URL: ${baseUrl}`);
  }
  if (u.protocol !== "https:" && !/^(127\.0\.0\.1|localhost)$/.test(u.hostname))
    throw new DeploySafetyError("hosted E2E base URL must be https (or localhost)");
  if (PROD_HOST_PATTERNS.some((re) => re.test(u.hostname)))
    throw new DeploySafetyError(`refusing hosted E2E against production host ${u.hostname}`);
  return u.origin;
}

/**
 * Post-deploy binding check: /api/health must report the expected env + D1 id.
 * @param {string} env @param {object} health parsed /api/health body
 */
export function checkHealthBinding(env, health, { expectedMeals } = {}) {
  const target = ENVIRONMENTS[env];
  const problems = [];
  if (!health || health.ok !== true) problems.push("health.ok !== true");
  if (health?.d1 !== "ok") problems.push(`health.d1=${health?.d1}`);
  if (health?.deploy_env !== target.name) problems.push(`deploy_env=${health?.deploy_env ?? null} expected ${target.name}`);
  if (health?.d1_database_id !== target.d1Id)
    problems.push(`d1_database_id=${health?.d1_database_id ?? null} expected ${target.d1Id}`);
  if (health?.catalog_source !== "d1") problems.push(`catalog_source=${health?.catalog_source}`);
  if (expectedMeals != null && health?.catalog_runtime_meals !== expectedMeals)
    problems.push(`catalog_runtime_meals=${health?.catalog_runtime_meals} expected ${expectedMeals}`);
  return { ok: problems.length === 0, problems };
}
