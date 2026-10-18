// @ts-check
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";
import { mockAlphaAi, seedDinnerPlan } from "./alpha-helpers.js";

/** Home is the phone path into the list. Session restore lands on Tonight, where that card is not on screen. */
async function openTheList(page) {
  await page.locator('[data-nav="home"]').filter({ visible: true }).first().click();
  await expect(page.locator(".view.is-active[data-view='home']")).toBeVisible();
  await page.locator(".view.is-active button.link-card[data-go='shopList']").click();
  await expect(page.locator(".view.is-active[data-view='shopList']")).toBeVisible();
}

test.describe("household shopping list", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await mockAlphaAi(page);
    await skipToChoices(page);
    await seedDinnerPlan(page, { finalize: true });
  });

  test("add, edit, check off, already have, skip, and in-store mode", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await openTheList(page);
    await expect(page.getByRole("heading", { name: "The list" })).toBeVisible();
    await expect(page.locator("[data-shop-more]").first()).toBeVisible({ timeout: 30000 });

    const add = page.locator("#shopAddInput");
    await add.fill("paper towels");
    await page.locator("#shopAddForm button[type='submit']").click();
    await expect(page.getByRole("checkbox", { name: /Still need, Paper towels/i })).toBeVisible();

    const towelsMore = page.getByRole("button", { name: "More for Paper towels" });
    await towelsMore.click();
    await page.locator("#shopEditQty").fill("2");
    await page.locator("#shopEditUnit").selectOption("package");
    await page.locator("#btnShopEditSave").click();
    await expect(page.getByRole("checkbox", { name: /Still need, Paper towels, 2/i })).toBeVisible();

    await page.getByRole("checkbox", { name: /Still need, Paper towels, 2/i }).click();
    await expect(page.getByRole("checkbox", { name: /Bought, Paper towels/i })).toBeVisible();

    await page.getByRole("button", { name: "More for Paper towels" }).click();
    await page.getByRole("button", { name: "Already have it" }).click();
    await expect(page.getByRole("checkbox", { name: /Already have, Paper towels/i })).toBeVisible();

    await page.getByRole("button", { name: "More for Paper towels" }).click();
    await page.getByRole("button", { name: "Skip this trip" }).click();
    await expect(page.getByRole("checkbox", { name: /Skipping, Paper towels/i })).toBeVisible();

    await page.getByRole("button", { name: "How are you shopping?" }).click();
    await page.locator("#shopHowSheet").getByRole("button", { name: /Shop in store/ }).click();
    await expect(page.locator("#shopEyebrow")).toHaveText("In the store");
    await expect(page.locator("#btnShopDone")).toBeVisible();
    await page.locator("#btnShopDone").click();
    await expect(page.locator(".view.is-active[data-view='home']")).toBeVisible();
  });

  test("settings favorites, share snapshot, and mobile back from a recipe", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.locator("#shopUsualStore").fill("Market Street");
    await page.locator("#shopMemberStore").fill("Corner shop");
    await page.locator("#btnSaveShopping").click();
    await expect(page.getByText("Shopping saved")).toBeVisible();

    await openTheList(page);
    await expect(page.locator("[data-shop-more]").first()).toBeVisible({ timeout: 30000 });
    await page.locator("#btnShopMenu").click();
    await page.getByRole("button", { name: "Sharing link" }).click();
    const link = page.locator("#shopShareUrl");
    await expect(link).toHaveValue(/\/shop\/shared\/HE-SHOP-/);
    const url = await link.inputValue();
    await page.locator("#shopShareSheet").getByRole("button", { name: "Close" }).click();
    await page.locator("#shopAddInput").fill("secret sauce");
    await page.locator("#shopAddForm button[type='submit']").click();
    await expect(page.getByRole("checkbox", { name: /secret sauce/i })).toBeVisible();

    const token = url.split("/shop/shared/")[1];
    const pub = await page.request.get("/api/shop/shared/" + token);
    expect(pub.status()).toBe(200);
    const snap = await pub.json();
    const dumped = JSON.stringify(snap);
    expect(dumped).not.toContain("secret sauce");
    expect(dumped).not.toMatch(/Market Street|Corner shop|postal/i);
    expect(pub.headers()["x-robots-tag"] || "").toContain("noindex");

    await page.locator("#btnShopMenu").click();
    await page.getByRole("button", { name: "Stop sharing" }).click();
    await expect(page.getByText("Link stopped")).toBeVisible();
    const gone = await page.request.get("/api/shop/shared/" + token);
    expect(gone.status()).toBe(404);

    await page.locator("[data-shop-more]").first().click();
    await page.locator('[data-action="shop-view-recipe"]').click();
    await expect(page.locator(".view.is-active[data-view='detail']")).toBeVisible();
    await page.getByRole("button", { name: /Shopping list/i }).click();
    await expect(page.locator(".view.is-active[data-view='shopList']")).toBeVisible();
  });

  test("onboarding skip writes nothing", async ({ page, context }) => {
    await context.clearCookies();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    let preferencePosts = 0;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/api/household-shop/preferences")) preferencePosts += 1;
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Get started" }).click();
    await page.locator("#hhName").fill("[synthetic] Skip Kitchen");
    await page.locator("#ownerName").fill("Alex");
    await page.locator("#btnCreateHh").click();
    await page.locator("#newMemberName").fill("Partner");
    await page.getByRole("button", { name: "Add person" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Skip for now" }).click();
    await page.getByRole("button", { name: "Skip — show tonight’s picks" }).click();
    await expect(page.locator("#shopOnboardSheet")).toBeVisible();
    await page.locator("#btnShopOnboardSkip").click();
    await expect(page.locator("#shopOnboardSheet")).toBeHidden();
    expect(preferencePosts).toBe(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("he_shop_onboard"))).toBe("skip");
  });

  test("order online stays disconnected (or a labeled Preview mock)", async ({ page }) => {
    await page.goto("/");
    await openTheList(page);
    await expect(page.locator("[data-shop-more]").first()).toBeVisible({ timeout: 30000 });
    const caps = page.waitForResponse((r) => r.url().includes("/api/grocery/capabilities"));
    await page.getByRole("button", { name: "How are you shopping?" }).click();
    const body = await (await caps).json().catch(() => ({}));
    const instacart = (body.providers || []).find((p) => p.id === "instacart");
    await expect(page.locator("#shopHowSheet")).toBeVisible();
    await expect(page.getByText("Copy it into a grocery app that supports pasting multiple items, or save the image for one that reads list photos. Review the items there before checkout.")).toBeVisible();
    await expect(page.getByText("Names and quantities only. Dietary notes stay in FlavorWeave, so check labels and any substitutions for allergens.")).toBeVisible();
    if (!instacart) {
      await expect(page.locator("#shopHowConnected")).toBeHidden();
      await expect(page.locator("#btnShopOrder")).toBeHidden();
      await expect(page.getByText("Not connected yet")).toHaveCount(0);
    } else {
      await expect(page.locator("#btnShopHowConnected")).toBeVisible();
      await page.locator("#btnShopHowConnected").click();
      // Only a Preview fixture may configure Instacart here, and the UI must say it is a test.
      expect(instacart.mode).toBe("mock");
      expect(instacart.launch_enabled).toBe(false);
      const badge = "Preview test — Not a real Instacart connection. Nothing is sent to Instacart.";
      await expect(page.locator("#btnShopPickInstacart")).toContainText("Instacart (test)");
      await expect(page.locator("[data-shop-mock-badge]")).toHaveText(badge);
      await page.locator("#btnShopPickInstacart").click();
      await expect(page.locator("#shopOrderBody [data-shop-mock-badge]")).toHaveText(badge);
      await expect(page.getByText("This is a Preview test. It does not open Instacart")).toBeVisible();
      await expect(page.locator("#btnShopInstacartCta")).toBeDisabled();
    }
    await expect(page.getByRole("link", { name: /instacart/i })).toHaveCount(0);
  });
});
