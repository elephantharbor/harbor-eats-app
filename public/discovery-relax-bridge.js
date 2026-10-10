/**
 * Browser bridge for discovery relax chips (mirrors src/discovery/client-ui.js).
 */
(function (root) {
  var REMOVAL_ORDER = [
    ["explicit_quick", "time"],
    ["explicit_max_minutes", "time"],
    ["explicit_effort", "easy"],
    ["explicit_complexity", "simple"],
    ["explicit_cuisine", "cuisine"],
    ["explicit_meal_style", "style"],
    ["explicit_flavor", "flavor"],
    ["explicit_ingredient", "ingredient"],
    ["explicit_protein", "protein"],
    ["explicit_diet", "diet"],
    ["explicit_texture", "texture"],
    ["explicit_method", "method"],
    ["explicit_equipment", "equipment"],
    ["explicit_exclude_ingredient", "exclude"],
    ["explicit_different", "different"],
  ];

  function relaxRemoveChips(excluded, query) {
    var counts = excluded || {};
    var chips = [];
    var c = query.criteria || {};
    for (var i = 0; i < REMOVAL_ORDER.length; i++) {
      var code = REMOVAL_ORDER[i][0];
      var kind = REMOVAL_ORDER[i][1];
      if (!counts[code]) continue;
      if (kind === "time") {
        if (c.quick) chips.push({ label: "Under 30 min", patch: { quick: false, max_minutes: null } });
        else if (c.max_minutes != null) chips.push({ label: "Under " + c.max_minutes + " min", patch: { max_minutes: null } });
      } else if (kind === "easy") chips.push({ label: "Easy", patch: { effort_levels: [] } });
      else if (kind === "simple") chips.push({ label: "Simple ingredients", patch: { ingredient_complexities: [] } });
      else if (kind === "different") chips.push({ label: "Something different", patch: { different: false } });
      else if (kind === "cuisine" && c.cuisines && c.cuisines.length) {
        chips.push({ label: c.cuisines[0], patch: { cuisines: c.cuisines.slice(1) } });
      } else if (kind === "style" && c.meal_styles && c.meal_styles.length) {
        chips.push({ label: c.meal_styles[0], patch: { meal_styles: c.meal_styles.slice(1) } });
      } else if (kind === "flavor" && c.flavors && c.flavors.length) {
        chips.push({ label: c.flavors[0], patch: { flavors: c.flavors.slice(1) } });
      } else if (kind === "ingredient" && c.ingredients && c.ingredients.length) {
        chips.push({ label: c.ingredients[0], patch: { ingredients: c.ingredients.slice(1) } });
      } else if (kind === "protein" && c.protein_groups && c.protein_groups.length) {
        chips.push({ label: "Fish & seafood", patch: { protein_groups: [] } });
      } else if (kind === "diet" && c.diet && c.diet.length) {
        chips.push({ label: "Plant-forward", patch: { diet: [] } });
      } else if (kind === "texture" && c.textures && c.textures.length) {
        chips.push({ label: c.textures[0], patch: { textures: c.textures.slice(1) } });
      } else if (kind === "method" && c.methods && c.methods.length) {
        chips.push({ label: c.methods[0], patch: { methods: c.methods.slice(1) } });
      } else if (kind === "equipment" && c.equipment && c.equipment.length) {
        chips.push({ label: c.equipment[0], patch: { equipment: c.equipment.slice(1) } });
      } else if (kind === "exclude" && c.exclude_ingredients && c.exclude_ingredients.length) {
        chips.push({ label: "No " + c.exclude_ingredients[0], patch: { exclude_ingredients: c.exclude_ingredients.slice(1) } });
      }
      if (chips.length >= 3) break;
    }
    if (query.text && chips.length < 3) chips.push({ label: "\u201c" + query.text + "\u201d", patch: { text: null } });
    return chips.slice(0, 3);
  }

  function emptyCriteriaSummary(query) {
    var c = (query && query.criteria) || {};
    var out = [];
    if (query && query.text) out.push("\u201c" + query.text + "\u201d");
    if (c.quick) out.push("Under 30 min");
    else if (c.max_minutes != null) out.push("Under " + c.max_minutes + " min");
    if (c.effort_levels && c.effort_levels.length) out.push("Easy");
    if (c.ingredient_complexities && c.ingredient_complexities.length) out.push("Simple ingredients");
    ["cuisines", "meal_styles", "flavors", "ingredients", "textures", "methods", "equipment"].forEach(function (k) {
      (c[k] || []).forEach(function (x) {
        out.push(x);
      });
    });
    (c.exclude_ingredients || []).forEach(function (x) {
      out.push("No " + x);
    });
    if (c.protein_groups && c.protein_groups.length) out.push("Fish & seafood");
    if (c.diet && c.diet.length) out.push("Plant-forward");
    if (c.different) out.push("Something different");
    return out;
  }

  function applyRelaxChip(query, chip) {
    var base = {
      schema_version: query.schema_version,
      text: query.text,
      criteria: Object.assign({}, query.criteria),
      soft: query.soft,
      soft_provided: query.soft_provided,
      limit: query.limit,
      offset: query.offset,
    };
    var p = chip.patch || {};
    if (p.quick === false) {
      base.criteria.quick = false;
      base.criteria.max_minutes = null;
    }
    if (p.max_minutes === null) base.criteria.max_minutes = null;
    if (p.effort_levels) base.criteria.effort_levels = p.effort_levels;
    if (p.ingredient_complexities) base.criteria.ingredient_complexities = p.ingredient_complexities;
    if (p.different === false) base.criteria.different = false;
    if (p.cuisines) base.criteria.cuisines = p.cuisines;
    if (p.meal_styles) base.criteria.meal_styles = p.meal_styles;
    if (p.flavors) base.criteria.flavors = p.flavors;
    if (p.ingredients) base.criteria.ingredients = p.ingredients;
    if (p.protein_groups) base.criteria.protein_groups = p.protein_groups;
    if (p.diet) base.criteria.diet = p.diet;
    if (p.textures) base.criteria.textures = p.textures;
    if (p.methods) base.criteria.methods = p.methods;
    if (p.equipment) base.criteria.equipment = p.equipment;
    if (p.exclude_ingredients) base.criteria.exclude_ingredients = p.exclude_ingredients;
    if (Object.prototype.hasOwnProperty.call(p, "text")) base.text = p.text;
    return base;
  }

  root.FlavorWeaveDiscoveryRelax = {
    relaxRemoveChips: relaxRemoveChips,
    applyRelaxChip: applyRelaxChip,
    emptyCriteriaSummary: emptyCriteriaSummary,
  };
})(typeof window !== "undefined" ? window : globalThis);
