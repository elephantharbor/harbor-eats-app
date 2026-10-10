/**
 * Service-worker cache-version invariant.
 * release/release-metadata.json records { sw_cache_version, sw_shell_hash }.
 * - public/sw.js CACHE_VERSION must equal sw_cache_version.
 * - sha256 over the SW SHELL files must equal sw_shell_hash. If shell content changes,
 *   bump fw-sw-vN in sw.js AND run `npm run release:sw-stamp` (records the new hash).
 *   Changing shell bytes without a version bump fails (stale-cache class of bug).
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const META = "release/release-metadata.json";

export function readSw(root = repoRoot) {
  const sw = readFileSync(join(root, "public/sw.js"), "utf8");
  const version = (/const CACHE_VERSION = "(fw-sw-v\d+)"/.exec(sw) || [])[1] || null;
  const shellBlock = (/const SHELL = \[([\s\S]*?)\];/.exec(sw) || [])[1] || "";
  const shell = [...shellBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  return { version, shell };
}

export function shellHash(root = repoRoot, shell = readSw(root).shell) {
  const h = createHash("sha256");
  for (const p of [...new Set(shell.map((s) => (s === "/" ? "/index.html" : s)))].sort()) {
    h.update(p + "\0");
    h.update(readFileSync(join(root, "public", p)));
    h.update("\0");
  }
  return h.digest("hex");
}

export function readMeta(root = repoRoot) {
  return JSON.parse(readFileSync(join(root, META), "utf8"));
}

/** @returns {{ok:boolean, problems:string[], version:string|null, hash:string}} */
export function checkSwInvariant(root = repoRoot) {
  const { version, shell } = readSw(root);
  const meta = readMeta(root);
  const hash = shellHash(root, shell);
  const problems = [];
  if (!version) problems.push("public/sw.js has no CACHE_VERSION fw-sw-vN");
  if (version !== meta.sw_cache_version)
    problems.push(`sw.js ${version} != release-metadata ${meta.sw_cache_version}`);
  if (hash !== meta.sw_shell_hash)
    problems.push(
      `SW shell content changed (hash ${hash.slice(0, 12)} != recorded ${String(meta.sw_shell_hash).slice(0, 12)}): bump fw-sw-vN and run npm run release:sw-stamp`
    );
  return { ok: problems.length === 0, problems, version, hash };
}

/** Record current version + hash; refuses if shell changed but version did not bump. */
export function stamp(root = repoRoot) {
  const meta = readMeta(root);
  const { version } = readSw(root);
  const hash = shellHash(root);
  if (meta.sw_shell_hash !== "PENDING" && hash !== meta.sw_shell_hash && version === meta.sw_cache_version)
    throw new Error(`shell changed but CACHE_VERSION still ${version}: bump fw-sw-vN first`);
  meta.sw_cache_version = version;
  meta.sw_shell_hash = hash;
  writeFileSync(join(root, META), JSON.stringify(meta, null, 2) + "\n");
  return meta;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === "--stamp") console.log(JSON.stringify(stamp()));
  else {
    const r = checkSwInvariant();
    console.log(JSON.stringify(r));
    process.exit(r.ok ? 0 : 1);
  }
}
