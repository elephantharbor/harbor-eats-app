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
    expect(src).toContain("fwGuard");
    expect(src).toContain("suppressDialogHistory");
    const pop = src.slice(src.indexOf("function onPopState"));
    expect(pop.indexOf("topOpenDialog")).toBeLessThan(pop.indexOf("logicalBack"));
  });

  it("discovery back no longer calls history.back for find detail", () => {
    const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    expect(app).not.toMatch(/origin === "find"[\s\S]{0,120}history\.back\(\)/);
  });

  it("replace-mode Find names the screen Back returns to", () => {
    const src = readFileSync(new URL("../public/discovery-ui.js", import.meta.url), "utf8");
    expect(src).toContain("function discoveryBackName()");
    expect(src).toContain('origin === "planReview"');
    expect(src).toContain('return "Plan"');
    expect(src).toContain('aria-label="Back to ');
  });

  it("find history does not steal a plan Back", () => {
    const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
    const pop = app.slice(app.indexOf('addEventListener("popstate"'));
    expect(pop).toContain("fwGuard");
    expect(pop.indexOf("fwGuard")).toBeLessThan(pop.indexOf('show("find"'));
  });

  it("back labels name destinations for plan and shop", () => {
    const nav = readFileSync(new URL("../public/nav-context.js", import.meta.url), "utf8");
    expect(nav).toContain('shopList: "Shopping list"');
    expect(nav).toContain('planReview: "Plan"');
  });
});
