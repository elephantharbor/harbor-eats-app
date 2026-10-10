import { readFileSync, existsSync, mkdtempSync, cpSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, vi } from "vitest";
import {
  ENVIRONMENTS,
  PROD_D1_ID,
  PREVIEW_D1_ID,
  validateDeployPlan,
  assertHostedE2ETarget,
  checkHealthBinding,
} from "../scripts/deploy/environments.mjs";
import { runDeploy } from "../scripts/deploy/deploy.mjs";
import { verifyBinding } from "../scripts/deploy/verify-binding.mjs";
import { assertTarget } from "../scripts/ci/assert-hosted-target.mjs";
import { runPreflight, defaultDeps } from "../scripts/preflight.mjs";
import { resolveE2EMode } from "../scripts/e2e-modes.mjs";
import { checkSwInvariant, shellHash, readSw } from "../scripts/release/sw-invariant.mjs";

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");
const previewCfg = read("deploy/pages/preview/wrangler.toml");
const prodCfg = read("deploy/pages/production/wrangler.toml");

describe("deploy configs (binding correct by construction)", () => {
  it("preview config binds only preview D1; production only prod D1", () => {
    expect(previewCfg).toContain(PREVIEW_D1_ID);
    expect(previewCfg).not.toContain(PROD_D1_ID);
    expect(prodCfg).toContain(PROD_D1_ID);
    expect(prodCfg).not.toContain(PREVIEW_D1_ID);
  });
  it("no root wrangler.toml remains for ad-hoc `wrangler pages deploy` to pick up", () => {
    expect(existsSync(join(root, "wrangler.toml"))).toBe(false);
  });
  it("valid plans pass", () => {
    expect(validateDeployPlan({ env: "preview", configText: previewCfg }).project).toBe("harbor-eats-cycle1-preview");
    expect(validateDeployPlan({ env: "production", configText: prodCfg }).branch).toBe("main");
  });
});

describe("deploy refusals", () => {
  const refuse = (req) => expect(() => validateDeployPlan(req)).toThrow(/refused|must|expects|exactly/);
  it("preview with prod D1 FAILS (flag override)", () => refuse({ env: "preview", d1Id: PROD_D1_ID, configText: previewCfg }));
  it("preview with prod D1 FAILS (prod config)", () => refuse({ env: "preview", configText: prodCfg }));
  it("preview config with an extra prod binding FAILS", () =>
    refuse({ env: "preview", configText: previewCfg.replace(PREVIEW_D1_ID, PROD_D1_ID) }));
  it("prod with preview D1 FAILS (flag override)", () => refuse({ env: "production", d1Id: PREVIEW_D1_ID, configText: prodCfg }));
  it("prod with preview D1 FAILS (preview config)", () => refuse({ env: "production", configText: previewCfg }));
  it("non-public/ root FAILS", () => {
    for (const root of [".", "dist", "public/images", "./"]) refuse({ env: "preview", root, configText: previewCfg });
  });
  it("wrong project or branch FAILS", () => {
    refuse({ env: "preview", project: "harbor-eats-app", configText: previewCfg });
    refuse({ env: "production", project: "harbor-eats-cycle1-preview", configText: prodCfg });
    refuse({ env: "preview", branch: "main", configText: previewCfg });
    refuse({ env: "production", branch: "cycle1", configText: prodCfg });
  });
  it("unknown env FAILS", () => expect(() => validateDeployPlan({ env: "staging", configText: "" })).toThrow(/unknown/));
});

describe("deploy script (mocked wrangler, no network)", () => {
  const deps = () => ({ exec: vi.fn(), log: () => {}, readFile: read });
  it("dry-run preview builds the canonical command and executes nothing", () => {
    const d = deps();
    const r = runDeploy(["preview", "--dry-run"], d);
    expect(r.executed).toBe(false);
    expect(d.exec).not.toHaveBeenCalled();
    expect(r.wranglerArgs).toEqual(
      expect.arrayContaining(["pages", "deploy", "public", "--project-name=harbor-eats-cycle1-preview", "--branch=cycle1"])
    );
  });
  it("refuses preview --d1 <prod> before any exec", () => {
    const d = deps();
    expect(() => runDeploy(["preview", "--d1", PROD_D1_ID], d)).toThrow(/PRODUCTION D1/);
    expect(d.exec).not.toHaveBeenCalled();
  });
  it("refuses production --d1 <preview> and --root dist", () => {
    const d = deps();
    expect(() => runDeploy(["production", "--confirm-production", "--d1", PREVIEW_D1_ID], d)).toThrow(/PREVIEW D1/);
    expect(() => runDeploy(["preview", "--root", "dist"], d)).toThrow(/public/);
    expect(d.exec).not.toHaveBeenCalled();
  });
  it("production without --confirm-production refuses", () => {
    expect(() => runDeploy(["production"], deps())).toThrow(/confirm-production/);
  });
  it("preview using the production config file refuses", () => {
    expect(() => runDeploy(["preview", "--config", "deploy/pages/production/wrangler.toml"], deps())).toThrow(/PRODUCTION D1/);
  });
  it("HARBOR_DEPLOY_FREEZE blocks real runs", () => {
    process.env.HARBOR_DEPLOY_FREEZE = "1";
    try {
      expect(() => runDeploy(["preview"], deps())).toThrow(/frozen/);
    } finally {
      delete process.env.HARBOR_DEPLOY_FREEZE;
    }
  });
});

