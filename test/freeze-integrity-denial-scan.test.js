import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// factory/tools/freeze_integrity.py: after wave-14 audit r1 the denial-string check also
// scans README.md, image-prompt.md, image-plating-brief.md, and image-state.json.
const root = process.cwd();
const tool = join(root, "factory/tools/freeze_integrity.py");
const pkg = join(root, "factory/waves/wave-14/candidates/greek-spanakopita");

let hasPython = true;
try {
  execFileSync("python3", ["-c", "import PIL"], { stdio: "ignore" });
} catch {
  hasPython = false;
}

const tmp = mkdtempSync(join(tmpdir(), "freeze-denial-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function run(name, mutate) {
  const dir = join(tmp, name);
  cpSync(pkg, dir, { recursive: true });
  if (mutate) mutate(dir);
  try {
    execFileSync("python3", [tool, dir], { stdio: "pipe" });
  } catch {
    // non-zero exit on FAIL; the JSON report is still written
  }
  const report = JSON.parse(readFileSync(join(dir, "FREEZE_INTEGRITY.json"), "utf8"));
  return { report, denial: report.checks.find((c) => c.id === "no_denial_strings") };
}

describe.skipIf(!hasPython)("freeze_integrity.py denial scan (text files)", () => {
  it("passes the certified wave-14 package unchanged", () => {
    const { report } = run("clean");
    expect(report.FREEZE_INTEGRITY).toBe("PASS");
  });

  for (const [file, phrase] of [
    ["README.md", "The WebP pair is not, yet, on disk."],
    ["image-prompt.md", "Status: pending_image_pass"],
    ["image-plating-brief.md", "Freeze integrity fails until the image pass lands."],
  ]) {
    it(`fails when ${file} carries a pending-image phrase`, () => {
      const { report, denial } = run(file.replace(/\W/g, "_"), (dir) => appendFileSync(join(dir, file), `\n${phrase}\n`));
      expect(report.FREEZE_INTEGRITY).toBe("FAIL");
      expect(denial.result).toBe("FAIL");
      expect(JSON.stringify(denial.detail)).toContain(file);
    });
  }

  it("fails when image-state.json says the slot is pending", () => {
    const { denial } = run("state", (dir) => {
      const p = join(dir, "image-state.json");
      const s = JSON.parse(readFileSync(p, "utf8"));
      s.note = "image_slot_pending";
      writeFileSync(p, JSON.stringify(s));
    });
    expect(denial.result).toBe("FAIL");
  });
});
