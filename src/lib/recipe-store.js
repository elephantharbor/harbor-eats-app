/**
 * Harbor Eats first-party meal concepts + recipe versions (alpha catalog).
 * Source of truth for structured recipes; IDs sync to D1 meal_option.recipe_version.
 */

/** @typedef {{ name: string, quantity?: string, note?: string }} RecipeIngredient */
/** @typedef {{ title: string, body: string, ingredient_refs?: string[] }} RecipeStep */

/**
 * @typedef {object} RecipeVersion
 * @property {string} recipe_version_id
 * @property {string} concept_id
 * @property {number} version_number
 * @property {number} servings
 * @property {number} prep_minutes
 * @property {number} cook_minutes
 * @property {string} effort
 * @property {string[]} methods
 * @property {string[]} dietary_tags
 * @property {RecipeIngredient[]} ingredients
 * @property {RecipeStep[]} steps
 * @property {Record<string, string>} [substitutions]
 */

/**
 * @typedef {object} MealConcept
 * @property {string} concept_id
 * @property {string} name
 * @property {string} title
 * @property {string} cuisine
 * @property {string} meal_format
 * @property {string} primary_ingredient
 * @property {string} texture
 * @property {string} flavor_profile
 * @property {string} effort_band
 * @property {boolean} weeknight
 * @property {string[]} tags
 * @property {string[]} sparks
 * @property {number} exploration
 * @property {string} plate
 * @property {string} tone
 * @property {string[]} chips
 * @property {RecipeVersion} current_version
 */

/** @param {string} slug @param {Partial<MealConcept> & { ingredients: RecipeIngredient[], steps: RecipeStep[] }} def */
function concept(slug, def) {
  const prep = def.prep_minutes ?? 15;
  const cook = def.cook_minutes ?? 25;
  const versionId = `rv_${slug}_v1`;
  /** @type {MealConcept} */
  const row = {
    concept_id: slug,
    name: def.name,
    title: def.title || def.name,
    cuisine: def.cuisine || "american",
    meal_format: def.meal_format || "plate",
    primary_ingredient: def.primary_ingredient || "mixed",
    texture: def.texture || "mixed",
    flavor_profile: def.flavor_profile || "savory",
    effort_band: def.effort_band || "easy",
    weeknight: def.weeknight !== false,
    tags: def.tags || [],
    sparks: def.sparks || [],
    exploration: def.exploration ?? 0.4,
    plate: def.plate || "🍽️",
    tone: def.tone || "tone-a",
    chips: def.chips || [],
    current_version: {
      recipe_version_id: versionId,
      concept_id: slug,
      version_number: 1,
      servings: def.servings ?? 4,
      prep_minutes: prep,
      cook_minutes: cook,
      effort: def.effort || "Easy",
      methods: def.methods || ["stovetop"],
      dietary_tags: def.dietary_tags || def.tags || [],
      ingredients: def.ingredients,
      steps: def.steps,
      substitutions: def.substitutions,
    },
  };
  return row;
}

