// @ts-check
// Cycle 1 UX retest. Every household here is created in QA mode, so it is
// stored as data_origin=synthetic and never counts as Household 001 evidence.
import { test, expect } from "@playwright/test";
import { reachTonightChoices } from "./helpers.js";

/** @param {import('@playwright/test').Page} page */
async function freshQaKitchen(page) {
  await page.context().clearCookies();
  await page.goto("/?qa=1");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("he_qa", "1");
  });
  await page.goto("/?qa=1");
  await page.getByRole("button", { name: "Get started" }).click();
}

/** @param {import('@playwright/test').Page} page */
async function me(page) {
  return page.evaluate(async () => (await fetch("/api/sessions/me", { credentials: "same-origin" })).json());
}

/**
 * Onboard through every step. Ticks HH001-style limits and one taste.
 * @param {import('@playwright/test').Page} page
 */
async function onboard(page, { kitchen = "The Parkers", owner = "Jordan", partner = "Sam" } = {}) {
  await freshQaKitchen(page);
  await page.locator("#hhName").fill(kitchen);
  await page.locator("#ownerName").fill(owner);
  await page.locator("#btnCreateHh").click();
  await expect(page.locator('.view[data-view="members"].is-active')).toHaveCount(1);
  await page.locator("#newMemberName").fill(partner);
  await page.getByRole("button", { name: "Add person" }).click();
  await expect(page.locator("#memberList, .member-list").first()).toContainText(partner);
  await page.waitForTimeout(300);
  await page.locator('.view[data-view="members"] .flow__actions .btn-primary').click();
  for (const key of ["dairy", "meat", "shellfish", "nuts"]) {
    await page.locator(`#constraints input[data-cid="${key}"]`).check();
  }
  await page.locator('#constraints input[data-cid="cashew_ok"]').check();
  await page.locator('.view[data-view="constraints"] .flow__actions .btn-primary').click();
  await page.locator('#tastePicks [data-taste-pick="tacos"]').click();
  await page.locator('.view[data-view="taste"] .flow__actions .btn-primary').click();
  await page.getByRole("button", { name: "Skip — show tonight’s picks" }).click();
  await reachTonightChoices(page);
}

test.describe("October 1 retest (synthetic QA kitchen)", () => {
  test("blank kitchen name is not accepted", async ({ page }) => {
    await freshQaKitchen(page);
    await page.locator("#ownerName").fill("Jordan");
    await page.locator("#btnCreateHh").click();
    await expect(page.locator('.view[data-view="create"].is-active')).toHaveCount(1);
    await expect(page.locator("#hhNameError")).toBeVisible();
    await expect(page.locator("#hhName")).toHaveAttribute("aria-invalid", "true");
    await page.locator("#hhName").fill("   ");
    await page.locator("#btnCreateHh").click();
    await expect(page.locator('.view[data-view="create"].is-active')).toHaveCount(1);
    const snap = await me(page);
    expect(snap.ok).toBeFalsy();
  });

  test("household name never becomes the diner's name", async ({ page }) => {
    await freshQaKitchen(page);
    await page.locator("#hhName").fill("The Parkers");
    await page.locator("#btnCreateHh").click();
    await expect(page.locator("#ownerNameError")).toBeVisible();
    await expect(page.locator('.view[data-view="create"].is-active')).toHaveCount(1);
    await page.locator("#ownerName").fill("Jordan");
    await page.locator("#btnCreateHh").click();
    await expect(page.locator('.view[data-view="members"].is-active')).toHaveCount(1);
    const snap = await me(page);
    const names = snap.members.map((m) => m.display_name);
    expect(names).toContain("Jordan");
    expect(names).not.toContain("The Parkers");
    expect(snap.household.display_name).toBe("The Parkers");
    expect(snap.household.data_origin).toBe("synthetic");
  });

  test("going back to step 1 renames instead of creating a second kitchen", async ({ page }) => {
    await freshQaKitchen(page);
    await page.locator("#hhName").fill("Casa Test");
    await page.locator("#ownerName").fill("Jo");
    await page.locator("#btnCreateHh").click();
    await expect(page.locator('.view[data-view="members"].is-active')).toHaveCount(1);
    const first = await me(page);
    expect(first.ok).toBe(true);
    await page.locator('.view[data-view="members"] [data-go="create"]').click();
    await page.locator("#hhName").fill("Casa Prueba");
    await page.locator("#ownerName").fill("Joanna");
    await page.locator("#btnCreateHh").click();
    await expect(page.locator('.view[data-view="members"].is-active')).toHaveCount(1);
    const second = await me(page);
    expect(second.household.household_id).toBe(first.household.household_id);
    expect(second.household.display_name).toBe("Casa Prueba");
    expect(second.members.map((m) => m.display_name)).toEqual(["Joanna"]);
  });

  test("added member survives a reload, and the first round is not empty", async ({ page }) => {
    await onboard(page);
    await expect(page.locator(".option-card[data-preview]")).toHaveCount(3);
    await page.reload();
    await expect(page.locator(".view.is-active")).toHaveCount(1, { timeout: 15000 });
    const snap = await me(page);
    expect(snap.members.map((m) => m.display_name).sort()).toEqual(["Jordan", "Sam"]);
    await page.locator('#topbar [data-go="settings"]:visible, #tabbar [data-go="settings"]:visible').first().click();
    await expect(page.locator("#settingsMembers")).toContainText("Sam");
    await expect(page.locator("#settingsMembers")).toContainText("Jordan");
  });
});

