/**
 * Minimal JSON-schema subset validator (type, required, properties, enum, items,
 * maxLength, maxItems, minimum, maximum, additionalProperties:false). Deterministic, no deps.
 */
export function validateSchema(schema, value, path = "$") {
  const errors = [];
  walk(schema, value, path, errors);
  return { ok: errors.length === 0, errors };
}

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v;
}

function walk(s, v, p, errors) {
  if (!s) return;
  const t = typeOf(v);
  if (s.type) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    const ok = types.some((x) => x === t || (x === "number" && t === "integer"));
    if (!ok) return errors.push(`${p}: expected ${types.join("|")}`);
  }
  if (s.enum && !s.enum.includes(v)) errors.push(`${p}: not in enum`);
  if (t === "string" && s.maxLength != null && v.length > s.maxLength) errors.push(`${p}: too long`);
  if ((t === "number" || t === "integer") && s.minimum != null && v < s.minimum) errors.push(`${p}: below minimum`);
  if ((t === "number" || t === "integer") && s.maximum != null && v > s.maximum) errors.push(`${p}: above maximum`);
  if (t === "array") {
    if (s.maxItems != null && v.length > s.maxItems) errors.push(`${p}: too many items`);
    if (s.items) v.forEach((item, i) => walk(s.items, item, `${p}[${i}]`, errors));
  }
  if (t === "object") {
    for (const key of s.required || []) if (!(key in v)) errors.push(`${p}.${key}: required`);
    const props = s.properties || {};
    for (const [key, val] of Object.entries(v)) {
      if (props[key]) walk(props[key], val, `${p}.${key}`, errors);
      else if (s.additionalProperties === false) errors.push(`${p}.${key}: unexpected`);
    }
  }
}

/** Parse provider text into JSON; tolerate a fenced block. Returns null on failure. */
export function parseJsonOutput(text) {
  if (text && typeof text === "object") return text;
  const raw = String(text ?? "").trim();
  const fenced = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  try {
    return JSON.parse(fenced ? fenced[1] : raw);
  } catch {
    return null;
  }
}
