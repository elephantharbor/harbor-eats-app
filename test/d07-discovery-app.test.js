import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const nav = readFileSync(new URL("../public/nav-context.js", import.meta.url), "utf8");

describe("D-07 MealDiscovery app wiring", () => {
  it("exposes Find as fifth primary nav tab and route", () => {
    expect(nav).toContain('"find"');
    expect(html).toContain('data-go="find"');
    expect(html).toContain('data-view="find"');
    expect(html).toContain("discovery-ui.js");
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
});