/** @type {MealConcept[]} */
export const MEAL_CONCEPTS = [
  concept("crispy-chipotle-tofu-tacos", {
    name: "Crispy Chipotle Tofu Tacos",
    cuisine: "mexican",
    meal_format: "tacos",
    primary_ingredient: "tofu",
    texture: "crispy",
    flavor_profile: "smoky-bright",
    tags: ["plant", "tacos", "crispy", "dairy-free"],
    sparks: ["crispy", "tacos", "bright"],
    exploration: 0.35,
    cook_minutes: 25,
    prep_minutes: 15,
    plate: "🌮",
    tone: "tone-a",
    chips: ["Plant", "40 min", "Air fry"],
    methods: ["air_fry", "stovetop"],
    ingredients: [
      { name: "extra-firm tofu", quantity: "14 oz" },
      { name: "neutral oil", quantity: "1 tbsp" },
      { name: "cornstarch", quantity: "1 tbsp" },
      { name: "chipotle powder", quantity: "1 tsp" },
      { name: "smoked paprika", quantity: "1 tsp" },
      { name: "ground cumin", quantity: "½ tsp" },
      { name: "garlic powder", quantity: "½ tsp" },
      { name: "green cabbage", quantity: "3 cups shredded" },
      { name: "carrot", quantity: "½ cup grated" },
      { name: "cilantro", quantity: "¼ cup" },
      { name: "lime", quantity: "2" },
      { name: "corn tortillas", quantity: "8 small" },
      { name: "avocado", quantity: "1" },
    ],
    steps: [
      {
        title: "Press & season tofu",
        body: "Press tofu 10–15 min, cube into ¾-inch pieces, and pat dry. Toss with oil, cornstarch, chipotle, paprika, cumin, garlic powder, salt, and pepper until coated.",
        ingredient_refs: ["extra-firm tofu", "neutral oil", "cornstarch", "chipotle powder"],
      },
      {
        title: "Crisp the tofu",
        body: "Air fry at 400°F for 14–18 minutes, shaking halfway, until deep golden. Skillet option: medium-high 8–10 min, turning. Finish with juice of ½ lime.",
        ingredient_refs: ["extra-firm tofu", "lime"],
      },
      {
        title: "Make lime slaw",
        body: "Toss cabbage, carrot, cilantro, juice of 1 lime, a drizzle of oil, salt, and pepper. Rest 5 minutes.",
        ingredient_refs: ["green cabbage", "carrot", "cilantro", "lime"],
      },
      {
        title: "Warm tortillas & build",
        body: "Warm tortillas in a dry skillet 20–30 sec per side. Build tacos with tofu, slaw, and avocado. Serve with lime wedges.",
        ingredient_refs: ["corn tortillas", "avocado", "lime"],
      },
    ],
  }),
  concept("miso-ginger-salmon", {
    name: "Miso-Ginger Salmon",
    cuisine: "japanese",
    meal_format: "fillet",
    primary_ingredient: "salmon",
    texture: "tender",
    flavor_profile: "umami-bright",
    tags: ["fish", "finfish", "dairy-free"],
    sparks: ["fish", "bright"],
    exploration: 0.55,
    cook_minutes: 12,
    prep_minutes: 10,
    effort: "Medium",
    plate: "🐟",
    tone: "tone-b",
    chips: ["Fish", "35 min"],
    methods: ["grill", "skillet"],
    ingredients: [
      { name: "salmon fillets", quantity: "4 (5–6 oz each)" },
      { name: "white miso", quantity: "2 tbsp" },
      { name: "fresh ginger", quantity: "1 tbsp grated" },
      { name: "rice vinegar", quantity: "1 tbsp" },
      { name: "sesame oil", quantity: "1 tsp" },
      { name: "green onions", quantity: "2 sliced" },
      { name: "steamed rice", quantity: "for serving" },
    ],
    steps: [
      {
        title: "Marinate",
        body: "Whisk miso, ginger, vinegar, sesame oil, and 1 tbsp water. Coat salmon and rest 15 min (or up to 30 in fridge).",
        ingredient_refs: ["salmon fillets", "white miso", "fresh ginger"],
      },
      {
        title: "Cook salmon",
        body: "Cook skin-side down on medium-high oiled skillet or griddle 4–5 min, flip, cook 3–4 min until just opaque in center.",
        ingredient_refs: ["salmon fillets"],
      },
      {
        title: "Serve",
        body: "Top with green onions and serve over rice with extra lime if desired.",
        ingredient_refs: ["green onions", "steamed rice"],
      },
    ],
  }),
  concept("coconut-chickpea-curry", {
    name: "Coconut Chickpea Spinach Curry",
    cuisine: "indian-inspired",
    meal_format: "bowl",
    primary_ingredient: "chickpeas",
    texture: "creamy",
    flavor_profile: "warm-spiced",
    tags: ["plant", "curry", "dairy-free"],
    sparks: ["curry", "bright"],
    exploration: 0.4,
    plate: "🍛",
    tone: "tone-c",
    chips: ["Plant", "40 min"],
    ingredients: [
      { name: "canned chickpeas", quantity: "2 (15 oz), drained" },
      { name: "coconut milk", quantity: "1 can (13.5 oz)" },
      { name: "baby spinach", quantity: "4 cups" },
      { name: "yellow onion", quantity: "1 diced" },
      { name: "garlic", quantity: "3 cloves" },
      { name: "curry powder", quantity: "2 tbsp" },
      { name: "tomato paste", quantity: "1 tbsp" },
      { name: "basmati rice", quantity: "for serving" },
    ],
    steps: [
      {
        title: "Sweat aromatics",
        body: "Sauté onion in oil until soft. Add garlic and curry powder; cook 1 minute.",
        ingredient_refs: ["yellow onion", "garlic", "curry powder"],
      },
      {
        title: "Simmer curry",
        body: "Stir in tomato paste, chickpeas, coconut milk, and ½ cup water. Simmer 15 min until thickened.",
        ingredient_refs: ["canned chickpeas", "coconut milk", "tomato paste"],
      },
      {
        title: "Finish & serve",
        body: "Fold in spinach until wilted. Season and serve over rice.",
        ingredient_refs: ["baby spinach", "basmati rice"],
      },
    ],
  }),
  concept("cashew-pesto-pasta", {
    name: "Cashew Pesto Pasta",
    cuisine: "italian-inspired",
    meal_format: "pasta",
    primary_ingredient: "pasta",
    texture: "creamy",
    flavor_profile: "herbaceous",
    tags: ["plant", "pasta", "nuts", "cashew"],
    sparks: ["bright"],
    exploration: 0.5,
    cook_minutes: 15,
    prep_minutes: 10,
    plate: "🍝",
    tone: "tone-b",
    chips: ["Plant", "30 min"],
    dietary_tags: ["plant", "cashew"],
    ingredients: [
      { name: "short pasta", quantity: "12 oz" },
      { name: "raw cashews", quantity: "½ cup soaked" },
      { name: "basil", quantity: "2 cups" },
      { name: "garlic", quantity: "2 cloves" },
      { name: "lemon juice", quantity: "2 tbsp" },
      { name: "nutritional yeast", quantity: "3 tbsp" },
      { name: "cherry tomatoes", quantity: "1 cup halved" },
    ],
    steps: [
      { title: "Blend pesto", body: "Blend cashews, basil, garlic, lemon, yeast, salt, and ¼ cup water until smooth.", ingredient_refs: ["raw cashews", "basil"] },
      { title: "Cook pasta", body: "Boil pasta until al dente; reserve ½ cup pasta water.", ingredient_refs: ["short pasta"] },
      { title: "Toss & serve", body: "Toss pasta with pesto, splashes of pasta water, and tomatoes.", ingredient_refs: ["cherry tomatoes"] },
    ],
  }),
  concept("teriyaki-tofu-bowls", {
    name: "Teriyaki Tofu Bowls",
    cuisine: "japanese-inspired",
    meal_format: "bowl",
    primary_ingredient: "tofu",
    tags: ["plant", "dairy-free", "bowl"],
    sparks: ["sheet", "bright"],
    exploration: 0.42,
    plate: "🥣",
    tone: "tone-b",
    chips: ["Plant", "35 min"],
    ingredients: [
      { name: "extra-firm tofu", quantity: "14 oz" },
      { name: "soy sauce", quantity: "3 tbsp" },
      { name: "maple syrup", quantity: "2 tbsp" },
      { name: "rice vinegar", quantity: "1 tbsp" },
      { name: "broccoli florets", quantity: "3 cups" },
      { name: "jasmine rice", quantity: "2 cups cooked" },
      { name: "sesame seeds", quantity: "1 tbsp" },
    ],
    steps: [
      { title: "Bake tofu", body: "Cube tofu, toss with half the teriyaki glaze, bake at 425°F 20 min.", ingredient_refs: ["extra-firm tofu", "soy sauce"] },
      { title: "Steam broccoli", body: "Steam or roast broccoli until tender-crisp.", ingredient_refs: ["broccoli florets"] },
      { title: "Assemble bowls", body: "Serve rice, tofu, broccoli, remaining glaze, sesame.", ingredient_refs: ["jasmine rice", "sesame seeds"] },
    ],
  }),
  concept("lemon-garlic-shrimp-pasta", {
    name: "Lemon Garlic Shrimp Pasta",
    cuisine: "mediterranean",
    meal_format: "pasta",
    primary_ingredient: "shrimp",
    tags: ["shellfish", "seafood", "pasta"],
    sparks: ["bright"],
    exploration: 0.58,
    plate: "🦐",
    tone: "tone-c",
    chips: ["Shellfish", "30 min"],
    ingredients: [
      { name: "linguine", quantity: "12 oz" },
      { name: "large shrimp", quantity: "1 lb peeled" },
      { name: "garlic", quantity: "4 cloves" },
      { name: "lemon", quantity: "2" },
      { name: "parsley", quantity: "¼ cup" },
      { name: "olive oil", quantity: "3 tbsp" },
    ],
    steps: [
      { title: "Cook pasta", body: "Boil linguine; reserve water.", ingredient_refs: ["linguine"] },
      { title: "Sauté shrimp", body: "Sear shrimp with garlic in oil 2 min per side until pink.", ingredient_refs: ["large shrimp", "garlic"] },
      { title: "Finish", body: "Toss pasta, shrimp, lemon zest/juice, parsley, and splash of pasta water.", ingredient_refs: ["lemon", "parsley"] },
    ],
  }),
  concept("black-bean-quesadillas", {
    name: "Black Bean Quesadillas",
    cuisine: "mexican",
    meal_format: "handheld",
    primary_ingredient: "beans",
    tags: ["plant", "dairy", "tacos"],
    sparks: ["tacos", "sheet"],
    exploration: 0.3,
    plate: "🧀",
    tone: "tone-a",
    chips: ["Vegetarian", "25 min"],
    ingredients: [
      { name: "black beans", quantity: "1 can, mashed lightly" },
      { name: "shredded cheese", quantity: "1½ cups" },
      { name: "flour tortillas", quantity: "4 large" },
      { name: "salsa", quantity: "½ cup" },
      { name: "cumin", quantity: "1 tsp" },
    ],
    steps: [
      { title: "Fill", body: "Mix beans, cumin, half the cheese. Spread on tortillas, top with cheese, fold.", ingredient_refs: ["black beans", "shredded cheese"] },
      { title: "Crisp", body: "Cook quesadillas in oiled skillet 2–3 min per side until golden.", ingredient_refs: ["flour tortillas"] },
      { title: "Serve", body: "Cut into wedges; serve with salsa.", ingredient_refs: ["salsa"] },
    ],
  }),
  concept("sheet-pan-lemon-herb-chicken", {
    name: "Sheet-Pan Lemon Herb Chicken",
    cuisine: "american",
    meal_format: "sheet-pan",
    primary_ingredient: "chicken",
    tags: ["poultry", "meat", "sheet-pan"],
    sparks: ["sheet", "bright"],
    exploration: 0.45,
    plate: "🍗",
    tone: "tone-a",
    chips: ["Poultry", "45 min"],
    ingredients: [
      { name: "chicken thighs", quantity: "6 bone-in" },
      { name: "potatoes", quantity: "1 lb cubed" },
      { name: "green beans", quantity: "12 oz" },
      { name: "lemon", quantity: "2" },
      { name: "dried oregano", quantity: "1 tsp" },
    ],
    steps: [
      { title: "Season & arrange", body: "Toss chicken, potatoes, beans with oil, lemon, oregano, salt, pepper on one pan.", ingredient_refs: ["chicken thighs", "potatoes"] },
      { title: "Roast", body: "Roast at 425°F 35–40 min until chicken hits 165°F.", ingredient_refs: ["chicken thighs"] },
      { title: "Rest", body: "Rest 5 min; squeeze remaining lemon over top.", ingredient_refs: ["lemon"] },
    ],
  }),
  concept("smoky-lentil-sweet-potato-stew", {
    name: "Smoky Lentil Sweet Potato Stew",
    cuisine: "american",
    meal_format: "stew",
    primary_ingredient: "lentils",
    tags: ["plant", "dairy-free", "stew"],
    sparks: ["curry", "sheet"],
    exploration: 0.38,
    plate: "🍲",
    tone: "tone-c",
    chips: ["Plant", "45 min"],
    ingredients: [
      { name: "red lentils", quantity: "1 cup" },
      { name: "sweet potato", quantity: "2 cubed" },
      { name: "diced tomatoes", quantity: "1 can" },
      { name: "smoked paprika", quantity: "1 tsp" },
      { name: "vegetable broth", quantity: "4 cups" },
    ],
    steps: [
      { title: "Simmer base", body: "Simmer lentils, sweet potato, tomatoes, paprika, and broth 25 min.", ingredient_refs: ["red lentils", "sweet potato"] },
      { title: "Mash slightly", body: "Partially mash to thicken; season.", ingredient_refs: ["diced tomatoes"] },
      { title: "Serve", body: "Serve with crusty bread if desired.", ingredient_refs: [] },
    ],
  }),
  concept("ginger-scallion-fish-packets", {
    name: "Ginger Scallion Fish Packets",
    cuisine: "chinese-inspired",
    meal_format: "packet",
    primary_ingredient: "cod",
    tags: ["fish", "finfish", "dairy-free"],
    sparks: ["fish", "bright"],
    exploration: 0.48,
    plate: "🐟",
    tone: "tone-b",
    chips: ["Fish", "30 min"],
    ingredients: [
      { name: "white fish fillets", quantity: "4" },
      { name: "ginger", quantity: "2 tbsp sliced" },
      { name: "scallions", quantity: "4 sliced" },
      { name: "soy sauce", quantity: "2 tbsp" },
      { name: "bok choy", quantity: "2 heads halved" },
    ],
    steps: [
      { title: "Pack packets", body: "Place fish and bok choy on foil; top with ginger, scallions, soy, and a splash of water.", ingredient_refs: ["white fish fillets", "bok choy"] },
      { title: "Steam bake", body: "Seal packets; bake at 400°F 18–20 min.", ingredient_refs: ["white fish fillets"] },
      { title: "Serve", body: "Open carefully; serve with rice.", ingredient_refs: [] },
    ],
  }),
  concept("roasted-cauliflower-shawarma-plate", {
    name: "Roasted Cauliflower Shawarma Plate",
    cuisine: "middle-eastern",
    meal_format: "plate",
    primary_ingredient: "cauliflower",
    tags: ["plant", "dairy-free"],
    sparks: ["crispy", "bright"],
    exploration: 0.52,
    plate: "🥙",
    tone: "tone-a",
    chips: ["Plant", "40 min"],
    ingredients: [
      { name: "cauliflower florets", quantity: "1 large head" },
      { name: "shawarma spice blend", quantity: "2 tbsp" },
      { name: "tahini", quantity: "3 tbsp" },
      { name: "cucumber", quantity: "1 diced" },
      { name: "pita", quantity: "4 rounds" },
    ],
    steps: [
      { title: "Roast cauliflower", body: "Toss cauliflower with oil and spices; roast at 425°F 25 min.", ingredient_refs: ["cauliflower florets"] },
      { title: "Make sauce", body: "Whisk tahini with lemon juice and water to drizzle.", ingredient_refs: ["tahini"] },
      { title: "Plate", body: "Serve cauliflower with cucumber, sauce, and warm pita.", ingredient_refs: ["pita", "cucumber"] },
    ],
  }),
  concept("sesame-soba-noodle-bowl", {
    name: "Sesame Soba Noodle Bowl",
    cuisine: "japanese",
    meal_format: "bowl",
    primary_ingredient: "soba",
    tags: ["plant", "dairy-free", "bowl"],
    sparks: ["bright"],
    exploration: 0.44,
    plate: "🍜",
    tone: "tone-c",
    chips: ["Plant", "25 min"],
    ingredients: [
      { name: "soba noodles", quantity: "12 oz" },
      { name: "edamame", quantity: "1 cup shelled" },
      { name: "carrot", quantity: "1 julienned" },
      { name: "sesame oil", quantity: "2 tbsp" },
      { name: "rice vinegar", quantity: "2 tbsp" },
    ],
    steps: [
      { title: "Cook noodles", body: "Boil soba; rinse cold.", ingredient_refs: ["soba noodles"] },
      { title: "Dress", body: "Toss noodles with sesame oil, vinegar, soy, and vegetables.", ingredient_refs: ["sesame oil", "carrot"] },
      { title: "Top", body: "Top with edamame and sesame seeds.", ingredient_refs: ["edamame"] },
    ],
  }),
  concept("harissa-roasted-carrots-feta", {
    name: "Harissa Roasted Carrots with Feta",
    cuisine: "north-african",
    meal_format: "side-main",
    primary_ingredient: "carrots",
    tags: ["plant", "dairy"],
    sparks: ["bright", "sheet"],
    exploration: 0.5,
    plate: "🥕",
    tone: "tone-b",
    chips: ["Vegetarian", "35 min"],
    ingredients: [
      { name: "carrots", quantity: "2 lb whole" },
      { name: "harissa paste", quantity: "2 tbsp" },
      { name: "feta", quantity: "4 oz crumbled" },
      { name: "mint", quantity: "¼ cup" },
      { name: "couscous", quantity: "for serving" },
    ],
    steps: [
      { title: "Roast", body: "Coat carrots with harissa and oil; roast 30 min at 425°F.", ingredient_refs: ["carrots", "harissa paste"] },
      { title: "Finish", body: "Top with feta and mint; serve over couscous.", ingredient_refs: ["feta", "couscous"] },
    ],
  }),
  concept("white-bean-kale-soup", {
    name: "White Bean Kale Soup",
    cuisine: "mediterranean",
    meal_format: "soup",
    primary_ingredient: "beans",
    tags: ["plant", "dairy-free"],
    sparks: ["sheet"],
    exploration: 0.32,
    plate: "🥣",
    tone: "tone-c",
    chips: ["Plant", "35 min"],
    ingredients: [
      { name: "cannellini beans", quantity: "2 cans" },
      { name: "kale", quantity: "4 cups chopped" },
      { name: "fennel", quantity: "1 bulb sliced" },
      { name: "vegetable broth", quantity: "6 cups" },
      { name: "tomatoes", quantity: "1 can diced" },
    ],
    steps: [
      { title: "Sauté fennel", body: "Soften fennel in oil 5 min.", ingredient_refs: ["fennel"] },
      { title: "Simmer", body: "Add beans, broth, tomatoes; simmer 20 min.", ingredient_refs: ["cannellini beans", "vegetable broth"] },
      { title: "Wilt kale", body: "Stir in kale until tender; season.", ingredient_refs: ["kale"] },
    ],
  }),
  concept("maple-mustard-glazed-salmon", {
    name: "Maple Mustard Glazed Salmon",
    cuisine: "american",
    meal_format: "fillet",
    primary_ingredient: "salmon",
    tags: ["fish", "finfish", "dairy-free"],
    sparks: ["fish", "sheet"],
    exploration: 0.46,
    plate: "🐟",
    tone: "tone-a",
    chips: ["Fish", "25 min"],
    ingredients: [
      { name: "salmon fillets", quantity: "4" },
      { name: "Dijon mustard", quantity: "2 tbsp" },
      { name: "maple syrup", quantity: "2 tbsp" },
      { name: "asparagus", quantity: "1 bunch" },
    ],
    steps: [
      { title: "Glaze", body: "Mix mustard and maple; brush salmon and asparagus.", ingredient_refs: ["salmon fillets", "Dijon mustard"] },
      { title: "Roast", body: "Roast at 400°F 12–15 min.", ingredient_refs: ["salmon fillets", "asparagus"] },
    ],
  }),
  concept("mushroom-walnut-bolognese", {
    name: "Mushroom Walnut Bolognese",
    cuisine: "italian-inspired",
    meal_format: "pasta",
    primary_ingredient: "mushrooms",
    tags: ["plant", "dairy-free", "pasta"],
    sparks: ["sheet"],
    exploration: 0.41,
    plate: "🍝",
    tone: "tone-b",
    chips: ["Plant", "40 min"],
    ingredients: [
      { name: "cremini mushrooms", quantity: "1 lb finely chopped" },
      { name: "walnuts", quantity: "½ cup chopped" },
      { name: "crushed tomatoes", quantity: "1 can" },
      { name: "spaghetti", quantity: "12 oz" },
      { name: "garlic", quantity: "3 cloves" },
    ],
    steps: [
      { title: "Brown mushrooms", body: "Cook mushrooms and walnuts until deeply browned.", ingredient_refs: ["cremini mushrooms", "walnuts"] },
      { title: "Simmer sauce", body: "Add garlic, tomatoes; simmer 20 min.", ingredient_refs: ["crushed tomatoes"] },
      { title: "Toss pasta", body: "Serve sauce over spaghetti.", ingredient_refs: ["spaghetti"] },
    ],
  }),
  concept("citrus-fennel-arctic-char", {
    name: "Citrus Fennel Arctic Char",
    cuisine: "scandinavian-inspired",
    meal_format: "fillet",
    primary_ingredient: "arctic char",
    tags: ["fish", "finfish", "dairy-free"],
    sparks: ["fish", "bright"],
    exploration: 0.62,
    plate: "🐟",
    tone: "tone-c",
    chips: ["Fish", "30 min"],
    ingredients: [
      { name: "arctic char fillets", quantity: "4" },
      { name: "fennel bulb", quantity: "1 sliced" },
      { name: "orange", quantity: "1 zested and juiced" },
      { name: "dill", quantity: "2 tbsp" },
    ],
    steps: [
      { title: "Roast fennel", body: "Roast fennel with orange juice 15 min at 400°F.", ingredient_refs: ["fennel bulb", "orange"] },
      { title: "Cook char", body: "Nestle char on pan; roast 10–12 min more.", ingredient_refs: ["arctic char fillets"] },
      { title: "Finish", body: "Top with dill and zest.", ingredient_refs: ["dill"] },
    ],
  }),
  concept("chipotle-lime-black-bean-bowls", {
    name: "Chipotle Lime Black Bean Bowls",
    cuisine: "mexican",
    meal_format: "bowl",
    primary_ingredient: "beans",
    tags: ["plant", "dairy-free", "bowl"],
    sparks: ["tacos", "bright"],
    exploration: 0.36,
    plate: "🥣",
    tone: "tone-a",
    chips: ["Plant", "30 min"],
    ingredients: [
      { name: "black beans", quantity: "2 cans" },
      { name: "corn", quantity: "1 cup" },
      { name: "chipotle in adobo", quantity: "1 tsp minced" },
      { name: "lime", quantity: "2" },
      { name: "quinoa", quantity: "2 cups cooked" },
    ],
    steps: [
      { title: "Warm beans", body: "Simmer beans with chipotle and lime juice.", ingredient_refs: ["black beans", "chipotle in adobo"] },
      { title: "Assemble", body: "Layer quinoa, beans, corn, and toppings.", ingredient_refs: ["quinoa", "corn"] },
    ],
  }),
  concept("thai-basil-eggplant-stir-fry", {
    name: "Thai Basil Eggplant Stir-Fry",
    cuisine: "thai-inspired",
    meal_format: "stir-fry",
    primary_ingredient: "eggplant",
    tags: ["plant", "dairy-free"],
    sparks: ["crispy", "curry"],
    exploration: 0.54,
    plate: "🍆",
    tone: "tone-b",
    chips: ["Plant", "35 min"],
    ingredients: [
      { name: "Japanese eggplant", quantity: "2 sliced" },
      { name: "Thai basil", quantity: "1 cup" },
      { name: "soy sauce", quantity: "2 tbsp" },
      { name: "garlic", quantity: "3 cloves" },
      { name: "jasmine rice", quantity: "for serving" },
    ],
    steps: [
      { title: "Stir-fry eggplant", body: "High heat with oil until browned and tender.", ingredient_refs: ["Japanese eggplant"] },
      { title: "Season", body: "Add garlic, soy, basil off heat.", ingredient_refs: ["Thai basil", "garlic"] },
      { title: "Serve", body: "Serve over rice.", ingredient_refs: ["jasmine rice"] },
    ],
  }),
  concept("herbed-polenta-tomato-stew", {
    name: "Herbed Polenta with Tomato Stew",
    cuisine: "italian-inspired",
    meal_format: "bowl",
    primary_ingredient: "polenta",
    tags: ["plant", "dairy-free"],
    sparks: ["sheet", "bright"],
    exploration: 0.43,
    plate: "🍅",
    tone: "tone-c",
    chips: ["Plant", "45 min"],
    ingredients: [
      { name: "polenta", quantity: "1 cup" },
      { name: "cherry tomatoes", quantity: "2 cups" },
      { name: "white beans", quantity: "1 can" },
      { name: "rosemary", quantity: "1 tbsp" },
      { name: "vegetable broth", quantity: "4 cups" },
    ],
    steps: [
      { title: "Cook polenta", body: "Whisk polenta into simmering broth 20 min.", ingredient_refs: ["polenta", "vegetable broth"] },
      { title: "Stew tomatoes", body: "Burst tomatoes with beans and rosemary 10 min.", ingredient_refs: ["cherry tomatoes", "white beans"] },
      { title: "Serve", body: "Spoon stew over soft polenta.", ingredient_refs: [] },
    ],
  }),
  concept("crispy-fish-tacos-cabbage-slaw", {
    name: "Crispy Fish Tacos with Cabbage Slaw",
    cuisine: "mexican",
    meal_format: "tacos",
    primary_ingredient: "cod",
    tags: ["fish", "finfish", "tacos", "dairy-free"],
    sparks: ["tacos", "crispy", "fish"],
    exploration: 0.57,
    plate: "🌮",
    tone: "tone-a",
    chips: ["Fish", "35 min"],
    ingredients: [
      { name: "cod pieces", quantity: "1 lb" },
      { name: "corn tortillas", quantity: "8" },
      { name: "cabbage slaw mix", quantity: "3 cups" },
      { name: "lime crema (dairy-free)", quantity: "½ cup" },
      { name: "cornmeal", quantity: "½ cup" },
    ],
    steps: [
      { title: "Coat fish", body: "Dredge cod in cornmeal; pan-fry until crisp.", ingredient_refs: ["cod pieces", "cornmeal"] },
      { title: "Slaw", body: "Toss slaw with lime and salt.", ingredient_refs: ["cabbage slaw mix"] },
      { title: "Build tacos", body: "Warm tortillas; fill with fish, slaw, crema.", ingredient_refs: ["corn tortillas"] },
    ],
  }),
  concept("peanut-noodle-stir-fry", {
    name: "Peanut Noodle Stir-Fry",
    cuisine: "asian-fusion",
    meal_format: "stir-fry",
    primary_ingredient: "rice noodles",
    tags: ["plant", "nuts", "peanut"],
    sparks: ["curry"],
    exploration: 0.59,
    plate: "🥜",
    tone: "tone-b",
    chips: ["Plant", "30 min"],
    ingredients: [
      { name: "rice noodles", quantity: "8 oz" },
      { name: "peanut butter", quantity: "3 tbsp" },
      { name: "soy sauce", quantity: "2 tbsp" },
      { name: "bell pepper", quantity: "2 sliced" },
      { name: "snap peas", quantity: "1 cup" },
    ],
    steps: [
      { title: "Cook noodles", body: "Soak noodles per package; drain.", ingredient_refs: ["rice noodles"] },
      { title: "Sauce", body: "Whisk peanut butter, soy, lime, and warm water.", ingredient_refs: ["peanut butter"] },
      { title: "Stir-fry", body: "Sear peppers and peas; toss with noodles and sauce.", ingredient_refs: ["bell pepper", "snap peas"] },
    ],
  }),
  concept("moroccan-chickpea-skillet", {
    name: "Moroccan Chickpea Skillet",
    cuisine: "moroccan",
    meal_format: "skillet",
    primary_ingredient: "chickpeas",
    tags: ["plant", "dairy-free"],
    sparks: ["curry", "bright"],
    exploration: 0.47,
    plate: "🍲",
    tone: "tone-c",
    chips: ["Plant", "35 min"],
    ingredients: [
      { name: "chickpeas", quantity: "2 cans" },
      { name: "preserved lemon", quantity: "2 tbsp chopped" },
      { name: "ras el hanout", quantity: "1 tbsp" },
      { name: "spinach", quantity: "3 cups" },
      { name: "couscous", quantity: "for serving" },
    ],
    steps: [
      { title: "Spice chickpeas", body: "Sauté spices; add chickpeas and splash of water.", ingredient_refs: ["chickpeas", "ras el hanout"] },
      { title: "Finish", body: "Stir in preserved lemon and spinach.", ingredient_refs: ["spinach", "preserved lemon"] },
      { title: "Serve", body: "Serve over couscous.", ingredient_refs: ["couscous"] },
    ],
  }),
  concept("grilled-peach-burrito-bowl", {
    name: "Grilled Peach Burrito Bowl",
    cuisine: "californian",
    meal_format: "bowl",
    primary_ingredient: "peaches",
    tags: ["plant", "dairy-free", "bowl"],
    sparks: ["bright"],
    exploration: 0.61,
    plate: "🍑",
    tone: "tone-a",
    chips: ["Plant", "30 min"],
    ingredients: [
      { name: "peaches", quantity: "3 sliced" },
      { name: "black beans", quantity: "1 can" },
      { name: "lime rice", quantity: "3 cups cooked" },
      { name: "pickled red onion", quantity: "½ cup" },
      { name: "cilantro", quantity: "¼ cup" },
    ],
    steps: [
      { title: "Grill peaches", body: "Grill peach slices 2 min per side.", ingredient_refs: ["peaches"] },
      { title: "Warm beans", body: "Season black beans with cumin and lime.", ingredient_refs: ["black beans"] },
      { title: "Assemble bowls", body: "Layer rice, beans, peaches, onion, cilantro.", ingredient_refs: ["lime rice"] },
    ],
  }),
];

