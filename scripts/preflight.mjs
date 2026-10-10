#!/usr/bin/env node
/**
 * Cheap preflight gates (seconds, no network unless noted). Modes:
 *   base        — node version, no root Pages config with a D1 binding, deploy configs valid, SW invariant
 *   e2e         — base + E2E mode contract (docs/release/E2E-MODES.md): D1 mode needs a seed
 *   preview     — base + preview deploy plan valid + clean git tree
 *   production  — base + production deploy plan valid + clean tree + HEAD == origin/main
 * Usage: node scripts/preflight.mjs [mode]   (npm run preflight[:e2e|:preview|:production])
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENVIRONMENTS, validateDeployPlan, parsePagesConfig } from "./deploy/environments.mjs";
import { checkSwInvariant } from "./release/sw-invariant.mjs";
import { resolveE2EMode } from "./e2e-modes.mjs";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

export function defaultDeps(root = repoRoot) {
  return {
    root,
    nodeVersion: process.versions.node,
    exists: (p) => existsSync(join(root, p)),
    read: (p) => readFileSync(join(root, p), "utf8"),
    git: (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(),
    env: process.env,
    swInvariant: () => checkSwInvariant(root),
  };
}

export function runPreflight(mode = "base", deps = defaultDeps()) {
  const results = [];
  const check = (name, fn) => {
    try {
      const detail = fn();
      results.push({ name, ok: true, detail: detail ?? "" });
    } catch (e) {
      results.push({ name, ok: false, detail: e.message });
    }
  };
  check("node>=22", () => {
    if (Number(deps.nodeVersion.split(".")[0]) < 22) throw new Error(`node ${deps.nodeVersion}`);
  });
  check("no root Pages config with D1 binding", () => {
    for (const f of ["wrangler.toml", "wrangler.json", "wrangler.jsonc"]) {
      if (!deps.exists(f)) continue;
      const cfg = parsePagesConfig(deps.read(f));
      if (cfg.outputDir || cfg.d1Ids.length)
        throw new Error(`${f} at repo root would be picked up by an ad-hoc \`wrangler pages deploy\`; use deploy/pages/<env>/wrangler.toml`);
    }
  });
  for (const env of Object.keys(ENVIRONMENTS)) {
    check(`deploy config ${env}`, () => {
      const t = ENVIRONMENTS[env];
      validateDeployPlan({ env, configText: deps.read(t.config) });
      return `${t.project}@${t.branch} d1=${t.d1Id}`;
    });
  }
  check("staging worker config is not prod D1", () => {
    const cfg = parsePagesConfig(deps.read("wrangler.staging.toml"));
    if (cfg.d1Ids.includes(ENVIRONMENTS.production.d1Id)) throw new Error("wrangler.staging.toml points at PROD D1");
  });
  check("SW cache-version invariant", () => {
    const r = deps.swInvariant();
    if (!r.ok) throw new Error(r.problems.join("; "));
    return r.version;
  });

  if (mode === "e2e") {
    check("E2E mode contract", () => {
      const m = resolveE2EMode(deps.env, { exists: deps.exists, read: deps.read });
      return `${m.name}: ${m.summary}`;
    });
  }
  if (mode === "preview" || mode === "production") {
    check("clean git tree", () => {
      const s = deps.git("status", "--porcelain");
      if (s) throw new Error(`uncommitted changes:\n${s}`);
    });
  }
  if (mode === "production") {
    check("HEAD == origin/main", () => {
      const head = deps.git("rev-parse", "HEAD");
      const main = deps.git("rev-parse", "origin/main");
      if (head !== main) throw new Error(`HEAD ${head.slice(0, 7)} != origin/main ${main.slice(0, 7)}`);
      return head.slice(0, 7);
    });
  }
  return { mode, ok: results.every((r) => r.ok), results };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const mode = process.argv[2] || "base";
  if (!["base", "e2e", "preview", "production"].includes(mode)) {
    console.error(`unknown preflight mode ${mode}`);
    process.exit(2);
  }
  const r = runPreflight(mode);
  for (const x of r.results) console.log(`${x.ok ? "PASS" : "FAIL"}  ${x.name}${x.detail ? ` — ${x.detail}` : ""}`);
  console.log(`preflight:${mode} ${r.ok ? "PASS" : "FAIL"}`);
  process.exit(r.ok ? 0 : 1);
}
