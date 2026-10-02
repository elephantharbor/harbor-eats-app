import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const publicDir = join(process.cwd(), "public");

describe("FlavorWeave brand smoke", () => {
  it("consumer index uses FlavorWeave, not Harbor Eats", () => {
    const html = readFileSync(join(publicDir, "index.html"), "utf8");
    expect(html).toMatch(/FlavorWeave/);
    expect(html).not.toMatch(/Harbor Eats/);
  });

  it("manifest names FlavorWeave", () => {
    const manifest = JSON.parse(readFileSync(join(publicDir, "manifest.webmanifest"), "utf8"));
    expect(manifest.name).toBe("FlavorWeave");
    expect(manifest.short_name).toBe("FlavorWeave");
    expect(manifest.theme_color).toBe("#FCFBF9");
  });

  it("brand emblem SVG is committed", () => {
    const svg = readFileSync(join(publicDir, "brand/flavorweave-emblem.svg"), "utf8");
    expect(svg).toContain("#1C2A2B");
    expect(svg).toContain("#DB6D4B");
  });
});
