/**
 * Redaction + compact household context. The context carries only what a task needs, never
 * ids, names, emails, tokens, or member-level restriction detail. Allergen/diet data is
 * NOT passed to the LLM as an authority: eligibility is applied deterministically afterwards.
 */
const PATTERNS = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]"],
  [/\+?\d[\d\s().-]{7,}\d/g, "[phone]"],
  [/\b(?:sk|pk|xai|key|tok|gho|ghp)[-_][A-Za-z0-9_-]{8,}\b/g, "[secret]"],
  [/\bhh_[a-z0-9]{6,}\b/gi, "[household]"],
  [/\bhttps?:\/\/\S+/gi, "[url]"],
];

export function redactText(text) {
  let s = String(text ?? "");
  for (const [re, rep] of PATTERNS) s = s.replace(re, rep);
  return s;
}

/** Deep-redact all string leaves. */
export function redactValue(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactValue(v)]));
  return value;
}

/**
 * @param {{ active_member_count?: number, settings?: object, recent_recipe_slugs?: string[] }} state
 */
export function buildHouseholdContext(state = {}) {
  const prefs = state.settings?.prefs || {};
  return {
    diners: Math.max(1, Math.min(12, Number(state.active_member_count) || 1)),
    keep_it_easy: prefs.keep_it_easy === true,
    keep_ingredients_simple: prefs.keep_ingredients_simple === true,
    recent_count: Array.isArray(state.recent_recipe_slugs) ? Math.min(state.recent_recipe_slugs.length, 14) : 0,
  };
}

/** Salted SHA-256 so usage rows can be rate-limited per household without storing the id. */
export async function householdKey(householdId, salt = "fw-d05") {
  if (!householdId) return null;
  const data = new TextEncoder().encode(`${salt}:${householdId}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stable normalization for cache keys: lowercase/trim strings, sorted keys. */
export function normalizeInput(value) {
  if (typeof value === "string") return value.trim().toLowerCase().replace(/\s+/g, " ");
  if (Array.isArray(value)) return value.map(normalizeInput);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, normalizeInput(value[k])]));
  }
  return value;
}
