/**
 * FlavorWeave meal imagery — recipe-specific photography bundled under /images/meals/.
 * Keyed by catalog recipe_slug; titles are a fallback for shared plans that omit the slug.
 * Unknown meals return null so callers render the quiet placeholder instead of a gradient hero.
 */
(function () {
  var CATALOG = {
    "crispy-chipotle-tofu-tacos": "Crispy Chipotle Tofu Tacos",
    "miso-ginger-salmon": "Miso-Ginger Salmon",
    "coconut-chickpea-curry": "Coconut Chickpea Spinach Curry",
    "cashew-pesto-pasta": "Cashew Pesto Pasta",
    "teriyaki-tofu-bowls": "Teriyaki Tofu Bowls",
    "lemon-garlic-shrimp-pasta": "Lemon Garlic Shrimp Pasta",
    "black-bean-quesadillas": "Black Bean Quesadillas",
    "sheet-pan-lemon-herb-chicken": "Sheet-Pan Lemon Herb Chicken",
    "smoky-lentil-sweet-potato-stew": "Smoky Lentil Sweet Potato Stew",
    "ginger-scallion-fish-packets": "Ginger Scallion Fish Packets",
    "roasted-cauliflower-shawarma-plate": "Roasted Cauliflower Shawarma Plate",
    "sesame-soba-noodle-bowl": "Sesame Soba Noodle Bowl",
    "harissa-roasted-carrots-feta": "Harissa Roasted Carrots with Feta",
    "white-bean-kale-soup": "White Bean Kale Soup",
    "maple-mustard-glazed-salmon": "Maple Mustard Glazed Salmon",
    "mushroom-walnut-bolognese": "Mushroom Walnut Bolognese",
    "citrus-fennel-arctic-char": "Citrus Fennel Arctic Char",
    "chipotle-lime-black-bean-bowls": "Chipotle Lime Black Bean Bowls",
    "thai-basil-eggplant-stir-fry": "Thai Basil Eggplant Stir-Fry",
    "herbed-polenta-tomato-stew": "Herbed Polenta with Tomato Stew",
    "crispy-fish-tacos-cabbage-slaw": "Crispy Fish Tacos with Cabbage Slaw",
    "peanut-noodle-stir-fry": "Peanut Noodle Stir-Fry",
    "moroccan-chickpea-skillet": "Moroccan Chickpea Skillet",
    "grilled-peach-burrito-bowl": "Grilled Peach Burrito Bowl",
  };

  function normalize(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  var byTitle = {};
  Object.keys(CATALOG).forEach(function (slug) {
    byTitle[normalize(CATALOG[slug])] = slug;
  });

  /** Legacy / marketing display titles that differ from catalog names. */
  var TITLE_ALIASES = {
    "blackstone miso ginger salmon": "miso-ginger-salmon",
  };

  function titleHintsSlug(title) {
    var n = normalize(title);
    if (TITLE_ALIASES[n]) return TITLE_ALIASES[n];
    if (byTitle[n]) return byTitle[n];
    if (n.indexOf("miso") >= 0 && n.indexOf("ginger") >= 0 && n.indexOf("salmon") >= 0) {
      return "miso-ginger-salmon";
    }
    return null;
  }

  function slugFor(meal) {
    if (!meal) return null;
    var slug = meal.recipe_slug || meal.slug;
    if (!slug && meal.recipe_version_id) {
      slug = String(meal.recipe_version_id).replace(/^rv_/, "").replace(/_v\d+$/, "");
    }
    if (slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return slug;
    var title = meal.title || meal.name || meal.meal_name;
    return titleHintsSlug(title);
  }

  function imageFor(meal) {
    var slug = slugFor(meal);
    if (!slug) return null;
    var base = "/images/meals/" + slug;
    return {
      slug: slug,
      src: base + ".webp",
      srcset: base + "-640.webp 640w, " + base + ".webp 1200w",
      alt: CATALOG[slug] || slug,
    };
  }

  window.FlavorWeaveMedia = { catalog: CATALOG, slugFor: slugFor, imageFor: imageFor };
})();
