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
  const dir = process.env.S05C_SHOT_DIR || "docs/shopping/assets/screens";
  mkdirSync(dir, { recursive: true });
  return `${dir}/${name}.png`;
}

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
    const events = [];
    const clientErrors = [];
    page.on("request", (request) => {
      if (request.method() !== "POST") return;
      if (request.url().includes("/api/events")) events.push(request.postDataJSON());
      if (request.url().includes("/api/client-errors")) clientErrors.push(request.postDataJSON());
    });
    await openTheList(page);
    const add = page.locator("#shopAddInput");
    await expect(add).toBeEnabled();
    await add.fill("2 lb yellow onions");
    await page.locator("#shopAddForm button[type='submit']").click();
    await expect(page.getByRole("checkbox", { name: /yellow onions/i })).toBeVisible();
    await add.fill("1 lb Yukon Gold potatoes");
    await page.locator("#shopAddForm button[type='submit']").click();
    await expect(page.getByRole("checkbox", { name: /Yukon Gold/ })).toBeVisible();
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
    await expect(sheet.getByText("Copy it into a grocery app that supports pasting multiple items, or save the image for one that reads list photos. Review the items there before checkout.")).toBeVisible();
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
    await expect(sheet.locator("#shopHowStoreCopy")).toHaveText("Your list, in aisle order, with check\u2011offs.");
    await page.locator("#btnShopCopyApp").click();
    await expect(sheet.locator("#shopHowStatus")).toHaveText("Copied. Paste this into your grocery app, then review the items before buying.");
    await expect(sheet.locator("#shopHowStatus")).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("2 lb yellow onions");
    expect(copied).toContain("1 lb Yukon Gold potatoes");
    expect(copied).not.toContain("secret sauce");
    expect(copied).not.toMatch(/Part \d|FlavorWeave list|Produce/);
    await expect(page.locator("#shopExportReturn")).toBeVisible();

    await page.evaluate(() => {
      navigator.canShare = () => true;
      navigator.share = () => Promise.reject(Object.assign(new Error("The user aborted a request."), { name: "AbortError" }));
    });
    await page.locator("#btnShopSaveImage").click();
    await expect(sheet.locator("#shopHowStatus")).toHaveText("Share cancelled. Your list is still here.");

    await page.evaluate(() => {
      navigator.canShare = () => false;
    });
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#btnShopSaveImage").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/shopping-list.*\.png/);
    await expect(sheet.locator("#shopHowStatus")).toContainText("Download started. Check your downloads");

    const shopEvents = events.filter((body) => body && body.event_name === "shop_export");
    const succeeded = shopEvents.filter((body) => body.stage === "succeeded");
    expect(succeeded).toEqual([
      expect.objectContaining({ type: "copy_app", ok: true, surface: "shop_sheet", stage: "succeeded" }),
      expect.objectContaining({ type: "download", ok: true, surface: "shop_sheet", stage: "succeeded" }),
    ]);
    expect(shopEvents.filter((body) => body.stage === "attempted").length).toBeGreaterThanOrEqual(2);
    expect(shopEvents.some((body) => body.stage === "cancelled" && body.type === "image" && body.ok === false)).toBe(true);
    expect(JSON.stringify(shopEvents)).not.toMatch(/Yukon|onion|secret|paprika/i);
    expect(clientErrors).toEqual([]);

    for (const [name, size] of SHOTS) {
      await page.setViewportSize(size);
      await page.evaluate(() => {
        const row = document.getElementById("shopHowConnected");
        if (row) row.hidden = true;
      });
      const close = sheet.getByRole("button", { name: "Close" });
      const box = await close.boundingBox();
      expect(box).toBeTruthy();
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      await page.screenshot({ path: shotPath(`s05c1-sheet-${name}`) });
      await page.evaluate(() => {
        const row = document.getElementById("shopHowConnected");
        const copy = document.getElementById("shopHowConnectedCopy");
        if (copy) copy.textContent = "A grocery service is connected for this kitchen. You’ll review the items before anything leaves FlavorWeave.";
        if (row) row.hidden = false;
      });
      const withRow = await close.boundingBox();
      expect(withRow.y).toBeGreaterThanOrEqual(0);
      expect(withRow.y + withRow.height).toBeLessThanOrEqual(size.height);
      const saveBox = await page.locator("#btnShopSaveImage").boundingBox();
      const continueBox = await page.locator("#btnShopHowConnected").boundingBox();
      expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(continueBox.y + 1);
      await page.screenshot({ path: shotPath(`s05c1-sheet-${name}-mock-row`) });
    }
    await sheet.getByRole("button", { name: "Close" }).click();
    await expect(sheet).toBeHidden();
  });

  test("save image shows the sheet failure when the list fetch fails or aborts", async ({ page }) => {
    const clientErrors = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && request.url().includes("/api/client-errors")) clientErrors.push(request.postData() || "");
    });
    await openTheList(page);
    await page.getByRole("button", { name: "How are you shopping?" }).click();
    const sheet = page.locator("#shopHowSheet");
    await expect(sheet).toBeVisible();
    const failure = "Couldn’t prepare the image. Try Copy for my grocery app.";

    await page.evaluate(() => {
      const orig = window.fetch.bind(window);
      window.fetch = function (input, init) {
        const url = typeof input === "string" ? input : input && input.url;
        if (String(url).includes("/api/household-shop/export") && String(url).includes("for=image")) {
          return Promise.reject(Object.assign(new Error("The operation was aborted."), { name: "AbortError" }));
        }
        return orig(input, init);
      };
    });
    const before = clientErrors.length;
    await page.locator("#btnShopSaveImage").click();
    await expect(sheet.locator("#shopHowStatus")).toHaveText(failure);

    await page.evaluate(() => {
      const orig = window.fetch.bind(window);
      window.fetch = function (input, init) {
        const url = typeof input === "string" ? input : input && input.url;
        if (String(url).includes("/api/household-shop/export") && String(url).includes("for=image")) {
          return Promise.reject(new TypeError("Load failed"));
        }
        return orig(input, init);
      };
    });
    await page.locator("#btnShopSaveImage").click();
    await expect(sheet.locator("#shopHowStatus")).toHaveText(failure);
    expect(clientErrors.slice(before)).toEqual([]);
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
