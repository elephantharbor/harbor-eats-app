/**
 * In-store adapter. No network. Independent of GROCERY_PROVIDERS.
 */

import { capabilityUnsupported } from "./errors.js";

const CAPABILITIES = Object.freeze(["in_store"]);
const FULFILLMENT = Object.freeze(["in_store"]);

export function createInStoreAdapter() {
  return {
    id: "instore",
    capabilities() {
      return CAPABILITIES;
    },
    fulfillmentMethods() {
      return FULFILLMENT;
    },
    configured() {
      return true;
    },
    async invoke(capability) {
      if (!CAPABILITIES.includes(capability)) return capabilityUnsupported("instore", capability);
      return { ok: true, provider_id: "instore", capability: "in_store" };
    },
  };
}