test.describe("FW-05 · invite from Settings", () => {
  test("stays in the app, keeps nav, returns to Settings, keeps taste", async ({ page }) => {
    await onboard(page);
    await page.locator('#topbar [data-go="settings"]:visible').first().click();
    await page.locator('.view[data-view="settings"] [data-go="invite"]').click();
    await expect(page.locator('.view[data-view="invite"].is-active')).toHaveCount(1);
    await expect(page.locator("#app")).toHaveAttribute("data-chrome", "full");
    await expect(page.locator("#topNav")).toBeVisible();
    await expect(page.locator('#topbar [data-nav="settings"]')).toHaveClass(/is-on/);
    await expect(page.locator("#inviteEyebrow")).not.toContainText("Step");
    await expect(page.locator("#inviteProgress")).toBeHidden();
    await expect(page.locator('[data-back="invite"]')).toContainText("Settings");
    await page.locator('[data-back="invite"]').click();
    await expect(page.locator('.view[data-view="settings"].is-active')).toHaveCount(1);

    await page.locator('.view[data-view="settings"] [data-go="invite"]').click();
    await page.locator("#btnSkipInvite").click();
    await expect(page.locator('.view[data-view="settings"].is-active')).toHaveCount(1);

    await page.locator('#topbar [data-go="tasteProfile"]:visible').first().click();
    await expect(page.locator('.view[data-view="tasteProfile"]')).toContainText(/Tacos/);
  });

  test("an onboarded kitchen never sees a stale onboarding step", async ({ page }) => {
    await onboard(page);
    await page.evaluate(() => {
      const b = document.createElement("button");
      b.dataset.go = "taste";
      b.id = "staleStep";
      document.querySelector('.view[data-view="home"]').appendChild(b);
    });
    await page.locator('#topbar [data-go="home"]:visible').first().click();
    await page.locator("#staleStep").click({ force: true });
    await expect(page.locator('.view[data-view="taste"].is-active')).toHaveCount(0);
    await expect(page.locator('.view[data-view="home"].is-active')).toHaveCount(1);
  });
});

