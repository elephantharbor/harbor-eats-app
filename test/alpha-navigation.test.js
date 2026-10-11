import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("alpha D-04 navigation contracts", () => {
  it("nav-context returns shopList parent for recipe opened from shop", () => {
    const src = readFileSync(new URL("../public/nav-context.js", import.meta.url), "utf8");
    expect(src).toMatch(/origin === "shopList".*return "shopList"/s);
  });

  it("nav-history module defines fw frames and dialog precedence", () => {
    const src = readFileSync(new URL("../public/nav-history.js", import.meta.url), "utf8");
    expect(src).toContain('fw: 1');
    expect(src).toContain("topOpenDialog");
    expect(src).toContain("participantsSheet");
  });

  it("discovery back no longer calls history.back for find detail", () => {
    const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    expect(app).not.toMatch(/origin === "find"[\s\S]{0,120}history\.back\(\)/);
  });

  it("back labels name destinations for plan and shop", () => {
    const nav = readFileSync(new URL("../public/nav-context.js", import.meta.url), "utf8");
    expect(nav).toContain('shopList: "Tonight"');
    expect(nav).toContain('planReview: "Plan"');
  });
});
