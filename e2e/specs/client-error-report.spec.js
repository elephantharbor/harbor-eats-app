// @ts-check
import { test, expect } from "@playwright/test";

async function installRoutes(page, { clientErrorStatus }) {
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.route("**/api/health", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, d1: "ok", consumer_ui: true }),
    })
  );
  await page.route("**/api/sessions/me", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "unavailable" }),
    })
  );
  const reports = [];
  await page.route("**/api/client-errors", async (route) => {
    reports.push(route.request().postDataJSON());
    await route.fulfill({
      status: clientErrorStatus,
      contentType: "application/json",
      body: JSON.stringify(
        clientErrorStatus === 201 ? { ok: true, error_id: "cerr_test" } : { ok: false, error: "unavailable" }
      ),
    });
  });
  return reports;
}

test.describe("client error reporting", () => {
  test("a failing error endpoint stays bounded for the page", async ({ page }) => {
    const reports = await installRoutes(page, { clientErrorStatus: 500 });
    await page.goto("/");
    await page.waitForTimeout(1500);
    expect(reports.map((body) => body.message)).toEqual(["/api/sessions/me 500"]);
    await page.waitForTimeout(1000);
    expect(reports).toHaveLength(1);
  });

  test("a healthy error endpoint receives the page's reports once", async ({ page }) => {
    const reports = await installRoutes(page, { clientErrorStatus: 201 });
    await page.goto("/");
    await page.waitForTimeout(1500);
    expect(reports).toHaveLength(1);
    expect(reports[0].surface).toBe("api");
    expect(reports[0].message).toBe("/api/sessions/me 500");
    await page.waitForTimeout(800);
    expect(reports).toHaveLength(1);
  });
});
