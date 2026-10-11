export function postValidateExplanation(output, packet) {
  const used = output.used_fact_ids || [];
  const allowed = new Set((packet.facts || []).map((f) => f.id));
  if (used.some((id) => !allowed.has(id))) return { ok: false, reason: "fact_mismatch" };
  const text = output.text || "";
  if (/\b(allergen|safe for|nut-free|gluten-free)\b/i.test(text)) return { ok: false, reason: "authority_claim" };
  const digits = text.match(/\d+/g) || [];
  const allowedNums = new Set(packet.allowed_numbers || []);
  if (digits.some((d) => !allowedNums.has(d))) return { ok: false, reason: "digit" };
  if (/\bmushroom/i.test(text) && !(packet.facts || []).some((f) => /mushroom/i.test(f.phrase))) {
    return { ok: false, reason: "unsupported_food" };
  }
  if ((packet.basis === "cold" || packet.basis === "run") && /\b(you both|you tend|you love|you enjoy|your favorite)\b/i.test(text)) {
    return { ok: false, reason: "cold_voice" };
  }
  return { ok: true, value: output };
}
