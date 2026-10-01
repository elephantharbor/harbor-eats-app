// @ts-check
import { test, expect } from "@playwright/test";
import { apiCreateHousehold } from "./helpers.js";

/** @param {import('@playwright/test').APIRequestContext} request */
function sessionHeaders(sessionToken) {
  if (!sessionToken) return {};
  return { Cookie: `he_session=${encodeURIComponent(sessionToken)}` };
}

test.describe("household authorization boundary", () => {
  test("unauthenticated protected reads and writes are denied", async ({ playwright }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
    const request = await playwright.request.newContext();
    const hhRes = await request.post(`${base}/api/households`, {
      data: { display_name: "No Session HH" },
    });
    const hhBody = await hhRes.json();
    const household_id = hhBody.household_id;

    const stateRes = await request.get(`${base}/api/households/${household_id}/state`);
    expect(stateRes.status()).toBe(401);

    const planRes = await request.post(`${base}/api/plans`, {
      data: { household_id },
    });
    expect(planRes.status()).toBe(401);
    await request.dispose();
  });

  test("household A session cannot read or mutate household B", async ({ request }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
    const a = await apiCreateHousehold(request, "Household A");
    const b = await apiCreateHousehold(request, "Household B");

    const headers = sessionHeaders(a.sessionToken);

    const readB = await request.get(`${base}/api/households/${b.household_id}/state`, {
      headers,
    });
    expect(readB.status()).toBe(403);
    const readBody = await readB.json();
    expect(readBody.error).toBe("forbidden_cross_household");

    const planOnB = await request.post(
      `${base}/api/plans`,
      {
        headers,
        data: { household_id: b.household_id, plan_id: "cross-tenant-plan" },
      }
    );
    expect(planOnB.status()).toBe(403);
  });

  test("same-household session succeeds for state and plan create", async ({ request }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
    const a = await apiCreateHousehold(request, "Household OK");
    const headers = sessionHeaders(a.sessionToken);

    const stateRes = await request.get(`${base}/api/households/${a.household_id}/state`, {
      headers,
    });
    expect(stateRes.ok()).toBeTruthy();
    const state = await stateRes.json();
    expect(state.ok).toBe(true);

    const planRes = await request.post(`${base}/api/plans`, {
      headers,
      data: { household_id: a.household_id, plan_id: `plan-${Date.now()}` },
    });
    expect(planRes.status()).toBe(201);
  });

  test("recovery token is single-use and establishes session", async ({ request }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
    const a = await apiCreateHousehold(request, "Recovery HH");

    const req = await request.post(`${base}/api/recovery/request`, {
      data: {
        household_id: a.household_id,
        member_id: a.memberId,
        destination_path: "/",
      },
    });
    expect(req.ok()).toBeTruthy();
    const reqBody = await req.json();
    expect(reqBody.dev_recovery_url).toBeTruthy();
    const token = String(reqBody.dev_recovery_url).split("/recover/")[1].split("?")[0];

    const first = await request.post(`${base}/api/recovery/consume`, {
      data: { token },
    });
    expect(first.ok()).toBeTruthy();
    const setCookie = first.headers()["set-cookie"] || "";
    expect(setCookie).toContain("he_session=");

    const second = await request.post(`${base}/api/recovery/consume`, {
      data: { token },
    });
    expect(second.status()).toBe(410);
  });

  test("invite resolve stays public; invalid invite fails", async ({ request }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";
    const bad = await request.get(`${base}/api/invites/HE-INV-NOTREAL`);
    expect(bad.status()).toBe(404);

    const a = await apiCreateHousehold(request, "Invite HH");
    const headers = sessionHeaders(a.sessionToken);
    const created = await request.post(`${base}/api/invites`, {
      headers,
      data: { household_id: a.household_id, channel: "copy" },
    });
    expect(created.ok()).toBeTruthy();
    const inv = await created.json();
    const resolved = await request.get(`${base}/api/invites/${inv.invite_code}`);
    expect(resolved.ok()).toBeTruthy();
  });
});
