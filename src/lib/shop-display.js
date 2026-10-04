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
const SHOP_LINE_EPS = 1e-6;

/** @param {object} line */
export function normalizeShopLineForCompare(line) {
  if (!line) return null;
  return {
    line_id: line.line_id,
    quantity: Number(line.quantity) || 0,
    still_needed: !!line.still_needed,
    list_state: line.list_state || "open",
  };
}

function shopLineCompareKey(line) {
  if (!line || !line.ingredient_id) return null;
  return String(line.ingredient_id) + "\0" + String(line.unit || "");
}

function shopCompareMap(lines) {
  const map = new Map();
  for (const line of lines || []) {
    const key = shopLineCompareKey(line);
    const row = normalizeShopLineForCompare(line);
    if (!key || !row) continue;
    map.set(key, row);
  }
  return map;
}

/**
 * Whether shopping lines changed in a way that should surface a list toast.
 * @param {object[]} beforeLines
 * @param {object[]} afterLines
 */
export function shopListMateriallyChanged(beforeLines, afterLines) {
  const before = shopCompareMap(beforeLines);
  const after = shopCompareMap(afterLines);
  const ids = new Set([...before.keys(), ...after.keys()]);
  for (const id of ids) {
    const b = before.get(id);
    const a = after.get(id);
    if (!b || !a) return true;
    if (
      Math.abs(b.quantity - a.quantity) > SHOP_LINE_EPS ||
      b.still_needed !== a.still_needed ||
      b.list_state !== a.list_state
    ) {
      return true;
    }
  }
  return false;
}

function neededQty(row) {
  return row && row.still_needed ? row.quantity : 0;
}

/**
 * Counts for the post-shopping list-change toast from a before/after diff only.
 * @param {object[]} beforeLines
 * @param {object[]} afterLines
 */
export function shopListChangeCounts(beforeLines, afterLines) {
  const before = shopCompareMap(beforeLines);
  const after = shopCompareMap(afterLines);
  const ids = new Set([...before.keys(), ...after.keys()]);
  let added = 0;
  let removed = 0;
  for (const id of ids) {
    const b = before.get(id);
    const a = after.get(id);
    if (!b && a) {
      if (a.still_needed) added++;
      continue;
    }
    if (b && !a) {
      if (b.still_needed) removed++;
      continue;
    }
    if (!b || !a) continue;
    const bNeed = neededQty(b);
    const aNeed = neededQty(a);
    if (!b.still_needed && a.still_needed) added++;
    else if (b.still_needed && !a.still_needed) removed++;
    else if (b.still_needed && a.still_needed) {
      if (aNeed > bNeed + SHOP_LINE_EPS) added++;
      else if (bNeed > aNeed + SHOP_LINE_EPS) removed++;
    }
  }
  return { added, removed };
}

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
