// @ts-check
import { test, expect } from "@playwright/test";
import { apiCreateHousehold, skipToChoices } from "./helpers.js";

const WAVE12_SLUGS = [
  "sheet-pan-gnocchi-brussels-apples",
  "miso-mushroom-ramen",
  "brazilian-fish-moqueca",
  "vegetable-biryani-cashews",
  "filipino-chicken-adobo",
  "classic-smash-burgers",
  "chicken-enchiladas-verdes",
  "baked-ziti-italian-sausage",
  "peruvian-lomo-saltado",
  "pumpkin-pinto-bean-chili",
  "salade-nicoise-seared-tuna",
  "japanese-okonomiyaki",
  "vietnamese-turmeric-dill-fish",
  "thai-turkey-larb-lettuce-wraps",
  "sheet-pan-shrimp-boil",
  "pressure-cooker-butter-chicken",
  "turkish-lahmacun",
  "mushroom-hominy-pozole-rojo",
  "sabich-pita-sandwiches",
  "tomato-soup-grilled-cheese",
  "spaghetti-puttanesca",
  "cottage-pie",
  "cashew-chicken-stir-fry",
  "thai-fish-cakes-cucumber-relish",
  "seared-scallops-parsnip-puree",
];

const HH001_KEYS = ["dairy", "meat", "poultry", "shellfish", "nuts", "cashew_ok"];

const HH001_BLOCKED = [
  "sheet-pan-shrimp-boil",
  "seared-scallops-parsnip-puree",
  "filipino-chicken-adobo",
  "chicken-enchiladas-verdes",
  "pressure-cooker-butter-chicken",
  "thai-turkey-larb-lettuce-wraps",
  "cashew-chicken-stir-fry",
  "classic-smash-burgers",
  "peruvian-lomo-saltado",
  "baked-ziti-italian-sausage",
  "turkish-lahmacun",
  "cottage-pie",
  "tomato-soup-grilled-cheese",
];

const HH001_MUST_INCLUDE = [
  "salade-nicoise-seared-tuna",
  "brazilian-fish-moqueca",
  "thai-fish-cakes-cucumber-relish",
  "ginger-scallion-fish-packets",
  "maple-mustard-glazed-salmon",
];

const describeHosted = process.env.PLAYWRIGHT_BASE_URL ? test.describe : test.describe.skip;

/** @param {import('@playwright/test').Page} page */
async function waitDiscoveryReady(page) {
  const main = page.locator("#discMain");
  await expect(main).toBeVisible({ timeout: 60000 });
  const busy = await main.getAttribute("aria-busy");
  if (busy === "true") {
    await expect(main).toHaveAttribute("aria-busy", "false", { timeout: 60000 });
  }
  await expect(
    page.locator(".disc-shelf, .disc-grid, .disc-results-title, #discMain .empty-state").first()
  ).toBeVisible({ timeout: 60000 });
}

/**
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} base
 * @param {Record<string, string>} headers
 * @param {{ text?: string|null }} [query]
 */
async function discoverySearchAll(request, base, headers, query = {}) {
  /** @type {string[]} */
  const slugs = [];
  let offset = 0;
  /** @type {object|null} */
  let firstBody = null;
  while (true) {
    const res = await request.post(`${base}/api/discovery/search`, {
      headers: { ...headers, "Content-Type": "application/json" },
      data: {
        mode: "standalone",
        context: { mode: "standalone" },
        query: { text: query.text ?? null, limit: 50, offset },
      },
    });
    const body = await res.json();
    expect(res.ok(), JSON.stringify(body)).toBe(true);
    expect(body.ok).toBe(true);
    if (!firstBody) firstBody = body;
    const results = body.results || [];
    slugs.push(...results.map((row) => row.recipe_slug));
    if (results.length < 50) break;
    offset += 50;
  }
  return { slugs, firstBody, unique: new Set(slugs) };
}

describeHosted("Wave-12 catalog (hosted preview)", () => {
  test("health, images, discovery, and HH001 hard limits", async ({ page, request }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL;
    expect(base).toBeTruthy();

    const health = await request.get(`${base}/api/health`);
    expect(health.ok()).toBe(true);
    const healthBody = await health.json();
    expect(healthBody.catalog_runtime_meals).toBe(75);

    for (const slug of WAVE12_SLUGS) {
      for (const suffix of ["", "-640"]) {
        const res = await request.get(`${base}/images/meals/${slug}${suffix}.webp`);
        expect(res.status()).toBe(200);
        expect(res.headers()["content-type"] || "").toMatch(/image\/webp/i);
      }
    }

    const openHousehold = await apiCreateHousehold(request, "Wave12 discover75", []);
    const openHeaders = { ...(openHousehold.cookieHeader || {}), "Content-Type": "application/json" };
    const discover75 = await discoverySearchAll(request, base, openHeaders);
    expect(discover75.firstBody?.total).toBe(75);
    expect(discover75.firstBody?.catalog_size).toBe(75);
    expect(discover75.unique.size).toBe(75);
    for (const slug of WAVE12_SLUGS) {
      expect(discover75.unique.has(slug)).toBe(true);
    }

    await page.goto(`${base}/`);
    await skipToChoices(page);
    await page.locator('[data-go="find"][data-nav="find"]').filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { name: "Find a dinner" })).toBeVisible({ timeout: 30000 });
    await waitDiscoveryReady(page);
    const cardImages = page.locator(".disc-card img");
    const imageCount = await cardImages.count();
    expect(imageCount).toBeGreaterThan(0);
    for (let i = 0; i < imageCount; i++) {
      const loaded = await cardImages.nth(i).evaluate((img) => img.complete && img.naturalWidth > 0);
      expect(loaded).toBe(true);
    }

    const hh001 = await apiCreateHousehold(request, "Wave12 HH001", HH001_KEYS);
    const hhHeaders = { ...(hh001.cookieHeader || {}), "Content-Type": "application/json" };
    const hhSearch = await discoverySearchAll(request, base, hhHeaders);
    for (const blocked of HH001_BLOCKED) {
      expect(hhSearch.slugs).not.toContain(blocked);
    }
    for (const slug of HH001_MUST_INCLUDE) {
      expect(hhSearch.slugs).toContain(slug);
    }

    const planRes = await request.post(`${base}/api/recommendations/plan`, {
      headers: hhHeaders,
      data: { household_id: hh001.household_id },
    });
    expect(planRes.status()).toBe(201);
    const planBody = await planRes.json();
    expect(planBody.ok).toBe(true);
    const pickSlugs = (planBody.meal_options || []).map((row) => {
      if (row.recipe_slug) return row.recipe_slug;
      const attrs = row.attributes_json;
      if (attrs && typeof attrs === "object" && attrs.recipe_slug) return attrs.recipe_slug;
      return null;
    });
    for (const blocked of HH001_BLOCKED) {
      expect(pickSlugs).not.toContain(blocked);
    }
  });
});
