/**
 * Grocery provider registry.
 * Lifecycle is the highest mark that is true. Mock contract tests do not
 * make a provider tested or production-enabled.
 * Official Instacart pages re-read 2026-10-16.
 */

import { createInStoreAdapter } from "./instore.js";
import { createInstacartAdapter } from "./instacart.js";

export const GROCERY_REGISTRY = Object.freeze([
  {
    id: "instacart",
    display_name: "Instacart",
    fulfillment_methods: ["provider_checkout"],
    geography: "US and CA",
    documented_capabilities: ["retailer_discovery", "list_handoff"],
    verified_capabilities: [],
    mock_tested_capabilities: ["retailer_discovery", "list_handoff"],
    provider_tested_capabilities: [],
    access: "none",
    credential_status: "none",
    environments: ["https://connect.dev.instacart.tools", "https://connect.instacart.com"],
    navigation_hosts: ["https://www.instacart.com", "https://instacart.com"],
    integration_status: "mock_only",
    lifecycle: "documented",
    sources: [
      "https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page/",
      "https://docs.instacart.com/developer_platform_api/api/retailers/get_nearby_retailers/",
      "https://docs.instacart.com/developer_platform_api/api/units_of_measurement",
      "https://docs.instacart.com/developer_platform_api/api/error_and_status_codes",
      "https://docs.instacart.com/developer_platform_api/guide/concepts/design/cta_design",
      "https://docs.instacart.com/developer_platform_api/guide/concepts/launch_activities/pre-launch_checklist",
    ],
    last_verified: "2026-10-16",
    contract_test_date: "2026-10-16",
    owner: "S-03 integration",
    limitations: "Link only. No cart, stock, price, order, or substitution is returned. CTA stays disabled until an official logo asset is in the repo.",
  },
  {
    id: "walmart",
    display_name: "Walmart",
    fulfillment_methods: [],
    geography: "Walmart.com affiliate, US marketplace docs",
    documented_capabilities: [],
    verified_capabilities: [],
    mock_tested_capabilities: [],
    provider_tested_capabilities: [],
    access: "none",
    credential_status: "none",
    environments: [],
    integration_status: "none",
    lifecycle: "documented",
    sources: ["https://walmart.io/apidocs/affiliates/affiliate-marketing-api"],
    last_verified: "2026-10-16",
    contract_test_date: null,
    owner: "S-03 integration",
    limitations: "Registry only. No adapter. Affiliate search is not list handoff.",
  },
  {
    id: "amazon",
    display_name: "Whole Foods / Amazon",
    fulfillment_methods: [],
    geography: "Amazon.com Associates / Creators API",
    documented_capabilities: [],
    verified_capabilities: [],
    mock_tested_capabilities: [],
    provider_tested_capabilities: [],
    access: "none",
    credential_status: "none",
    environments: [],
    integration_status: "none",
    lifecycle: "documented",
    sources: ["https://affiliate-program.amazon.com/creatorsapi/docs/en-us/introduction"],
    last_verified: "2026-10-16",
    contract_test_date: null,
    owner: "S-03 integration",
    limitations: "Registry only. No Whole Foods or Amazon Fresh order API is in use.",
  },
  {
    id: "trader_joes",
    display_name: "Trader Joe’s",
    fulfillment_methods: [],
    geography: "Stores they operate",
    documented_capabilities: [],
    verified_capabilities: [],
    mock_tested_capabilities: [],
    provider_tested_capabilities: [],
    access: "none",
    credential_status: "none",
    environments: [],
    integration_status: "none",
    lifecycle: "documented",
    sources: ["https://www.traderjoes.com/home/FAQ/general-faqs.html"],
    last_verified: "2026-10-16",
    contract_test_date: null,
    owner: "S-03 integration",
    limitations: "No online sales in the FAQ. No adapter.",
  },
  {
    id: "instore",
    display_name: "Shop in store",
    fulfillment_methods: ["in_store"],
    geography: "Wherever the household shops",
    documented_capabilities: ["in_store"],
    verified_capabilities: ["in_store"],
    mock_tested_capabilities: [],
    provider_tested_capabilities: ["in_store"],
    access: "none",
    credential_status: "none",
    environments: [],
    integration_status: "production",
    lifecycle: "production-enabled",
    sources: [],
    last_verified: "2026-10-16",
    contract_test_date: "2026-10-16",
    owner: "S-03 integration",
    limitations: "The household list on the phone. Not a retailer integration.",
  },
]);

export function registryRow(id) {
  return GROCERY_REGISTRY.find((row) => row.id === id) || null;
}

export function createGroceryAdapters(deps = {}) {
  return {
    instore: createInStoreAdapter(),
    instacart: createInstacartAdapter(deps),
  };
}

export function adapterFor(id, deps) {
  const map = createGroceryAdapters(deps);
  return map[id] || null;
}
