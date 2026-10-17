/**
 * Import-ready grocery text. One purchase line per still-needed item.
 * No header, category, meal, note, member, diet, or provider text.
 * Part labels stay in the FlavorWeave UI. They are not part of the payload.
 */

import { buyQuantity, CATEGORY_ORDER, humanUnit } from "./household-shop.js";
import { formatShopQuantityAmount, presentShopQuantity, unicodeShopAmount } from "./shop-display.js";

export const APP_EXPORT_PART_LIMIT = 200;

function categoryIndex(category) {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function countableName(name, quantity) {
  const amount = formatShopQuantityAmount(quantity);
  const spoken = presentShopQuantity({ quantity, unit: "count", name });
  if (spoken.display.startsWith(`${unicodeShopAmount(amount)} `)) {
    return spoken.display.slice(unicodeShopAmount(amount).length + 1);
  }
  return String(name || "").trim();
}

/**
 * @param {object} line
 * @returns {{ quantity: string, quantity_unicode: string, name: string, text: string } | null}
 */
export function formatAppPurchaseLine(line) {
  const name = String(line?.display_name || "").trim().replace(/\s+/g, " ");
  if (!name) return null;
  const qty = buyQuantity(line);
  if (qty == null) {
    return { quantity: "", quantity_unicode: "", name, text: name };
  }
  const amount = formatShopQuantityAmount(qty);
  const unicode = unicodeShopAmount(amount);
  const unitKey = line.unit;
  if (!unitKey || unitKey === "count" || unitKey === "each" || unitKey === "unparsed") {
    const noun = countableName(name, qty);
    return {
      quantity: amount,
      quantity_unicode: unicode,
      name: noun,
      text: `${amount} ${noun}`.trim(),
    };
  }
  const unit = humanUnit(unitKey, qty);
  const quantity = unit ? `${amount} ${unit}` : amount;
  const quantityUnicode = unit ? `${unicode} ${unit}` : unicode;
  return {
    quantity,
    quantity_unicode: quantityUnicode,
    name,
    text: `${quantity} ${name}`.trim(),
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
      name: row.name,
    })),
  };
}
