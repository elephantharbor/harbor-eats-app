// @ts-check
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";
import { mockAlphaAi, seedDinnerPlan } from "./alpha-helpers.js";

const dir = "docs/shopping/s02-screens";

async function settle(page) {
  await page.evaluate(() => {
    document.getAnimations().forEach((anim) => anim.finish());
  });
}

test.describe("S-02 screenshots", () => {
  test.skip(!process.env.S02_SHOTS, "local UX capture only");

  test("capture phone and desktop shopping surfaces", async ({ page, context }) => {
    await context.clearCookies();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await mockAlphaAi(page);
    await page.getByRole("button", { name: "Get started" }).click();
    await page.locator("#hhName").fill("[synthetic] E2E Kitchen");
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
    await settle(page);
    await page.screenshot({ path: `${dir}/phone-onboard.png` });
    await page.locator("#btnShopOnboardSkip").click();
    await page.locator("#shopOnboardSheet").waitFor({ state: "hidden" });

    await seedDinnerPlan(page, { finalize: true });
    await page.goto("/");
    await page.locator('[data-nav="home"]').filter({ visible: true }).first().click();
    await expect(page.locator(".view.is-active[data-view='home']")).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${dir}/phone-home.png`, fullPage: true });
    await page.locator(".view.is-active button.link-card[data-go='shopList']").click();
    await expect(page.locator("[data-shop-more]").first()).toBeVisible({ timeout: 30000 });
    await page.locator("#shopAddInput").fill("paper towels");
    await page.locator("#shopAddForm button[type='submit']").click();
    await expect(page.getByRole("checkbox", { name: /Paper towels/i })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${dir}/phone-list.png` });

    await page.getByRole("button", { name: "More for Paper towels" }).click();
    await expect(page.locator("#shopLineSheet")).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${dir}/phone-edit.png` });
    await page.locator("#shopLineSheet").getByRole("button", { name: "Close" }).click();

    await page.getByRole("checkbox", { name: /Still need, Carrot/i }).click();
    await expect(page.getByRole("checkbox", { name: /Bought, Carrot/i })).toBeVisible();
    await page.getByRole("button", { name: "How are you shopping?" }).click();
    await page.locator("#shopHowSheet").getByRole("button", { name: /Shop in store/ }).click();
    await expect(page.locator("#shopEyebrow")).toHaveText("In the store");
    await settle(page);
    await page.screenshot({ path: `${dir}/phone-instore.png` });
    await page.locator("#btnShopDone").click();

    await page.locator(".view.is-active button.link-card[data-go='shopList']").click();
    await page.getByRole("button", { name: "How are you shopping?" }).click();
    await expect(page.locator("#shopHowSheet")).toBeVisible();
    await expect(page.getByText("No grocery service is connected")).toHaveCount(0);
    await settle(page);
    await page.screenshot({ path: `${dir}/phone-order.png` });
    await page.locator("#shopHowSheet").getByRole("button", { name: "Close" }).click();

    await page.locator("#btnShopMenu").click();
    await page.getByRole("button", { name: "Sharing link" }).click();
    await expect(page.locator("#shopShareUrl")).toHaveValue(/HE-SHOP-/);
    await settle(page);
    await page.screenshot({ path: `${dir}/phone-share.png` });
    const url = await page.locator("#shopShareUrl").inputValue();
    await page.locator("#shopShareSheet").getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Settings" }).click();
    await page.locator("#shoppingSettingsTitle").scrollIntoViewIfNeeded();
    await settle(page);
    await page.screenshot({ path: `${dir}/phone-settings.png` });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('[data-nav="home"]').filter({ visible: true }).first().click();
    await page.locator(".view.is-active button.link-card[data-go='shopList']").click();
    await expect(page.locator("[data-shop-more]").first()).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${dir}/desktop-list.png` });

    const guest = await context.browser().newContext();
    const pub = await guest.newPage();
    await pub.setViewportSize({ width: 390, height: 844 });
    await pub.goto(url);
    await expect(pub.getByRole("heading", { name: "The list" })).toBeVisible();
    await settle(pub);
    await pub.screenshot({ path: `${dir}/phone-shared.png` });
    await guest.close();
  });
});
