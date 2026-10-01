// @ts-check
import { test, expect } from "@playwright/test";
import { apiCreateHousehold } from "./helpers.js";

test.describe("production invite → join", () => {
  test("recipient joins via API and receives session cookie", async ({ request }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
    const { household_id, memberId, cookieHeader } = await apiCreateHousehold(request, "Join Flow HH");
    const inv = await request.post(`${base}/api/invites`, {
      headers: cookieHeader,
      data: { household_id, inviter_member_id: memberId, channel: "copy" },
    });
    const invBody = await inv.json();
    expect(invBody.invite_code).toMatch(/^HE-INV-/);

    const join = await request.post(`${base}/api/invites/join`, {
      data: {
        invite_code: invBody.invite_code,
        display_name: "Partner",
        constraint_keys: ["shellfish"],
      },
    });
    expect(join.ok()).toBeTruthy();
    const joinBody = await join.json();
    expect(joinBody.ok).toBe(true);
    expect(joinBody.household_id).toBe(household_id);
    expect(join.headers()["set-cookie"] || "").toMatch(/he_session=/);
  });

  test("UI join from invite deep link reaches choices", async ({ page, request, context }) => {
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
    const { household_id, memberId, cookieHeader } = await apiCreateHousehold(request, "UI Join HH");
    const inv = await request.post(`${base}/api/invites`, {
      headers: cookieHeader,
      data: { household_id, inviter_member_id: memberId, channel: "copy" },
    });
    const { invite_code } = await inv.json();
    await page.goto(`/invite/${encodeURIComponent(invite_code)}`);
    await page.locator("#joinName").fill("Partner");
    await page.getByRole("button", { name: "Join kitchen" }).click();
    await expect(page.getByRole("heading", { name: "Which should we make?" })).toBeVisible({
      timeout: 20000,
    });
  });

});
