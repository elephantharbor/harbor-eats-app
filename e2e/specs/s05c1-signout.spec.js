// @ts-check
import { mkdirSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";

function shotPath(name) {
  const dir = process.env.S05C_SHOT_DIR || "docs/shopping/assets/screens";
  mkdirSync(dir, { recursive: true });
  return `${dir}/${name}.png`;
}

test.describe("S-05C.1 sign-out confirmation", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await skipToChoices(page);
  });

  test("a failed logout keeps the kitchen signed in and can be retried", async ({ page }) => {
    await page.locator('[data-nav="home"]').filter({ visible: true }).first().click();
    await page.locator(".view.is-active button.link-card[data-go='shopList']").click();
    const add = page.locator("#shopAddInput");
    await expect(add).toBeEnabled();
    await add.fill("unsynced oat milk");

    await page.locator("#topbar [data-nav='settings']").click();
    await page.evaluate(() => localStorage.setItem("he_shop_snap_plan", "{\"secret\":true}"));
    await page.locator("#btnSignOut").scrollIntoViewIfNeeded();

    let release = () => {};
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/api/sessions/logout", async (route) => {
      await gate;
      await route.abort();
    });

    await page.locator("#btnSignOut").click();
    await expect(page.locator("#signOutCover")).toBeVisible();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById("app")).visibility)).toBe("hidden");
    release();

    const failed = page.locator("#signOutFailed");
    await expect(failed).toBeVisible();
    await expect(failed).toContainText("We couldn’t confirm sign-out. Your kitchen is still signed in on this device.");
    await expect(page.locator("#signOutCover")).toBeHidden();
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.getElementById("app")).visibility)).toBe("visible");
    expect(await page.evaluate(() => localStorage.getItem("he_shop_snap_plan"))).toBe("{\"secret\":true}");
    const stillIn = await page.evaluate(async () => {
      const response = await fetch("/api/sessions/me", { credentials: "same-origin", cache: "no-store" });
      return response.status;
    });
    expect(stillIn).toBe(200);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: shotPath("s05c1-signout-failed") });

    await page.locator("#btnSignOutStay").click();
    await expect(failed).toBeHidden();
    await expect(page.locator(".view.is-active[data-view='settings']")).toBeVisible();

    await page.unroute("**/api/sessions/logout");
    await page.locator("#btnSignOut").click();
    await expect(page.locator(".view.is-active[data-view='welcome']")).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("he_shop_snap_plan"))).toBeNull();
    const gone = await page.evaluate(async () => {
      const response = await fetch("/api/sessions/me", { credentials: "same-origin", cache: "no-store" });
      return response.status;
    });
    expect(gone).toBe(401);

    await page.goBack();
    if (!page.url().startsWith("http")) await page.goto("/");
    await expect(page.locator(".view.is-active[data-view='shopList']")).toHaveCount(0);
    const afterBack = await page.evaluate(async () => {
      const response = await fetch("/api/sessions/me", { credentials: "same-origin", cache: "no-store" });
      return response.status;
    });
    expect(afterBack).toBe(401);
  });

  test("a 500 and a timeout leave the draft and the session in place", async ({ page }) => {
    await page.locator('[data-nav="home"]').filter({ visible: true }).first().click();
    await page.locator(".view.is-active button.link-card[data-go='shopList']").click();
    const add = page.locator("#shopAddInput");
    await expect(add).toBeEnabled();
    await add.fill("unsynced oat milk");
    await page.locator("#topbar [data-nav='settings']").click();

    await page.route("**/api/sessions/logout", (route) => route.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
    await page.locator("#btnSignOut").scrollIntoViewIfNeeded();
    await page.locator("#btnSignOut").click();
    await expect(page.locator("#signOutFailed")).toBeVisible();
    await page.locator("#btnSignOutStay").click();

    await page.unroute("**/api/sessions/logout");
    await page.evaluate(() => {
      window.FlavorWeaveSignOut.timeoutMs = 300;
    });
    await page.route("**/api/sessions/logout", () => new Promise(() => {}));
    await page.locator("#btnSignOut").click();
    await expect(page.locator("#signOutFailed")).toBeVisible({ timeout: 10000 });
    await page.locator("#btnSignOutStay").click();

    await page.locator('[data-nav="home"]').filter({ visible: true }).first().click();
    await page.locator(".view.is-active button.link-card[data-go='shopList']").click();
    await expect(page.locator("#shopAddInput")).toHaveValue("unsynced oat milk");
    const me = await page.evaluate(async () => {
      const response = await fetch("/api/sessions/me", { credentials: "same-origin", cache: "no-store" });
      return response.status;
    });
    expect(me).toBe(200);
  });
});
