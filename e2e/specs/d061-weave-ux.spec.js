// @ts-check
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** @param {import('@playwright/test').Page} page */
async function pinWeaveScripts(page) {
  const weaveUi = fs.readFileSync(path.join(repoRoot, "public/weave-ui.js"), "utf8");
  const weaveBridge = fs.readFileSync(path.join(repoRoot, "public/weave-bridge.js"), "utf8");
  await page.route("**/weave-ui.js*", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/javascript; charset=utf-8", body: weaveUi });
  });
  await page.route("**/weave-bridge.js*", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/javascript; charset=utf-8", body: weaveBridge });
  });
}

/** @param {import('@playwright/test').Page} page */
async function showConsumerComposer(page) {
  await pinWeaveScripts(page);
  await page.route("**/api/health", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    body.consumer_ui = true;
    await route.fulfill({ status: res.status(), contentType: "application/json", body: JSON.stringify(body) });
  });
}

/** @param {import('@playwright/test').Page} page */
async function seedUndatedPlan(page, mealCount = 3) {
  return page.evaluate(async (count) => {
    const created = await fetch("/api/dinner-plans", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal_count: count, entry_point: "plan_dinners", fill: "planner" }),
    }).then((r) => r.json());
    if (!created.ok) throw new Error(JSON.stringify(created));
    return created.plan;
  }, mealCount);
}

