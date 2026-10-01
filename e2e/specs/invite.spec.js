// @ts-check
import { test, expect } from "@playwright/test";
import { apiCreateHousehold } from "./helpers.js";

test("invite deep link opens join, not welcome", async ({ page, request, context }) => {
  await context.clearCookies();
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
  const { household_id, memberId, cookieHeader } = await apiCreateHousehold(request, "Invite HH");
  const inv = await request.post(`${base}/api/invites`, {
    headers: cookieHeader,
    data: { household_id, inviter_member_id: memberId, channel: "copy" },
  });
  expect(inv.ok()).toBeTruthy();
  const invBody = await inv.json();
  expect(invBody.invite_code).toMatch(/^HE-INV-/);
  await page.goto(`/?invite=${encodeURIComponent(invBody.invite_code)}`);
  await expect(page.locator("#joinCode")).toBeVisible();
  await expect(page.getByTestId("welcome-title")).toBeHidden();
});