describe("post-deploy binding check", () => {
  const good = (env) => ({
    ok: true,
    d1: "ok",
    deploy_env: env,
    d1_database_id: ENVIRONMENTS[env].d1Id,
    catalog_source: "d1",
    catalog_runtime_meals: 75,
  });
  it("passes for matching env + D1", () => {
    expect(checkHealthBinding("preview", good("preview"), { expectedMeals: 75 }).ok).toBe(true);
    expect(checkHealthBinding("production", good("production"), { expectedMeals: 75 }).ok).toBe(true);
  });
  it("fails when preview serves prod D1 (the known hazard)", () => {
    const r = checkHealthBinding("preview", { ...good("preview"), d1_database_id: PROD_D1_ID });
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/d1_database_id/);
  });
  it("fails when vars are missing or meal count drifts", () => {
    expect(checkHealthBinding("production", { ...good("production"), deploy_env: undefined }).ok).toBe(false);
    expect(checkHealthBinding("production", good("production"), { expectedMeals: 74 }).ok).toBe(false);
  });
  it("verifyBinding checks /api/health and the served SW version (mock fetch)", async () => {
    const meta = JSON.parse(read("release/release-metadata.json"));
    const fetchImpl = vi.fn(async (url) =>
      url.endsWith("/api/health")
        ? { ok: true, json: async () => good("preview") }
        : { ok: true, text: async () => `const CACHE_VERSION = "${meta.sw_cache_version}";` }
    );
    expect((await verifyBinding("preview", "https://x.harbor-eats-cycle1-preview.pages.dev", { fetchImpl, expectedMeals: 75 })).ok).toBe(true);
    const stale = vi.fn(async (url) =>
      url.endsWith("/api/health") ? { ok: true, json: async () => good("preview") } : { ok: true, text: async () => "fw-sw-v1" }
    );
    expect((await verifyBinding("preview", "https://x.harbor-eats-cycle1-preview.pages.dev", { fetchImpl: stale })).ok).toBe(false);
  });
});

describe("hosted E2E target guard", () => {
  it("rejects prod hostnames and prod-project preview aliases", () => {
    for (const u of ["https://harbor-eats-app.pages.dev", "https://c8f6ab25.harbor-eats-app.pages.dev", "https://HARBOR-EATS-APP.pages.dev/x"])
      expect(() => assertHostedE2ETarget(u)).toThrow(/production/);
  });
  it("rejects non-https and garbage", () => {
    expect(() => assertHostedE2ETarget("http://harbor-eats-cycle1-preview.pages.dev")).toThrow(/https/);
    expect(() => assertHostedE2ETarget("not a url")).toThrow(/invalid/);
  });
  it("accepts isolated preview", () => {
    expect(assertHostedE2ETarget("https://abc123.harbor-eats-cycle1-preview.pages.dev/")).toBe(
      "https://abc123.harbor-eats-cycle1-preview.pages.dev"
    );
  });
  it("health step refuses a preview reporting prod D1", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ ok: true, d1: "ok", catalog_source: "d1", catalog_runtime_meals: 75, deploy_env: "preview", d1_database_id: PROD_D1_ID }),
    });
    await expect(assertTarget("https://harbor-eats-cycle1-preview.pages.dev", { health: true, fetchImpl })).rejects.toThrow(/D1/);
  });
});

