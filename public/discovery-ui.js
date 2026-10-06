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
  };

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
    history[fn]({ find: { scrollY: state.scrollY, focusSlug: state.focusSlug } }, "", path);
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

  function metaBadges(row) {
    const bits = [];
    if (row.total_minutes != null) bits.push('<span class="badge badge--sm">' + esc(row.total_minutes + " min") + "</span>");
    if (row.effort_level === "easy") bits.push('<span class="badge badge--sm">Easy</span>');
    if (row.ingredient_complexity === "simple") {
      bits.push('<span class="badge badge--sm" aria-label="Simple ingredients">Simple</span>');
    }
    return bits.join(" ");
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
      '<div class="disc-meta">' +
      metaBadges(row) +
      "</div>" +
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
    html += "<h1 class=\"title\">" + esc(title) + "</h1><p class=\"lede\">" + esc(lede) + "</p>";
    if (mode === "standalone") {
      html += '<button type="button" class="btn btn-quiet btn-sm disc-pick-one" data-action="pick-one">Pick one for us</button>';
    }
    html += '<p class="disc-table meta" id="discTableNote"></p></div></header>';
    html += '<div class="disc-search-row"><label class="visually-hidden" for="discSearch">Search dinners</label>';
    html += '<input type="search" id="discSearch" class="disc-search" placeholder="Try salmon, tacos, or Thai" autocomplete="off" value="' + esc((resp && resp.query && resp.query.text) || "") + '" />';
    html += '<button type="button" class="btn btn-quiet disc-search-clear" id="discSearchClear" aria-label="Clear search">Clear search</button></div>';
    html += '<div class="disc-chips" id="discChips" role="toolbar" aria-label="Refine dinners"></div>';
    html += '<div class="disc-progress" id="discProgress" hidden></div>';
    html += '<div class="disc-main" id="discMain" aria-live="polite"></div>';
    rootEl.innerHTML = html;
    paintChips();
    paintMain();
    paintTableNote();
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
    const timeLabel = c.quick ? "Under 30 min" : c.max_minutes ? "Under " + c.max_minutes + " min" : "Under 30 min ▾";
    html += '<button type="button" class="chip-tog" data-disc-chip="time" aria-haspopup="menu">' + esc(timeLabel) + "</button>";
    const simpleOn = c.ingredient_complexities && c.ingredient_complexities.indexOf("simple") >= 0;
    html +=
      '<button type="button" class="chip-tog' +
      (simpleOn ? " is-on" : "") +
      '" data-disc-chip="simple" aria-pressed="' +
      (simpleOn ? "true" : "false") +
      '">Simple ingredients</button>';
    html += '<button type="button" class="chip-tog" data-disc-chip="refine">Refine</button>';
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
    if (lean) header += '<p class="disc-lean meta">' + esc(lean) + '</p>';
    header += '<button type="button" class="btn btn-quiet btn-sm" data-disc-clear>Clear all</button>';
    let body = "";
    if (total === 0) {
      const kind = d().emptyStateKind ? d().emptyStateKind(resp.query, total, resp.excluded_counts) : "nothing_fits";
      if (kind === "relax") {
        const chips = d().relaxRemoveChips ? d().relaxRemoveChips(resp.excluded_counts, resp.query) : [];
        body =
          '<div class="empty-state"><strong>No dinners match all of that</strong><p class="meta">Loosen one thing:</p><div class="disc-chips">';
        chips.forEach(function (chip) {
          body += '<button type="button" class="chip-tog" data-disc-relax="' + esc(chip.label) + '">Remove ' + esc(chip.label) + "</button>";
        });
        body += "</div></div>";
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
    if (opts && opts.forceResults != null) state.forceResults = opts.forceResults;
    state.response = Object.assign({}, state.response || {}, { query: next });
    await loadMain();
    if (!(opts && opts.skipUrl)) syncBrowserUrl(true);
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
      state.scrollY = window.scrollY;
      state.focusSlug = slug;
      history.replaceState({ find: { scrollY: state.scrollY, focusSlug: slug } }, "", location.pathname + location.search);
      track("discovery_recipe_opened", { mode: state.mode, recipe_slug: slug, from: "results" });
      d().openDiscoveryRecipe(slug);
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
        applyQueryPatch({ criteria: { quick: true, max_minutes: null } });
      } else if (kind === "refine") {
        document.getElementById("discRefineSheet") && document.getElementById("discRefineSheet").showModal();
      }
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
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      applyQueryPatch({ text: val.trim() || null });
    }, 250);
  }

  function bind() {
    document.addEventListener("click", handleClick);
    const rootEl = document.getElementById("findRoot");
    if (rootEl) {
      rootEl.addEventListener("input", function (e) {
        if (e.target.id === "discSearch") handleSearchInput(e);
      });
    }
  }

  function init(dependencies) {
    deps = Object.assign(
      {
        DISCOVERY_SHELVES: DISCOVERY_SHELVES,
        SHELF_MIN_TOTAL: SHELF_MIN_TOTAL,
        findPathFromState: findPathFromState,
        queryHasActiveCriteria: queryHasActiveCriteria,
        shelfDisplayTitle: shelfDisplayTitle,
        shelfDisplaySubtitle: shelfDisplaySubtitle,
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
      dependencies || {}
    );
    bind();
  }

  function onShow() {
    if (!state.response) loadMain();
    else paint();
  }

  function restoreFromHistory(st) {
    if (!st || !st.find) return;
    state.scrollY = st.find.scrollY || 0;
    state.focusSlug = st.find.focusSlug || null;
    requestAnimationFrame(function () {
      window.scrollTo(0, state.scrollY);
    });
  }

  root.FlavorWeaveDiscovery = {
    init,
    open,
    openFromLocation,
    openStandaloneFromNav,
    onShow,
    restoreFromHistory,
    getState: function () {
      return state;
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
