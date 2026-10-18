/**
 * Write S-08 culinary revisions. v1 and v2 files are not edited.
 * Run from the repo root: node scripts/s08-author-revisions.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assessCulinaryQuality, saltNote } from "../src/lib/culinary-quality.js";
import {
  normalizeFactoryPackage,
  normalizeLegacyAuditDraftPackage,
  normalizeLegacyPackage,
} from "../src/lib/catalog-import.js";
import { LEGACY_AUDIT_DRAFT_CONTRACT, LEGACY_CONTRACT } from "../src/lib/catalog-legacy.js";

const root = join(process.cwd(), "catalog");

function evidence() {
  return {
    structurally_validated: "s08-2026-10-18",
    culinary_reviewed: "s08-2026-10-18",
    kitchen_tested: false,
    household_rated: false,
    note: "Culinary review is a written judgment of the recipe text. It is not a kitchen test and not a household rating. Model confidence is not evidence of cooking.",
  };
}

function item(name, quantity, unit, note = null) {
  return { name, quantity, unit, note, raw: `${quantity} ${unit}` };
}

function step(n, title, body, refs) {
  return { step_number: n, title, body, ingredient_refs: refs };
}

const S = (grams, role) => saltNote(grams, role);

const revisions = [];

function add(slug, rev) {
  revisions.push({ slug, ...rev });
}

add("maple-mustard-glazed-salmon", {
  description:
    "Salmon fillets roasted with a maple-Dijon glaze until the center reaches 145 F, with asparagus roasted beside them and a lemon-dill finish.",
  prep: 15,
  cook: 15,
  heat: "Oven 425 F, then a short broil.",
  doneness:
    "Cook the salmon to 145 F in the thickest part (FDA seafood guidance: https://www.fda.gov/food/buy-store-serve-safe-food/selecting-and-serving-fresh-and-frozen-seafood-safely). The center is opaque and the fish flakes. Rest 3 minutes. A thin fillet does not need to be pulled early for carryover.",
  ingredients: [
    item("salmon fillets", 4, "count", "About 6 oz each, 1.5 lb total. Skin-on or skinless."),
    item("asparagus", 1, "lb", "Trimmed. About one bunch."),
    item("Dijon mustard", 3, "tbsp", "Store-bought. Not a dairy food in this catalog."),
    item("maple syrup", 2, "tbsp", "Maple syrup, not pancake syrup."),
    item("olive oil", 2, "tbsp", "1 tbsp for the asparagus, 1 tbsp in the glaze."),
    item("garlic", 1, "clove", "Grated."),
    item("lemon", 1, "count", "Zest in the glaze, 1 tbsp juice in the reserved glaze, the rest as wedges."),
    item("fresh dill", 2, "tbsp", "Chopped. Chives work if dill is out."),
    item("Diamond Crystal kosher salt", 8, "g", S(8, "Divided: 5 g on the salmon, 2 g on the asparagus, 1 g in the glaze.")),
    item("black pepper", 0.5, "tsp", "Divided between the salmon and the asparagus."),
  ],
  steps: [
    step(1, "Heat the oven and season", "Heat the oven to 425 F with a rack in the upper third. Pat the salmon fillets dry. Season them with 5 g of the Diamond Crystal kosher salt and most of the black pepper.", ["salmon fillets", "Diamond Crystal kosher salt", "black pepper"]),
    step(2, "Season the asparagus", "Toss the asparagus with 1 tbsp of the olive oil, 2 g of the Diamond Crystal kosher salt, and the rest of the black pepper. Do not brush the glaze onto the asparagus, because the glaze is for the salmon and would make the stalks sticky instead of roasted.", ["asparagus", "olive oil", "Diamond Crystal kosher salt", "black pepper"]),
    step(3, "Make the glaze", "Whisk the Dijon mustard, maple syrup, grated garlic, the lemon zest, the remaining 1 tbsp olive oil, and the remaining 1 g Diamond Crystal kosher salt. Set aside 2 tbsp of this glaze for the finish.", ["Dijon mustard", "maple syrup", "garlic", "lemon", "olive oil", "Diamond Crystal kosher salt"]),
    step(4, "Roast and broil", "Roast the salmon fillets and the asparagus on a sheet pan at 425 F until the thickest part of the salmon is 145 F, opaque in the center, and flakes, about 8 to 12 minutes. Broil 1 to 3 minutes, watching, until the glaze spots amber. Rest 3 minutes.", ["salmon fillets", "asparagus"]),
    step(5, "Finish", "Whisk 1 tbsp lemon juice into the reserved glaze and spoon it over the salmon. Scatter the fresh dill and serve the remaining lemon as wedges.", ["lemon", "fresh dill", "salmon fillets"]),
  ],
  meta: {
    yield: "4 servings",
    expected_flavor: "Savory maple-mustard salmon with enough salt to keep the sweetness from tasting flat, lemon and dill at the end, and asparagus that roasts instead of steaming.",
    dietary: "Still finfish only. Dairy-free. No new allergen. HH001 may eat finfish; eligibility booleans are unchanged.",
    safety: "Default doneness is 145 F internal per FDA. No lower pull temperature is given.",
    shopping: "New lines are olive oil, garlic, lemon, dill, salt, and pepper. Quantities are numbers with units and scale by servings.",
    uncertainties: "Broil time depends on the oven. Dill versus chives is a cook's choice of one herb, not a stack of garnishes.",
    image_impact: "Regen. The current hero was audited as having no lemon and no herbs. Dill and lemon wedges will show.",
  },
});

add("cashew-pesto-pasta", {
  description:
    "Dairy-free basil pesto with toasted cashews, olive oil, lemon, and nutritional yeast, tossed with pasta boiled in salted water.",
  prep: 15,
  cook: 15,
  heat: "Stovetop.",
  doneness: "Pasta al dente. Pesto thick and glossy on the noodles, not watery.",
  ingredients: [
    item("short pasta", 12, "oz", "Durum wheat, such as penne or fusilli."),
    item("raw cashews", 0.5, "cup", "Toasted. Reserve 2 tbsp chopped for the top. This dish contains cashews and is not nut-safe."),
    item("basil", 3, "cup", "Packed leaves, about 85 g. Added at the end of blending."),
    item("garlic", 2, "clove", null),
    item("lemon", 1, "count", "Zest, plus 3 tbsp juice."),
    item("extra-virgin olive oil", 0.25, "cup", "3 tbsp in the pesto, 1 tsp on the tomatoes, the rest as a finish."),
    item("nutritional yeast", 0.25, "cup", "Savory stand-in for cheese. Not dairy."),
    item("Diamond Crystal kosher salt", 31, "g", S(31, "Divided: 28 g in 3 qt pasta water (about 1% by weight), 2.5 g in the pesto, 0.5 g on the tomatoes.")),
    item("black pepper", 0.25, "tsp", "In the pesto."),
    item("cherry tomatoes", 1, "cup", "Halved."),
    item("water", 3, "qt", "For boiling the pasta. Up to 2 tbsp more only if the pesto will not blend."),
  ],
  steps: [
    step(1, "Toast the cashews", "Toast the raw cashews in a dry skillet over medium heat until golden, 4 to 5 minutes. Reserve 2 tbsp, chopped, for the top.", ["raw cashews"]),
    step(2, "Blend the pesto", "Blend the remaining cashews with the garlic, lemon zest, 2 tbsp lemon juice, nutritional yeast, 2.5 g of the Diamond Crystal kosher salt, 3 tbsp extra-virgin olive oil, and the black pepper until thick. Add the basil and pulse until green and still a little coarse. Taste the pesto, which is meant to be eaten without further cooking, and add the remaining lemon juice if it tastes dull. No cheese: this pesto is dairy-free, and nutritional yeast plus salt replace the savoriness cheese would have brought.", ["raw cashews", "garlic", "lemon", "nutritional yeast", "Diamond Crystal kosher salt", "extra-virgin olive oil", "black pepper", "basil"]),
    step(3, "Boil the pasta", "Bring the water to a boil with 28 g of the Diamond Crystal kosher salt (about 1% by weight, 28 g per 3 qt). Boil the short pasta until al dente. Reserve 1 cup of the salted pasta water, then drain.", ["water", "Diamond Crystal kosher salt", "short pasta"]),
    step(4, "Season the tomatoes", "Toss the cherry tomatoes with 1 tsp of the extra-virgin olive oil and the remaining 0.5 g Diamond Crystal kosher salt.", ["cherry tomatoes", "extra-virgin olive oil", "Diamond Crystal kosher salt"]),
    step(5, "Toss and finish", "Off the heat, toss the pasta with the pesto and 1/4 to 1/2 cup of the salted pasta water until the sauce looks glossy. Taste a noodle and add salt or lemon only if that bite needs it. Finish with the rest of the olive oil, the toasted cashews, and a few basil leaves.", ["short pasta", "cherry tomatoes", "raw cashews", "basil", "lemon", "extra-virgin olive oil"]),
  ],
  meta: {
    yield: "4 servings",
    expected_flavor: "Basil-forward pesto that coats pasta, with salt in the noodle and the sauce, olive oil to carry the herbs, and lemon at the end. Cashews are toasted instead of soaked.",
    dietary: "Still plant-based and dairy-free. Allergens remain cashew, nuts, and wheat. Not nut-safe. No miso, so no new soy allergen.",
    safety: "No raw animal food. Garlic and nuts are eaten as pesto, which is the dish.",
    shopping: "Olive oil, a whole lemon, more basil, and a weighed salt line replace the unsalted boil and the oil-free blend. Salt scales by servings; the 3 qt water is the 4-serving pot.",
    uncertainties: "Cashew toast color and basil bruising vary. The 1% pasta-water target is a ratio, and most of that salt stays in the pot.",
    time_note: "Cashews are toasted 4 to 5 minutes, not soaked. Prep is 15 minutes and cook is 15. Heat the pasta water while the pesto is blended.",
    image_impact: "Regen recommended. Toasted cashews, a greener pesto, and an oil sheen will not match a pale oil-free photo.",
  },
});

add("chipotle-lime-black-bean-bowls", {
  description: "Chipotle-lime black beans over quinoa with corn, salted in each component and finished with lime.",
  prep: 10,
  cook: 20,
  heat: "Stovetop.",
  doneness: "Quinoa tender with a white ring. Beans hot and coated, not soupy.",
  ingredients: [
    item("quinoa", 0.67, "cup", "Dry, rinsed. Cooks to about 2 cups."),
    item("water", 1.33, "cup", "For the quinoa."),
    item("black beans", 2, "can", "15 oz cans, drained and rinsed."),
    item("chipotle in adobo", 1, "tsp", "Minced chipotle, plus 1 tbsp adobo sauce from the same can."),
    item("lime", 2, "count", "Juice of 1 in the beans. The second lime is wedges."),
    item("corn", 1, "cup", "Kernels, canned and drained or frozen and thawed."),
    item("neutral oil", 1, "tbsp", "In the beans so the chipotle coats instead of steaming."),
    item("ground cumin", 1, "tsp", "Bloomed with the beans."),
    item("Diamond Crystal kosher salt", 6, "g", S(6, "Divided: 2 g in the quinoa water (about 0.6% of 1.33 cups, and that water is absorbed), 3 g in the beans, 1 g on the corn.")),
  ],
  steps: [
    step(1, "Cook the quinoa", "Rinse the quinoa. Simmer it covered in the water with 2 g of the Diamond Crystal kosher salt, about 15 minutes, until the grains are tender and the water is absorbed (about 0.6% salt, because that water stays in the grain). Rest covered 5 minutes, then fluff.", ["quinoa", "water", "Diamond Crystal kosher salt"]),
    step(2, "Simmer the beans", "Warm the neutral oil, stir in the ground cumin and the chipotle in adobo for 30 seconds, then add the black beans, 3 g Diamond Crystal kosher salt, and the juice of 1 lime. Simmer 10 minutes, until the beans are hot and coated. Taste a bean, which is fully cooked, and add a pinch more salt only if the chipotle still tastes flat. Cut the second lime into wedges.", ["neutral oil", "ground cumin", "chipotle in adobo", "black beans", "Diamond Crystal kosher salt", "lime"]),
    step(3, "Assemble", "Toss the corn with the remaining 1 g Diamond Crystal kosher salt. Layer quinoa, beans, and corn. Add the lime wedges.", ["corn", "Diamond Crystal kosher salt", "quinoa", "black beans", "lime"]),
  ],
  meta: {
    yield: "4 servings",
    expected_flavor: "The same bowl, with salt in the quinoa, the beans, and the corn, and cumin bloomed in a little oil so the chipotle tastes savory.",
    dietary: "Allergens unchanged. Chipotle in adobo is still not contracted as plant-based. hh001_eligible stays false for that reason.",
    safety: "No raw protein.",
    shopping: "Oil, cumin, and weighed salt are new grocery lines. Cans and lime stay.",
    uncertainties: "Adobo salt varies by brand. The taste step is on the cooked beans.",
    image_impact: "No regen required. No new colorful garnish. Oil and cumin are not a new plated component.",
  },
});

add("ginger-scallion-fish-packets", {
  description: "White fish and bok choy steamed in foil with ginger, scallion, and soy, with rice salted in the pot, served with the packet juices.",
  prep: 15,
  cook: 20,
  heat: "Oven 400 F, and a saucepan for the rice.",
  doneness: "Fish flakes and is opaque in the center at 145 F. Bok choy is tender. FDA seafood temperature is 145 F.",
  ingredients: [
    item("long-grain white rice", 2, "cup", "Dry."),
    item("water", 3, "cup", "For the rice. It is absorbed."),
    item("water for packets", 2, "tbsp", "About 1/2 tbsp in each packet."),
    item("white fish fillets", 4, "count", "About 6 oz each, 1.5 lb total."),
    item("bok choy", 2, "head", "Halved."),
    item("ginger", 2, "tbsp", "Thin matchsticks or grated."),
    item("scallions", 4, "count", "Sliced."),
    item("soy sauce", 2, "tbsp", "Regular soy sauce. Wheat and soy."),
    item("Diamond Crystal kosher salt", 4, "g", S(4, "All of it goes in the rice water. The fish is seasoned by the soy sauce. 4 g in 3 cups is about 0.5% because the water is absorbed, not a 1% pasta pot.")),
  ],
  steps: [
    step(1, "Start the rice", "Rinse the long-grain white rice. Combine it with the water and the Diamond Crystal kosher salt. Bring to a boil, cover, and simmer 18 minutes, until the rice is tender and the water is absorbed. The 4 g is about 0.5% of the 3 cups because that water stays in the rice.", ["long-grain white rice", "water", "Diamond Crystal kosher salt"]),
    step(2, "Pack the packets", "Heat the oven to 400 F. On each of 4 foil sheets put 1 white fish fillet and half a head of bok choy. Divide the ginger, scallions, soy sauce, and the water for packets across the four packets. Seal the foil.", ["white fish fillets", "bok choy", "ginger", "scallions", "soy sauce", "water for packets"]),
    step(3, "Bake", "Bake at 400 F for 18 to 20 minutes, until the fish flakes, is opaque in the center, and reads 145 F, and the bok choy is tender.", ["white fish fillets", "bok choy"]),
    step(4, "Serve", "Open the foil carefully. Spoon the packet juices over the fish and the rice. Those juices are the sauce.", ["long-grain white rice", "white fish fillets", "soy sauce"]),
  ],
  meta: {
    yield: "4 servings",
    expected_flavor: "Ginger and scallion stay the aroma. Rice is seasoned. Soy still seasons the fish. The packet liquid is eaten instead of being left behind.",
    dietary: "Finfish, soy, and wheat unchanged. No new allergen.",
    safety: "Fish is cooked to 145 F.",
    shopping: "A weighed salt line for the rice. Everything else was already on the list.",
    uncertainties: "Soy brands differ in salt. The rice salt is modest because none of the cooking water is thrown out.",
    image_impact: "No regen. The plate is still fish, bok choy, rice, scallion, and ginger.",
  },
});

add("harissa-roasted-carrots-feta", {
  description: "Harissa-roasted carrots with feta, mint, lemon, and couscous cooked in salted water.",
  prep: 15,
  cook: 30,
  heat: "Oven 425 F.",
  doneness: "Carrots tender and browned at the edges. Couscous fluffy.",
  ingredients: [
    item("carrots", 2, "lb", "Whole, peeled."),
    item("harissa paste", 2, "tbsp", "Store-bought paste. Salt level varies by brand."),
    item("neutral oil", 2, "tbsp", null),
    item("feta", 4, "oz", "Crumbled."),
    item("mint", 0.25, "cup", "Torn leaves."),
    item("couscous", 1, "cup", "Dry wheat couscous."),
    item("water", 1, "cup", "Boiling, for the couscous. It is absorbed."),
    item("lemon", 1, "count", "Juice over the carrots after roasting. No plated wedge required."),
    item("Diamond Crystal kosher salt", 6, "g", S(6, "Divided: 4 g on the carrots, 2 g in the couscous water (about 0.8% of 1 cup, and the water is absorbed).")),
  ],
  steps: [
    step(1, "Roast", "Heat the oven to 425 F. Toss the carrots with the harissa paste, neutral oil, and 4 g of the Diamond Crystal kosher salt. Roast 30 minutes, until tender and browned at the edges.", ["carrots", "harissa paste", "neutral oil", "Diamond Crystal kosher salt"]),
    step(2, "Couscous", "Stir the couscous and the remaining 2 g Diamond Crystal kosher salt into the boiling water. Cover 5 minutes off the heat, then fluff. The 2 g in 1 cup is about 0.8% and the water is absorbed.", ["couscous", "Diamond Crystal kosher salt", "water"]),
    step(3, "Finish", "Squeeze the lemon over the carrots. Top with the feta and the mint. Serve over the couscous.", ["lemon", "feta", "mint", "carrots", "couscous"]),
  ],
  meta: {
    yield: "4 servings",
    expected_flavor: "Harissa sweetness backed by salt, feta, mint, and lemon. Couscous tastes seasoned instead of plain.",
    dietary: "Dairy and wheat unchanged. Lemon adds no allergen.",
    safety: "Vegetables only.",
    shopping: "Lemon and weighed salt. Feta, harissa, carrots, mint, and couscous stay.",
    uncertainties: "Harissa brands range from salty to mild. The 4 g on the carrots assumes a typical paste, not an unsalted one.",
    image_impact: "Low. Lemon is juiced, not set on the plate as a wedge. Feta and mint were already the finish.",
  },
});

add("lemon-garlic-shrimp-pasta", {
  description: "Shrimp seared with garlic in olive oil and tossed with lemon, parsley, and pasta from a salted pot.",
  prep: 15,
  cook: 15,
  heat: "Stovetop.",
  doneness: "Shrimp are pink and opaque and the thickest piece is 145 F. Pasta is al dente.",
  ingredients: [
    item("linguine", 12, "oz", null),
    item("large shrimp", 1, "lb", "Peeled and deveined."),
    item("garlic", 4, "clove", "Sliced."),
    item("lemon", 2, "count", "Zest of both, juice of 1, the second as wedges."),
    item("parsley", 0.25, "cup", "Chopped."),
    item("olive oil", 3, "tbsp", "For searing the shrimp."),
    item("Diamond Crystal kosher salt", 31, "g", S(31, "Divided: 28 g in 3 qt pasta water (about 1%), 3 g on the shrimp.")),
    item("black pepper", 0.25, "tsp", null),
    item("water", 3, "qt", "For the pasta."),
  ],
  steps: [
    step(1, "Boil the pasta", "Bring the water to a boil with 28 g of the Diamond Crystal kosher salt (about 1% by weight, 28 g per 3 qt). Boil the linguine until al dente. Reserve 1/2 cup pasta water, then drain.", ["water", "Diamond Crystal kosher salt", "linguine"]),
    step(2, "Sear the shrimp", "Pat the large shrimp dry and season with the remaining 3 g Diamond Crystal kosher salt and the black pepper. Sear them in the olive oil with the garlic over medium-high heat, about 2 minutes per side, until pink, opaque, and 145 F in the thickest piece.", ["large shrimp", "Diamond Crystal kosher salt", "black pepper", "olive oil", "garlic"]),
    step(3, "Finish", "Off the heat, toss the linguine with the shrimp, the lemon zest and juice, the parsley, and a splash of pasta water. Taste a noodle and a shrimp, both cooked, and add lemon or a pinch of salt only if the bowl needs it. Serve with the remaining lemon wedges.", ["linguine", "large shrimp", "lemon", "parsley"]),
  ],
  meta: {
    yield: "4 servings",
    expected_flavor: "Garlic, lemon, and olive oil on shrimp that were salted before they hit the pan, over pasta that was boiled in salted water.",
    dietary: "Shellfish and wheat unchanged. Dairy-free.",
    safety: "Shrimp cooked to 145 F.",
    shopping: "Salt, pepper, and a stated pasta-water volume. Oil was already listed and is now used by name.",
    uncertainties: "Shrimp size changes the minute count. Use the thermometer, not the clock, for the last minute.",
    image_impact: "No regen required. The plate is still shrimp, lemon, parsley, and pasta.",
  },
});

add("moroccan-chickpea-skillet", {
  description: "Chickpeas with ras el hanout, garlic, preserved lemon, and spinach over couscous, salted with the lemon and checked before serving.",
  prep: 10,
  cook: 15,
  heat: "Stovetop.",
  doneness: "Chickpeas glossy, spinach just wilted, couscous fluffy.",
  ingredients: [
    item("chickpeas", 2, "can", "15 oz cans, drained and rinsed, about 3 cups."),
    item("preserved lemon", 2, "tbsp", "Chopped rind only. Rinse and discard the pulp."),
    item("ras el hanout", 1, "tbsp", null),
    item("garlic", 2, "clove", "Minced."),
    item("neutral oil", 1, "tbsp", null),
    item("spinach", 3, "cup", "Packed baby spinach."),
    item("parsley", 2, "tbsp", "Chopped, for the top."),
    item("couscous", 1.5, "cup", "Dry wheat couscous."),
    item("water", 1.75, "cup", "Divided: 1.5 cups boiling for the couscous, 0.25 cup in the skillet."),
    item("Diamond Crystal kosher salt", 4, "g", S(4, "Divided: 2 g in the couscous water (about 0.5% of 1.5 cups, absorbed), and up to 2 g in the skillet after tasting.")),
  ],
  steps: [
    step(1, "Steam the couscous", "Put the couscous and 2 g of the Diamond Crystal kosher salt in a bowl. Pour over 1.5 cups boiling water. Cover 5 minutes, then fluff. The 2 g in 1.5 cups is about 0.5% and the water is absorbed.", ["couscous", "Diamond Crystal kosher salt", "water"]),
    step(2, "Spice the chickpeas", "Warm the neutral oil in a skillet over medium heat. Stir in the garlic and the ras el hanout and cook 1 minute. Add the chickpeas and 1/4 cup water. Cook 5 minutes, until the chickpeas are glossy.", ["neutral oil", "garlic", "ras el hanout", "chickpeas", "water"]),
    step(3, "Finish", "Stir in the preserved lemon and the spinach. Cook 1 to 2 minutes, until the spinach wilts. Taste a chickpea. Preserved lemon is already salty and brands vary, so add up to the remaining 2 g Diamond Crystal kosher salt only if the skillet tastes flat.", ["preserved lemon", "spinach", "chickpeas", "Diamond Crystal kosher salt"]),
    step(4, "Serve", "Serve the skillet over the couscous and top with the parsley.", ["couscous", "parsley", "chickpeas"]),
  ],
  meta: {
    yield: "4 servings",
    expected_flavor: "Ras el hanout and garlic bloomed in oil, preserved lemon as the main salt, spinach wilted in, parsley on top. The old ban on any more salt is gone because lemon brands are not equally salty.",
    dietary: "Wheat unchanged. Plant and dairy-free. Parsley and garlic add no allergen.",
    safety: "No raw protein.",
    shopping: "Garlic, parsley, and weighed salt join the existing cans, lemon, spice, spinach, and couscous.",
    uncertainties: "Preserved-lemon salt is the main unknown. The taste step exists for that reason.",
    image_impact: "Regen recommended if the hero shows a bare skillet. Chopped parsley on top is a visible change.",
  },
});

add("mushroom-walnut-bolognese", {
  description: "Mushroom and walnut sauce over spaghetti, salted as the mushrooms brown and in the pasta water.",
  prep: 15,
  cook: 30,
  heat: "Stovetop.",
  doneness: "Mushrooms deeply browned. Sauce thick. Pasta al dente.",
  ingredients: [
    item("cremini mushrooms", 1, "lb", "Cut into small cubes."),
    item("walnuts", 0.5, "cup", "Chopped."),
    item("crushed tomatoes", 28, "oz", "One can."),
    item("spaghetti", 12, "oz", null),
    item("garlic", 3, "clove", "Minced."),
    item("olive oil", 2, "tbsp", null),
    item("Diamond Crystal kosher salt", 32, "g", S(32, "Divided: 28 g in 3 qt pasta water (about 1%), 4 g on the mushrooms as they brown.")),
    item("black pepper", 0.25, "tsp", "In the sauce."),
    item("water", 3, "qt", "For the pasta."),
  ],
  steps: [
    step(1, "Brown", "Cook the cremini mushrooms and the walnuts in the olive oil with 4 g of the Diamond Crystal kosher salt until the mushrooms are deeply browned. Work in batches if the pan is crowded.", ["cremini mushrooms", "walnuts", "olive oil", "Diamond Crystal kosher salt"]),
    step(2, "Simmer and boil", "Add the garlic, crushed tomatoes, and black pepper. Simmer 20 minutes. Meanwhile bring the water to a boil with the remaining 28 g Diamond Crystal kosher salt (about 1% by weight, 28 g per 3 qt) and boil the spaghetti until al dente. Reserve 1/2 cup pasta water.", ["garlic", "crushed tomatoes", "black pepper", "water", "Diamond Crystal kosher salt", "spaghetti"]),
    step(3, "Toss", "Taste the sauce and add salt only if it still tastes flat. Toss the spaghetti with the sauce, loosening it with pasta water if it looks thick.", ["spaghetti", "cremini mushrooms"]),
  ],
  meta: {
    yield: "4 servings",
    expected_flavor: "Browned mushrooms and walnuts, tomato, garlic, and salt both in the sauce and in the pasta.",
    dietary: "Nuts, walnut, and wheat unchanged. Dairy-free and plant-based. No cheese added.",
    safety: "No raw protein.",
    shopping: "Salt is now a weighed, divided line, and the pasta pot has a volume.",
    uncertainties: "How dark the mushrooms get changes the savoriness more than another teaspoon of salt would.",
    image_impact: "No regen. The plate is still mushroom sauce on spaghetti.",
  },
});

add("roasted-cauliflower-shawarma-plate", {
  description: "Roasted shawarma-spiced cauliflower with a salted tahini-garlic sauce, cucumber, and warm pita.",
  prep: 15,
  cook: 25,
  heat: "Oven 425 F.",
  doneness: "Cauliflower charred at the edges and tender at the stem. Sauce drizzle-thin.",
  ingredients: [
    item("cauliflower", 1, "head", "Cut into florets."),
    item("neutral oil", 2, "tbsp", "For the cauliflower."),
    item("shawarma spice blend", 2, "tbsp", "Store-bought. Dairy, nuts, wheat, and sesame in the blend are not contracted."),
    item("tahini", 3, "tbsp", "Sesame paste."),
    item("lemon", 1, "count", "Juice of 1/2 in the sauce, juice of the other 1/2 on the cucumber."),
    item("water", 3, "tbsp", "To thin the tahini."),
    item("garlic", 1, "clove", "Grated, in the sauce."),
    item("cucumber", 1, "count", "Diced."),
    item("pita", 4, "count", "Warmed, not fried."),
    item("Diamond Crystal kosher salt", 7, "g", S(7, "Divided: 4 g on the cauliflower, 2 g in the tahini, 1 g on the cucumber.")),
  ],
  steps: [
    step(1, "Roast the cauliflower", "Heat the oven to 425 F. Toss the cauliflower with the neutral oil, the shawarma spice blend, and 4 g of the Diamond Crystal kosher salt. Roast 25 minutes, until the edges char and a stem is tender.", ["cauliflower", "neutral oil", "shawarma spice blend", "Diamond Crystal kosher salt"]),
    step(2, "Make the sauce", "Whisk the tahini with the grated garlic, the juice of 1/2 lemon, the water, and 2 g Diamond Crystal kosher salt until it drizzles.", ["tahini", "garlic", "lemon", "water", "Diamond Crystal kosher salt"]),
    step(3, "Warm the pita and plate", "Dice the cucumber and toss it with the remaining lemon juice and the remaining 1 g Diamond Crystal kosher salt. Warm the pita in foil for the last 3 minutes of the roast. Serve cauliflower, cucumber, sauce, and pita. Feta is not in this dish because this package does not claim a dairy-free or dairy contract for the spice blend, and feta would add a dairy allergen the recipe does not list.", ["cucumber", "lemon", "Diamond Crystal kosher salt", "pita", "cauliflower", "tahini"]),
  ],
  meta: {
    yield: "4 servings",
    expected_flavor: "Spiced roasted cauliflower, a tahini sauce that is salted and garlicky, and cucumber that is not a plain watery bite.",
    dietary: "Sesame and wheat unchanged. Dairy in the spice blend stays uncontracted. hh001_eligible stays false. No feta added.",
    safety: "No raw protein. The feta sentence is an allergen boundary, not a flavor ban.",
    shopping: "Garlic and weighed salt. Tahini, lemon, cauliflower, cucumber, and pita stay.",
    uncertainties: "Shawarma blends differ. If a blend is already very salty, the 4 g on the cauliflower is the amount to reduce at the taste of a roasted floret.",
    image_impact: "Low. Garlic is inside the sauce. The plate is still cauliflower, cucumber, tahini, and pita.",
  },
});

add("sesame-soba-noodle-bowl", {
  description: "Cold soba with sesame oil, rice vinegar, soy, and a measured salt in the dressing.",
  prep: 15,
  cook: 10,
  heat: "Stovetop.",
  doneness: "Soba tender, not mushy, rinsed cold. Dressing clinging, not pooled.",
  ingredients: [
    item("soba noodles", 12, "oz", "Wheat-and-buckwheat soba, not egg soba."),
    item("sesame oil", 2, "tbsp", null),
    item("rice vinegar", 2, "tbsp", null),
    item("soy sauce", 1, "tbsp", "Regular soy sauce. Wheat and soy."),
    item("carrot", 1, "count", "Julienned."),
    item("edamame", 1, "cup", "Shelled. Thawed if frozen."),
    item("sesame seeds", 1, "tbsp", null),
    item("Diamond Crystal kosher salt", 2, "g", S(2, "In the dressing, with the soy sauce. The boil is unsalted on purpose.")),
    item("water", 3, "qt", "Unsalted boil. The dressing seasons the noodles."),
  ],
  steps: [
    step(1, "Cook the noodles", "Boil the soba noodles in the unsalted water for 4 to 5 minutes, until tender. The water is unsalted because the soy dressing seasons the noodles, which is how this cold bowl is built, not a 1% pasta pot. Drain and rinse under cold water.", ["soba noodles", "water"]),
    step(2, "Dress", "Toss the cooled noodles with the sesame oil, rice vinegar, soy sauce, Diamond Crystal kosher salt, and the carrot. Taste a noodle and add a pinch more salt only if the soy still tastes thin.", ["sesame oil", "rice vinegar", "soy sauce", "Diamond Crystal kosher salt", "carrot", "soba noodles"]),
    step(3, "Top", "Top with the edamame and the sesame seeds.", ["edamame", "sesame seeds"]),
  ],
  meta: {
    yield: "4 servings",
    expected_flavor: "Sesame, vinegar, and soy, with a small measured salt so the noodles are not only as salty as 1 tbsp of soy.",
    dietary: "Wheat, soy, and sesame unchanged. Plant and dairy-free. HH001-eligible booleans unchanged. No peanut.",
    safety: "Noodles are boiled.",
    shopping: "A 2 g salt line. The rest of the bowl is unchanged.",
    uncertainties: "Soy salt varies. The taste step is one noodle, after cooking.",
    image_impact: "No regen. Same bowl.",
  },
});

add("sheet-pan-lemon-herb-chicken", {
  description: "Sheet-pan chicken thighs with potatoes, green beans, lemon, garlic, oregano, and thyme.",
  prep: 15,
  cook: 40,
  heat: "Oven 425 F.",
  doneness: "Chicken 165 F in the thickest part, away from the bone. Rest 5 minutes.",
  ingredients: [
    item("chicken thighs", 6, "count", "Bone-in, skin-on."),
    item("potatoes", 1, "lb", "Cubed."),
    item("green beans", 12, "oz", null),
    item("lemon", 2, "count", "One sliced with the chicken, one squeezed at the end."),
    item("dried oregano", 1, "tsp", null),
    item("dried thyme", 1, "tsp", "With the oregano, so the herb in the title is more than a dusting."),
    item("garlic", 3, "clove", "Minced."),
    item("neutral oil", 2, "tbsp", null),
    item("Diamond Crystal kosher salt", 10, "g", S(10, "Divided: 8 g on the chicken and potatoes, 2 g on the green beans.")),
    item("black pepper", 0.5, "tsp", "On the chicken and potatoes."),
  ],
  steps: [
    step(1, "Season and arrange", "Heat the oven to 425 F. Toss the chicken thighs and potatoes with the neutral oil, half the lemon, the dried oregano, dried thyme, garlic, 8 g of the Diamond Crystal kosher salt, and the black pepper.", ["chicken thighs", "potatoes", "neutral oil", "lemon", "dried oregano", "dried thyme", "garlic", "Diamond Crystal kosher salt", "black pepper"]),
    step(2, "Roast", "Roast at 425 F until the chicken reaches 165 F, 35 to 40 minutes. Add the green beans tossed with the remaining 2 g Diamond Crystal kosher salt for about the last 12 minutes.", ["chicken thighs", "green beans", "Diamond Crystal kosher salt"]),
    step(3, "Rest", "Rest 5 minutes, then squeeze the remaining lemon over the top.", ["lemon", "chicken thighs"]),
  ],
  meta: {
    yield: "4 servings, with two thighs left for a larger appetite or the next day.",
    expected_flavor: "Lemon, garlic, oregano, and thyme on salted chicken and potatoes, and green beans that are salted when they go on the pan.",
    dietary: "Poultry unchanged. No new allergen.",
    safety: "Chicken to 165 F.",
    shopping: "Thyme, garlic, and salt by weight. Six thighs, potatoes, beans, lemon, oregano, and oil stay.",
    uncertainties: "Bone-in thighs vary. The thermometer is the doneness, not the 35-minute mark.",
    image_impact: "Low. Dried herbs and minced garlic do not remake the hero. Regen only if a later photo pass wants the garlic to read.",
  },
});

add("smoky-lentil-sweet-potato-stew", {
  description: "Red lentils and sweet potato in a smoky tomato broth, with onion and garlic sweated first.",
  prep: 15,
  cook: 30,
  heat: "Stovetop.",
  doneness: "Sweet potato tender, lentils broken down, stew thick enough to hold a spoon.",
  ingredients: [
    item("red lentils", 1, "cup", "Dry, rinsed."),
    item("sweet potato", 2, "count", "About 8 oz each, cut into 3/4-inch cubes."),
    item("diced tomatoes", 1, "can", "14.5 oz, with their juice."),
    item("smoked paprika", 1, "tsp", null),
    item("vegetable broth", 4, "cup", "Salt level varies by carton."),
    item("yellow onion", 1, "count", "Diced."),
    item("garlic", 2, "clove", "Minced."),
    item("olive oil", 1, "tbsp", "To sweat the onion and bloom the paprika."),
    item("Diamond Crystal kosher salt", 4, "g", S(4, "With the onion. If the broth is already salty, start with 2 g and taste the finished stew.")),
    item("black pepper", 0.25, "tsp", null),
  ],
  steps: [
    step(1, "Sweat and bloom", "Cook the yellow onion in the olive oil with the Diamond Crystal kosher salt over medium heat until soft, about 6 minutes. Add the garlic and smoked paprika and cook 1 minute.", ["yellow onion", "olive oil", "Diamond Crystal kosher salt", "garlic", "smoked paprika"]),
    step(2, "Simmer", "Add the red lentils, sweet potato, diced tomatoes, vegetable broth, and black pepper. Simmer 25 minutes, until the sweet potato is tender and the lentils have broken down. Taste the stew and add salt only if the broth did not already season it.", ["red lentils", "sweet potato", "diced tomatoes", "vegetable broth", "black pepper"]),
    step(3, "Thicken and serve", "Mash a portion of the stew against the side of the pot until it thickens. Leave some sweet potato cubes visible.", ["sweet potato", "red lentils"]),
  ],
  meta: {
    yield: "4 servings",
    expected_flavor: "A lentil stew that tastes like onion, garlic, and smoked paprika, not only boiled lentils.",
    dietary: "Plant and dairy-free. No new allergen. Broth label is still the cook's check for unexpected wheat or soy.",
    safety: "Simmered through.",
    shopping: "Onion, garlic, olive oil, and weighed salt. Lentils, sweet potato, tomatoes, paprika, and broth stay.",
    uncertainties: "Broth sodium is the main variable. The taste step is after the simmer.",
    image_impact: "Low. The bowl still looks like lentil and sweet potato stew.",
  },
});

add("thai-basil-eggplant-stir-fry", {
  description: "Japanese eggplant stir-fried with garlic, soy, a little sugar, red pepper flakes, and Thai basil over rice.",
  prep: 15,
  cook: 25,
  heat: "Stovetop.",
  doneness: "Eggplant creamy in the center with browned edges. Basil just wilted. Rice tender.",
  ingredients: [
    item("Japanese eggplant", 4, "count", "About 1 1/4 lb. Sliced 1/2 inch thick."),
    item("Thai basil", 1, "cup", "Packed leaves."),
    item("soy sauce", 2, "tbsp", "Wheat-containing soy sauce, not fish sauce."),
    item("garlic", 3, "clove", "Minced."),
    item("neutral oil", 3, "tbsp", "2 tbsp to brown the eggplant, 1 tbsp for the garlic."),
    item("granulated sugar", 1, "tsp", "Balances the soy. Not a dessert sweetness."),
    item("red pepper flakes", 0.5, "tsp", "The heat in this Thai basil stir-fry."),
    item("jasmine rice", 1.5, "cup", "Dry."),
    item("water", 2.25, "cup", "For the rice. Absorbed."),
    item("Diamond Crystal kosher salt", 4, "g", S(4, "In the rice water, about 0.7% of 2.25 cups, absorbed. The stir-fry is seasoned by the soy sauce.")),
  ],
  steps: [
    step(1, "Cook the rice", "Rinse the jasmine rice. Bring it to a boil with the water and the Diamond Crystal kosher salt. Cover and simmer 15 minutes. Rest covered 5 minutes, then fluff. The 4 g in 2.25 cups is about 0.7% and the water is absorbed.", ["jasmine rice", "water", "Diamond Crystal kosher salt"]),
    step(2, "Brown the eggplant", "While the rice cooks, heat 2 tbsp of the neutral oil in a wide skillet over high heat. Stir-fry the Japanese eggplant in a single layer, in two batches if needed, until browned and creamy in the center, 6 to 8 minutes per batch.", ["neutral oil", "Japanese eggplant"]),
    step(3, "Season", "Add the remaining 1 tbsp neutral oil, the garlic, and the red pepper flakes. Cook 30 seconds. Add the soy sauce and the granulated sugar and toss to coat. Take the pan off the heat and stir in the Thai basil until just wilted. Taste a piece of eggplant and add a splash more soy only if it tastes flat. Fish sauce is not in this version because it would add a finfish allergen and drop the plant-based claim.", ["neutral oil", "garlic", "red pepper flakes", "soy sauce", "granulated sugar", "Thai basil", "Japanese eggplant"]),
    step(4, "Serve", "Serve the eggplant and basil over the rice.", ["Japanese eggplant", "Thai basil", "jasmine rice"]),
  ],
  meta: {
    yield: "4 servings",
    expected_flavor: "Browned eggplant, Thai basil, soy, a little sugar, and chile. Still plant-based.",
    dietary: "Soy and wheat unchanged. No fish sauce. Plant and dairy-free stay.",
    safety: "Stir-fry is cooked through.",
    shopping: "Sugar, red pepper flakes, and weighed rice salt. Eggplant, basil, soy, garlic, oil, and rice stay.",
    uncertainties: "Chile heat at 1/2 tsp flakes is moderate. A household that wants it mild can use less; that is a preference, not a second recipe.",
    image_impact: "Low to moderate. A few red flakes may show. The plate is still eggplant and basil over rice.",
  },
});

add("white-bean-kale-soup", {
  description: "White bean and kale soup with fennel, garlic, tomato, and enough salt for a pot of broth.",
  prep: 15,
  cook: 30,
  heat: "Stovetop.",
  doneness: "Fennel soft, kale tender, beans hot through.",
  ingredients: [
    item("fennel", 1, "bulb", "Sliced."),
    item("neutral oil", 1, "tbsp", null),
    item("garlic", 2, "clove", "Minced."),
    item("cannellini beans", 2, "can", "15 oz cans, drained and rinsed."),
    item("vegetable broth", 6, "cup", "Check the carton. Wheat or soy on the label would be an allergen this package does not claim."),
    item("diced tomatoes", 1, "can", "14.5 oz, with their liquid."),
    item("kale", 4, "cup", "Chopped."),
    item("Diamond Crystal kosher salt", 4, "g", S(4, "Stirred in at the end. If the broth is already salty, start with 2 g.")),
    item("black pepper", 0.25, "tsp", null),
  ],
  steps: [
    step(1, "Saute the fennel", "Cook the fennel in the neutral oil over medium heat for 5 minutes. Add the garlic and cook 1 minute.", ["fennel", "neutral oil", "garlic"]),
    step(2, "Simmer", "Add the cannellini beans, vegetable broth, and diced tomatoes. Simmer 20 minutes.", ["cannellini beans", "vegetable broth", "diced tomatoes"]),
    step(3, "Wilt the kale and season", "Stir in the kale and cook about 5 minutes, until tender. Stir in the Diamond Crystal kosher salt and the black pepper. Taste a spoonful and stop if the broth was already salty enough. Cheese, sausage, and cream are not in this soup because the package is dairy-free and plant-based, and those foods would add allergens it does not claim.", ["kale", "Diamond Crystal kosher salt", "black pepper"]),
  ],
  meta: {
    yield: "4 servings",
    expected_flavor: "Fennel and garlic up front, beans and tomato in the body, kale at the end, salt checked against the broth.",
    dietary: "Plant and dairy-free. hh001_eligible stays true on the existing booleans. Broth label is still unchecked by this package.",
    safety: "Simmered soup.",
    shopping: "Garlic and a larger, weighed salt line. The pot of beans, fennel, kale, tomato, and broth stays.",
    uncertainties: "Broth sodium. The 4 g is a start, not a promise that every carton needs all of it.",
    image_impact: "No regen. The bowl is still white beans, kale, and fennel.",
  },
});

add("black-bean-quesadillas", {
  description: "Black bean and cheese quesadillas, with the beans salted, garlicked, and finished with lime before they go in the tortilla.",
  prep: 15,
  cook: 20,
  heat: "Stovetop.",
  doneness: "Tortillas golden and the cheese melted.",
  ingredients: [
    item("black beans", 1, "can", "15 oz, drained, rinsed, and lightly mashed."),
    item("shredded cheese", 1.5, "cup", null),
    item("flour tortillas", 4, "count", "Large."),
    item("salsa", 0.5, "cup", "Store-bought, for serving."),
    item("neutral oil", 1, "tbsp", "For the skillet."),
    item("ground cumin", 1, "tsp", null),
    item("garlic", 1, "clove", "Minced, mixed into the beans."),
    item("lime", 1, "count", "Juice stirred into the beans."),
    item("Diamond Crystal kosher salt", 3, "g", S(3, "In the mashed beans. The cheese is salty too.")),
  ],
  steps: [
    step(1, "Season the beans", "Mash the black beans with the ground cumin, garlic, lime juice, and Diamond Crystal kosher salt. Taste the mash and add a pinch more salt only if it still tastes flat next to the cheese.", ["black beans", "ground cumin", "garlic", "lime", "Diamond Crystal kosher salt"]),
    step(2, "Fill and crisp", "Spread the beans and half the shredded cheese on the flour tortillas, top with the rest of the cheese, and fold. Cook in the neutral oil over medium heat 2 to 3 minutes per side, until golden.", ["black beans", "shredded cheese", "flour tortillas", "neutral oil"]),
    step(3, "Serve", "Cut into wedges and serve with the salsa.", ["salsa", "flour tortillas"]),
  ],
  meta: {
    yield: "4 quesadillas",
    expected_flavor: "The bean filling tastes like cumin, garlic, lime, and salt, and the cheese still does the melting.",
    dietary: "Dairy and wheat unchanged. Not plant-based.",
    safety: "Skillet only.",
    shopping: "Garlic, lime, and weighed salt. Beans, cheese, tortillas, salsa, oil, and cumin stay.",
    uncertainties: "Cheese salt varies. The 3 g is for the beans, not a second salting of the cheese.",
    image_impact: "No regen. Still a cheese and bean quesadilla. Lime is mixed in, not a new garnish pile.",
  },
});

function readV2(slug) {
  return JSON.parse(readFileSync(join(root, slug, "v2.json"), "utf8"));
}

function writeLegacy(slug, rev) {
  const pkg = readV2(slug);
  const id = `rv_${slug}_v3`;
  const prev = `rv_${slug}_v2`;
  pkg.dish.current_version_id = id;
  pkg.dish.description = rev.description;
  pkg.evidence = evidence();
  pkg.package_revision = "s08-culinary";
  pkg.culinary_revision = { from: prev, to: id, ...rev.meta };
  const version = pkg.recipe_version;
  version.recipe_version_id = id;
  version.version_number = 3;
  version.description = rev.description;
  version.prep_minutes = rev.prep;
  version.cook_minutes = rev.cook;
  version.total_minutes = rev.prep + rev.cook;
  version.heat = rev.heat;
  version.doneness = rev.doneness;
  version.kitchen_tested = false;
  if (rev.time_note || rev.meta?.time_note) version.time_note = rev.time_note || rev.meta.time_note;
  else if (version.time_note) {
    version.time_note_superseded = version.time_note;
    delete version.time_note;
  }
  if (Array.isArray(version.unchanged_from_v1)) {
    version.v1_v2_record = version.unchanged_from_v1;
    delete version.unchanged_from_v1;
    version.revision_note =
      "S-08 v3 revises seasoning and technique. v1.json and v2.json bytes are unchanged. v1_v2_record is what the v2 draft said had not changed from v1. It does not describe v3.";
  }
  version.steps = rev.steps;
  if (pkg.catalog_contract === LEGACY_AUDIT_DRAFT_CONTRACT) {
    version.replaces_recipe_version_id = prev;
    version.ingredients = rev.ingredients.map((row) => ({
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      note: row.note,
      preparation: null,
      role: null,
    }));
    pkg.kitchen_tested = false;
    if (pkg.certification) pkg.certification.kitchen_tested = false;
  } else if (pkg.catalog_contract === LEGACY_CONTRACT) {
    version.supersedes_version_id = prev;
    version.ingredients = rev.ingredients.map((row) => ({
      name: row.name,
      quantity: row.raw,
      note: row.note,
    }));
    pkg.projection.parsed_ingredients = rev.ingredients.map((row) => ({
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      note: row.note,
      raw_quantity: row.raw,
    }));
    if (pkg.certification) pkg.certification.kitchen_tested = false;
  } else {
    throw new Error(`unexpected contract for ${slug}`);
  }
  const path = join(root, slug, "v3.json");
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  return pkg;
}

function writeFactory(slug, mutate) {
  const pkg = JSON.parse(readFileSync(join(root, slug, "v1.json"), "utf8"));
  const id = `rv_${slug}_v2`;
  pkg.dish.current_version_id = id;
  pkg.recipe_version.recipe_version_id = id;
  pkg.recipe_version.version_number = 2;
  pkg.recipe_version.supersedes_recipe_version_id = `rv_${slug}_v1`;
  pkg.package_revision = "s08-culinary";
  pkg.recipe_version.package_revision = "s08-culinary";
  if (pkg.recipe_version.culinary_hash) delete pkg.recipe_version.culinary_hash;
  pkg.recipe_version.culinary_hash_basis =
    "S-08 removed the v1 culinary hash because the culinary text changed. catalog-import.js computes the import content hash.";
  pkg.recipe_version.immutability_note =
    "v2 supersedes v1. Culinary seasoning revision only. kitchen_tested is false. Not a household rating.";
  pkg.evidence = evidence();
  pkg.kitchen_tested = false;
  mutate(pkg);
  writeFileSync(join(root, slug, "v2.json"), `${JSON.stringify(pkg, null, 2)}\n`);
  return pkg;
}

function setSalt(pkg, grams, extra) {
  const salt = pkg.recipe_version.ingredients.find((row) => row.ingredient_id === "kosher-salt");
  if (!salt) throw new Error("no salt ingredient");
  salt.name = "Diamond Crystal kosher salt";
  salt.display_name = "Diamond Crystal kosher salt";
  salt.quantity = grams;
  salt.unit = "g";
  salt.note = `${S(grams, extra)}`;
}

const factoryMeta = {
  "steak-au-poivre-smashed-potatoes": {
    yield: "4 servings",
    expected_flavor: "Pepper-crusted steaks seasoned like steaks, potatoes boiled in a real salt ratio and smashed, and a sauce that is salted and tasted.",
    dietary: "Meat and milk unchanged.",
    safety: "The instruction is 145 F and a 3-minute rest for whole-muscle beef. A pinker center is not given as a temperature.",
    shopping: "The salt line changes from 3.5 tsp of an unnamed kosher salt to 38 g Diamond Crystal, most of it in the potato water.",
    uncertainties: "Sear time to reach 145 F depends on thickness. The thermometer decides.",
    image_impact: "No regen. Same steak, sauce, and smashed potatoes.",
  },
  "spanish-potato-tortilla": {
    yield: "4 servings",
    expected_flavor: "Potatoes and onion cooked in olive oil and salted while they are still in the pan, eggs salted separately.",
    dietary: "Egg only. Dairy-free and vegetarian. HH001 booleans unchanged.",
    safety: "Eggs are cooked until the center is just firm. No runny-egg instruction.",
    shopping: "Salt changes from 1.5 tsp unnamed kosher salt to 11 g Diamond Crystal.",
    uncertainties: "Potato thickness changes the fry. Salt is the part that was thin.",
    image_impact: "No regen. Same tortilla and parsley.",
  },
  "linguine-with-clams": {
    yield: "4 servings",
    expected_flavor: "Clams, garlic, wine, lemon, and parsley, with pasta boiled in a stated volume of salted water. The sauce stays light because the clams are briny.",
    dietary: "Shellfish and wheat unchanged. Dairy-free. Not HH001.",
    safety: "Clams must open. Discard closed ones. Seafood in the sauce is cooked.",
    shopping: "Salt changes from 1 tbsp in an unnamed pot to 38 g in 4 qt (about 1%).",
    uncertainties: "Clam liquor salt varies, which is why the sauce is tasted and not pre-salted.",
    image_impact: "No regen. Same linguine and clams.",
  },
};

function validate(slug, pkg) {
  const source = { source_path: `catalog/${slug}/vN.json`, freeze_integrity: "not_in_package", readme_declares_not_certified: true };
  let normalized;
  if (pkg.catalog_contract === LEGACY_AUDIT_DRAFT_CONTRACT) {
    normalized = normalizeLegacyAuditDraftPackage(pkg, source, { publicationStatus: "published" });
  } else if (pkg.catalog_contract === LEGACY_CONTRACT) {
    normalized = normalizeLegacyPackage(pkg, source, { publicationStatus: "published" });
  } else {
    normalized = normalizeFactoryPackage(pkg, source, { publicationStatus: "published" });
  }
  const culinary = assessCulinaryQuality(pkg);
  const problems = [];
  if (!normalized.ok) problems.push(normalized.errors);
  if (culinary.fails.length) problems.push(culinary.fails);
  if (culinary.warnings.length) problems.push(culinary.warnings);
  if (pkg.evidence?.kitchen_tested !== false) problems.push(["kitchen_tested"]);
  if (problems.length) {
    console.error(slug, JSON.stringify(problems, null, 2));
    process.exitCode = 1;
  } else {
    console.log("ok", slug, pkg.recipe_version.recipe_version_id);
  }
}

for (const rev of revisions) {
  validate(rev.slug, writeLegacy(rev.slug, rev));
}

validate(
  "steak-au-poivre-smashed-potatoes",
  writeFactory("steak-au-poivre-smashed-potatoes", (pkg) => {
    setSalt(pkg, 38, "Divided: 11 g on the steaks (about 2.8 g each), 24 g in 10 cups potato water (about 1% by weight), 2 g on the smashed potatoes, 1 g in the sauce.");
    pkg.recipe_version.doneness =
      "Whole-muscle beef steaks to 145 F in the center, then a 3-minute rest (FDA). Potatoes tender, then crisp at the edges.";
    pkg.culinary_revision = { from: "rv_steak-au-poivre-smashed-potatoes_v1", to: "rv_steak-au-poivre-smashed-potatoes_v2", ...factoryMeta["steak-au-poivre-smashed-potatoes"] };
    const bodies = {
      "Preheat and prep":
        "Turn the oven on to 450 F to preheat. Put the potatoes in a 4-quart pot with 10 cups cold water and 24 g of the Diamond Crystal kosher salt (about 1% by weight) over high heat. Crack the peppercorns coarsely. Season the steaks with 11 g of the Diamond Crystal kosher salt and press the cracked pepper into both sides. Mince the shallot and snip the chives.",
      "Boil the potatoes":
        "Bring the 10 cups of salted water to a boil and cook the potatoes until a knife slides in, about 18 minutes. Drain and let them steam dry 2 minutes.",
      Smash:
        "Spread the potatoes on the sheet pan, press each one flat to about 1/2 inch, drizzle with the olive oil, and sprinkle with 2 g of the Diamond Crystal kosher salt.",
      "Sear the steaks":
        "With 12 minutes left on the potatoes, heat the oil in the cast-iron skillet over high until smoking. Sear the steaks, turning as needed, until the center of each steak is 145 F. Move them to a plate and rest 3 minutes. A pinker center is a personal texture preference and is not the instruction in this recipe. Runs inside the potato roast (overlap stated).",
      "Make the sauce":
        "Pour off all but a thin film of fat and lower the heat to medium. Add the butter and shallot and cook 1 minute. Take the pan off the heat, add the brandy, return it to the heat, and simmer until almost gone, about 1 minute. Whisk in the cream, the Dijon, and the remaining 1 g Diamond Crystal kosher salt. Simmer until the sauce coats a spoon, 2 to 3 minutes, adding the steak juices. Taste the sauce and add salt only if it still tastes flat. Spoon it over the steaks and serve with the potatoes and chives.",
    };
    for (const step of pkg.recipe_version.steps) {
      if (bodies[step.title]) step.body = bodies[step.title];
    }
  })
);

validate(
  "spanish-potato-tortilla",
  writeFactory("spanish-potato-tortilla", (pkg) => {
    setSalt(pkg, 11, "Divided: 8 g on the potatoes and onion while they cook, 3 g in the eggs.");
    pkg.culinary_revision = { from: "rv_spanish-potato-tortilla_v1", to: "rv_spanish-potato-tortilla_v2", ...factoryMeta["spanish-potato-tortilla"] };
    const bodies = {
      "Shallow-fry the potatoes":
        "Heat the olive oil in a 10-inch skillet over medium. Add the potatoes and onion, keep them in a shallow layer of oil, and cook, turning gently, until the potatoes are tender but not browned hard, about 18 minutes. Salt them with 8 g of the Diamond Crystal kosher salt as they cook. Taste one potato, which is cooked, before it goes into the eggs, and add a pinch more salt only if it tastes flat. Drain, and reserve the oil.",
      "Set and flip":
        "Beat the eggs with the remaining 3 g Diamond Crystal kosher salt and the pepper. Fold in the potatoes and onion. Return 2 tbsp of the oil to the skillet over medium-low. Pour in the eggs and cook until the edge is set and the top is still moist, about 8 minutes. Invert onto a plate, slide it back, and cook about 4 minutes more, until the center is just firm. Scatter the parsley and cut into wedges.",
    };
    for (const step of pkg.recipe_version.steps) {
      if (bodies[step.title]) step.body = bodies[step.title];
    }
  })
);

validate(
  "linguine-with-clams",
  writeFactory("linguine-with-clams", (pkg) => {
    setSalt(pkg, 38, "For 4 qt pasta water, about 1% by weight. The clam sauce is tasted, not pre-salted, because clam liquor is already briny.");
    pkg.culinary_revision = { from: "rv_linguine-with-clams_v1", to: "rv_linguine-with-clams_v2", ...factoryMeta["linguine-with-clams"] };
    const bodies = {
      "Scrub and boil":
        "Scrub the clams. Slice the garlic, chop the parsley, and juice the lemon. Bring 4 qt of water to a boil with the Diamond Crystal kosher salt (38 g, about 1% by weight). The water should be boiling by the end of this 15-minute prep.",
      Toss:
        "Drain the pasta, reserving 1/2 cup pasta water. Toss the pasta with the clams, their liquor, the parsley, lemon juice, and pepper. Loosen with pasta water if it looks dry. Taste a noodle with a clam, both cooked, and add salt only if the brine did not already season the bowl.",
    };
    for (const step of pkg.recipe_version.steps) {
      if (bodies[step.title]) step.body = bodies[step.title];
    }
  })
);
