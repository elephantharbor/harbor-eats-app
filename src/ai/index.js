/** D-05 public surface for server code. Feature code imports from here only. */
export { createGenerationService } from "./gateway.js";
export { createD1Store, createMemoryStore } from "./store.js";
export { createFakeProvider } from "./providers/fake.js";
export { unconfiguredProvider, assertAdapter } from "./providers/contract.js";
export { aiHealth, D05_VERSION } from "./health.js";
export { handleAiSmoke } from "./smoke.js";
export { intentToDiscoveryQuery } from "./intent-adapter.js";
export { buildHouseholdContext, redactText } from "./privacy.js";
export { TASKS, TASK_IDS, getTask } from "./tasks.js";

export { createOpenAIProvider } from "./providers/openai.js";
export { PRICING_VERSION, MODEL_PRICING, MODEL_OUTPUT_CEILINGS } from "./pricing.js";

import { unconfiguredProvider } from "./providers/contract.js";
import { createOpenAIProvider } from "./providers/openai.js";
/**
 * Resolve the runtime provider. AI_PROVIDER=openai AND a non-empty OPENAI_API_KEY secret =>
 * the OpenAI adapter; anything else => an unconfigured provider that never calls out.
 */
export function resolveProvider(env = {}) {
  const id = String(env.AI_PROVIDER || "none");
  if (id === "openai" && typeof env.OPENAI_API_KEY === "string" && env.OPENAI_API_KEY.trim()) return createOpenAIProvider({ env });
  return unconfiguredProvider(id);
}
