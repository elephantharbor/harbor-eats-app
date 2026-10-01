/**
 * Scale canonical recipe versions to household serving count (alpha default).
 * Keeps base servings on the version; returns scaled quantities for display/cook.
 */

const FRAC_CHAR = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
};

/**
 * @param {string|undefined} raw
 * @returns {number|null}
 */
function parseAmount(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s || /for serving/i.test(s)) return null;
  let m = s.match(/^(\d+)\s*([½¼¾⅓⅔⅛])?$/);
  if (m) {
    const whole = Number(m[1]);
    const frac = m[2] ? FRAC_CHAR[m[2]] || 0 : 0;
    return whole + frac;
  }
  m = s.match(/^([½¼¾⅓⅔⅛])$/);
  if (m) return FRAC_CHAR[m[1]] ?? null;
  m = s.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return Number(m[1]);
  m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  return null;
}

/**
 * @param {number} n
 * @param {string} [unitHint]
 */
function formatAmount(n, unitHint = "") {
  if (!Number.isFinite(n)) return String(n);
  const u = unitHint.toLowerCase();
  const roundWhole =
    /\b(each|whole|small|large|medium|clove|lime|avocado|fillet|tortilla|onion|egg)\b/.test(u) ||
    /\b(each|whole|small|large|medium)\b/.test(unitHint);
  if (roundWhole) {
    const rounded = Math.max(1, Math.round(n));
    return String(rounded);
  }
  const tspish = /\b(tsp|tbsp|teaspoon|tablespoon)\b/.test(u);
  const step = tspish ? 0.25 : 0.5;
  let v = Math.round(n / step) * step;
  if (v < step && n > 0) v = step;
  if (Math.abs(v - Math.round(v)) < 0.001) return String(Math.round(v));
  const map = [
    [0.25, "¼"],
    [0.5, "½"],
    [0.75, "¾"],
    [1 / 3, "⅓"],
    [2 / 3, "⅔"],
  ];
  const whole = Math.floor(v);
  const frac = v - whole;
  for (const [f, ch] of map) {
    if (Math.abs(frac - f) < 0.06) {
      return whole > 0 ? `${whole}${ch}` : ch;
    }
  }
  return v.toFixed(1).replace(/\.0$/, "");
}

/**
 * @param {string|undefined} quantity
 * @param {number} ratio
 * @param {string} [ingredientName]
 */
export function scaleIngredientQuantity(quantity, ratio, ingredientName = "") {
  if (!quantity || ratio === 1) return quantity;
  const q = String(quantity).trim();
  if (/for serving/i.test(q)) return q;

  const parenCount = q.match(/^(\d+)\s*\([^)]+\)\s*(.*)$/i);
  if (parenCount) {
    const scaled = Math.max(1, Math.round(Number(parenCount[1]) * ratio));
    return `${scaled} (${parenCount[2].trim()})`.trim();
  }

  const leading = q.match(/^([\d½¼¾⅓⅔⅛./\s]+)\s*(.*)$/);
  if (!leading) return q;
  const amountRaw = leading[1].trim();
  const rest = leading[2].trim();
  const base = parseAmount(amountRaw.replace(/\s+/g, " "));
  if (base == null) return q;
  const scaled = base * ratio;
  const formatted = formatAmount(scaled, `${rest} ${ingredientName}`);
  return rest ? `${formatted} ${rest}` : formatted;
}

/**
 * @param {import('./recipe-store.js').RecipeVersion} version
 * @param {number} targetServings
 */
export function scaleRecipeVersion(version, targetServings) {
  const baseServings = version.servings || 4;
  const requested = Math.max(1, Math.min(8, Number(targetServings) || baseServings));
  if (requested === baseServings) {
    return {
      ...version,
      base_servings: baseServings,
      requested_servings: requested,
      scale_factor: 1,
    };
  }
  const ratio = requested / baseServings;
  const ingredients = (version.ingredients || []).map((ing) => ({
    ...ing,
    quantity: scaleIngredientQuantity(ing.quantity, ratio, ing.name),
  }));
  return {
    ...version,
    servings: requested,
    base_servings: baseServings,
    requested_servings: requested,
    scale_factor: ratio,
    ingredients,
  };
}
