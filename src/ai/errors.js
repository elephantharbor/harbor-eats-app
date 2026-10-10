/** Normalized D-05 gateway errors. Every failure maps to one code; callers fall back deterministically. */
export const AI_ERROR_CODES = Object.freeze([
  "timeout",
  "rate_limited",
  "malformed_output",
  "provider_outage",
  "disabled",
  "budget_exceeded",
  "invalid_input",
  "unknown_task",
  "provider_unconfigured",
]);

export class AiError extends Error {
  /** @param {string} code @param {string} [detail] */
  constructor(code, detail) {
    super(code);
    this.code = AI_ERROR_CODES.includes(code) ? code : "provider_outage";
    this.detail = detail ? String(detail).slice(0, 200) : null;
  }
}

/** Map anything a provider throws onto a normalized code. */
export function normalizeError(error) {
  if (error instanceof AiError) return error;
  const name = String(error?.name || "");
  const status = Number(error?.status || 0);
  if (name === "AbortError" || name === "TimeoutError") return new AiError("timeout");
  if (status === 429) return new AiError("rate_limited");
  if (status >= 500 || status === 0) return new AiError("provider_outage");
  return new AiError("provider_outage", `status_${status}`);
}
