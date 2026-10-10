/**
 * Provider adapter contract. The GenerationService is the ONLY caller of adapters.
 *
 * interface ProviderAdapter {
 *   id: string;                          // "fake", later e.g. "xai"
 *   configured(env): boolean;            // credential present (never returns the value)
 *   resolveModel(alias): string|null;    // logical alias -> concrete provider model id
 *   generate(req, { signal }): Promise<{
 *     text: string,                      // raw output (JSON expected)
 *     model: string,
 *     usage: { input_tokens: number, output_tokens: number, cached?: boolean },
 *     metadata?: object                  // request id, finish reason; never reasoning text
 *   }>
 *   // req = { system, user, max_output_tokens, response_schema, temperature }
 *   // errors: throw { status } / AbortError; the gateway normalizes them.
 * }
 *
 * No real provider adapter ships in D-05: no credential is configured in either Pages
 * project or the box, and provider/spend selection is an open Oversight decision.
 */
export const REQUIRED_ADAPTER_METHODS = Object.freeze(["configured", "resolveModel", "generate"]);

export function assertAdapter(adapter) {
  for (const m of REQUIRED_ADAPTER_METHODS) {
    if (typeof adapter?.[m] !== "function") throw new Error(`adapter missing ${m}`);
  }
  if (!adapter.id) throw new Error("adapter missing id");
  return adapter;
}

/** Placeholder for an unconfigured real provider: always reports unconfigured, never calls out. */
export function unconfiguredProvider(id = "unconfigured") {
  return {
    id,
    configured: () => false,
    resolveModel: () => null,
    generate: async () => {
      const e = new Error("provider_unconfigured");
      e.status = 0;
      e.unconfigured = true;
      throw e;
    },
  };
}
