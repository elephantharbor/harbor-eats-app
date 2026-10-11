// @ts-check
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { skipToChoices, reachTonightChoices } from "./helpers.js";

/** @param {import('@playwright/test').Page} page */
async function skipToChoicesNoShellfish(page) {
  return skipToChoices(page);
}

/** @param {import('@playwright/test').Page} page */
async function skipToChoicesShellfish(page) {
  await page.getByRole("button", { name: "Get started" }).click();
  await page.locator("#hhName").fill("[synthetic] E2E Kitchen");
  await page.locator("#ownerName").fill("Alex");
  await page.locator("#btnCreateHh").click();
  await page.locator("#newMemberName").fill("Partner");
  await page.getByRole("button", { name: "Add person" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[data-cid="shellfish"]').check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.getByRole("button", { name: "Skip — show tonight’s picks" }).click();
  await reachTonightChoices(page);
}

/**
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{ dinner_plan_id: string, meals: { meal_id: string, position: number, title: string, recipe_version_id: string, scheduled_date: string | null }[] }>}
 */
async function seedDatedThreeMealPlan(page) {
  return page.evaluate(async () => {
    const dates = ["2026-10-13", "2026-10-14", "2026-10-15"];
    const created = await fetch("/api/dinner-plans", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal_count: 3, entry_point: "plan_dinners", fill: "planner" }),
    }).then((r) => r.json());
    if (!created.ok) throw new Error("create plan failed: " + JSON.stringify(created));
    let plan = created.plan;
    for (let i = 0; i < plan.meals.length; i += 1) {
      const mut = await fetch("/api/dinner-plans/" + encodeURIComponent(plan.dinner_plan_id) + "/mutations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "set_date", meal_id: plan.meals[i].meal_id, date: dates[i] }),
      }).then((r) => r.json());
      if (mut.ok) plan = mut.plan;
    }
    return {
      dinner_plan_id: plan.dinner_plan_id,
      meals: plan.meals.map((m) => ({
        meal_id: m.meal_id,
        position: m.position,
        title: m.title,
        recipe_version_id: m.recipe_version_id,
        scheduled_date: m.scheduled_date,
      })),
    };
  });
}

/** @param {import('@playwright/test').Page} page */
async function openPlanReview(page) {
  await page.locator('[data-go="home"][data-nav="home"]').filter({ visible: true }).first().click();
  const finish = page.getByRole("button", { name: "Finish the plan" });
  await expect(finish).toBeVisible({ timeout: 30000 });
  await finish.click();
  await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible({ timeout: 30000 });
}

/** @param {import('@playwright/test').Page} page */
async function openFindForWeave(page) {
  await page.evaluate(() => {
    sessionStorage.removeItem("he_find_standalone_url");
    Object.keys(sessionStorage).forEach((k) => {
      if (k.startsWith("he_disc_cache:")) sessionStorage.removeItem(k);
    });
  });
  await page.locator('[data-go="find"][data-nav="find"]').filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Find a dinner" })).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#discChips [data-disc-chip='easy']")).toBeVisible({ timeout: 60000 });
}

/**
 * Hosted runs have no /opt/cursor/artifacts directory. E2E_SCREENSHOT_DIR
 * wins when set; otherwise Playwright's own output path.
 * @param {import('@playwright/test').TestInfo} testInfo
 * @param {string} filename
 */
function screenshotFile(testInfo, filename) {
  const dir = process.env.E2E_SCREENSHOT_DIR;
  if (dir) {
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, filename);
  }
  return testInfo.outputPath(filename);
}

const consumerUiPages = new WeakSet();

