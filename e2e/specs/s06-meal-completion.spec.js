// @ts-check
import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";

const SHOTS = [
  ["375", { width: 375, height: 812 }],
  ["390", { width: 390, height: 844 }],
  ["414", { width: 414, height: 896 }],
  ["desktop", { width: 1280, height: 800 }],
];

function shotPath(name) {
  const dir = process.env.S06_SHOT_DIR || "/opt/cursor/artifacts/s06";
  mkdirSync(dir, { recursive: true });
  return `${dir}/${name}.png`;
}

async function shoot(page, name) {
  for (const [label, size] of SHOTS) {
    await page.setViewportSize(size);
    await page.waitForTimeout(200);
    await page.screenshot({ path: shotPath(`${name}-${label}`) });
  }
}

async function seedCookingPlan(page) {
  return page.evaluate(async () => {
    const created = await fetch("/api/dinner-plans", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal_count: 1, entry_point: "plan_dinners", fill: "planner" }),
    }).then((r) => r.json());
    if (!created.ok) throw new Error("create failed " + JSON.stringify(created));
    let plan = created.plan;
    const id = plan.dinner_plan_id;
    const mut = async (body) => {
      const res = await fetch("/api/dinner-plans/" + encodeURIComponent(id) + "/mutations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json());
      if (res.ok && res.plan) plan = res.plan;
      return res;
    };
    await mut({ op: "set_planning_preferences", keep_it_easy: true, keep_ingredients_simple: false });
    await mut({ op: "finalize" });
    const meal = plan.meals[0];
    const cooking = await mut({ op: "begin_cook", meal_id: meal.meal_id });
    if (!cooking.ok) throw new Error("begin_cook failed " + JSON.stringify(cooking));
    return {
      planId: id,
      mealId: meal.meal_id,
      title: meal.title,
      updatedAt: cooking.plan.updated_at,
    };
  });
}

