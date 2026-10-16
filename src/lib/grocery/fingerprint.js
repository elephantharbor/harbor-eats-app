/**
 * Transfer fingerprints. No timestamps, secrets, notes, or member fields.
 * request_hash is the payload we would send.
 * content_fingerprint ignores check-off state so a bought mark does not,
 * by itself, stale a link. A quantity, name, unit, or override change does.
 */

import { sha256Hex } from "../crypto.js";

function canonicalQty(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}

function sorted(lines, map) {
  return [...lines].map(map).sort((a, b) => String(a.line_id).localeCompare(String(b.line_id)));
}

export function contentFingerprintInput(lines) {
  return {
    v: 1,
    lines: sorted(lines || [], (line) => ({
      line_id: line.line_id,
      display_name: line.display_name,
      unit: line.unit,
      buy_quantity: canonicalQty(line.buy_quantity),
      override_stale: line.override_stale ? 1 : 0,
      still_needed: line.still_needed ? 1 : 0,
    })),
  };
}

export function requestFingerprintInput(providerId, included) {
  return {
    v: 1,
    provider_id: providerId,
    link_type: "shopping_list",
    lines: sorted(included || [], (line) => ({
      line_id: line.line_id,
      name: line.name,
      display_text: line.display_text,
      measurements: (line.measurements || []).map((m) => ({
        quantity: canonicalQty(m.quantity),
        unit: m.unit,
      })),
    })),
  };
}

export async function fingerprint(value) {
  return sha256Hex(JSON.stringify(value));
}
