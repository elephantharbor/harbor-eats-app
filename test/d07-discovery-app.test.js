import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const nav = readFileSync(new URL("../public/nav-context.js", import.meta.url), "utf8");

describe("D-07 MealDiscovery app wiring", () => {
  it("exposes Find as fifth primary nav tab and route", () => {
    const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
    expect(nav).toContain('"find"');
    expect(html).toContain('data-go="find"');
    expect(html).toContain('data-view="find"');
    expect(html).toContain("discovery-ui.js");
    expect(css).toMatch(/\.tabbar[\s\S]{0,200}repeat\(5/);
  });

  it("routes Find a dinner to Discovery, not single-meal proposal", () => {
    expect(app).toContain("openDiscoveryStandalone");
    expect(app).toMatch(/find-dinner[\s\S]{0,400}openDiscoveryStandalone/);
    expect(app).toContain('data-action="pick-one"');
    expect(app).toMatch(/pick-one[\s\S]{0,200}startFindDinner/);
  });

  it("wires swap sheet See all options to replace_plan_meal Discovery", () => {
    expect(html).toContain('data-action="swap-see-all"');
    expect(app).toContain("openDiscoveryReplace");
    expect(app).toMatch(/swap-see-all[\s\S]{0,300}openDiscoveryReplace/);
  });

  it("registers /find SPA paths", () => {
    const routes = readFileSync(new URL("../public/_routes.json", import.meta.url), "utf8");
    expect(routes).toContain("/find");
  });

  it("wires discovery recipe CTAs and history capture", () => {
    expect(app).toContain("syncDiscoveryDetailActions");
    expect(app).toContain("discovery-cook-tonight");
    expect(app).toContain("discovery-add-plan");
    expect(app).toContain("captureState");
    expect(html).toContain("discRefineSheet");
    expect(html).toContain("discovery-relax-bridge.js");
  });

  it("passes participant_ids into replace_plan_meal discovery open", () => {
    expect(app).toMatch(/openDiscoveryReplace[\s\S]{0,500}participant_ids/);
  });

  it("uses slot participant_ids for choose_for_plan and add-to-plan sheet for multiple open rows", () => {
    expect(app).toMatch(/openDiscoveryChoose[\s\S]{0,400}meal\.participant_ids/);
    expect(html).toContain("discAddPlanSheet");
    expect(app).toContain("openDiscAddPlanSheet");
  });

  it("persists full find history snapshot on URL sync", () => {
    const disc = readFileSync(new URL("../public/discovery-ui.js", import.meta.url), "utf8");
    expect(disc).toContain("function syncBrowserUrl");
    expect(disc).toMatch(/syncBrowserUrl[\s\S]*captureState\(\)/);
  });

  it("toggles quick chip off on second click", () => {
    const disc = readFileSync(new URL("../public/discovery-ui.js", import.meta.url), "utf8");
    expect(disc).toContain("function timeChipTogglePatch");
    expect(disc).toMatch(/kind === "time"[\s\S]{0,120}timeChipTogglePatch/);
  });

  it("keeps Opus review fixes in place", () => {
    const disc = readFileSync(new URL("../public/discovery-ui.js", import.meta.url), "utf8");
    const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");
    expect(disc).not.toContain("visually-hidden");
    expect(disc).toContain("group.category");
    expect(disc).toMatch(/DISCOVERY_SHELVES \|\| \[\]\)\s*\.map/);
    expect(disc).toMatch(/rootEl\.dataset\.discMode === mode/);
    expect(disc).not.toMatch(/deps\.timeChip(IsOn|TogglePatch)/);
    const discCss = css.slice(css.indexOf("/* D-07 MealDiscovery */"));
    expect(discCss).not.toMatch(/--color-surface-raised|--color-border-subtle|var\(--page-padding\)/);
  });

  it("hides clear search until the field has text", () => {
    const disc = readFileSync(new URL("../public/discovery-ui.js", import.meta.url), "utf8");
    expect(disc).toContain("function syncSearchClearButton");
    expect(disc).toMatch(/discSearchClear[\s\S]{0,200}hidden/);
  });
});
