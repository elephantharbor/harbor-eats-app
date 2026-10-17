/**
 * Import-ready grocery text. One purchase line per still-needed item.
 * No header, category, meal, note, member, diet, or provider text.
 * Part labels stay in the FlavorWeave UI. They are not part of the payload.
 */

import { buyQuantity, CATEGORY_ORDER } from "./household-shop.js";
import { presentShopFaces } from "./shop-display.js";

export const APP_EXPORT_PART_LIMIT = 200;

function categoryIndex(category) {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

/**
 * @param {object} line
 * @returns {{ quantity: string, quantity_unicode: string, quantity_human: string, name: string, text: string } | null}
 */
export function formatAppPurchaseLine(line) {
  const name = String(line?.display_name || "").trim().replace(/\s+/g, " ");
  if (!name) return null;
  const qty = buyQuantity(line);
  const faces = presentShopFaces({ quantity: qty, unit: line.unit, name });
  if (qty == null) {
    return { quantity: "", quantity_unicode: "", quantity_human: "", name: faces.product || name, text: faces.product || name };
  }
  return {
    quantity: faces.machineQuantity,
    quantity_unicode: faces.machineQuantityUnicode,
    quantity_human: faces.imageQuantity,
    name: faces.exportName,
    text: faces.machineText,
  };
}

/** Still to buy, in the existing category order. Labels are not returned. */
export function appPurchaseLines(list) {
  const rows = (list?.lines || []).filter((line) => line && line.still_needed && line.list_state === "open");
  const key = (value) => String(value || "").toLowerCase();
  rows.sort((a, b) => {
    const category = categoryIndex(a.category) - categoryIndex(b.category);
    if (category) return category;
    if (key(a.display_name) < key(b.display_name)) return -1;
    if (key(a.display_name) > key(b.display_name)) return 1;
    if (key(a.unit) < key(b.unit)) return -1;
    if (key(a.unit) > key(b.unit)) return 1;
    if (key(a.line_id) < key(b.line_id)) return -1;
    if (key(a.line_id) > key(b.line_id)) return 1;
    return 0;
  });
  return rows.map(formatAppPurchaseLine).filter(Boolean);
}

export function splitAppExportParts(lines, limit = APP_EXPORT_PART_LIMIT) {
  const clean = (lines || []).map((line) => String(line || "").replace(/[\r\n]+/g, " ").trim()).filter(Boolean);
  if (!clean.length) return [];
  const size = Math.max(1, limit);
  const parts = [];
  for (let i = 0; i < clean.length; i += size) {
    parts.push(clean.slice(i, i + size).join("\n"));
  }
  return parts;
}

export function renderAppExport(list, { partLimit = APP_EXPORT_PART_LIMIT } = {}) {
  const formatted = appPurchaseLines(list);
  const lines = formatted.map((row) => row.text);
  const parts = splitAppExportParts(lines, partLimit);
  return {
    lines,
    parts,
    part_count: parts.length,
    line_count: lines.length,
    rows: formatted.map((row) => ({
      quantity: row.quantity,
      quantity_unicode: row.quantity_unicode,
      quantity_human: row.quantity_human,
      name: row.name,
    })),
  };
}
