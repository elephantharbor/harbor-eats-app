// @ts-check
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";

async function openTheList(page) {
  await page.locator('[data-nav="home"]').filter({ visible: true }).first().click();
  await expect(page.locator(".view.is-active[data-view='home']")).toBeVisible();
  await page.locator(".view.is-active button.link-card[data-go='shopList']").click();
  await expect(page.locator(".view.is-active[data-view='shopList']")).toBeVisible();
  await expect(page.locator("#shopListTitle")).toBeVisible();
}

test.describe("S-05C grocery app handoff", () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await skipToChoices(page);
  });

  test("sheet copies import text and downloads an image", async ({ page, context }) => {
    await openTheList(page);
    const add = page.locator("#shopAddInput");
    await add.fill("2 lb yellow onions");
    await page.locator("#shopAddForm button[type='submit']").click();
    await expect(page.getByRole("checkbox", { name: /yellow onions/i })).toBeVisible();
    await add.fill("secret sauce");
    await page.locator("#shopAddForm button[type='submit']").click();
    await expect(page.getByRole("checkbox", { name: /Still need, Secret sauce/i })).toBeVisible();
    await page.getByRole("checkbox", { name: /Still need, Secret sauce/i }).click();
    await expect(page.getByRole("checkbox", { name: /Bought, Secret sauce/i })).toBeVisible();

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const caps = page.waitForResponse((r) => r.url().includes("/api/grocery/capabilities"));
    await page.getByRole("button", { name: "How are you shopping?" }).click();
    const sheet = page.locator("#shopHowSheet");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Your list is ready to share. Review the items in your grocery app before checkout.")).toBeVisible();
    const capsBody = await (await caps).json().catch(() => ({}));
    const connected = (capsBody.providers || []).filter((p) => p && p.configured && p.id !== "instore");
    if (connected.length) {
      // Only a Preview fixture may configure a provider; the sheet copy stays provider-neutral.
      expect(connected.every((p) => p.mode === "mock")).toBe(true);
      await expect(sheet.locator("#shopHowConnected")).toBeVisible();
    } else {
      await expect(sheet.locator("#shopHowConnected")).toBeHidden();
    }
    await expect(sheet).not.toContainText(/Instacart|Schnucks|Dierbergs|Walmart|Whole Foods|Amazon|Whisk/);
    await page.locator("#btnShopCopyApp").click();
    await expect(sheet.locator("#shopHowStatus")).toHaveText("Copied. Paste this into your grocery app, then review the items before buying.");
    await expect(sheet.locator("#shopHowStatus")).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("2 lb yellow onions");
    expect(copied).not.toContain("secret sauce");
    expect(copied).not.toMatch(/Part \d|FlavorWeave list|Produce/);
    await expect(page.locator("#shopExportReturn")).toBeVisible();

    await page.evaluate(() => {
      navigator.canShare = () => false;
    });
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#btnShopSaveImage").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/shopping-list.*\.png/);
    await expect(sheet.locator("#shopHowStatus")).toContainText("Download started. Check your downloads");
    const shots = [
      ["375", { width: 375, height: 812 }],
      ["390", { width: 390, height: 844 }],
      ["414", { width: 414, height: 896 }],
      ["desktop", { width: 1280, height: 800 }],
    ];
    for (const [name, size] of shots) {
      await page.setViewportSize(size);
      await page.screenshot({ path: process.env.S05C_SHOT_DIR ? `${process.env.S05C_SHOT_DIR}/sheet-${name}.png` : test.info().outputPath(`sheet-${name}.png`) });
    }
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
  });

  test("sign out clears the device, survives reload and Back, then an invite can rejoin", async ({ page }) => {
    await page.locator("#topbar [data-nav='settings']").click();
    const inviteResponse = page.waitForResponse(
      (response) => response.url().includes("/api/invites") && response.request().method() === "POST" && response.ok()
    );
    await page.locator("[data-view='settings']").getByRole("button", { name: "Invite" }).click();
    const inviteBody = await (await inviteResponse).json();
    const inviteCode = inviteBody.invite_code;
    expect(inviteCode).toMatch(/^HE-INV-/);

    await page.evaluate(() => {
      localStorage.setItem("fw_theme", "dark");
      localStorage.setItem("he_shop_snap_plan", "{\"secret\":true}");
    });
    await page.locator("#topbar [data-nav='settings']").click();
    await page.locator("#btnSignOut").scrollIntoViewIfNeeded();
    await page.locator("#btnSignOut").click();
    await expect(page.locator(".view.is-active[data-view='welcome']")).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("he_household_id"))).toBeNull();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("he_shop_snap_plan"))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("fw_theme"))).toBe("dark");

    const me = await page.evaluate(async () => {
      const response = await fetch("/api/sessions/me", { credentials: "same-origin", cache: "no-store" });
      return response.status;
    });
    expect(me).toBe(401);

    await page.reload();
    await expect(page.locator(".view.is-active[data-view='welcome']")).toBeVisible();
    await page.goBack();
    if (page.url().startsWith("http")) {
      await expect(page.locator(".view.is-active[data-view='shopList']")).toHaveCount(0);
      const afterBack = await page.evaluate(async () => {
        const response = await fetch("/api/sessions/me", { credentials: "same-origin", cache: "no-store" });
        return response.status;
      });
      expect(afterBack).toBe(401);
    } else {
      await page.goto("/");
      await expect(page.locator(".view.is-active[data-view='welcome']")).toBeVisible();
    }

    await page.goto(`/invite/${encodeURIComponent(inviteCode)}`);
    await page.locator("#joinName").fill("Alex");
    await page.getByRole("button", { name: "Join kitchen" }).click();
    await expect(page.locator(".view.is-active[data-view='home']")).toBeVisible({ timeout: 20000 });
    const rejoined = await page.evaluate(async () => {
      const response = await fetch("/api/sessions/me", { credentials: "same-origin", cache: "no-store" });
      return response.status;
    });
    expect(rejoined).toBe(200);
  });
});