/** @param {import('@playwright/test').Page} page */
async function openPlanReview(page) {
  await page.locator('[data-go="home"][data-nav="home"]').filter({ visible: true }).first().click();
  const finish = page.getByRole("button", { name: "Finish the plan" });
  await expect(finish).toBeVisible({ timeout: 30000 });
  await finish.click();
  await expect(page.locator(".view.is-active[data-view='planReview']")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#planReviewWeaveHost .weave-composer")).toBeVisible({ timeout: 30000 });
}

test.describe("D-06.1 weave UX", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await showConsumerComposer(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
  });

  test("no-fish household hides fish starters", async ({ page }) => {
    await page.route("**/api/weave/starters", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          llm_called: false,
          starters: [
            { id: "find_cozy", task: "discovery_intent", text: "Something cozy" },
            { id: "find_lighter", task: "discovery_intent", text: "Something lighter" },
          ],
        }),
      });
    });
    await page.getByRole("button", { name: "Get started" }).click();
    await page.locator("#hhName").fill("[synthetic] no fish weave");
    await page.locator("#ownerName").fill("Alex");
    await page.locator("#btnCreateHh").click();
    await page.locator("#newMemberName").fill("Partner");
    await page.getByRole("button", { name: "Add person" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator('input[data-cid="fish"]').check();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.getByRole("button", { name: "Skip — show tonight’s picks" }).click();

    await page.locator('[data-go="find"]').filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { name: "Find a dinner" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("button", { name: "Easy fish dinner" })).toHaveCount(0);
  });

  test("keyboard open hides tab bar on weave field", async ({ page }) => {
    await skipToChoices(page);
    await page.locator('[data-go="home"][data-nav="home"]').filter({ visible: true }).first().click();
    await page.locator('[data-action="plan-dinners"]').first().click();
    const field = page.locator(".weave-composer__field").first();
    await field.click();
    await page.evaluate(() => {
      if (window.visualViewport) {
        Object.defineProperty(window.visualViewport, "height", { configurable: true, value: 400 });
        window.visualViewport.dispatchEvent(new Event("resize"));
      }
      window.FlavorWeaveKeyboard?.measure?.();
    });
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.keyboardOwner)).toBe("weave");
    await field.blur();
    await page.waitForTimeout(400);
    await page.evaluate(() => window.FlavorWeaveKeyboard?.measure?.());
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.keyboard || "")).toBe("");
  });

  test("chooser single dinner resolves with zero interpret calls", async ({ page }) => {
    let interpretCalls = 0;
    await page.route("**/api/plan/interpret", async (route) => {
      interpretCalls += 1;
      await route.fulfill({
        json: {
          ok: true,
          task: "planning_intent",
          source: "provider",
          state: { dinner_count: 3, pending_slot: { effort: "easy" } },
          chips: [{ id: "dinner_count", label: "3 dinners" }],
          choice: {
            reason: "undated",
            multi: false,
            candidates: [
              { position: 1, label: "Dinner 1", title: "One" },
              { position: 2, label: "Dinner 2", title: "Two" },
              { position: 3, label: "Dinner 3", title: "Three" },
            ],
          },
          choice_copy: {
            context: "Your dinners don't have days yet.",
            question: "Which dinner did you mean?",
          },
          changed_positions: [],
          preview: null,
        },
      });
    });

    await skipToChoices(page);
    await seedUndatedPlan(page, 3);
    await openPlanReview(page);
    await expect(page.locator("#planMealCards .plan-meal-card")).toHaveCount(3, { timeout: 30000 });
    await page.locator("#planReviewWeaveHost .weave-composer").click();
    await page.locator("#planReviewWeaveHost .weave-composer__field").fill("Make Tuesday easier");
    await page.locator("#planReviewWeaveHost .weave-composer__submit").click();
    await expect.poll(() => interpretCalls).toBeGreaterThan(0);
    await expect(page.locator(".weave-choice__question")).toBeVisible({ timeout: 30000 });

    const atChooser = interpretCalls;
    await page.locator('.weave-choice__chip[data-choice-position="2"]').click();
    await expect(page.locator(".weave-choice__question")).toHaveCount(0, { timeout: 30000 });
    expect(interpretCalls).toBe(atChooser);
  });

  test("chooser weekend multi-select resolves with zero extra interpret calls", async ({ page }) => {
    let interpretCalls = 0;
    await page.route("**/api/plan/interpret", async (route) => {
      interpretCalls += 1;
      await route.fulfill({
        json: {
          ok: true,
          task: "planning_intent",
          source: "provider",
          state: { dinner_count: 3, pending_slot: { effort: "easy" } },
          chips: [{ id: "dinner_count", label: "3 dinners" }],
          choice: {
            reason: "weekend_undated",
            multi: true,
            candidates: [
              { position: 2, label: "Dinner 2", title: "Sat stand-in" },
              { position: 3, label: "Dinner 3", title: "Sun stand-in" },
            ],
          },
          choice_copy: {
            context: "Your dinners don't have days yet.",
            question: "Which ones are the weekend?",
          },
          changed_positions: [],
          preview: null,
        },
      });
    });

    await skipToChoices(page);
    await seedUndatedPlan(page, 3);
    await openPlanReview(page);
    await expect(page.locator("#planMealCards .plan-meal-card")).toHaveCount(3, { timeout: 30000 });
    await page.locator("#planReviewWeaveHost .weave-composer").click();
    await page.locator("#planReviewWeaveHost .weave-composer__field").fill("Make the weekend easier");
    await page.locator("#planReviewWeaveHost .weave-composer__submit").click();
    await expect(page.locator(".weave-choice__question")).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".weave-choice__apply")).toBeHidden();
    await page.locator('.weave-choice__chip[data-choice-position="2"]').click();
    await page.locator('.weave-choice__chip[data-choice-position="3"]').click();
    await expect(page.locator(".weave-choice__apply")).toBeVisible({ timeout: 30000 });

    const atChooser = interpretCalls;
    await page.locator(".weave-choice__apply").click();
    await expect(page.locator(".weave-choice__apply")).toHaveCount(0, { timeout: 30000 });
    expect(interpretCalls).toBe(atChooser);
  });

  test("stepper plus minus and undo make zero interpret calls", async ({ page }) => {
    let interpretCalls = 0;
    await page.route("**/api/plan/interpret", async (route) => {
      interpretCalls += 1;
      await route.fulfill({
        json: {
          ok: true,
          task: "planning_intent",
          source: "provider",
          acknowledgement: "Three dinners ready.",
          state: { dinner_count: 3 },
          chips: [{ id: "dinner_count", label: "3 dinners" }],
          changed_positions: [],
          preview: null,
        },
      });
    });

    await skipToChoices(page);
    await seedUndatedPlan(page, 3);
    await openPlanReview(page);
    await expect(page.locator("#planMealCards .plan-meal-card")).toHaveCount(3, { timeout: 30000 });
    await page.locator("#planReviewWeaveHost .weave-composer").click();
    await page.locator("#planReviewWeaveHost .weave-composer__field").fill("Three easy dinners");
    await page.locator("#planReviewWeaveHost .weave-composer__submit").click();
    await expect(page.locator(".weave-stepper")).toBeVisible({ timeout: 30000 });

    const baseline = interpretCalls;
    await page.locator('.weave-stepper__btn[data-step="1"]').click();
    await expect.poll(() => page.locator("#planMealCards .plan-meal-card").count()).toBe(4, { timeout: 30000 });
    expect(interpretCalls).toBe(baseline);

    await page.locator('.weave-stepper__btn[data-step="-1"]').click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible({ timeout: 30000 });
    await expect.poll(() => page.locator("#planMealCards .plan-meal-card").count()).toBe(3, { timeout: 30000 });
    expect(interpretCalls).toBe(baseline);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => page.locator("#planMealCards .plan-meal-card").count()).toBe(4, { timeout: 30000 });
    expect(interpretCalls).toBe(baseline);
  });
});
