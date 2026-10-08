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

const HH001_REACHABLE = [
  "salade-nicoise-seared-tuna",
  "brazilian-fish-moqueca",
  "thai-fish-cakes-cucumber-relish",
];

const describeHosted = process.env.PLAYWRIGHT_BASE_URL ? test.describe : test.describe.skip;

describeHosted("Wave-12 catalog (hosted preview)", () => {
  test("health, images, discovery, and HH001 hard limits", async ({ page, request }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL;
    expect(base).toBeTruthy();

    const health = await request.get(`${base}/api/health`);
    expect(health.ok()).toBe(true);
    const healthBody = await health.json();
    expect(healthBody.catalog_runtime_meals).toBe(75);

    const discover = await request.post(`${base}/api/discovery/search`, {
      headers: { "Content-Type": "application/json" },
      data: { mode: "standalone", context: { mode: "standalone" }, query: { text: null, limit: 100, offset: 0 } },
    });
    const discoverBody = await discover.json();
    expect(discoverBody.ok).toBe(true);
    const slugs = new Set((discoverBody.results || []).map((row) => row.recipe_slug));
    expect(slugs.size).toBeGreaterThanOrEqual(75);

    for (const slug of WAVE12_SLUGS) {
      for (const suffix of ["", "-640"]) {
        const res = await request.get(`${base}/images/meals/${slug}${suffix}.webp`);
        expect(res.status()).toBe(200);
        expect(res.headers()["content-type"] || "").toMatch(/image\/webp/i);
      }
    }

    await skipToChoices(page);
    await page.goto(`${base}/`);
    await page.locator('[data-go="find"][data-nav="find"]').filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { name: "Find a dinner" })).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".disc-shelf, .disc-grid").first()).toBeVisible({ timeout: 60000 });
    const broken = await page.locator('.disc-card img[src*="undefined"], .disc-card img:not([src])').count();
    expect(broken).toBe(0);

    const hh = await apiCreateHousehold(request, "Wave12 HH001");
    const headers = { ...(hh.cookieHeader || {}), "Content-Type": "application/json" };
    const search = await request.post(`${base}/api/discovery/search`, {
      headers,
      data: {
        mode: "standalone",
        context: { mode: "standalone" },
        query: { text: null, limit: 100, offset: 0 },
      },
    });
    const body = await search.json();
    expect(body.ok).toBe(true);
    const hhSlugs = (body.results || []).map((row) => row.recipe_slug);
    for (const blocked of HH001_BLOCKED) {
      expect(hhSlugs).not.toContain(blocked);
    }
    for (const slug of HH001_REACHABLE) {
      expect(hhSlugs).toContain(slug);
    }
  });
});
