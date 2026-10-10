/**
 * Centralized routing table. Cost classes map to model tiers; tasks reference a cost class.
 * Cheap models for extraction/classification; stronger models only for creative work.
 * Model ids are logical aliases bound to a concrete provider model by the adapter, so a
 * provider decision does not change feature code.
 */
export const COST_CLASSES = Object.freeze({
  cheap: { models: ["fast-small"], usd_per_mtok_in: 0.2, usd_per_mtok_out: 0.5 },
  standard: { models: ["fast-small", "balanced"], usd_per_mtok_in: 1.0, usd_per_mtok_out: 3.0 },
  creative: { models: ["balanced", "strong"], usd_per_mtok_in: 3.0, usd_per_mtok_out: 15.0 },
});

/** Ordered fallback list for a task; first entry is primary. */
export function routeModels(task) {
  const cls = COST_CLASSES[task.cost_class];
  if (!cls) throw new Error(`unknown cost class ${task.cost_class}`);
  return task.allowed_models.filter((m) => cls.models.includes(m));
}

export function estimateCostUsd(costClass, inputTokens, outputTokens) {
  const cls = COST_CLASSES[costClass];
  if (!cls) return 0;
  const usd = (inputTokens * cls.usd_per_mtok_in + outputTokens * cls.usd_per_mtok_out) / 1e6;
  return Math.round(usd * 1e6) / 1e6;
}
