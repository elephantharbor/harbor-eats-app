import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatalogFromDisk } from "../src/lib/catalog-disk.js";
import { plannerEntryFromRecord, recipeShapeFromEntry } from "../src/lib/catalog-runtime.js";
import { neededLines, scaleForDiners } from "../src/lib/ingredient-identity.js";
import { presentShopQuantity } from "../src/lib/shop-display.js";
import { interpretedAmount, isCountItem, parsedQuantity, scaleIngredientQuantity, scaleRecipeVersion } from "../src/lib/recipe-scaling.js";

const root = join(process.cwd(), "catalog");
const stagingPolicy = JSON.parse(readFileSync(join(root, "staging-publication.json"), "utf8"));
const loaded = loadCatalogFromDisk(root, stagingPolicy);
const published = loaded.records.filter((record) => record.publication_status === "published" && !record.household_id);

function packageRevision(record) {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), record.source_path), "utf8"));
  return String(pkg.package_revision || "");
}

const s08 = published.filter((record) => packageRevision(record).startsWith("s08"));

const TARGETS = [1, 2, 6, 8];
const LIMIT = 0.15;

function shapeFor(record) {
  return recipeShapeFromEntry(plannerEntryFromRecord(record));
}

function leadingAmount(quantity) {
  const match = String(quantity || "").trim().match(/^([\d½⅓⅔¼¾⅛⅜./\s]+)\s*(.*)$/);
  if (!match) return null;
  const raw = match[1].trim().replace(/\s+/g, " ");
  const rest = match[2].trim();
  const unit = rest.split(/\s+/)[0] || "";
  const chars = { "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125, "⅜": 0.375 };
  let amount = null;
  let m = raw.match(/^(\d+)\s*([½⅓⅔¼¾⅛⅜])?$/);
  if (m) amount = Number(m[1]) + (m[2] ? chars[m[2]] : 0);
  else if (chars[raw] != null) amount = chars[raw];
  else if (/^\d+\/\d+$/.test(raw)) {
    const [a, b] = raw.split("/").map(Number);
    amount = a / b;
  } else if (/^\d+(?:\.\d+)?$/.test(raw)) amount = Number(raw);
  else {
    m = raw.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (m) amount = Number(m[1]) + Number(m[2]) / Number(m[3]);
  }
  if (amount == null) return null;
  return { amount, unit };
}

/**
 * The pre-fix rounder. Half-cup minimum, and count words matched inside the name.
 * Used only to count the flags Preview already found.
 */
function legacyScale(quantity, ratio, name) {
  const q = String(quantity || "").trim();
  if (!q || ratio === 1) return q;
  const leading = q.match(/^([\d½¼¾⅓⅔⅛./\s]+)\s*(.*)$/);
  if (!leading) return q;
  const parsed = leadingAmount(leading[1]);
  if (!parsed) return q;
  const scaled = parsed.amount * ratio;
  const hint = `${leading[2]} ${name}`.toLowerCase();
  const roundWhole = /\b(each|whole|small|large|medium|clove|lime|avocado|fillet|tortilla|onion|egg)\b/.test(hint);
  let text;
  if (roundWhole) {
    const rounded = Math.round(scaled);
    text = String(rounded < 1 && scaled > 0 ? 1 : Math.max(0, rounded));
  } else {
    const tspish = /\b(tsp|tbsp|teaspoon|tablespoon)\b/.test(hint);
    const step = tspish ? 0.25 : 0.5;
    let value = Math.round(scaled / step) * step;
    if (value < step && scaled > 0) value = step;
    const glyphs = [[0.25, "¼"], [0.5, "½"], [0.75, "¾"], [1 / 3, "⅓"], [2 / 3, "⅔"]];
    const whole = Math.floor(value);
    const frac = value - whole;
    const hit = glyphs.find(([glyph]) => Math.abs(frac - glyph) < 0.06);
    if (Math.abs(value - Math.round(value)) < 0.001) text = String(Math.round(value));
    else if (hit) text = whole > 0 ? `${whole}${hit[1]}` : hit[1];
    else text = value.toFixed(1).replace(/\.0$/, "");
  }
  const rest = leading[2].trim();
  return rest ? `${text} ${rest}` : text;
}

function audit(records, scale) {
  /** @type {string[]} */
  const flags = [];
  for (const record of records) {
    const version = shapeFor(record).version;
    const base = version.servings || 4;
    for (const target of TARGETS) {
      const ratio = Math.max(1, Math.min(8, target)) / base;
      for (const ingredient of version.ingredients || []) {
        const original = String(ingredient.quantity || "");
        const parsed = parsedQuantity(original);
        if (!parsed || !(parsed.amount > 0) || ratio === 1) continue;
        if (isCountItem(parsed.unit, ingredient.name) || /^\d+\s*\(/.test(original)) continue;
        const shown = scale(original, ratio, ingredient.name);
        const exact = parsed.amount * ratio;
        const got = interpretedAmount(shown, parsed.unit);
        const error = got == null ? Infinity : Math.abs(got - exact) / exact;
        if (!(error <= LIMIT)) {
          flags.push(`${record.slug}@${target} ${ingredient.name}: ${original} → ${shown} (${error === Infinity ? "unreadable" : `${Math.round(error * 100)}%`})`);
        }
      }
    }
  }
  return flags;
}

function ingredientMap(record, servings) {
  const scaled = scaleRecipeVersion(shapeFor(record).version, servings);
  return Object.fromEntries(scaled.ingredients.map((item) => [item.name, item.quantity]));
}

describe("S-08.1 kitchen scaling", () => {
  it("loads the published catalog", () => {
    expect(loaded.failures).toEqual([]);
    expect(published).toHaveLength(250);
    expect(s08.length).toBeGreaterThan(0);
  });

  it("keeps every published amount within about 15% except count items", () => {
    const flags = audit(published, scaleIngredientQuantity);
    expect(flags, flags.join("\n")).toEqual([]);
  });

  it("counts the pre-fix flags on S-08 versions", () => {
    const before = audit(s08, legacyScale);
    const after = audit(s08, scaleIngredientQuantity);
    expect(after).toEqual([]);
    // Replaying the pre-fix rounder against this 15% rule flags 216 amounts
    // on the S-08 versions. Preview's earlier pass reported 150.
    expect(before.length).toBe(216);
  });

  it("shows pesto v3 at 2 servings in kitchen amounts, and shops the same oil", () => {
    const pesto = s08.find((record) => record.slug === "cashew-pesto-pasta");
    const amounts = ingredientMap(pesto, 2);
    expect(amounts["raw cashews"]).toBe("¼ cup");
    expect(amounts["extra-virgin olive oil"]).toBe("2 tbsp");
    expect(amounts["nutritional yeast"]).toBe("2 tbsp");
    expect(amounts["basil"]).toBe("1½ cups");
    expect(amounts["short pasta"]).toBe("6 oz");
    expect(amounts["Diamond Crystal kosher salt"]).toBe("15½ g");
    expect(amounts["cherry tomatoes"]).toBe("½ cup");
    expect(amounts["black pepper"]).toBe("⅛ tsp");
    expect(amounts["garlic"]).toBe("1 clove");
    expect(amounts["lemon"]).toBe("½");

    const meal = {
      meal_id: "pesto",
      kind: "recipe",
      state: "planned",
      base_servings: 4,
      participant_ids: ["a", "b"],
      pinned_ingredients: (pesto.ingredients || []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        note: item.note,
      })),
    };
    const oil = scaleForDiners(meal.pinned_ingredients, 4, 2).find((item) => /olive oil/.test(item.name));
    expect(oil.quantity).toBe(0.125);
    expect(oil.unit).toBe("cup");
    const shop = neededLines([meal]).find((line) => /olive oil/.test(line.display_name));
    expect(shop.quantity).toBe(0.125);
    expect(shop.unit).toBe("cup");
    expect(presentShopQuantity(shop).display).toMatch(/1\/8 cup|⅛ cup/);
  });

  it("shows salmon v3 at 1, 2, and 6 servings", () => {
    const salmon = s08.find((record) => record.slug === "maple-mustard-glazed-salmon");
    const at = (servings) => ingredientMap(salmon, servings);
    expect(at(1)).toMatchObject({
      "salmon fillets": "1",
      asparagus: "¼ lb",
      "Dijon mustard": "¾ tbsp",
      "maple syrup": "½ tbsp",
      "olive oil": "½ tbsp",
      garlic: "½ clove",
      lemon: "½",
      "fresh dill": "½ tbsp",
      "Diamond Crystal kosher salt": "2 g",
      "black pepper": "⅛ tsp",
    });
    expect(at(2)).toMatchObject({
      "salmon fillets": "2",
      asparagus: "½ lb",
      "Dijon mustard": "1½ tbsp",
      "maple syrup": "1 tbsp",
      "olive oil": "1 tbsp",
      garlic: "½ clove",
      lemon: "½",
      "fresh dill": "1 tbsp",
      "Diamond Crystal kosher salt": "4 g",
      "black pepper": "¼ tsp",
    });
    expect(at(6)).toMatchObject({
      "salmon fillets": "6",
      asparagus: "1½ lb",
      "Dijon mustard": "4½ tbsp",
      "maple syrup": "3 tbsp",
      "olive oil": "3 tbsp",
      garlic: "1½ cloves",
      lemon: "1½",
      "fresh dill": "3 tbsp",
      "Diamond Crystal kosher salt": "12 g",
      "black pepper": "¾ tsp",
    });
  });
});
