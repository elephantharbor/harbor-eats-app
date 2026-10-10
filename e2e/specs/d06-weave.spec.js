// @ts-check
import { test, expect } from "@playwright/test";
import path from "node:path";
import { skipToChoices } from "./helpers.js";

const ART = "/opt/cursor/artifacts/screenshots";

/** @param {import('@playwright/test').Page} page */
async function openPlanCount(page) {
  await page.goto("/");
  await skipToChoices(page);
  await page.locator('[data-go="home"][data-nav="home"]').filter({ visible: true }).first().click();
  await page.locator('[data-action="plan-dinners"]').first().click();
  await expect(page.getByRole("heading", { name: "Plan your dinners" })).toBeVisible({ timeout: 30000 });
}

/** @param {import('@playwright/test').Page} page */
async function weaveField(page) {
  return page.locator(".weave-composer__field").first();
}

test.describe("D-06 Weave UX", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("NL plan: three easy dinners, fish twice", async ({ page }) => {
    await page.route("**/api/plan/interpret", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          task: "planning_intent",
          source: "provider",
          acknowledgement: "Got it — three dinners, mostly easy, fish twice.",
          state: { dinner_count: 3, keep_it_easy: true, frequencies: [{ token: "fish", min_count: 2, max_count: 2 }] },
          chips: [
            { id: "dinner_count", label: "3 dinners" },
            { id: "freq:fish", label: "Fish ×2" },
          ],
          conflicts: [],
          preview: {
            slots: [
              { position: 1, result: "recommended", recipe_version_id: "rv_test_1", participant_ids: [] },
              { position: 2, result: "recommended", recipe_version_id: "rv_test_2", participant_ids: [] },
              { position: 3, result: "recommended", recipe_version_id: "rv_test_3", participant_ids: [] },
            ],
          },
          changed_positions: [1, 2, 3],
        }),
      });
    });
    await page.route("**/api/plan/commit", async (route) => {
      const req = route.request();
      const body = JSON.parse(req.postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          plan: {
            dinner_plan_id: "dp_weave_e2e",
            meal_count: 3,
            status: "ready",
            meals: body.preview?.slots?.map((s, i) => ({
              meal_id: "m" + i,
              position: s.position,
              kind: "recipe",
              state: "planned",
              recipe_version_id: s.recipe_version_id,
              title: "Test dinner " + s.position,
            })),
            intent: { dinner_count: 3, keep_it_easy: true, keep_ingredients_simple: false },
          },
          unfilled: [],
        }),
      });
    });

    await openPlanCount(page);
    const field = await weaveField(page);
    await field.fill("Plan three easy dinners this week. Fish twice.");
    await page.locator(".weave-composer__submit").click();
    await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible({ timeout: 60000 });
    await page.screenshot({ path: path.join(ART, "d06-plan-settled.png"), fullPage: true });
  });

  test("chip removal makes no interpret call", async ({ page }) => {
    let interpretCalls = 0;
    await page.route("**/api/plan/interpret", async (route) => {
      interpretCalls += 1;
      await route.continue();
    });
    await page.route("**/api/plan/apply", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          source: "deterministic",
          acknowledgement: "Updated.",
          state: { dinner_count: 3 },
          chips: [{ id: "dinner_count", label: "3 dinners" }],
          preview: { slots: [] },
          changed_positions: [],
        }),
      });
    });
    await openPlanCount(page);
    await page.evaluate(() => {
      const host = document.getElementById("planWeaveHost");
      if (host && window.FlavorWeaveWeaveBridge) {
        window.__weaveTest = window.FlavorWeaveWeaveBridge.planMountCount({
          track: () => {},
          activeMemberIds: () => [],
          applyDinnerPlan: () => {},
          show: () => {},
          navContextFor: () => ({}),
          planningApi: () => null,
          getDinnerPlan: () => null,
          mutateDinnerPlan: async () => {},
          renderPlanReview: () => {},
          renderPlanReviewPartial: () => {},
          focusPlanMeal: () => {},
          mountPlanReview: () => {},
        });
      }
    });
    const ctrl = await page.evaluate(() => window.__weaveTest);
    expect(ctrl).toBeTruthy();
    await page.evaluate(async () => {
      await window.__weaveTest.removeChip("freq:fish", {});
    });
    expect(interpretCalls).toBe(0);
  });

  test("NL Find cozy but not too heavy", async ({ page }) => {
    await skipToChoices(page);
    await page.route("**/api/discovery/interpret", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          task: "discovery_intent",
          source: "provider",
          acknowledgement: "Something cozy that isn't too heavy — here's what fits.",
          state: { intent_cues: ["cozy", "light"] },
          chips: [{ id: "cue:cozy", label: "Cozy" }, { id: "cue:light", label: "Not too heavy" }],
          conflicts: [],
          results: [{ recipe_slug: "test-meal", title: "Test", recipe_version_id: "rv1" }],
          total: 1,
          query: { text: null, criteria: {} },
        }),
      });
    });
    await page.locator('[data-go="find"]').first().click();
    await expect(page.getByRole("heading", { name: "Find a dinner" })).toBeVisible();
    const field = await weaveField(page);
    await field.fill("Something cozy but not too heavy");
    await page.locator(".weave-composer__submit").click();
    await expect(page.locator(".weave-echo")).toContainText("cozy");
    await page.screenshot({ path: path.join(ART, "d06-find-nl.png"), fullPage: true });
  });

  test("bypass salmon makes no interpret call", async ({ page }) => {
    let interpretCalls = 0;
    await page.route("**/api/discovery/interpret", async (route) => {
      interpretCalls += 1;
      await route.continue();
    });
    await skipToChoices(page);
    await page.locator('[data-go="find"]').first().click();
    const field = await weaveField(page);
    await field.fill("salmon");
    await page.locator(".weave-composer__submit").click();
    await expect.poll(() => interpretCalls).toBe(0);
  });

  test("reduced motion shows full reply", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openPlanCount(page);
    await page.route("**/api/plan/interpret", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          acknowledgement: "Got it — three easy dinners.",
          state: { dinner_count: 3 },
          chips: [],
          preview: null,
          fallback_code: "empty_delta",
        }),
      });
    });
    const field = await weaveField(page);
    await field.fill("three easy dinners");
    await page.locator(".weave-composer__submit").click();
    await expect(page.locator(".weave-notice--error, .weave-reply").first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe("D-06 Weave phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
  });

  test("phone viewport plan composer", async ({ page }) => {
    await openPlanCount(page);
    await expect(page.locator(".weave-composer")).toBeVisible();
    await page.screenshot({ path: path.join(ART, "d06-plan-phone.png"), fullPage: true });
  });
});
