/**
 * Deterministic fake provider for tests and local dev. Responses come from a script
 * (array or function); token counts derive from string length so accounting is testable.
 */
export function createFakeProvider({ script = null, id = "fake" } = {}) {
  const calls = [];
  let i = 0;
  return {
    id,
    calls,
    configured: () => true,
    resolveModel: (alias) => `fake-${alias}`,
    async generate(req, { signal } = {}) {
      calls.push(req);
      if (signal?.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      const step = typeof script === "function" ? script(req, i) : Array.isArray(script) ? script[Math.min(i, script.length - 1)] : { text: "{}" };
      i += 1;
      if (step?.throw) throw Object.assign(new Error(step.throw.message || "fake"), step.throw);
      if (step?.hang) {
        await new Promise((resolve, reject) => {
          signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
        });
      }
      const text = typeof step?.text === "string" ? step.text : JSON.stringify(step?.json ?? {});
      return {
        text,
        model: `fake-${req.model}`,
        usage: { input_tokens: Math.ceil((req.system.length + req.user.length) / 4), output_tokens: Math.ceil(text.length / 4) },
        metadata: { finish_reason: "stop" },
      };
    },
  };
}
