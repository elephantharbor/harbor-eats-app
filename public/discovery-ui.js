/**
 * D-07 MealDiscovery surface (Find a dinner).
 */
(function (root) {
  const LS_FIND_URL = "he_find_standalone_url";
  const CACHE_PREFIX = "he_disc_cache:";
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const SHELF_MIN_TOTAL = 4;
  const DISCOVERY_SHELVES = [
    { id: "good_matches", title: "Good matches", altTitle: "Fits your table", subtitle: "Picked from what your table likes", altSubtitle: "Every one of these works for everyone eating", query: {} },
    { id: "easy", title: "Easy", subtitle: "Short on steps, light on fuss", query: { criteria: { effort_levels: ["easy"] } } },
    { id: "quick", title: "Under 30 minutes", subtitle: "On the table in half an hour", query: { criteria: { quick: true } } },
    { id: "simple", title: "Simple ingredients", subtitle: "Familiar ingredients, nothing hard to find", query: { criteria: { ingredient_complexities: ["simple"] } } },
    { id: "seafood", title: "Fish & seafood", subtitle: "From the sea, not land meat", query: { criteria: { protein_groups: ["seafood"] } } },
    { id: "plant", title: "Plant-forward", subtitle: "Vegetarian-friendly dinners", query: { criteria: { diet: ["plant"] } } },
    { id: "different", title: "Something different", subtitle: "Ones you haven’t cooked lately", query: { criteria: { different: true } } },
  ];

  /** @type {object|null} */
  var deps = null;
  var state = {
    mode: "standalone",
    urlContext: {},
    response: null,
    shelves: {},
    loading: false,
    error: null,
    softTouched: false,
    view: "shelves",
    entry: "nav",
    scrollY: 0,
    focusSlug: null,
    forceResults: false,
    refineDraft: null,
    refinePreviewTotal: null,
    refineVocab: null,
    relaxChips: [],
  };

  const INSPIRED_CUISINES = { indian: 1, thai: 1, japanese: 1, italian: 1, chinese: 1, scandinavian: 1 };
  const DIET_OPTIONS = [
    { slug: "plant", label: "Plant-forward" },
    { slug: "vegetarian", label: "Vegetarian" },
    { slug: "dairy_free", label: "Dairy-free" },
  ];
  const PROTEIN_OPTIONS = [{ slug: "seafood", label: "Fish & seafood" }];
  const TEXTURE_OPTIONS = [
    { slug: "crispy", label: "Crispy" },
    { slug: "creamy", label: "Creamy" },
    { slug: "crunchy", label: "Crunchy" },
    { slug: "tender", label: "Tender" },
  ];

  function cuisineSendValues(slug) {
    if (INSPIRED_CUISINES[slug]) return [slug, slug + "-inspired"];
    return [slug];
  }

  function vocabularyByKind(catalog) {
    const out = { cuisines: [], meal_styles: [], flavors: [], ingredients: [] };
    const map = { cuisine: "cuisines", meal_style: "meal_styles", flavor: "flavors", ingredient: "ingredients" };
    ((catalog && catalog.groups) || []).forEach(function (group) {
      const field = map[group.kind || group.id];
      if (!field) return;
      (group.terms || []).forEach(function (term) {
        if (term.on_menu === false) return;
        out[field].push(term);
      });
    });
    return out;
  }

  function draftFromQuery(query) {
    const q = query || currentQuery();
    return {
      text: q.text,
      criteria: Object.assign(emptyCriteria(), q.criteria),
      soft: Object.assign({ keep_it_easy: false, keep_ingredients_simple: false }, q.soft || {}),
      soft_provided: q.soft_provided === true,
    };
  }

  function captureState() {
    return {
      scrollY: window.scrollY,
      focusSlug: state.focusSlug,
      path: findPathFromState(currentQuery(), urlContextForApi()),
      forceResults: state.forceResults,
      mode: state.mode,
      urlContext: Object.assign({}, state.urlContext),
    };
  }

  function restoreSession(snapshot) {
    if (!snapshot) return;
    state.forceResults = snapshot.forceResults || false;
    state.mode = snapshot.mode || state.mode;
    state.urlContext = Object.assign({}, snapshot.urlContext || {});
    state.scrollY = snapshot.scrollY || 0;
    state.focusSlug = snapshot.focusSlug || null;
    if (snapshot.path && snapshot.path.indexOf("/find") === 0) {
      history.replaceState({ find: snapshot }, "", snapshot.path);
    }
    loadMain().then(function () {
      requestAnimationFrame(function () {
        window.scrollTo(0, state.scrollY);
        if (state.focusSlug) {
          const el = document.querySelector('[data-disc-slug="' + state.focusSlug + '"] h3');
          if (el) el.focus();
        }
      });
    });
  }

  function shelfDisplayTitle(shelf, response) {
    if (shelf.id !== "good_matches") return shelf.title;
    const results = (response && response.results) || [];
    const tasteHit = results.some(function (r) {
      return r.primary_reason === "taste_love" || r.primary_reason === "taste_like";
    });
    return tasteHit ? shelf.title : shelf.altTitle;
  }

  function shelfDisplaySubtitle(shelf, response) {
    if (shelf.id !== "good_matches") return shelf.subtitle;
    const results = (response && response.results) || [];
    const tasteHit = results.some(function (r) {
      return r.primary_reason === "taste_love" || r.primary_reason === "taste_like";
    });
    return tasteHit ? shelf.subtitle : shelf.altSubtitle;
  }

  function d() {
    return deps || {};
  }

  function esc(s) {
    return d().escapeHtml ? d().escapeHtml(s) : String(s == null ? "" : s);
  }

  function track(name, props) {
    if (d().track) d().track(name, props || {});
  }

  function emptyCriteria() {
    return {
      cuisines: [],
      meal_styles: [],
      flavors: [],
      ingredients: [],
      exclude_ingredients: [],
      effort_levels: [],
      ingredient_complexities: [],
      max_minutes: null,
      methods: [],
      equipment: [],
      quick: false,
      protein_groups: [],
      diet: [],
      textures: [],
      different: false,
    };
  }

  function mergeCriteria(base, patch) {
    const out = Object.assign({}, base || emptyCriteria());
    if (!patch) return out;
    Object.keys(patch).forEach(function (k) {
      out[k] = patch[k];
    });
    return out;
  }

  function currentQuery() {
    if (state.response && state.response.query) return state.response.query;
    return {
      schema_version: 1,
      text: null,
      criteria: emptyCriteria(),
      soft: { keep_it_easy: false, keep_ingredients_simple: false },
      soft_provided: false,
      limit: 50,
      offset: 0,
    };
  }

  function urlContextForApi() {
    const c = Object.assign({ mode: state.mode }, state.urlContext || {});
    if (state.mode === "standalone") {
      delete c.dinner_plan_id;
      delete c.meal_id;
      delete c.position;
    }
    return c;
  }

  function serializeDiscoveryQuery(query, limit) {
    const params = new URLSearchParams();
    params.set("schema", "1");
    if (query.text) params.set("text", query.text);
    const c = query.criteria || emptyCriteria();
    const pairs = [
      ["cuisine", c.cuisines],
      ["style", c.meal_styles],
      ["flavor", c.flavors],
      ["ingredient", c.ingredients],
      ["exclude_ingredient", c.exclude_ingredients],
      ["effort", c.effort_levels],
      ["complexity", c.ingredient_complexities],
      ["method", c.methods],
      ["equipment", c.equipment],
      ["protein", c.protein_groups],
      ["diet", c.diet],
      ["texture", c.textures],
    ];
    pairs.forEach(function (row) {
      if (row[1] && row[1].length) params.set(row[0], row[1].join(","));
    });
    if (c.max_minutes != null) params.set("max_minutes", String(c.max_minutes));
    if (c.quick) params.set("quick", "1");
    if (c.different) params.set("different", "1");
    if (query.soft_provided) {
      params.set("keep_it_easy", query.soft.keep_it_easy ? "1" : "0");
      params.set("keep_ingredients_simple", query.soft.keep_ingredients_simple ? "1" : "0");
    }
    params.set("limit", String(limit || query.limit || 50));
    params.set("offset", "0");
    return params.toString();
  }

  function findPathFromState(query, ctx) {
    const full = serializeDiscoveryQuery(query, 50);
    const params = new URLSearchParams(full);
    params.delete("schema");
    params.delete("limit");
    params.delete("offset");
    if (ctx && ctx.mode && ctx.mode !== "standalone") params.set("mode", ctx.mode);
    if (ctx && ctx.dinner_plan_id) params.set("dinner_plan_id", ctx.dinner_plan_id);
    if (ctx && ctx.meal_id) params.set("meal_id", ctx.meal_id);
    if (ctx && ctx.position != null) params.set("position", String(ctx.position));
    (ctx && ctx.participant_ids || []).forEach(function (id) {
      params.append("participant_id", id);
    });
    const qs = params.toString();
    return qs ? "/find?" + qs : "/find";
  }

  var CRITERIA_LIST_KEYS = [
    "cuisines",
    "meal_styles",
    "flavors",
    "ingredients",
    "exclude_ingredients",
    "effort_levels",
    "ingredient_complexities",
    "methods",
    "equipment",
    "protein_groups",
    "diet",
    "textures",
  ];

  function queryHasActiveCriteria(query) {
    if (!query) return false;
    if (query.text) return true;
    const c = query.criteria || emptyCriteria();
    if (c.quick || c.different || c.max_minutes != null) return true;
    return CRITERIA_LIST_KEYS.some(function (k) {
      return c[k] && c[k].length;
    });
  }

  function buildApiUrl(query, limit) {
    const params = new URLSearchParams();
    const ctx = urlContextForApi();
    if (ctx.mode && ctx.mode !== "standalone") params.set("mode", ctx.mode);
    if (ctx.dinner_plan_id) params.set("dinner_plan_id", ctx.dinner_plan_id);
    if (ctx.meal_id) params.set("meal_id", ctx.meal_id);
    if (ctx.position != null) params.set("position", String(ctx.position));
    (ctx.participant_ids || []).forEach(function (id) {
      params.append("participant_id", id);
    });
    const qs = serializeDiscoveryQuery(query, limit);
    new URLSearchParams(qs).forEach(function (v, k) {
      params.set(k, v);
    });
    return "/api/discovery/search?" + params.toString();
  }

  function syncBrowserUrl(replace) {
    if (!d().findPathFromState) return;
    const path = d().findPathFromState(currentQuery(), urlContextForApi());
    if (state.mode === "standalone") {
      try {
        sessionStorage.setItem(LS_FIND_URL, path);
      } catch (_) { /* ignore */ }
    }
    const fn = replace ? "replaceState" : "pushState";
    history[fn]({ find: captureState() }, "", path);
  }

  function cacheKey(path) {
    return CACHE_PREFIX + path;
  }

  function readCache(path) {
    try {
      const raw = sessionStorage.getItem(cacheKey(path));
      if (!raw) return null;
      const row = JSON.parse(raw);
      if (!row || Date.now() - row.ts > CACHE_TTL_MS) return null;
      return row.payload;
    } catch (_) {
      return null;
    }
  }

  function writeCache(path, payload) {
    try {
      sessionStorage.setItem(cacheKey(path), JSON.stringify({ ts: Date.now(), payload }));
    } catch (_) { /* ignore */ }
  }

  async function fetchSearch(query, limit) {
    const url = buildApiUrl(query, limit);
    const res = await d().apiGet(url);
    if (!res || !res.ok) return { error: (res && res.error) || "network" };
    return { data: res };
  }

  function hasCriteria(q) {
    return d().queryHasActiveCriteria ? d().queryHasActiveCriteria(q) : !!(q && q.text);
  }

  async function loadMain() {
    state.loading = true;
    state.error = null;
    paint();
    const q = currentQuery();
    const limit = hasCriteria(q) ? 50 : 50;
    const res = await fetchSearch(q, limit);
    state.loading = false;
    if (res.error) {
      state.error = res.error;
      paint();
      return;
    }
    state.response = res.data;
    state.view = hasCriteria(res.data.query) || state.forceResults ? "results" : "shelves";
    if (state.view === "shelves") await loadShelves();
    syncBrowserUrl(true);
    try {
      writeCache(findPathFromState(res.data.query, urlContextForApi()), res.data);
    } catch (_) { /* ignore */ }
    paint();
    track("discovery_query_changed", {
      mode: state.mode,
      total: res.data.total,
      text_len: (res.data.query && res.data.query.text && res.data.query.text.length) || 0,
    });
    if (res.data.total === 0) {
      const kind = d().emptyStateKind
        ? d().emptyStateKind(res.data.query, res.data.total, res.data.excluded_counts)
        : "nothing_fits";
      track("discovery_empty", { kind, mode: state.mode });
    }
  }

  async function loadShelves() {
    const shelves = d().DISCOVERY_SHELVES || [];
    const min = d().SHELF_MIN_TOTAL || 4;
    const out = {};
    await Promise.all(
      shelves.map(async function (shelf) {
        const base = currentQuery();
        const merged = Object.assign({}, base, {
          limit: 10,
          offset: 0,
          criteria: mergeCriteria(base.criteria, (shelf.query && shelf.query.criteria) || {}),
        });
        if (shelf.query && shelf.query.criteria && shelf.query.criteria.quick) {
          merged.criteria.quick = true;
        }
        const res = await fetchSearch(merged, 10);
        if (res.data && res.data.total >= min) out[shelf.id] = { shelf, response: res.data };
      })
    );
    state.shelves = out;
  }

  function leanSummary(resp) {
    const soft = resp && resp.soft;
    const source = resp && resp.soft_source;
    if (!soft || (!soft.keep_it_easy && !soft.keep_ingredients_simple)) return "";
    let line = "";
    if (soft.keep_it_easy && soft.keep_ingredients_simple) line = "Easier dinners and simpler ingredients first";
    else if (soft.keep_it_easy) line = "Easier dinners first";
    else line = "Simpler ingredients first";
    const q = resp.query || {};
    if (!(q.criteria.effort_levels && q.criteria.effort_levels.indexOf("easy") >= 0) && soft.keep_it_easy) {
      /* keep */
    } else if (soft.keep_it_easy && q.criteria.effort_levels && q.criteria.effort_levels.indexOf("easy") >= 0) {
      line = line.replace("Easier dinners and ", "").replace("Easier dinners first", "");
      line = line.replace(" and simpler ingredients first", "Simpler ingredients first");
      if (!soft.keep_ingredients_simple) line = "";
    }
    if (soft.keep_ingredients_simple && q.criteria.ingredient_complexities && q.criteria.ingredient_complexities.indexOf("simple") >= 0) {
      line = line.replace(" and simpler ingredients first", "").replace("Simpler ingredients first", "");
    }
    if (!line) return "";
    if (source === "plan_intent") line += " · from your plan";
    return line;
  }

  function timeChipIsOn(criteria) {
    if (deps && deps.timeChipIsOn) return deps.timeChipIsOn(criteria);
    const c = criteria || {};
    return c.quick === true || c.max_minutes != null;
  }

  function timeChipTogglePatch(criteria) {
    if (deps && deps.timeChipTogglePatch) return deps.timeChipTogglePatch(criteria);
    if (timeChipIsOn(criteria)) return { quick: false, max_minutes: null };
    return { quick: true, max_minutes: null };
  }

  function metaRowHtml(row) {
    const bits = [];
    const ariaParts = [];
    if (row.total_minutes != null) {
      ariaParts.push(row.total_minutes + " min");
      bits.push(
        '<span class="disc-meta__bit"><svg class="icon icon--sm" aria-hidden="true"><use href="#i-clock" /></svg>' +
          esc(row.total_minutes + " min") +
          "</span>"
      );
    }
    if (row.effort_level === "easy") {
      ariaParts.push("Easy");
      bits.push('<span class="disc-meta__bit">Easy</span>');
    }
    if (row.ingredient_complexity === "simple") {
      ariaParts.push("Simple ingredients");
      bits.push('<span class="disc-meta__bit" aria-label="Simple ingredients">Simple</span>');
    }
    if (!bits.length) return "";
    return (
      '<p class="disc-meta" aria-label="' +
      esc(ariaParts.join(", ")) +
      '">' +
      bits.join('<span class="disc-meta__sep" aria-hidden="true"> · </span>') +
      "</p>"
    );
  }

  function planStatusEyebrow(slug) {
    const plan = d().getDinnerPlan ? d().getDinnerPlan() : null;
    if (!plan || !slug) return "";
    const meals = plan.meals || [];
    for (let i = 0; i < meals.length; i++) {
      const m = meals[i];
      if (m.recipe_slug !== slug && m.slug !== slug) continue;
      if (m.state === "selected") return '<p class="eyebrow disc-plan-status">Tonight’s pick</p>';
      if (m.state === "planned" || m.state === "selected") {
        return '<p class="eyebrow disc-plan-status">On your plan · Dinner ' + esc(String(m.position)) + "</p>";
      }
    }
    return "";
  }

  function cardHtml(row, variant) {
    const slug = row.recipe_slug;
    const reason =
      variant !== "grid" || (window.matchMedia && window.matchMedia("(min-width: 768px)").matches)
        ? d().tasteReasonLine
          ? d().tasteReasonLine(row, d().memberName)
          : ""
        : "";
    const reasonLine = reason ? '<p class="disc-reason meta">' + esc(reason) + "</p>" : "";
    const meta = metaRowHtml(row);
    const modeCta =
      state.mode === "replace_plan_meal"
        ? '<button type="button" class="btn btn-secondary btn-sm disc-card-cta" data-disc-action="use" data-version="' +
          esc(row.recipe_version_id) +
          '" data-slug="' +
          esc(slug) +
          '">Use this</button>'
        : state.mode === "choose_for_plan"
          ? '<button type="button" class="btn btn-secondary btn-sm disc-card-cta" data-disc-action="add" data-version="' +
            esc(row.recipe_version_id) +
            '" data-slug="' +
            esc(slug) +
            '">Add this</button>'
          : "";
    const media = d().mealMediaHtml
      ? d().mealMediaHtml({ recipe_slug: slug, recipe_version_id: row.recipe_version_id, title: row.title }, { decorative: true, sizes: variant === "lead" ? "50vw" : "280px" })
      : "";
    if (variant === "lead") {
      return (
        '<article class="disc-card disc-card--lead" data-disc-slug="' +
        esc(slug) +
        '" data-version="' +
        esc(row.recipe_version_id) +
        '">' +
        '<a class="disc-card__link" href="/meal/' +
        esc(slug) +
        '?from=find" data-disc-open="' +
        esc(slug) +
        '"><span class="visually-hidden">' +
        esc(row.title) +
        "</span></a>" +
        '<div class="disc-card__hero">' +
        media +
        '<div class="disc-card__hero-scrim" aria-hidden="true"></div>' +
        '<div class="disc-card__hero-copy">' +
        planStatusEyebrow(slug) +
        "<h3>" +
        esc(row.title) +
        "</h3>" +
        meta +
        reasonLine +
        modeCta +
        "</div></div></article>"
      );
    }
    return (
      '<article class="disc-card disc-card--' +
      esc(variant) +
      '" data-disc-slug="' +
      esc(slug) +
      '" data-version="' +
      esc(row.recipe_version_id) +
      '">' +
      '<a class="disc-card__link" href="/meal/' +
      esc(slug) +
      '?from=find" data-disc-open="' +
      esc(slug) +
      '"><span class="visually-hidden">' +
      esc(row.title) +
      "</span></a>" +
      media +
      '<div class="disc-card__body">' +
      planStatusEyebrow(slug) +
      "<h3>" +
      esc(row.title) +
      "</h3>" +
      meta +
      reasonLine +
      modeCta +
      "</div></article>"
    );
  }

  function paint() {
    const rootEl = document.getElementById("findRoot");
    if (!rootEl) return;
    const resp = state.response;
    const mode = state.mode;
    const title =
      mode === "replace_plan_meal"
        ? "Find something else"
        : mode === "choose_for_plan"
          ? "Pick a dinner"
          : "Find a dinner";
    const lede =
      mode === "standalone"
        ? "Everything here fits your table. Have a look around."
        : "Every option fits everyone at this dinner.";
    let html = '<header class="page-head disc-head"><div class="page-head__copy">';
    if (mode !== "standalone") {
      html += '<button type="button" class="back disc-back" data-disc-back><span class="back__label">Back</span></button>';
    }
    html += '<div class="disc-head__title-row"><h1 class="title">' + esc(title) + "</h1>";
    if (mode === "standalone") {
      html += '<button type="button" class="btn btn-secondary btn-sm disc-pick-one" data-action="pick-one">Pick one for us</button>';
    }
    html += "</div><p class=\"lede\">" + esc(lede) + '</p>';
    html += '<p class="disc-table meta" id="discTableNote"></p></div></header>';
    html += '<div class="disc-search-row"><label class="visually-hidden" for="discSearch">Search dinners</label>';
    html += '<input type="search" id="discSearch" class="disc-search" placeholder="Try salmon, tacos, or Thai" autocomplete="off" value="' + esc((resp && resp.query && resp.query.text) || "") + '" />';
    const searchHasText = !!(resp && resp.query && resp.query.text);
    html +=
      '<button type="button" class="btn btn-quiet disc-search-clear" id="discSearchClear" aria-label="Clear search"' +
      (searchHasText ? "" : " hidden") +
      ">Clear search</button></div>";
    html += '<div class="disc-chips" id="discChips" role="toolbar" aria-label="Refine dinners"></div>';
    html += '<div class="disc-progress" id="discProgress" hidden></div>';
    html += '<div class="disc-main" id="discMain" aria-live="polite"></div>';
    rootEl.innerHTML = html;
    paintChips();
    paintMain();
    paintTableNote();
    syncSearchClearButton();
  }

  function syncSearchClearButton() {
    const input = document.getElementById("discSearch");
    const clear = document.getElementById("discSearchClear");
    if (!input || !clear) return;
    const hasText = !!(input.value && input.value.trim());
    clear.hidden = !hasText;
    clear.disabled = !hasText;
  }

  function paintTableNote() {
    const el = document.getElementById("discTableNote");
    if (!el || !state.response) return;
    const ids = (state.response.context && state.response.context.participant_ids) || [];
    const members = d().activeMembers ? d().activeMembers() : [];
    if (!ids.length || ids.length === members.length) {
      el.textContent = "For everyone · Fits everyone’s limits";
      return;
    }
    const names = ids
      .map(function (id) {
        return d().memberName ? d().memberName(id) : id;
      })
      .filter(Boolean);
    el.textContent = "For " + names.join(", ");
  }

  function paintChips() {
    const box = document.getElementById("discChips");
    if (!box || !state.response) return;
    const q = state.response.query;
    const c = q.criteria;
    let html = "";
    const easyOn = c.effort_levels && c.effort_levels.indexOf("easy") >= 0;
    html +=
      '<button type="button" class="chip-tog' +
      (easyOn ? " is-on" : "") +
      '" data-disc-chip="easy" aria-pressed="' +
      (easyOn ? "true" : "false") +
      '">Easy</button>';
    const timeOn = timeChipIsOn(c);
    const timeLabel = c.quick ? "Under 30 min" : c.max_minutes ? "Under " + c.max_minutes + " min" : "Under 30 min ▾";
    html +=
      '<button type="button" class="chip-tog' +
      (timeOn ? " is-on" : "") +
      '" data-disc-chip="time" aria-haspopup="menu" aria-pressed="' +
      (timeOn ? "true" : "false") +
      '">' +
      esc(timeLabel) +
      "</button>";
    const simpleOn = c.ingredient_complexities && c.ingredient_complexities.indexOf("simple") >= 0;
    html +=
      '<button type="button" class="chip-tog' +
      (simpleOn ? " is-on" : "") +
      '" data-disc-chip="simple" aria-pressed="' +
      (simpleOn ? "true" : "false") +
      '">Simple ingredients</button>';
    let refineLabel = "Refine";
    const hidden =
      (c.cuisines && c.cuisines.length) +
      (c.meal_styles && c.meal_styles.length) +
      (c.flavors && c.flavors.length) +
      (c.ingredients && c.ingredients.length) +
      (c.diet && c.diet.length) +
      (c.protein_groups && c.protein_groups.length) +
      (c.textures && c.textures.length);
    if (hidden > 0) refineLabel = "Refine · " + hidden;
    html += '<button type="button" class="chip-tog" data-disc-chip="refine">' + esc(refineLabel) + "</button>";
    box.innerHTML = html;
  }

  function paintMain() {
    const main = document.getElementById("discMain");
    if (!main) return;
    if (state.loading && !state.response) {
      main.innerHTML = '<div class="disc-skeleton" aria-busy="true">Loading…</div>';
      return;
    }
    if (state.error && !state.response) {
      main.innerHTML =
        '<div class="empty-state"><strong>We couldn’t reach the kitchen.</strong><p class="meta">Try again.</p><button type="button" class="btn btn-secondary" data-disc-retry>Try again</button></div>';
      return;
    }
    const resp = state.response;
    if (!resp) return;
    main.setAttribute("aria-busy", state.loading ? "true" : "false");
    if (state.view === "results" || hasCriteria(resp.query) || state.forceResults) {
      paintResults(main, resp);
      return;
    }
    paintShelves(main);
  }

  function paintShelves(main) {
    const shelves = state.shelves || {};
    const keys = Object.keys(shelves);
    if (!keys.length) {
      main.innerHTML = '<div class="empty-state"><strong>Nothing on the menu fits this table yet</strong><p class="meta">Between everyone’s limits, none of our dinners work. Try a different table.</p></div>';
      return;
    }
    let html = "";
    keys.forEach(function (id) {
      const row = shelves[id];
      const title = d().shelfDisplayTitle ? d().shelfDisplayTitle(row.shelf, row.response) : row.shelf.title;
      const sub = d().shelfDisplaySubtitle ? d().shelfDisplaySubtitle(row.shelf, row.response) : row.shelf.subtitle;
      html += '<section class="disc-shelf"><div class="disc-shelf__head"><div><h2>' + esc(title) + "</h2><p class=\"meta\">" + esc(sub) + '</p></div><button type="button" class="btn btn-quiet btn-sm" data-disc-see-all="' + esc(id) + '">See all</button></div><div class="disc-shelf__row">';
      const results = row.response.results || [];
      results.slice(0, 8).forEach(function (r, i) {
        html += cardHtml(r, i === 0 ? "lead" : "shelf");
      });
      html += "</div></section>";
    });
    main.innerHTML = html;
  }

  function paintResults(main, resp) {
    const total = resp.total;
    const lean = leanSummary(resp);
    let header = "<h2 class=\"disc-results-title\">" + esc(total === 1 ? "1 dinner" : total + " dinners") + "</h2>";
    if (lean) {
      header +=
        '<p class="disc-lean meta">' +
        esc(lean) +
        ' <button type="button" class="btn btn-quiet btn-sm" data-disc-lean-change>Change</button></p>';
    }
    header += '<button type="button" class="btn btn-quiet btn-sm" data-disc-clear>Clear all</button>';
    let body = "";
    if (total === 0) {
      const kind = d().emptyStateKind ? d().emptyStateKind(resp.query, total, resp.excluded_counts) : "nothing_fits";
      if (kind === "relax") {
        const chips = d().relaxRemoveChips ? d().relaxRemoveChips(resp.excluded_counts, resp.query) : [];
        state.relaxChips = chips;
        body =
          '<div class="empty-state"><strong>No dinners match all of that</strong><p class="meta">Loosen one thing:</p><div class="disc-chips">';
        chips.forEach(function (chip, i) {
          body +=
            '<button type="button" class="chip-tog" data-disc-relax-idx="' +
            i +
            '" aria-label="Remove ' +
            esc(chip.label) +
            '">Remove ' +
            esc(chip.label) +
            "</button>";
        });
        body += '</div><button type="button" class="btn btn-secondary btn-sm" data-disc-clear>Clear all</button></div>';
      } else if (kind === "text") {
        body =
          '<div class="empty-state"><strong>Nothing here matches “' +
          esc(resp.query.text) +
          '” for this table</strong><p class="meta">It may not be on the menu yet, or it may not work with everyone’s limits.</p><button type="button" class="btn btn-secondary" data-disc-clear-search>Clear search</button></div>';
      } else {
        body =
          '<div class="empty-state"><strong>Nothing on the menu fits this table yet</strong><p class="meta">Between everyone’s limits, none of our dinners work. Try a different table.</p></div>';
      }
    } else {
      body = '<div class="disc-grid">';
      (resp.results || []).forEach(function (r) {
        body += cardHtml(r, "grid");
      });
      body += "</div>";
    }
    main.innerHTML = header + body;
  }

  async function applyQueryPatch(patch, opts) {
    const base = currentQuery();
    const next = Object.assign({}, base, patch || {});
    if (patch && patch.criteria) {
      next.criteria =
        opts && opts.replaceCriteria ? Object.assign(emptyCriteria(), patch.criteria) : mergeCriteria(base.criteria, patch.criteria);
    }
    if (patch && patch.soft) {
      next.soft = patch.soft;
      next.soft_provided = patch.soft_provided !== false;
      state.softTouched = true;
    }
    if (patch && patch.soft_provided === false) {
      next.soft_provided = false;
      state.softTouched = false;
    }
    if (opts && opts.forceResults != null) state.forceResults = opts.forceResults;
    state.response = Object.assign({}, state.response || {}, { query: next });
    await loadMain();
    if (!(opts && opts.skipUrl)) syncBrowserUrl(true);
  }

  function toggleSlugList(list, slug) {
    const out = (list || []).slice();
    const i = out.indexOf(slug);
    if (i >= 0) out.splice(i, 1);
    else out.push(slug);
    out.sort();
    return out;
  }

  function toggleCuisine(draft, term) {
    const values = cuisineSendValues(term.slug);
    const cur = draft.criteria.cuisines || [];
    const allOn = values.every(function (v) {
      return cur.indexOf(v) >= 0;
    });
    let next = cur.filter(function (v) {
      return values.indexOf(v) < 0;
    });
    if (!allOn) next = next.concat(values);
    next.sort();
    draft.criteria.cuisines = next;
  }

  var refinePreviewTimer = null;
  function scheduleRefinePreview() {
    clearTimeout(refinePreviewTimer);
    refinePreviewTimer = setTimeout(previewRefineTotal, 200);
  }

  async function previewRefineTotal() {
    const draft = state.refineDraft;
    if (!draft) return;
    const q = Object.assign({}, currentQuery(), {
      criteria: draft.criteria,
      soft: draft.soft,
      soft_provided: draft.soft_provided,
    });
    const res = await fetchSearch(q, 1);
    state.refinePreviewTotal = res.data ? res.data.total : 0;
    const btn = document.getElementById("discRefineApply");
    if (!btn) return;
    const n = state.refinePreviewTotal;
    btn.disabled = n === 0;
    btn.textContent = n === 1 ? "Show 1 dinner" : "Show " + n + " dinners";
  }

  function renderRefineGroup(title, helper, chipsHtml) {
    return (
      '<section class="disc-refine-group"><h3>' +
      esc(title) +
      "</h3>" +
      (helper ? '<p class="meta">' + esc(helper) + "</p>" : "") +
      '<div class="disc-refine-chips">' +
      chipsHtml +
      "</div></section>"
    );
  }

  function renderRefineBody() {
    const body = document.getElementById("discRefineBody");
    const draft = state.refineDraft;
    const vocab = state.refineVocab;
    if (!body || !draft || !vocab) return;
    let html = "";
    const timeOn = function (v) {
      if (v === "30") return draft.criteria.quick;
      if (v === "any") return !draft.criteria.quick && draft.criteria.max_minutes == null;
      return draft.criteria.max_minutes === Number(v);
    };
    html += renderRefineGroup(
      "Time",
      "",
      ["any", "30", "45", "60"]
        .map(function (v) {
          const label = v === "any" ? "Any time" : "Under " + v + " min";
          return (
            '<button type="button" class="chip-tog' +
            (timeOn(v) ? " is-on" : "") +
            '" data-disc-time="' +
            v +
            '">' +
            esc(label) +
            "</button>"
          );
        })
        .join("")
    );
    html += renderRefineGroup(
      "Effort",
      "Only easy dinners.",
      '<button type="button" class="chip-tog' +
        (draft.criteria.effort_levels.indexOf("easy") >= 0 ? " is-on" : "") +
        '" data-disc-effort="easy">Easy</button>'
    );
    html += renderRefineGroup(
      "Ingredients",
      "Only dinners with familiar ingredients.",
      '<button type="button" class="chip-tog' +
        (draft.criteria.ingredient_complexities.indexOf("simple") >= 0 ? " is-on" : "") +
        '" data-disc-complexity="simple">Simple ingredients</button>'
    );
    html += renderRefineGroup(
      "Cuisine",
      "",
      vocab.cuisines
        .slice(0, 12)
        .map(function (term) {
          const on = cuisineSendValues(term.slug).every(function (s) {
            return draft.criteria.cuisines.indexOf(s) >= 0;
          });
          return (
            '<button type="button" class="chip-tog' +
            (on ? " is-on" : "") +
            '" data-disc-cuisine="' +
            esc(term.slug) +
            '">' +
            esc(term.name) +
            "</button>"
          );
        })
        .join("")
    );
    html += renderRefineGroup(
      "Type of dinner",
      "",
      vocab.meal_styles
        .slice(0, 12)
        .map(function (term) {
          const on = draft.criteria.meal_styles.indexOf(term.slug) >= 0;
          return (
            '<button type="button" class="chip-tog' +
            (on ? " is-on" : "") +
            '" data-disc-style="' +
            esc(term.slug) +
            '">' +
            esc(term.name) +
            "</button>"
          );
        })
        .join("")
    );
    html += renderRefineGroup(
      "Main ingredient",
      "",
      vocab.ingredients
        .slice(0, 12)
        .map(function (term) {
          const on = draft.criteria.ingredients.indexOf(term.slug) >= 0;
          return (
            '<button type="button" class="chip-tog' +
            (on ? " is-on" : "") +
            '" data-disc-ingredient="' +
            esc(term.slug) +
            '">' +
            esc(term.name) +
            "</button>"
          );
        })
        .join("")
    );
    html += renderRefineGroup(
      "Flavor",
      "",
      vocab.flavors
        .slice(0, 8)
        .map(function (term) {
          const on = draft.criteria.flavors.indexOf(term.slug) >= 0;
          return (
            '<button type="button" class="chip-tog' +
            (on ? " is-on" : "") +
            '" data-disc-flavor="' +
            esc(term.slug) +
            '">' +
            esc(term.name) +
            "</button>"
          );
        })
        .join("")
    );
    html += renderRefineGroup(
      "Diet",
      "",
      DIET_OPTIONS.map(function (opt) {
        const on = draft.criteria.diet.indexOf(opt.slug) >= 0;
        return (
          '<button type="button" class="chip-tog' +
          (on ? " is-on" : "") +
          '" data-disc-diet="' +
          esc(opt.slug) +
          '">' +
          esc(opt.label) +
          "</button>"
        );
      }).join("")
    );
    html += renderRefineGroup(
      "Protein",
      "",
      PROTEIN_OPTIONS.map(function (opt) {
        const on = draft.criteria.protein_groups.indexOf(opt.slug) >= 0;
        return (
          '<button type="button" class="chip-tog' +
          (on ? " is-on" : "") +
          '" data-disc-protein="' +
          esc(opt.slug) +
          '">' +
          esc(opt.label) +
          "</button>"
        );
      }).join("")
    );
    html += renderRefineGroup(
      "Texture",
      "",
      TEXTURE_OPTIONS.map(function (opt) {
        const on = draft.criteria.textures.indexOf(opt.slug) >= 0;
        return (
          '<button type="button" class="chip-tog' +
          (on ? " is-on" : "") +
          '" data-disc-texture="' +
          esc(opt.slug) +
          '">' +
          esc(opt.label) +
          "</button>"
        );
      }).join("")
    );
    html +=
      '<section class="disc-refine-group disc-refine-group--soft"><h3>Lean toward</h3><p class="meta">These sort the list. They don’t hide anything.</p>' +
      '<label class="disc-switch"><input type="checkbox" data-disc-lean="keep_it_easy"' +
      (draft.soft.keep_it_easy ? " checked" : "") +
      ' /> Keep it easy</label>' +
      '<label class="disc-switch"><input type="checkbox" data-disc-lean="keep_ingredients_simple"' +
      (draft.soft.keep_ingredients_simple ? " checked" : "") +
      ' /> Keep ingredients simple</label></section>';
    body.innerHTML = html;
    scheduleRefinePreview();
  }

  function openRefineSheet() {
    const sheet = document.getElementById("discRefineSheet");
    if (!sheet) return;
    const load = d().loadTasteCatalog;
    state.refineDraft = draftFromQuery(currentQuery());
    const resp = state.response;
    if (resp && resp.soft_source === "plan_intent" && !state.softTouched) {
      state.refineDraft.soft = {
        keep_it_easy: resp.soft.keep_it_easy,
        keep_ingredients_simple: resp.soft.keep_ingredients_simple,
      };
      state.refineDraft.soft_provided = false;
    }
    const done = function (catalog) {
      state.refineVocab = vocabularyByKind(catalog);
      renderRefineBody();
      sheet.showModal();
    };
    if (load) {
      load().then(done);
    } else done({ groups: [] });
  }

  async function applyRefineDraft() {
    const draft = state.refineDraft;
    if (!draft) return;
    const sheet = document.getElementById("discRefineSheet");
    state.forceResults = true;
    await applyQueryPatch(
      {
        criteria: draft.criteria,
        soft: draft.soft,
        soft_provided: draft.soft_provided || state.softTouched,
      },
      { forceResults: true, replaceCriteria: true }
    );
    if (sheet && sheet.open) sheet.close();
  }

  function open(opts) {
    const o = opts || {};
    state.mode = o.mode || "standalone";
    state.urlContext = {
      dinner_plan_id: o.dinner_plan_id,
      meal_id: o.meal_id,
      position: o.position,
      participant_ids: o.participant_ids,
    };
    state.entry = o.entry || "nav";
    state.softTouched = false;
    state.forceResults = false;
    state.response = null;
    state.shelves = {};
    track("discovery_opened", { mode: state.mode, entry: state.entry });
    const cached = o.path && readCache(o.path);
    if (cached) {
      state.response = cached;
      state.view = hasCriteria(cached.query) ? "results" : "shelves";
    }
    d().showView("find", {
      context: {
        mode: state.mode,
        origin: o.origin || (state.mode === "standalone" ? "find" : o.origin || "home"),
      },
    });
    if (!o.skipHistory) {
      const path = o.path || "/find";
      history.pushState({ find: {} }, "", path);
    }
    loadMain();
  }

  function openFromLocation() {
    const parts = location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (parts[0] !== "find") return false;
    const params = new URLSearchParams(location.search);
    const mode = params.get("mode") || "standalone";
    open({
      mode,
      dinner_plan_id: params.get("dinner_plan_id"),
      meal_id: params.get("meal_id"),
      position: params.get("position") ? Number(params.get("position")) : undefined,
      entry: "deep_link",
      path: location.pathname + location.search,
      skipHistory: true,
    });
    return true;
  }

  function openStandaloneFromNav() {
    let path = "/find";
    try {
      path = sessionStorage.getItem(LS_FIND_URL) || "/find";
    } catch (_) { /* ignore */ }
    if (state.mode === "standalone" && d().getView && d().getView() === "find") {
      history.replaceState(null, "", "/find");
      state.scrollY = 0;
      window.scrollTo(0, 0);
      loadMain();
      return;
    }
    open({ mode: "standalone", entry: "nav", path });
  }

  function handleClick(e) {
    const back = e.target.closest("[data-disc-back]");
    if (back) {
      e.preventDefault();
      const ctx = d().navContext ? d().navContext() : {};
      const target = ctx.origin || "home";
      d().showView(target);
      return;
    }
    const openRecipe = e.target.closest("[data-disc-open]");
    if (openRecipe && !e.target.closest(".disc-card-cta")) {
      e.preventDefault();
      const slug = openRecipe.dataset.discOpen;
      const card = openRecipe.closest(".disc-card");
      const version = card && card.dataset.version;
      state.scrollY = window.scrollY;
      state.focusSlug = slug;
      history.replaceState({ find: { scrollY: state.scrollY, focusSlug: slug } }, "", location.pathname + location.search);
      track("discovery_recipe_opened", { mode: state.mode, recipe_slug: slug, from: "results" });
      d().openDiscoveryRecipe(slug, version);
      return;
    }
    const use = e.target.closest("[data-disc-action='use'], [data-disc-action='add']");
    if (use) {
      e.preventDefault();
      const version = use.dataset.version;
      const action = use.dataset.discAction === "use" ? "use_this" : "add_this";
      d().discoveryPick(version, action);
      return;
    }
    const chip = e.target.closest("[data-disc-chip]");
    if (chip) {
      e.preventDefault();
      const kind = chip.dataset.discChip;
      const q = currentQuery();
      if (kind === "easy") {
        const on = !(q.criteria.effort_levels && q.criteria.effort_levels.indexOf("easy") >= 0);
        applyQueryPatch({ criteria: { effort_levels: on ? ["easy"] : [] } });
      } else if (kind === "simple") {
        const on = !(q.criteria.ingredient_complexities && q.criteria.ingredient_complexities.indexOf("simple") >= 0);
        applyQueryPatch({ criteria: { ingredient_complexities: on ? ["simple"] : [] } });
      } else if (kind === "time") {
        applyQueryPatch({ criteria: timeChipTogglePatch(q.criteria) });
      } else if (kind === "refine") {
        openRefineSheet();
      }
      return;
    }
    const relaxIdx = e.target.closest("[data-disc-relax-idx]");
    if (relaxIdx) {
      e.preventDefault();
      const chip = state.relaxChips[Number(relaxIdx.dataset.discRelaxIdx)];
      if (chip) {
        const next = deps.applyRelaxChip(currentQuery(), chip);
        applyQueryPatch({ criteria: next.criteria, text: next.text }, { forceResults: true, replaceCriteria: true });
        track("discovery_remove_chip", { field: chip.label });
      }
      return;
    }
    const leanChange = e.target.closest("[data-disc-lean-change]");
    if (leanChange) {
      e.preventDefault();
      openRefineSheet();
      return;
    }
    const seeAll = e.target.closest("[data-disc-see-all]");
    if (seeAll) {
      e.preventDefault();
      const id = seeAll.dataset.discSeeAll;
      const shelf = (d().DISCOVERY_SHELVES || []).find(function (s) {
        return s.id === id;
      });
      if (shelf) {
        track("discovery_shelf_see_all", { shelf: id });
        applyQueryPatch(shelf.query || {}, { forceResults: true });
      }
      return;
    }
    if (e.target.closest("#discSearchClear")) {
      e.preventDefault();
      const input = document.getElementById("discSearch");
      if (input) input.value = "";
      syncSearchClearButton();
      applyQueryPatch({ text: null });
      return;
    }
    const clear = e.target.closest("[data-disc-clear], [data-disc-clear-search]");
    if (clear) {
      e.preventDefault();
      state.softTouched = false;
      state.forceResults = false;
      applyQueryPatch({ text: null, criteria: emptyCriteria() }, { replaceCriteria: true, forceResults: false });
      return;
    }
    const retry = e.target.closest("[data-disc-retry]");
    if (retry) {
      e.preventDefault();
      loadMain();
    }
  }

  var searchTimer = null;
  function handleSearchInput(e) {
    const val = e.target.value;
    syncSearchClearButton();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      applyQueryPatch({ text: val.trim() || null });
    }, 250);
  }

  function bindRefineEvents() {
    const sheet = document.getElementById("discRefineSheet");
    if (!sheet) return;
    sheet.addEventListener("change", function (e) {
      if (e.target.matches("[data-disc-lean]") && state.refineDraft) {
        state.refineDraft.soft[e.target.dataset.discLean] = e.target.checked;
        state.refineDraft.soft_provided = true;
        state.softTouched = true;
        scheduleRefinePreview();
      }
    });
    sheet.addEventListener("click", function (e) {
      const draft = state.refineDraft;
      if (!draft) return;
      const time = e.target.closest("[data-disc-time]");
      if (time) {
        const v = time.dataset.discTime;
        if (v === "any") {
          draft.criteria.quick = false;
          draft.criteria.max_minutes = null;
        } else if (v === "30") {
          draft.criteria.quick = true;
          draft.criteria.max_minutes = null;
        } else {
          draft.criteria.quick = false;
          draft.criteria.max_minutes = Number(v);
        }
        renderRefineBody();
        return;
      }
      const effort = e.target.closest("[data-disc-effort]");
      if (effort) {
        draft.criteria.effort_levels = draft.criteria.effort_levels.indexOf("easy") >= 0 ? [] : ["easy"];
        renderRefineBody();
        return;
      }
      const complexity = e.target.closest("[data-disc-complexity]");
      if (complexity) {
        draft.criteria.ingredient_complexities =
          draft.criteria.ingredient_complexities.indexOf("simple") >= 0 ? [] : ["simple"];
        renderRefineBody();
        return;
      }
      const cuisine = e.target.closest("[data-disc-cuisine]");
      if (cuisine) {
        toggleCuisine(draft, { slug: cuisine.dataset.discCuisine });
        renderRefineBody();
        return;
      }
      const style = e.target.closest("[data-disc-style]");
      if (style) {
        draft.criteria.meal_styles = toggleSlugList(draft.criteria.meal_styles, style.dataset.discStyle);
        renderRefineBody();
        return;
      }
      const ing = e.target.closest("[data-disc-ingredient]");
      if (ing) {
        draft.criteria.ingredients = toggleSlugList(draft.criteria.ingredients, ing.dataset.discIngredient);
        renderRefineBody();
        return;
      }
      const flavor = e.target.closest("[data-disc-flavor]");
      if (flavor) {
        draft.criteria.flavors = toggleSlugList(draft.criteria.flavors, flavor.dataset.discFlavor);
        renderRefineBody();
        return;
      }
      const diet = e.target.closest("[data-disc-diet]");
      if (diet) {
        draft.criteria.diet = toggleSlugList(draft.criteria.diet, diet.dataset.discDiet);
        renderRefineBody();
        return;
      }
      const protein = e.target.closest("[data-disc-protein]");
      if (protein) {
        draft.criteria.protein_groups = toggleSlugList(draft.criteria.protein_groups, protein.dataset.discProtein);
        renderRefineBody();
        return;
      }
      const texture = e.target.closest("[data-disc-texture]");
      if (texture) {
        draft.criteria.textures = toggleSlugList(draft.criteria.textures, texture.dataset.discTexture);
        renderRefineBody();
        return;
      }
      const lean = e.target.closest("[data-disc-lean]");
      if (lean && lean.tagName === "INPUT") {
        const key = lean.dataset.discLean;
        draft.soft[key] = lean.checked;
        draft.soft_provided = true;
        state.softTouched = true;
        scheduleRefinePreview();
        return;
      }
      if (e.target.id === "discRefineClear") {
        state.refineDraft = draftFromQuery({ criteria: emptyCriteria(), text: null, soft_provided: false });
        renderRefineBody();
        return;
      }
      if (e.target.id === "discRefineApply") {
        e.preventDefault();
        applyRefineDraft();
        return;
      }
      if (e.target.id === "discRefineClose") {
        sheet.close();
      }
    });
  }

  function bind() {
    document.addEventListener("click", handleClick);
    bindRefineEvents();
    const rootEl = document.getElementById("findRoot");
    if (rootEl) {
      rootEl.addEventListener("input", function (e) {
        if (e.target.id === "discSearch") handleSearchInput(e);
      });
    }
  }

  function applyRelaxChipLocal(query, chip) {
    const base = Object.assign({}, query, { criteria: Object.assign({}, query.criteria) });
    const p = chip.patch || {};
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
    return base;
  }

  function init(dependencies) {
    deps = Object.assign(
      {
        DISCOVERY_SHELVES: DISCOVERY_SHELVES,
        SHELF_MIN_TOTAL: SHELF_MIN_TOTAL,
        findPathFromState: findPathFromState,
        queryHasActiveCriteria: queryHasActiveCriteria,
        timeChipIsOn: timeChipIsOn,
        timeChipTogglePatch: timeChipTogglePatch,
        shelfDisplayTitle: shelfDisplayTitle,
        shelfDisplaySubtitle: shelfDisplaySubtitle,
        relaxRemoveChips: function (excluded, query) {
          return d().relaxRemoveChips ? d().relaxRemoveChips(excluded, query) : [];
        },
        applyRelaxChip: function (query, chip) {
          return d().applyRelaxChip ? d().applyRelaxChip(query, chip) : applyRelaxChipLocal(query, chip);
        },
        emptyStateKind: function (q, total, excluded) {
          if (total > 0) return null;
          const counts = excluded || {};
          const hasExplicit = Object.keys(counts).some(function (k) {
            return k.indexOf("explicit_") === 0 && counts[k] > 0;
          });
          if (hasExplicit) return "relax";
          if (q && q.text) return "text";
          return "nothing_fits";
        },
      },
      {
        relaxRemoveChips: function (excluded, query) {
          if (dependencies && dependencies.relaxRemoveChips) return dependencies.relaxRemoveChips(excluded, query);
          return [];
        },
        applyRelaxChip: applyRelaxChipLocal,
      },
      dependencies || {}
    );
    const bridge = root.FlavorWeaveDiscoveryRelax;
    deps.relaxRemoveChips =
      (dependencies && dependencies.relaxRemoveChips) || (bridge && bridge.relaxRemoveChips) || deps.relaxRemoveChips;
    deps.applyRelaxChip =
      (dependencies && dependencies.applyRelaxChip) || (bridge && bridge.applyRelaxChip) || applyRelaxChipLocal;
    bind();
  }

  function onShow() {
    if (!state.response) loadMain();
    else paint();
  }

  function restoreFromHistory(st) {
    const snap = (st && st.find) || st;
    if (!snap) return;
    restoreSession(snap);
  }

  root.FlavorWeaveDiscovery = {
    init,
    open,
    openFromLocation,
    openStandaloneFromNav,
    onShow,
    restoreFromHistory,
    restoreSession,
    captureState,
    getState: function () {
      return state;
    },
    getResponse: function () {
      return state.response;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
