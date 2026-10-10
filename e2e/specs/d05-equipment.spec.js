// @ts-check
import { test, expect } from "@playwright/test";

const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:8787";

test("Butter Chicken recipe API carries the pressure cooker from canonical equipment metadata", async ({ request }) => {
  const res = await request.get(`${base}/api/recipes/pressure-cooker-butter-chicken`);
  expect(res.status()).toBe(200);
  const { recipe } = await res.json();
  expect(Array.isArray(recipe.equipment)).toBe(true);
  expect(recipe.equipment.some((/** @type {string} */ e) => /pressure cooker/i.test(e))).toBe(true);
});

test("D-05 health is served, makes no provider call, gateway off, no consumer UI", async ({ request }) => {
  const res = await request.get(`${base}/api/ai/health`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ ok: true, gateway_enabled: false, provider_configured: false, consumer_ui: false });
  expect(body.tasks).toHaveLength(8);
});
