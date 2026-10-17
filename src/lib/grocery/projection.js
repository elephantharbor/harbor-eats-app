/**
 * Reviewed transfer projection. The canonical list is not edited here.
 * Unsupported units stay on the list and are explained. Nothing medical,
 * no member identity, and no substitution is added.
 */

import { buyQuantity } from "../household-shop.js";
import { presentShopFaces, shopNameForDisplay } from "../shop-display.js";
import { instacartUnit } from "./units.js";

const TITLE = "FlavorWeave list";

function titleCase(name) {
  return shopNameForDisplay(name);
}

function searchName(line) {
  return String(line.display_name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function finiteQty(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
}

function staying(line, reason, message, action) {
  const faces = presentShopFaces({ quantity: null, unit: line.unit, name: line.display_name });
  return {
    line_id: line.line_id,
    display_text: titleCase(faces.product || line.display_name),
    reason,
    message,
    action,
  };
}

function classify(line) {
  const needed = line.still_needed === 1 || line.still_needed === true;
  if (!needed) {
    return staying(line, "no_longer_needed", "The plan no longer needs this.", null);
  }
  if (line.list_state === "purchased") {
    return staying(line, "purchased", "Already marked bought on your list.", null);
  }
  if (line.list_state === "already_have") {
    return staying(line, "already_have", "Already have.", null);
  }
  if (line.list_state === "skipped") {
    return staying(line, "skipped", "Leaving off this link.", "edit");
  }
  if (line.override_stale) {
    return staying(
      line,
      "ambiguous_amount",
      line.reconcile_note || "Confirm the amount before it can go to Instacart.",
      "edit"
    );
  }
  const rawQty = buyQuantity(line);
  const qty = finiteQty(rawQty);
  const unit = instacartUnit(line.unit);
  if (line.unparsed || qty == null || !unit) {
    const unsupported = !unit || line.unit === "unparsed" || line.unit === "clove" || line.unit === "jar" || line.unit === "serving" || line.unit === "carton";
    if (unsupported && line.unit && line.unit !== "unparsed") {
      const faces = presentShopFaces({ quantity: rawQty, unit: line.unit, name: line.display_name });
      const label = titleCase(faces.product || line.display_name);
      return staying(
        line,
        "invalid_qty_unit",
        `${label} needs a unit Instacart accepts. Edit it, or grab it in the store.`,
        "edit"
      );
    }
    return staying(
      line,
      "invalid_qty_unit",
      "Add a quantity and a unit Instacart accepts, or grab it in the store.",
      "edit"
    );
  }
  if (qty <= 0) {
    return staying(line, "invalid_qty_unit", "Enter an amount greater than zero, or leave it off.", "edit");
  }
  const name = searchName(line);
  if (!name) {
    return staying(line, "invalid_qty_unit", "Add a bit more of a name.", "edit");
  }
  // Same native words the list uses. `unit` above is only the Instacart measurement.
  const faces = presentShopFaces({ quantity: rawQty, unit: line.unit, name: line.display_name });
  return {
    include: true,
    line_id: line.line_id,
    name: faces.product ? faces.product.toLowerCase() : name,
    display_text: titleCase(faces.product || line.display_name),
    our_unit: line.unit,
    our_quantity: qty,
    quantity_label: faces.humanQuantity,
    quantity_accessible: faces.humanAccessible,
    measurements: [{ quantity: qty, unit }],
  };
}

export function projectTransfer(list) {
  const included = [];
  const stay = [];
  for (const line of list?.lines || []) {
    const row = classify(line);
    if (row.include) included.push(row);
    else stay.push(row);
  }
  included.sort((a, b) => String(a.line_id).localeCompare(String(b.line_id)));
  stay.sort((a, b) => String(a.line_id).localeCompare(String(b.line_id)));
  return {
    title: TITLE,
    included,
    staying: stay,
    transferable_count: included.length,
  };
}

export function instacartRequestBody({ title, included, linkback, expiresIn = 14 }) {
  return {
    title,
    link_type: "shopping_list",
    expires_in: expiresIn,
    line_items: included.map((line) => ({
      name: line.name,
      display_text: line.display_text,
      line_item_measurements: line.measurements.map((m) => ({ quantity: m.quantity, unit: m.unit })),
    })),
    landing_page_configuration: {
      partner_linkback_url: linkback,
    },
  };
}
