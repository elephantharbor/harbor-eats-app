/** Shopping list quantity formatting and post-change row tags (Cycle 3). */

export const SHOP_QTY_FRACS = [
  [1 / 8, "1/8"],
  [1 / 4, "1/4"],
  [3 / 8, "3/8"],
  [1 / 3, "1/3"],
  [1 / 2, "1/2"],
  [2 / 3, "2/3"],
  [3 / 4, "3/4"],
];

const QTY_EPS = 1e-6;

export function formatShopQuantityAmount(num) {
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  const whole = Math.floor(abs + QTY_EPS);
  const fracPart = abs - whole;
  if (fracPart < QTY_EPS) return sign + String(whole);
  for (let i = 0; i < SHOP_QTY_FRACS.length; i++) {
    const pair = SHOP_QTY_FRACS[i];
    if (Math.abs(fracPart - pair[0]) < QTY_EPS) {
      return whole > 0 ? sign + whole + " " + pair[1] : sign + pair[1];
    }
  }
  const trimmed = String(abs);
  const short = trimmed.indexOf(".") >= 0 ? trimmed.replace(/\.?0+$/, "") : trimmed;
  return sign + short;
}

export function formatShopQty(line) {
  if (line.quantity == null || line.quantity === "") return "";
  const raw = line.quantity;
  const num = typeof raw === "number" ? raw : Number(raw);
  let amount;
  if (!Number.isNaN(num) && String(raw).trim() !== "") {
    amount = formatShopQuantityAmount(num);
  } else {
    amount = String(raw);
  }
  const unit = line.unit;
  if (!unit || unit === "count") return amount;
  return amount + " " + unit;
}

function lineKey(ingredientId, unit) {
  return ingredientId + "\0" + (unit || "");
}

/**
 * Reconstruct the pre-change snapshot from current open lines and unseen deltas.
 * @param {object[]} lines
 * @param {object[]} unseenDeltas newest-last
 */
export function rebuildShopSnapshotFromDeltas(lines, unseenDeltas) {
  const snap = {};
  (lines || []).forEach(function (l) {
    if (!l.still_needed) return;
    snap[lineKey(l.ingredient_id, l.unit)] = {
      quantity: l.quantity,
      list_state: l.list_state,
    };
  });
  const sorted = (unseenDeltas || [])
    .slice()
    .sort(function (a, b) {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  sorted.forEach(function (d) {
    const key = lineKey(d.ingredient_id, d.unit);
    const qty = Number(d.quantity) || 0;
    if (d.kind === "added") {
      if (!snap[key]) return;
      const cur = Number(snap[key].quantity) || 0;
      const next = cur - qty;
      if (next <= QTY_EPS) delete snap[key];
      else snap[key].quantity = next;
    } else if (d.kind === "no_longer_needed") {
      if (snap[key]) snap[key].quantity = (Number(snap[key].quantity) || 0) + qty;
      else snap[key] = { quantity: qty, list_state: "open" };
    }
  });
  return snap;
}

/**
 * @param {object} line
 * @param {{
 *   tagsVisible: boolean,
 *   snapshot: Record<string, { quantity: unknown, list_state?: string }>,
 *   unseenDeltas: object[],
 *   formatQty?: (line: object) => string,
 * }} ctx
 */
export function shopLineChangeMeta(line, ctx) {
  const formatQty = ctx.formatQty || formatShopQty;
  if (!ctx.tagsVisible || !line || !line.still_needed) return null;
  const key = lineKey(line.ingredient_id, line.unit);
  const deltas = (ctx.unseenDeltas || []).filter(function (d) {
    return lineKey(d.ingredient_id, d.unit) === key;
  });
  const snap = ctx.snapshot[key];
  const newQty = Number(line.quantity) || 0;
  const oldQty = snap ? Number(snap.quantity) || 0 : null;
  const wasOnSnapshot = snap != null;
  const addedDeltas = deltas.filter(function (d) {
    return d.kind === "added";
  });

  if (!wasOnSnapshot && addedDeltas.length) {
    return { tag: "Added", tagClass: "badge--accent badge--sm", qtyLine: null };
  }

  if (wasOnSnapshot && oldQty != null && newQty > oldQty + QTY_EPS) {
    if (line.list_state === "purchased" || line.list_state === "already_have") {
      const extra = newQty - oldQty;
      const extraLabel = extra ? formatQty({ quantity: extra, unit: line.unit }) : "more";
      return {
        tag: extra ? "Get " + extraLabel + " more" : "Get more",
        tagClass: "badge--warning badge--sm",
        qtyLine:
          formatQty(line) +
          " now · you have " +
          formatQty({ quantity: snap.quantity, unit: line.unit }),
      };
    }
    return {
      tag: "More needed",
      tagClass: "badge--sm",
      qtyLine: formatQty(line) + " now · was " + formatQty({ quantity: snap.quantity, unit: line.unit }),
    };
  }

  if (line.surplus_quantity > 0 && newQty > QTY_EPS) {
    const was = newQty + Number(line.surplus_quantity);
    return {
      tag: "Less needed",
      tagClass: "badge--sm",
      qtyLine: formatQty(line) + " now · was " + formatQty({ quantity: was, unit: line.unit }),
    };
  }

  return null;
}
