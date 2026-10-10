/** D-05 public surface for server code. Feature code imports from here only. */
export { createGenerationService } from "./gateway.js";
export { createD1Store, createMemoryStore } from "./store.js";
export { createFakeProvider } from "./providers/fake.js";
export { unconfiguredProvider, assertAdapter } from "./providers/contract.js";
export { aiHealth, D05_VERSION } from "./health.js";
export { intentToDiscoveryQuery } from "./intent-adapter.js";
export { buildHouseholdContext, redactText } from "./privacy.js";
export { TASKS, TASK_IDS, getTask } from "./tasks.js";

import { unconfiguredProvider } from "./providers/contract.js";
/** Resolve the runtime provider. Only "none" exists until Oversight approves a provider. */
export function resolveProvider(env = {}) {
  return unconfiguredProvider(String(env.AI_PROVIDER || "none"));
}