/** Local wrangler has the gateway off. Weave specs still exercise the composer, so health reports it on. */
async function showConsumerComposer(page) {
  if (consumerUiPages.has(page)) return;
  consumerUiPages.add(page);
  await page.route("**/api/health", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.consumer_ui = true;
    await route.fulfill({
      status: res.status(),
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

/** @param {import('@playwright/test').Page} page */
async function openPlanCount(page) {
  await showConsumerComposer(page);
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
    await showConsumerComposer(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("NL plan: three easy dinners, fish twice", async ({ page }, testInfo) => {
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
    await page.screenshot({ path: screenshotFile(testInfo, "d06-plan-settled.png"), fullPage: true });
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

  test("NL Find cozy but not too heavy", async ({ page }, testInfo) => {
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
    await page.screenshot({ path: screenshotFile(testInfo, "d06-find-nl.png"), fullPage: true });
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

  test("refine Make Tuesday easier changes only Tuesday card", async ({ page }) => {
    await page.goto("/");
    await skipToChoicesNoShellfish(page);
    const planSnap = await seedDatedThreeMealPlan(page);
    await page.locator('[data-go="home"][data-nav="home"]').filter({ visible: true }).first().click();
    await page.waitForTimeout(500);
    const tuesday = planSnap.meals.find((m) => m.position === 2);
    const monday = planSnap.meals.find((m) => m.position === 1);
    expect(tuesday).toBeTruthy();
    expect(monday).toBeTruthy();

    const altRv = await page.evaluate(async (avoid) => {
      const res = await fetch("/api/discovery/search?schema=1&limit=20", { credentials: "same-origin" }).then((r) => r.json());
      const row = (res.results || []).find((r) => r.recipe_version_id && r.recipe_version_id !== avoid);
      return row ? row.recipe_version_id : null;
    }, tuesday.recipe_version_id);
    expect(altRv).toBeTruthy();

    await page.route("**/api/plan/interpret", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      if (!/tuesday/i.test(body.text || "")) return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          task: "planning_intent",
          source: "provider",
          acknowledgement: "Tuesday's now an easy one.",
          state: body.state || { dinner_count: 3 },
          chips: [{ id: "slot:tuesday:effort", label: "Tue: easy" }],
          conflicts: [],
          changed_positions: [2],
          preview: {
            slots: planSnap.meals.map((m) => ({
              position: m.position,
              result: "recommended",
              recipe_version_id: m.position === 2 ? altRv : m.recipe_version_id,
              participant_ids: [],
            })),
          },
        }),
      });
    });

    await openPlanReview(page);
    const monTitle = await page.locator('.plan-meal-card[data-meal-id="' + monday.meal_id + '"] .plan-meal-title').innerText();
    const wedMeal = planSnap.meals.find((m) => m.position === 3);
    const wedTitle = await page.locator('.plan-meal-card[data-meal-id="' + wedMeal.meal_id + '"] .plan-meal-title').innerText();

    await page.locator("#planReviewWeaveHost .weave-composer").click();
    const field = await weaveField(page);
    await field.fill("Make Tuesday easier");
    await page.locator("#planReviewWeaveHost .weave-composer__submit").click();
    await expect(page.locator(".weave-echo")).toContainText("Tuesday", { timeout: 30000 });
    await expect(page.locator(".plan-meal-card--changed")).toHaveCount(1, { timeout: 30000 });
    await expect(page.locator('.plan-meal-card[data-meal-id="' + monday.meal_id + '"] .plan-meal-title')).toHaveText(monTitle);
    await expect(page.locator('.plan-meal-card[data-meal-id="' + wedMeal.meal_id + '"] .plan-meal-title')).toHaveText(wedTitle);
  });

  test("shrimp conflict shows shellfish notice for restricted household", async ({ page }) => {
    await page.goto("/");
    await skipToChoicesShellfish(page);
    await page.route("**/api/discovery/interpret", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      if (!/shrimp/i.test(body.text || "")) return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          task: "discovery_intent",
          source: "provider",
          acknowledgement: "Shrimp doesn't work for everyone at your table, so here's another seafood dinner.",
          acknowledgement_source: "reconciled",
          state: { ingredients: ["shrimp"] },
          chips: [{ id: "ingredient:shrimp", label: "Shrimp" }],
          conflicts: [
            {
              code: "hard_ineligible",
              token: "shrimp",
              alternative: { kind: "category", token: "fish" },
            },
          ],
          results: [{ recipe_slug: "miso-ginger-salmon", title: "Miso ginger salmon", recipe_version_id: "rv_miso-ginger-salmon_v1" }],
          total: 1,
          query: { text: null, criteria: { protein_groups: ["seafood"] } },
        }),
      });
    });
    await openFindForWeave(page);
    const field = await weaveField(page);
    await field.fill("Give us shrimp tonight");
    await page.locator(".weave-composer__submit").click();
    await expect(page.locator(".weave-notice")).toContainText(/seafood|shellfish|everyone at your table/i, {
      timeout: 30000,
    });
  });

  test("Back from recipe restores weave without new interpret calls", async ({ page }) => {
    let interpretCalls = 0;
    await page.route("**/api/plan/interpret", async (route) => {
      interpretCalls += 1;
      await route.continue();
    });
    await page.route("**/api/discovery/interpret", async (route) => {
      interpretCalls += 1;
      const body = JSON.parse(route.request().postData() || "{}");
      if (/cozy/i.test(body.text || "")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            task: "discovery_intent",
            source: "provider",
            acknowledgement: "Something cozy that isn't too heavy — here's what fits.",
            state: { intent_cues: ["cozy", "light"] },
            chips: [{ id: "cue:cozy", label: "Cozy" }],
            conflicts: [],
            results: [{ recipe_slug: "crispy-chipotle-tofu-tacos", title: "Crispy chipotle tofu tacos", recipe_version_id: "rv_crispy-chipotle-tofu-tacos_v1" }],
            total: 1,
            query: { text: null, criteria: {} },
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/");
    await skipToChoicesNoShellfish(page);
    const planSnap = await seedDatedThreeMealPlan(page);
    await page.locator('[data-go="home"][data-nav="home"]').filter({ visible: true }).first().click();
    await page.waitForTimeout(500);
    await page.evaluate(
      ({ planId, echo, reply }) => {
        sessionStorage.setItem(
          "fw_weave:dinner_plan_id:" + planId,
          JSON.stringify({
            adapter: "planRefine",
            echo,
            reply,
            chips: [{ id: "dinner_count", label: "3 dinners" }],
            next: [],
            stateRef: { dinner_count: 3 },
            at: Date.now(),
          })
        );
      },
      { planId: planSnap.dinner_plan_id, echo: "Plan three easy dinners", reply: "Got it — three dinners." }
    );
    await openPlanReview(page);
    await expect(page.locator("#planReviewWeaveHost .weave-echo")).toContainText("Plan three easy dinners", { timeout: 15000 });
    const planInterpretBefore = interpretCalls;
    const firstMeal = planSnap.meals[0];
    await page.locator('.plan-meal-card[data-meal-id="' + firstMeal.meal_id + '"] .plan-meal-title').click();
    await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible({ timeout: 30000 });
    await page.locator('[data-view="detail"] [data-back="detail"]').click();
    await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible({ timeout: 30000 });
    await expect(page.locator("#planReviewWeaveHost .weave-echo")).toContainText("Plan three easy dinners");
    expect(interpretCalls).toBe(planInterpretBefore);

    await openFindForWeave(page);
    const findField = page.locator("#discWeaveHost .weave-composer__field");
    await findField.fill("Something cozy but not too heavy");
    await page.locator("#discWeaveHost .weave-composer__submit").click();
    await expect(page.locator("#discWeaveHost .weave-echo")).toContainText("cozy", { timeout: 30000 });
    const findInterpretAfterNl = interpretCalls;
    expect(findInterpretAfterNl).toBeGreaterThan(planInterpretBefore);
    const findCard = page.locator(".disc-grid .disc-card__link, .disc-grid [data-disc-open]").first();
    await expect(findCard).toBeVisible({ timeout: 30000 });
    await findCard.click({ force: true });
    await expect(page).toHaveURL(/\/meal\/.+\?from=find/);
    await page.locator('[data-view="detail"] [data-back="detail"]').click();
    await expect(page.getByRole("heading", { name: "Find a dinner" })).toBeVisible({ timeout: 30000 });
    await expect(page.locator("#discWeaveHost .weave-echo")).toContainText("cozy");
    expect(interpretCalls).toBe(findInterpretAfterNl);
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

  test("phone viewport plan composer", async ({ page }, testInfo) => {
    await openPlanCount(page);
    await expect(page.locator(".weave-composer")).toBeVisible();
    await page.screenshot({ path: screenshotFile(testInfo, "d06-plan-phone.png"), fullPage: true });
  });
});
