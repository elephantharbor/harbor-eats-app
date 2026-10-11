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

test("D-05 health follows the environment's configured flags", async ({ request }) => {
  const res = await request.get(`${base}/api/ai/health`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.tasks).toHaveLength(8);
  const consumerTaskOn = body.tasks.some(
    (task) => (task.id === "planning_intent" || task.id === "discovery_intent") && task.enabled === true
  );
  expect(body.consumer_ui).toBe(Boolean(body.gateway_enabled) && Boolean(body.provider_configured) && consumerTaskOn);
});
