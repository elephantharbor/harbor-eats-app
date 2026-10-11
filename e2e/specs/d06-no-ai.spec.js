// @ts-check
import { test, expect } from "@playwright/test";
import { skipToChoices } from "./helpers.js";

test("no-AI plan and find do not promise a typed request", async ({ page, request }) => {
  // Only meaningful where consumer AI is off (local/CI, or a keyless deploy). Hosted preview/prod run with AI on.
  const health = await request.get("/api/ai/health").then((r) => (r.ok() ? r.json() : {})).catch(() => ({}));
  test.skip(health?.consumer_ui === true, "target has consumer AI enabled");
  await page.goto("/");
  await skipToChoices(page);

  await page.locator('[data-go="home"][data-nav="home"]').filter({ visible: true }).first().click();
  await page.locator('[data-action="plan-dinners"]').first().click();
  await expect(page.getByRole("heading", { name: "Plan your dinners" })).toBeVisible({ timeout: 30000 });
  await expect(page.locator("#planCountLede")).toHaveText("Choose how many dinners.");
  await expect(page.locator("#planWeaveHost .weave-composer")).toHaveCount(0);
  await expect(page.locator("#planCountDivider")).toBeHidden();
  await expect(page.locator("#planCountOptions .plan-count-option").first()).toBeVisible();

  await page.locator('[data-go="find"][data-nav="find"]').filter({ visible: true }).first().click();
  await expect(page.getByRole("heading", { name: "Find a dinner" })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("button", { name: "Something cozy" })).toHaveCount(0);
  const search = page.getByPlaceholder("Try salmon, tacos, or Thai");
  await expect(search).toBeVisible();
  await search.fill("salmon");
  await search.dispatchEvent("input");
  await expect(page.locator(".disc-results-title, .disc-card").first()).toBeVisible({ timeout: 30000 });
});