describe("hosted-e2e workflow (static validation)", () => {
  const wf = read(".github/workflows/hosted-e2e.yml");
  it("is workflow_dispatch only with a base_url input", () => {
    expect(wf).toMatch(/^on:\n {2}workflow_dispatch:/m);
    expect(wf).not.toMatch(/^\s+(push|pull_request|schedule):/m);
    expect(wf).toMatch(/base_url:/);
  });
  it("guards the target before running Playwright and never deploys or migrates", () => {
    expect(wf.indexOf("assert-hosted-target.mjs")).toBeLessThan(wf.indexOf("playwright test"));
    expect(wf).not.toMatch(/pages deploy|deploy:preview|deploy:production|d1 migrations apply|d1 execute|CLOUDFLARE_API_TOKEN/);
    expect(wf).toMatch(/PLAYWRIGHT_SKIP_WEBSERVER: "1"/);
  });
  it("main CI never deploys", () => {
    expect(read(".github/workflows/ci.yml")).not.toMatch(/deploy|wrangler pages|CLOUDFLARE/);
  });
});

describe("preflight", () => {
  it("base preflight passes on this tree", () => {
    const r = runPreflight("base");
    expect(r.results.filter((x) => !x.ok)).toEqual([]);
  });
  it("fails if a root wrangler.toml with a D1 binding reappears", () => {
    const d = defaultDeps();
    const r = runPreflight("base", { ...d, exists: (p) => p === "wrangler.toml" || d.exists(p), read: (p) => (p === "wrangler.toml" ? prodCfg : d.read(p)) });
    expect(r.ok).toBe(false);
  });
  it("fails if staging worker config points at prod D1", () => {
    const d = defaultDeps();
    const r = runPreflight("base", { ...d, read: (p) => (p === "wrangler.staging.toml" ? prodCfg : d.read(p)) });
    expect(r.results.find((x) => x.name.startsWith("staging")).ok).toBe(false);
  });
  it("production preflight fails when HEAD != origin/main or tree dirty", () => {
    const d = defaultDeps();
    const git = (...a) => (a[0] === "status" ? " M src/index.js" : a[1] === "HEAD" ? "aaaaaaa" : "bbbbbbb");
    const r = runPreflight("production", { ...d, git });
    expect(r.results.find((x) => x.name === "clean git tree").ok).toBe(false);
    expect(r.results.find((x) => x.name === "HEAD == origin/main").ok).toBe(false);
  });
});

describe("E2E modes", () => {
  const io = { exists: (p) => existsSync(join(root, p)), read };
  it("local-d1 is default and requires the seed", () => {
    expect(resolveE2EMode({}, io).name).toBe("local-d1");
    expect(() => resolveE2EMode({}, { exists: () => false, read })).toThrow(/requires seed/);
    expect(() => resolveE2EMode({}, { exists: () => true, read: () => "-- empty" })).toThrow(/no published/);
  });
  it("hosted-preview requires a non-prod URL", () => {
    expect(() => resolveE2EMode({ E2E_MODE: "hosted-preview" }, io)).toThrow(/PLAYWRIGHT_BASE_URL/);
    expect(() => resolveE2EMode({ E2E_MODE: "hosted-preview", PLAYWRIGHT_BASE_URL: "https://harbor-eats-app.pages.dev" }, io)).toThrow(/production/);
    expect(resolveE2EMode({ E2E_MODE: "hosted-preview", PLAYWRIGHT_BASE_URL: "https://harbor-eats-cycle1-preview.pages.dev" }, io).name).toBe("hosted-preview");
  });
  it("e2e web server runs preflight:e2e before migrate/seed", () => {
    const sh = read("scripts/e2e-web-server.sh");
    expect(sh.indexOf("preflight.mjs e2e")).toBeLessThan(sh.indexOf("seed-local-d1-catalog"));
  });
});

describe("SW cache-version invariant", () => {
  it("sw.js version and shell hash match release metadata", () => {
    const r = checkSwInvariant();
    expect(r.problems).toEqual([]);
    expect(r.version).toMatch(/^fw-sw-v\d+$/);
  });
  it("is deterministic", () => expect(shellHash()).toBe(shellHash()));
  it("detects shell content change without a version bump", () => {
    const tmp = mkdtempSync(join(tmpdir(), "sw-"));
    cpSync(join(root, "public"), join(tmp, "public"), { recursive: true });
    cpSync(join(root, "release"), join(tmp, "release"), { recursive: true });
    writeFileSync(join(tmp, "public/app.js"), read("public/app.js") + "\n// change");
    const r = checkSwInvariant(tmp);
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/bump fw-sw-vN/);
  });
  it("every SW shell asset exists", () => {
    for (const p of readSw().shell) expect(existsSync(join(root, "public", p === "/" ? "index.html" : p))).toBe(true);
  });
});