test.describe("FW-06 · diet controls", () => {
  test("hard limits are explicit, and the cashew exception only appears under No nuts", async ({ page }) => {
    await freshQaKitchen(page);
    await page.locator("#hhName").fill("Limits Lab");
    await page.locator("#ownerName").fill("Riley");
    await page.locator("#btnCreateHh").click();
    await page.locator('.view[data-view="members"] .flow__actions .btn-primary').click();
    const grid = page.locator("#constraints");
    await expect(grid).not.toContainText("*");
    await expect(grid).not.toContainText("Finfish");
    await expect(grid.locator('input[data-cid="cashew_ok"]')).toHaveCount(0);
    await grid.locator('input[data-cid="nuts"]').check();
    await expect(grid.locator('input[data-cid="cashew_ok"]')).toHaveCount(1);
    await grid.locator('input[data-cid="cashew_ok"]').check();
    await grid.locator('input[data-cid="nuts"]').uncheck();
    await expect(grid.locator('input[data-cid="cashew_ok"]')).toHaveCount(0);
    await grid.locator('input[data-cid="fish"]').check();
    await page.locator('.view[data-view="constraints"] .flow__actions .btn-primary').click();
    await expect(page.locator('#tastePicks [data-taste-pick="tacos"]')).toBeVisible();
    await expect(page.locator('[data-taste-pick="fish"]')).toHaveCount(0);
  });
});

test.describe("FW-10 + FW-07 · recipe origin, view vs select, next dinner", () => {
  test("full loop keeps origins straight and starts a fresh round", async ({ page }) => {
    await onboard(page);
    const cards = page.locator(".option-card[data-preview]");
    const titleB = (await cards.nth(1).locator("h2").textContent()) || "";

    await cards.nth(1).click();
    await expect(page.locator("#detailPickState")).toContainText("Just looking");
    await expect(page.locator('[data-back="detail"]')).toContainText("Tonight");
    await expect(page.locator('#topNav [data-nav="choices"]')).toHaveClass(/is-on/);
    await page.locator('[data-back="detail"]').click();
    await expect(page.locator('.view[data-view="choices"].is-active')).toHaveCount(1);
    await expect(page.locator(".option-card.selected-mark")).toHaveCount(0);

    await cards.nth(1).click();
    await page.locator("#btnStartCook").click();
    await expect(page.locator("#detailPickState")).toContainText("Tonight’s pick");
    await page.locator("#btnStartCook").click();
    for (let i = 0; i < 8; i++) {
      const finish = page.getByRole("button", { name: "Finish" });
      if (await finish.isVisible()) {
        await finish.click();
        break;
      }
      await page.getByRole("button", { name: "Next" }).click();
    }
    await page.getByRole("button", { name: "Rate now" }).click();
    const raters = page.locator(".rater-card");
    const n = await raters.count();
    for (let i = 0; i < n; i++) {
      await raters.nth(i).locator(".score-row button.score").nth(7).click();
    }
    await page.getByRole("button", { name: "Submit all ratings" }).click();
    await expect(page.getByRole("heading", { name: /rated dinner/ })).toBeVisible();

    const ratedPlan = (await me(page)).plan_id;
    await expect(page.locator('.view[data-view="loop"] [data-action="next-dinner"]')).toBeVisible();
    await page.locator('.view[data-view="loop"] [data-action="next-dinner"]').click();
    await expect(page.locator('.view[data-view="home"].is-active')).toHaveCount(1);
    await expect(page.getByTestId("home-title")).toHaveText("What’s for dinner?");
    await expect(page.getByRole("button", { name: "Plan our dinners" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Find a dinner" })).toBeVisible();
    const fresh = await me(page);
    expect(fresh.plan_id).toBe(ratedPlan);
    // The rated round is still the current plan, so it is not reported as a previous meal.
    expect(fresh.previous_meal).toBeNull();

    await page.locator('#topbar [data-go="meals"]:visible').first().click();
    const firstHistory = page.locator("[data-history-recipe]").first();
    await expect(firstHistory).toBeVisible({ timeout: 15000 });
    await firstHistory.click();
    await expect(page.locator("#detailTitle")).toHaveText(titleB);
    await expect(page.locator("#detailPickState")).toContainText("past round");
    await expect(page.locator("#btnStartCook")).toBeHidden();
    await expect(page.locator('[data-back="detail"]')).toContainText("History");
    await expect(page.locator('#topNav [data-nav="meals"]')).toHaveClass(/is-on/);
    await page.locator('[data-back="detail"]').click();
    await expect(page.locator('.view[data-view="meals"].is-active')).toHaveCount(1);

    const after = await me(page);
    expect(after.plan_id).toBe(fresh.plan_id);
    expect(after.selection || null).toBeNull();
  });
});