test.describe("S-06 meal completion", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await skipToChoices(page);
  });

  test("We made this records a cooking dinner, undo restores it, and rating can wait", async ({ page }) => {
    const seeded = await seedCookingPlan(page);
    await page.reload();
    await page.locator('[data-nav="home"]').filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { name: /is cooking/ })).toBeVisible({ timeout: 30000 });
    const made = page.locator(".view.is-active [data-action='mark-cooked']");
    await expect(made).toHaveText("We made this");
    await expect(page.locator(".view.is-active [data-action='dp-back-kitchen']")).toHaveText("Back to the kitchen");
    await shoot(page, "home-before");

    await page.locator('[data-nav="choices"]').filter({ visible: true }).first().click();
    await expect(page.locator(".view.is-active")).toContainText("In the kitchen");
    await expect(async () => {
      const tonightMade = page.locator(".view.is-active [data-action='mark-cooked']");
      await tonightMade.scrollIntoViewIfNeeded({ timeout: 2000 });
      await expect(tonightMade).toBeInViewport();
    }).toPass();
    await shoot(page, "tonight-completion");

    await page.locator('[data-nav="home"]').filter({ visible: true }).first().click();
    await page.locator(".view.is-active [data-action='mark-cooked']").click();
    await expect(page.getByRole("heading", { name: "How was it?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo, this dinner is not cooked yet" })).toBeVisible();
    await expect(page.locator("#rateLede")).toContainText("leave this and rate later");
    for (const [label, size] of SHOTS) {
      await page.setViewportSize(size);
      await page.waitForTimeout(200);
      await page.screenshot({ path: shotPath(`rating-entry-${label}`) });
      await page.screenshot({ path: shotPath(`undo-${label}`) });
    }

    await page.getByRole("button", { name: "Undo, this dinner is not cooked yet" }).click();
    await expect(page.getByRole("heading", { name: /is cooking/ })).toBeVisible();
    await expect(page.locator(".view.is-active [data-action='mark-cooked']")).toBeVisible();

    const events = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/events")) events.push(request.postDataJSON());
    });
    await page.locator(".view.is-active [data-action='mark-cooked']").click();
    await expect(page.getByRole("heading", { name: "How was it?" })).toBeVisible();
    await page.locator("#btnSavePartial").click();
    const homeRate = page.locator(".view.is-active [data-action='home-rate-cooked']");
    await expect(homeRate).toBeVisible();
    await expect(homeRate).toHaveText("How was it?");
    await shoot(page, "home-after");
    await expect(async () => {
      await page.locator(".view.is-active [data-action='home-rate-cooked']").click({ timeout: 2000 });
    }).toPass();
    await expect(page.getByRole("heading", { name: "How was it?" })).toBeVisible();
    await page.locator(".rater-card").first().locator(".score").first().click();
    await expect(page.locator(".rater-card").first()).toContainText("/10");
    await expect(page.getByRole("button", { name: "Undo, this dinner is not cooked yet" })).toHaveCount(0);

    const repeat = await page.evaluate(async ({ planId, mealId }) => {
      const current = await fetch("/api/dinner-plans/" + encodeURIComponent(planId), { credentials: "include" }).then((r) => r.json());
      const res = await fetch("/api/dinner-plans/" + encodeURIComponent(planId) + "/mutations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "mark_cooked",
          meal_id: mealId,
          expected_updated_at: current.plan.updated_at,
        }),
      }).then((r) => r.json());
      return {
        already: res.already_cooked,
        ratings: (res.plan.meals[0].ratings || []).length,
        state: res.plan.meals[0].state,
      };
    }, seeded);
    expect(repeat.already).toBe(true);
    expect(repeat.ratings).toBe(1);
    expect(["cooked", "partially_rated", "fully_rated"]).toContain(repeat.state);
    const completions = events.filter((row) => row && row.event_name === "cook_completed");
    expect(completions).toHaveLength(1);
  });

  test("history can log a superseded cooking meal without changing the current list", async ({ page }) => {
    const before = await seedCookingPlan(page);
    const after = await page.evaluate(async () => {
      const created = await fetch("/api/dinner-plans", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meal_count: 1, entry_point: "plan_dinners", fill: "planner" }),
      }).then((r) => r.json());
      const shop = await fetch("/api/household-shop", { credentials: "include" }).then((r) => r.json());
      const current = await fetch("/api/dinner-plans/current", { credentials: "include" }).then((r) => r.json());
      return {
        currentId: current.plan && current.plan.dinner_plan_id,
        shopPlanId: shop.list && shop.list.dinner_plan_id,
        newId: created.plan.dinner_plan_id,
      };
    });
    expect(after.currentId).toBe(after.newId);
    expect(after.currentId).not.toBe(before.planId);
    expect(after.shopPlanId).toBe(after.newId);

    await page.reload();
    await page.locator('[data-nav="meals"]').filter({ visible: true }).first().click();
    const recover = page.locator("[data-action='history-mark-cooked']");
    await expect(recover).toBeVisible({ timeout: 30000 });
    await expect(recover).toHaveText("We made this");
    await shoot(page, "history-recovery");
    await recover.click();
    await expect(page.getByRole("heading", { name: "How was it?" })).toBeVisible();
    await page.locator("#btnSavePartial").click();
    await expect(page.locator("[data-action='history-rate']")).toBeVisible();

    const still = await page.evaluate(async () => {
      const shop = await fetch("/api/household-shop", { credentials: "include" }).then((r) => r.json());
      const current = await fetch("/api/dinner-plans/current", { credentials: "include" }).then((r) => r.json());
      return {
        currentId: current.plan && current.plan.dinner_plan_id,
        shopPlanId: shop.list && shop.list.dinner_plan_id,
      };
    });
    expect(still.currentId).toBe(after.newId);
    expect(still.shopPlanId).toBe(after.newId);
  });

  test("a typed add survives an earlier save, the sheet hints at more, and sign-out stacks", async ({ page }) => {
    await page.locator('[data-nav="home"]').filter({ visible: true }).first().click();
    await page.locator(".view.is-active button.link-card[data-go='shopList']").click();
    await expect(page.locator("#shopAddInput")).toBeEnabled();

    let release = () => {};
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/api/household-shop", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      let body = {};
      try {
        body = route.request().postDataJSON() || {};
      } catch {
        body = {};
      }
      if (body.op === "add_item" && body.text === "first onion") await gate;
      await route.continue();
    });
    const input = page.locator("#shopAddInput");
    const sent = page.waitForRequest((request) => {
      if (request.method() !== "POST" || !request.url().includes("/api/household-shop")) return false;
      const body = request.postDataJSON();
      return body && body.op === "add_item" && body.text === "first onion";
    });
    await input.fill("first onion");
    await page.locator("#shopAddForm button[type='submit']").click();
    await sent;
    await input.fill("second onion");
    release();
    await expect(input).toHaveValue("second onion");
    await expect(page.getByRole("checkbox", { name: /first onion/i })).toBeVisible();
    await page.unroute("**/api/household-shop");

    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole("button", { name: "How are you shopping?" }).click();
    const sheet = page.locator("#shopHowSheet");
    await expect(sheet).toBeVisible();
    await page.evaluate(() => {
      const row = document.getElementById("shopHowConnected");
      if (!row) return;
      row.hidden = false;
      row.style.minHeight = "180px";
      const copy = document.getElementById("shopHowConnectedCopy");
      if (copy && !copy.textContent) copy.textContent = "A grocery app on this preview can take the list from here.";
      const rows = document.querySelector("#shopHowSheet .shop-how__rows");
      if (rows && rows.scrollHeight > rows.clientHeight + 8) rows.classList.add("is-more-below");
    });
    await page.waitForTimeout(450);
    const rows = sheet.locator(".shop-how__rows");
    const overflow = await rows.evaluate((node) => node.scrollHeight > node.clientHeight + 8);
    if (overflow) await expect(rows).toHaveClass(/is-more-below/);
    await shoot(page, "shop-how");
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 375, height: 812 });

    await page.locator("#topbar [data-nav='settings']").click();
    await page.route("**/api/sessions/logout", (route) => route.abort());
    await page.locator("#btnSignOut").scrollIntoViewIfNeeded();
    await page.locator("#btnSignOut").click();
    const failed = page.locator("#signOutFailed");
    await expect(failed).toBeVisible();
    await page.waitForTimeout(450);
    await shoot(page, "signout-failed");
    await page.setViewportSize({ width: 375, height: 812 });
    const stacked = await failed.locator(".sheet__actions .btn").evaluateAll((buttons) => {
      const widths = buttons.map((button) => button.getBoundingClientRect().width);
      const parent = buttons[0] && buttons[0].parentElement ? buttons[0].parentElement.getBoundingClientRect().width : 0;
      return { widths, parent, tall: buttons.every((button) => button.getBoundingClientRect().height >= 44) };
    });
    expect(stacked.tall).toBe(true);
    expect(stacked.widths.every((width) => width >= stacked.parent - 8)).toBe(true);
    await page.locator("#btnSignOutStay").click();
  });
});
