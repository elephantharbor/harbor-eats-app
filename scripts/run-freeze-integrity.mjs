#!/usr/bin/env node
/**
 * Write FREEZE_INTEGRITY.json for catalog packages (mechanical verification).
 * Usage: node scripts/run-freeze-integrity.mjs [slug ...]
 */
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runFreezeIntegrity } from "../src/lib/freeze-integrity.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const catalogRoot = join(root, "catalog");
const slugs = process.argv.slice(2);
const targets =
  slugs.length > 0
    ? slugs
    : [
        "cider-braised-pork-shoulder",
        "crispy-skillet-chicken-sandwiches",
        "garlic-tomato-mussels",
        "gochujang-grilled-flank-steak",
        "lentil-stuffed-cabbage",
        "roasted-butternut-farro-plate",
      ];

let failed = 0;
for (const slug of targets) {
  const dir = join(catalogRoot, slug);
  if (!existsSync(join(dir, "v1.json"))) {
    console.error(`skip ${slug}: no v1.json`);
    failed++;
    continue;
  }
  const report = runFreezeIntegrity(dir, { repoRoot: root });
  const outPath = join(dir, "FREEZE_INTEGRITY.json");
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${slug}: ${report.FREEZE_INTEGRITY} (${report.fail_count} fails) → ${outPath}`);
  if (report.FREEZE_INTEGRITY !== "PASS") failed++;
}

process.exit(failed > 0 ? 1 : 0);
