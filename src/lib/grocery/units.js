/**
 * FlavorWeave unit → Instacart line_item_measurements unit.
 * Verified 2026-10-16 against
 * https://docs.instacart.com/developer_platform_api/api/units_of_measurement
 * Unsupported units are omitted. They are never rewritten as "each".
 */

export const INSTACART_UNIT_MAP = Object.freeze({
  cup: "cup",
  tbsp: "tablespoon",
  tsp: "teaspoon",
  oz: "ounce",
  lb: "pound",
  g: "gram",
  kg: "kilogram",
  ml: "milliliter",
  l: "liter",
  can: "can",
  bunch: "bunch",
  head: "head",
  package: "package",
  count: "each",
});

/** Our units that the units page does not list. Carton is a FlavorWeave unit, not a bare Instacart unit. */
export const UNMAPPED_UNITS = Object.freeze(["clove", "jar", "serving", "unparsed", "carton"]);

export function instacartUnit(unit) {
  if (!unit) return null;
  return INSTACART_UNIT_MAP[unit] || null;
}
