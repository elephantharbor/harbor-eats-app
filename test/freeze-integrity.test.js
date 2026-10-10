import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runFreezeIntegrity, webpDimensions } from "../src/lib/freeze-integrity.js";

const root = join(process.cwd(), "catalog");

describe("freeze integrity", () => {
  it("reads webp dimensions for a bundled meal asset", () => {
    const buf = readFileSync(join(process.cwd(), "public/images/meals/miso-ginger-salmon.webp"));
    expect(webpDimensions(buf)).toEqual({ width: 1200, height: 900 });
  });

  it("PASS for backfilled factory packages with complete eligibility + frozen images", () => {
    for (const slug of [
      "cider-braised-pork-shoulder",
      "lentil-stuffed-cabbage",
      "roasted-butternut-farro-plate",
    ]) {
      const report = runFreezeIntegrity(join(root, slug));
      expect(report.FREEZE_INTEGRITY, slug).toBe("PASS");
      expect(existsSync(join(root, slug, "FREEZE_INTEGRITY.json"))).toBe(true);
      const onDisk = JSON.parse(readFileSync(join(root, slug, "FREEZE_INTEGRITY.json"), "utf8"));
      expect(onDisk.FREEZE_INTEGRITY).toBe("PASS");
    }
  });

  it("freeze-r1 amendments add dietary_eligibility so the three dry-run packages now PASS with a recorded FREEZE_INTEGRITY", () => {
    for (const slug of [
      "crispy-skillet-chicken-sandwiches",
      "garlic-tomato-mussels",
      "gochujang-grilled-flank-steak",
    ]) {
      const report = runFreezeIntegrity(join(root, slug));
      expect(report.FREEZE_INTEGRITY, slug).toBe("PASS");
      expect(report.checks.some((c) => c.id === "field_dietary_eligibility" && c.result === "FAIL")).toBe(false);
      expect(JSON.parse(readFileSync(join(root, slug, "FREEZE_INTEGRITY.json"), "utf8")).FREEZE_INTEGRITY).toBe("PASS");
    }
  });
});
