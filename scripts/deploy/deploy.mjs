#!/usr/bin/env node
/**
 * Canonical Pages deploy. Usage:
 *   node scripts/deploy/deploy.mjs preview   [--dry-run]
 *   node scripts/deploy/deploy.mjs production --confirm-production [--dry-run]
 * Stages public/ + functions/ + src/ beside deploy/pages/<env>/wrangler.toml so the
 * D1 binding comes from the env-specific config by construction, then runs
 * `wrangler pages deploy public --project-name <p> --branch <b>` from the stage dir.
 * Overrides (--project/--branch/--root/--d1) exist only so wrong combinations FAIL loudly.
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateDeployPlan, DeploySafetyError } from "./environments.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export function parseArgs(argv) {
  const out = { env: argv[0], dryRun: false, confirmProduction: false };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--confirm-production") out.confirmProduction = true;
    else if (["--project", "--branch", "--root", "--d1", "--config"].includes(a)) out[a.slice(2)] = argv[++i];
    else throw new DeploySafetyError(`unknown argument ${a}`);
  }
  return out;
}

/**
 * Build (and optionally run) the deploy. `deps` is injectable for unit tests.
 */
export function runDeploy(argv, deps = {}) {
  const exec = deps.exec || ((cmd, args, opts) => execFileSync(cmd, args, { stdio: "inherit", ...opts }));
  const read = deps.readFile || ((p) => readFileSync(join(repoRoot, p), "utf8"));
  const log = deps.log || console.log;
  const args = parseArgs(argv);
  const configPath = args.config || (args.env === "production" ? "deploy/pages/production/wrangler.toml" : "deploy/pages/preview/wrangler.toml");
  const plan = validateDeployPlan({
    env: args.env,
    project: args.project,
    branch: args.branch,
    root: args.root,
    d1Id: args.d1,
    configText: read(configPath),
  });
  if (plan.name === "production" && !args.confirmProduction && !args.dryRun)
    throw new DeploySafetyError("production deploy requires --confirm-production (Oversight-authorized releases only)");
  if (process.env.HARBOR_DEPLOY_FREEZE === "1" && !args.dryRun)
    throw new DeploySafetyError("HARBOR_DEPLOY_FREEZE=1: deploys are frozen");

  const stage = join(repoRoot, ".deploy-stage", plan.name);
  const wranglerArgs = ["wrangler", "pages", "deploy", "public", `--project-name=${plan.project}`, `--branch=${plan.branch}`, "--commit-dirty=false"];
  log(`[deploy] ${plan.name}: project=${plan.project} branch=${plan.branch} root=public/ d1=${plan.d1Id} config=${configPath}`);
  log(`[deploy] post-deploy: node scripts/deploy/verify-binding.mjs ${plan.name} https://<deployment>.${plan.host}`);
  if (args.dryRun) {
    log(`[deploy] DRY RUN — would run (cwd ${stage}): npx ${wranglerArgs.join(" ")}`);
    return { plan, stage, wranglerArgs, executed: false };
  }
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  for (const d of ["public", "functions", "src"]) cpSync(join(repoRoot, d), join(stage, d), { recursive: true });
  writeFileSync(join(stage, "wrangler.toml"), read(configPath));
  writeFileSync(join(stage, "package.json"), JSON.stringify({ type: "module", private: true }));
  if (!existsSync(join(stage, "public", "index.html"))) throw new DeploySafetyError("staged public/index.html missing");
  exec("npx", wranglerArgs, { cwd: stage });
  return { plan, stage, wranglerArgs, executed: true };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    runDeploy(process.argv.slice(2));
  } catch (e) {
    console.error(`[deploy] REFUSED: ${e.message}`);
    process.exit(2);
  }
}
