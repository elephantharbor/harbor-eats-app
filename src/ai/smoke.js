/**
 * Internal live-smoke endpoint: POST /api/ai/internal/smoke
 * DISABLED unless the AI_SMOKE_TOKEN secret is set (404 otherwise) and the request carries a
 * matching `x-ai-smoke-token` header. It runs exactly ONE fixed, tiny `explanation` task
 * (gpt-6-luna, max 120 output tokens) through the normal GenerationService, so the kill switch,
 * task flag, limits and budget all still apply. Not a consumer route; nothing in public/ calls it.
 */
import { createGenerationService } from "./gateway.js";
import { createD1Store } from "./store.js";

const SMOKE_INPUT = Object.freeze({ meal: "Weeknight tomato pasta", reasons: ["quick", "few ingredients"] });

function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

export async function handleAiSmoke(request, env, provider) {
  const token = typeof env.AI_SMOKE_TOKEN === "string" ? env.AI_SMOKE_TOKEN.trim() : "";
  if (!token) return { status: 404, body: { error: "not_found" } };
  if (!safeEqual(request.headers.get("x-ai-smoke-token") || "", token)) return { status: 403, body: { error: "forbidden" } };
  if (!env.DB) return { status: 503, body: { error: "d1_unbound" } };
  const service = createGenerationService({ provider, store: createD1Store(env.DB), env });
  const nonce = new URL(request.url).searchParams.get("nonce") || ""; // vary to bypass cache on purpose
  const input = nonce ? { ...SMOKE_INPUT, reasons: [...SMOKE_INPUT.reasons, `n${String(nonce).replace(/[^a-z0-9]/gi, "").slice(0, 12)}`] } : SMOKE_INPUT;
  const r = await service.run("explanation", input, { householdId: "ai_smoke", fallback: null });
  return { status: 200, body: { ok: r.ok, error: r.error ?? null, source: r.source ?? null, model: r.model ?? null, prompt_version: r.prompt_version ?? null, output: r.ok ? r.output : null } };
}
