import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const publicDir = join(process.cwd(), "public");
const read = (p) => readFileSync(join(publicDir, p), "utf8");

describe("FlavorWeave brand smoke", () => {
  it("consumer index uses FlavorWeave, not Harbor Eats", () => {
    const html = read("index.html");
    expect(html).toMatch(/FlavorWeave/);
    expect(html).not.toMatch(/Harbor Eats/);
  });

  it("manifest names FlavorWeave on the v2 Signature canvas", () => {
    const manifest = JSON.parse(read("manifest.webmanifest"));
    expect(manifest.name).toBe("FlavorWeave");
    expect(manifest.short_name).toBe("FlavorWeave");
    expect(manifest.theme_color).toBe("#FFFDF8");
    expect(manifest.background_color).toBe("#FFFDF8");
    const maskable = manifest.icons.find((i) => i.purpose === "maskable");
    expect(maskable).toBeTruthy();
    for (const icon of manifest.icons) {
      expect(existsSync(join(publicDir, icon.src))).toBe(true);
    }
  });

  it("brand emblem and wordmark SVGs use the v2 Ink and Coral", () => {
    for (const file of ["flavorweave-emblem.svg", "flavorweave-wordmark.svg", "flavorweave-lockup-horizontal.svg"]) {
      const svg = read(`brand/${file}`).toUpperCase();
      expect(svg, file).toContain("#17393A");
      expect(svg, file).toContain("#F15D3C");
    }
    expect(read("brand/flavorweave-wordmark-reversed.svg").toUpperCase()).toContain("#E9F2EF");
  });

  it("wordmark is traced artwork, not live type", () => {
    for (const file of ["flavorweave-wordmark.svg", "flavorweave-lockup-horizontal.svg"]) {
      const svg = read(`brand/${file}`);
      expect(svg, file).toMatch(/<path/);
      expect(svg, file).not.toMatch(/<text/);
      expect(svg, file).not.toMatch(/font-family/i);
    }
  });

  it("header uses the wordmark lockup image with alt text, not a plain-text brand", () => {
    const html = read("index.html");
    const header = html.match(/<header[\s\S]*?<\/header>/)[0];
    expect(header).toMatch(/<img[^>]+src="\/brand\/flavorweave-lockup-horizontal\.svg"[^>]+alt="FlavorWeave"/);
    expect(header).toMatch(/<img[^>]+src="\/brand\/flavorweave-lockup-horizontal-reversed\.svg"/);
    const textOnly = header.replace(/<[^>]+>/g, " ");
    expect(textOnly).not.toMatch(/FlavorWeave/);
  });

  it("welcome headline sets the brand name with the wordmark artwork, not live type", () => {
    const html = read("index.html");
    const title = html.match(/<h1[^>]*data-testid="welcome-title"[\s\S]*?<\/h1>/)[0];
    expect(title).toMatch(/<img[^>]+src="\/brand\/flavorweave-wordmark\.svg"[^>]+alt="FlavorWeave"/);
    expect(title.replace(/<[^>]+>/g, " ")).not.toMatch(/FlavorWeave/);
  });

  it("service worker shell caches fw-sw-v17", () => {
    const sw = read("sw.js");
    expect(sw).toMatch(/const CACHE_VERSION = "fw-sw-v17"/);
    for (const asset of ["/theme.js", "/meal-media.js", "/nav-context.js", "/taste-ui.js", "/brand/flavorweave-lockup-horizontal.svg"]) {
      expect(sw).toContain(`"${asset}"`);
      expect(existsSync(join(publicDir, asset))).toBe(true);
    }
  });
});