const bySlug = new Map(MEAL_CONCEPTS.map((c) => [c.concept_id, c]));
const byVersionId = new Map(
  MEAL_CONCEPTS.map((c) => [c.current_version.recipe_version_id, c.current_version])
);

export function getConceptBySlug(slug) {
  return bySlug.get(slug) || null;
}

export function getRecipeVersion(recipe_version_id) {
  const v = byVersionId.get(recipe_version_id);
  if (v) return { ...v, concept: getConceptBySlug(v.concept_id) };
  const slug = recipe_version_id?.replace(/^rv_/, "").replace(/_v\d+$/, "");
  const conceptRow = slug ? getConceptBySlug(slug) : null;
  if (conceptRow) return { ...conceptRow.current_version, concept: conceptRow };
  return null;
}

export function getCurrentVersionIdForSlug(slug) {
  const c = getConceptBySlug(slug);
  return c ? c.current_version.recipe_version_id : null;
}

/** Catalog shape for taste model + eligibility */
export function listCatalogMeals() {
  return MEAL_CONCEPTS.map((c) => {
    const v = c.current_version;
    return {
      recipe_slug: c.concept_id,
      recipe_version_id: v.recipe_version_id,
      name: c.name,
      title: c.title,
      tags: c.tags,
      sparks: c.sparks,
      exploration: c.exploration,
      minutes: v.prep_minutes + v.cook_minutes,
      effort: v.effort,
      plate: c.plate,
      tone: c.tone,
      chips: c.chips,
      cuisine: c.cuisine,
      meal_format: c.meal_format,
      primary_ingredient: c.primary_ingredient,
      texture: c.texture,
      flavor_profile: c.flavor_profile,
      weeknight: c.weeknight,
    };
  });
}

export function catalogCoverageMetrics() {
  const meals = listCatalogMeals();
  const countBy = (key) => {
    /** @type {Record<string, number>} */
    const m = {};
    for (const row of meals) {
      const val = String(row[key] || "unknown");
      m[val] = (m[val] || 0) + 1;
    }
    return m;
  };
  return {
    total_meals: meals.length,
    cuisines: countBy("cuisine"),
    meal_formats: countBy("meal_format"),
    primary_ingredients: countBy("primary_ingredient"),
    textures: countBy("texture"),
    flavor_profiles: countBy("flavor_profile"),
    plant_based: meals.filter((m) => m.tags.includes("plant")).length,
    fish: meals.filter((m) => m.tags.includes("fish") || m.tags.includes("finfish")).length,
    weeknight: meals.filter((m) => m.weeknight).length,
    thin_cuisines: Object.entries(countBy("cuisine")).filter(([, n]) => n < 2).map(([k]) => k),
  };
}
