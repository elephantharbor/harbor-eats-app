/**
 * FlavorWeave meal imagery — recipe-specific photography bundled under /images/meals/.
 * Titles come from generated meal-media-manifest.js (50-meal catalog). Slug and
 * recipe_version_id are the supported lookup paths; titles are fallback only.
 * Unknown meals return null so callers render the quiet placeholder.
 */
(function () {
  var CATALOG = window.FlavorWeaveMealManifest || {};

  /** Legacy / marketing display titles that differ from catalog names. */
  var TITLE_ALIASES = {
    "blackstone miso ginger salmon": "miso-ginger-salmon",
  };

  function normalize(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  var byTitle = {};
  Object.keys(CATALOG).forEach(function (slug) {
    byTitle[normalize(CATALOG[slug])] = slug;
  });

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
    var title = (meal && (meal.title || meal.name || meal.meal_name)) || CATALOG[slug] || null;
    return {
      slug: slug,
      src: base + ".webp",
      srcset: base + "-640.webp 640w, " + base + ".webp 1200w",
      alt: title || slug.replace(/-/g, " "),
    };
  }

  window.FlavorWeaveMedia = { catalog: CATALOG, slugFor: slugFor, imageFor: imageFor };
})();
