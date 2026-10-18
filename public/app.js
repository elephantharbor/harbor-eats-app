/**
 * FlavorWeave consumer app (Harbor Eats internal venture — product/prototype tree)
 * Sample meal: HE-2026-09-23-P01-A Crispy Chipotle Tofu Tacos
 * Ratings: 1–10 dual per diner (Cora confirmed; 1–5 revoked).
 * Same-origin /api/* when D1 live; graceful in-memory fallback.
 * Sage owns Taste Model alignment to 1–10.
 *
 * Analytics stubs (Bloom PLG + CHANNEL-RESEARCH):
 *   invite_sent / invite_accepted  — HE-INV-*
 *   share_choice_created / viewed / acted — HE-SHARE-*
 *   loop_completed (+ attribution_last_touch)
 * Dashboards default to Completed Meal Loops, not installs.
 */
(function () {
  const app = document.getElementById("app");
  const topbar = document.getElementById("topbar");
  const tabbar = document.getElementById("tabbar");
  const debug = document.getElementById("debug");
  const screenNav = document.getElementById("screenNav");
  const toastEl = document.getElementById("toast");
  const Theme = window.FlavorWeaveTheme || null;
  const Media = window.FlavorWeaveMedia || { imageFor: function () { return null; } };
  const Nav = window.FlavorWeaveNav;
  const Taste = window.FlavorWeaveTaste;
  const Discovery = window.FlavorWeaveDiscovery;

  const PLAN_ID = "local-plan";

  /** Required equipment from canonical catalog metadata (recipe.equipment); never parsed from steps. */
  function renderEquipment(recipe) {
    const wrap = document.getElementById("detailEquipmentWrap");
    const list = document.getElementById("detailEquipment");
    if (!wrap || !list) return;
    const items = Array.isArray(recipe && recipe.equipment) ? recipe.equipment.filter(Boolean) : [];
    list.innerHTML = items.map(function (e) { return "<li>" + escapeHtml(e) + "</li>"; }).join("");
    wrap.hidden = items.length === 0;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function icon(name, extraClass) {
    return `<svg class="icon${extraClass ? " " + extraClass : ""}" aria-hidden="true"><use href="#i-${name}" /></svg>`;
  }

  /** Mark cached/already-complete meal images visible (onload may not replay). */
  function hydrateMealMedia(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(".meal-media:not(.meal-media--ready):not(.meal-media--error) .meal-media__img").forEach((img) => {
      if (img.complete && img.naturalWidth > 0) {
        const shell = img.closest(".meal-media");
        if (shell) shell.classList.add("meal-media--ready");
      }
    });
  }

  app.addEventListener(
    "load",
    (event) => {
      const img = event.target;
      if (img && img.classList && img.classList.contains("meal-media__img")) {
        const shell = img.closest(".meal-media");
        if (shell) shell.classList.add("meal-media--ready");
      }
    },
    true
  );

  /** Recipe-specific photo when the catalog has one; quiet plate fallback otherwise. */
  function mealMediaHtml(meal, opts) {
    const o = opts || {};
    const img = Media.imageFor(meal);
    const cls = "meal-media" + (o.className ? " " + o.className : "");
    const fallback = `<span class="meal-media__fallback" aria-hidden="true">${escapeHtml((meal && meal.plate) || "🍽️")}</span>`;
    if (!img) return `<div class="${cls}">${o.inner || ""}${fallback}</div>`;
    const alt = o.decorative ? "" : escapeHtml((meal && (meal.title || meal.name)) || img.alt);
    const loading = o.eager ? 'fetchpriority="high"' : 'loading="lazy"';
    const imgTag =
      `<img class="meal-media__img" src="${img.src}" srcset="${img.srcset}" sizes="${o.sizes || "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 40vw"}" alt="${alt}" width="1200" height="900" decoding="async" ${loading} ` +
      `onload="this.closest('.meal-media').classList.add('meal-media--ready')" ` +
      `onerror="this.closest('.meal-media').classList.add('meal-media--error')" />`;
    return `<div class="${cls}">${imgTag}${fallback}${o.inner || ""}</div>`;
  }

  function mealMinutes(meal, recipe) {
    if (recipe && recipe.total_minutes) return recipe.total_minutes + " min";
    if (meal && meal.time && /\d/.test(meal.time)) return meal.time;
    const chip = meal && (meal.chips || []).find((c) => /min/i.test(c));
    return chip || "";
  }

  function randToken(n) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  }
  function makeInviteCode() {
    return "HE-INV-" + randToken(6);
  }
  function makeShareId() {
    return "HE-SHARE-" + randToken(6).toLowerCase();
  }
  const CANONICAL_ORIGIN = "https://harbor-eats-app.pages.dev";

  function appBaseUrl() {
    try {
      const h = location.hostname || "";
      if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".pages.dev") || h.endsWith(".workers.dev")) {
        return location.origin.replace(/\/$/, "") + "/";
      }
    } catch (_) { /* ignore */ }
    return CANONICAL_ORIGIN.replace(/\/$/, "") + "/";
  }
  function inviteUrl(code) {
    return appBaseUrl() + "invite/" + encodeURIComponent(code);
  }
  function shareUrl(shareId) {
    return appBaseUrl() + "share/" + encodeURIComponent(shareId);
  }

  /** Analytics stub — console + in-memory log; never invents loops */
  const analyticsLog = [];

  // —— Persistence API (same-origin /api/*; graceful fallback if unbound) ——
  const API = { available: null, householdId: null, planId: null, consumerUi: null };
  const aiGate = { consumerUi: null };
  aiGate.ready = new Promise(function (resolve) {
    aiGate._resolve = resolve;
  });
  window.FlavorWeaveAi = aiGate;

  function settleConsumerUi(on) {
    if (aiGate.consumerUi != null) return;
    aiGate.consumerUi = !!on;
    API.consumerUi = aiGate.consumerUi;
    aiGate._resolve(aiGate.consumerUi);
  }
  /** Recovery hints only — session is HttpOnly cookie (not localStorage). */
  const LS_HH = "he_household_id";
  const LS_MEMBER = "he_member_id";

  function rememberSessionIds(householdId, memberId) {
    try {
      if (householdId) localStorage.setItem(LS_HH, householdId);
      if (memberId) localStorage.setItem(LS_MEMBER, memberId);
    } catch (_) { /* private mode */ }
    if (memberId) state.meId = memberId;
    if (memberId && Theme) Theme.useMember(memberId);
  }

  function applyServerSnapshot(snap) {
    if (!snap || !snap.ok) return;
    if (snap.household) {
      state.householdId = snap.household.household_id;
      API.householdId = snap.household.household_id;
      state.householdName = snap.household.display_name || state.householdName;
    }
    if (Array.isArray(snap.members) && snap.members.length) {
      state.members = snap.members.map(function (m) {
        const name = m.display_name || m.member_id;
        return {
          id: m.member_id,
          name,
          initial: (name[0] || "?").toUpperCase(),
          status: m.status === "active" ? "Active" : m.status === "invited" ? "Invited" : m.status,
        };
      });
      state.ratings = Object.fromEntries(
        state.members.map(function (m) {
          return [m.id, { score: null, note: "" }];
        })
      );
    }
    const sessionMember = snap.session && snap.session.member_id;
    if (sessionMember) state.meId = sessionMember;
    if (Array.isArray(snap.constraints) && state.members.length) {
      state.householdConstraintRows = snap.constraints;
      const me = meMember();
      state.primaryConstraints = keysFromConstraintRows(
        snap.constraints.filter(function (c) {
          return me && c.member_id === me.id;
        })
      );
      state.savedConstraints = state.primaryConstraints.slice();
    }
    if (Object.prototype.hasOwnProperty.call(snap, "previous_meal")) {
      state.previousMeal = snap.previous_meal || null;
    }
    state.ratingsByOption = {};
    if (Array.isArray(snap.ratings)) {
      snap.ratings.forEach(function (r) {
        if (!r.meal_option_id) return;
        if (!state.ratingsByOption[r.meal_option_id]) state.ratingsByOption[r.meal_option_id] = {};
        state.ratingsByOption[r.meal_option_id][r.member_id] = {
          score: r.score,
          note: r.note || "",
          recipe_version_id: r.recipe_version_id || null,
        };
      });
    }
    if (snap.plan_id) API.planId = snap.plan_id;
    if (Array.isArray(snap.meal_options) && snap.meal_options.length) {
      const fromApi = optionsFromApi(snap.meal_options);
      if (fromApi) state.currentMeals = fromApi;
    }
    if (snap.selected_meal_option_id) state.selectedMealId = snap.selected_meal_option_id;
    state.outcomeLocked = !!snap.outcome_locked;
    state.lockedMealOptionId = snap.locked_meal_option_id || (state.outcomeLocked ? state.selectedMealId : null);
    state.previewMealId = state.selectedMealId;
    state.cookingMealId = null;
    if (state.selectedMealId && state.ratingsByOption[state.selectedMealId]) {
      const bucket = state.ratingsByOption[state.selectedMealId];
      state.members.forEach(function (m) {
        const row = bucket[m.id];
        state.ratings[m.id] = row ? { score: row.score, note: row.note || "" } : { score: null, note: "" };
      });
    }
    if (snap.lifecycle) {
      state.lifecycle = snap.lifecycle === "Generated" ? "Unselected" : snap.lifecycle;
    }
    if (snap.rating_state) state.ratingState = snap.rating_state;
    state.nextAction = snap.next_action || null;
    state.onboarded = snap.next_action !== "onboarding";
    if (snap.session) {
      rememberSessionIds(snap.session.household_id, snap.session.member_id);
    }
  }

  async function ensureMemberSession() {
    const hh = API.householdId || state.householdId;
    let memberId = null;
    try {
      memberId = localStorage.getItem(LS_MEMBER);
    } catch (_) { /* ignore */ }
    const member =
      (memberId && state.members.find(function (m) {
        return m.id === memberId;
      })) ||
      state.members[0];
    if (!hh || !member) return false;
    const res = await apiPost("/api/sessions", {
      household_id: hh,
      member_id: member.id,
    });
    if (res && res.ok) {
      rememberSessionIds(hh, member.id);
      return true;
    }
    return false;
  }

  async function restoreSession() {
    let snap = await apiGet("/api/sessions/me");
    if (!snap || !snap.ok) {
      try {
        const hh = localStorage.getItem(LS_HH);
        const mid = localStorage.getItem(LS_MEMBER);
        const dest = location.pathname + location.search;
        if (hh && mid) {
          const rec = await fetch("/api/recovery/request", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              household_id: hh,
              member_id: mid,
              destination_path: dest || "/",
            }),
          });
          const recBody = await rec.json().catch(function () {
            return null;
          });
          const consumeUrl =
            (recBody && recBody.dev_recovery_url) ||
            (recBody && recBody.mail && recBody.mail.dev_recovery_url);
          if (consumeUrl && consumeUrl.includes("/recover/")) {
            const token = consumeUrl.split("/recover/")[1].split("?")[0];
            await fetch("/api/recovery/consume", {
              method: "POST",
              credentials: "same-origin",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token }),
            });
            snap = await apiGet("/api/sessions/me");
          }
        }
      } catch (_) { /* ignore */ }
    }
    if (snap && snap.ok && (snap.session || snap.household)) {
      applyServerSnapshot(snap);
      return snap;
    }
    return null;
  }

  function onboardingResumeView(snap) {
    if (snap.next_view && snap.next_view !== "create") return snap.next_view;
    if (snap.next_action === "start_choices" || snap.next_action === "pick_meal") {
      if (!snap.plan_id && !snap.selected_meal_option_id) return "home";
      return "choices";
    }
    if (!state.members.length) return "members";
    if (state.members.length >= 2 && (snap.plan_id || snap.selected_meal_option_id)) return "choices";
    const hasConstraints = state.primaryConstraints.length > 0;
    if (!hasConstraints && !snap.plan_id) return "constraints";
    return snap.next_view || "home";
  }

  async function apiProbe() {
    if (API.available !== null) return API.available;
    try {
      const r = await fetch("/api/health", { method: "GET", credentials: "same-origin" });
      if (!r.ok) {
        API.available = false;
        settleConsumerUi(false);
        return false;
      }
      const j = await r.json();
      API.available = !!(j && j.ok && j.d1 === "ok");
      settleConsumerUi(!!(j && j.consumer_ui));
      return API.available;
    } catch (_) {
      API.available = false;
      settleConsumerUi(false);
      return false;
    }
  }

  const clientErrorReporter = window.FlavorWeaveClientErrors
    ? window.FlavorWeaveClientErrors.createReporter(function (path, body) {
        return sendClientError(path, body);
      })
    : null;

  function reportClientError(surface, code, message, extra) {
    if (!clientErrorReporter) return;
    clientErrorReporter
      .report(
        Object.assign(
          {
            surface: surface,
            code: code,
            message: message,
            path: location.pathname + location.search,
            household_id: API.householdId || state.householdId,
          },
          extra || {}
        )
      )
      .catch(function () {});
  }

  let pageUnloading = false;
  window.addEventListener("pagehide", function () { pageUnloading = true; });
  window.addEventListener("beforeunload", function () { pageUnloading = true; });

  function noteApiFailure(path, code, message, extra) {
    if (path === "/api/client-errors") return;
    const signingOut = signOutBusy || !!(document.documentElement && document.documentElement.dataset.signingOut === "1");
    const hidden = !!(document.hidden || document.visibilityState === "hidden");
    if (!shouldReportApiFailure({ hidden: hidden, unloading: pageUnloading, signingOut: signingOut })) return;
    reportClientError("api", code, message, extra);
  }

  function shouldReportApiFailure(ctx) {
    const gate = window.FlavorWeaveClientErrors && window.FlavorWeaveClientErrors.shouldReportClientApiFailure;
    if (typeof gate === "function") return gate(ctx);
    return !(ctx && (ctx.hidden || ctx.unloading || ctx.signingOut));
  }

  async function sendClientError(path, body) {
    if (!(await apiProbe())) return { ok: false, skipped: true };
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: apiHeaders(),
        credentials: "same-origin",
        body: JSON.stringify(body || {}),
      });
      const j = await r.json().catch(function () {
        return null;
      });
      if (!r.ok || (j && j.ok === false)) return { ok: false, status: r.status };
      return { ok: true, status: r.status };
    } catch (_) {
      return { ok: false, status: 0 };
    }
  }

  /** Bumped on sign-out so in-flight responses are ignored. */
  let sessionEpoch = 0;
  let sessionAbort = new AbortController();

  function abortSessionWork() {
    sessionEpoch += 1;
    try { sessionAbort.abort(); } catch (_) { /* already aborted */ }
    sessionAbort = new AbortController();
  }

  function sessionStillCurrent(epoch) {
    return epoch === sessionEpoch;
  }

  async function apiPost(path, body) {
    if (!(await apiProbe())) return null;
    const epoch = sessionEpoch;
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: apiHeaders(),
        credentials: "same-origin",
        cache: "no-store",
        signal: sessionAbort.signal,
        body: JSON.stringify(body || {}),
      });
      if (!sessionStillCurrent(epoch)) return { ok: false, aborted: true };
      const j = await r.json().catch(() => null);
      if (!sessionStillCurrent(epoch)) return { ok: false, aborted: true };
      if (!r.ok || (j && j.ok === false)) {
        console.warn("[he-api]", path, r.status, j);
        noteApiFailure(path, j && j.error, path + " " + r.status, { response: j });
        return Object.assign(j || {}, { ok: false, _httpStatus: r.status });
      }
      return j;
    } catch (e) {
      if (e && e.name === "AbortError") return { ok: false, aborted: true };
      if (!sessionStillCurrent(epoch)) return { ok: false, aborted: true };
      console.warn("[he-api]", path, e);
      noteApiFailure(path, "network", String(e && e.message), { path: path });
      return null;
    }
  }

  async function apiGet(path) {
    if (!(await apiProbe())) return null;
    const epoch = sessionEpoch;
    try {
      const r = await fetch(path, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: sessionAbort.signal,
      });
      if (!sessionStillCurrent(epoch)) return { ok: false, aborted: true };
      const j = await r.json().catch(() => null);
      if (!sessionStillCurrent(epoch)) return { ok: false, aborted: true };
      if (!r.ok || (j && j.ok === false)) {
        console.warn("[he-api]", path, r.status, j);
        noteApiFailure(path, j && j.error, path + " " + r.status, { response: j });
        return Object.assign(j || {}, { ok: false, _httpStatus: r.status });
      }
      return j;
    } catch (e) {
      if (e && e.name === "AbortError") return { ok: false, aborted: true };
      if (!sessionStillCurrent(epoch)) return { ok: false, aborted: true };
      console.warn("[he-api]", path, e);
      noteApiFailure(path, "network", String(e && e.message), { path: path });
      return null;
    }
  }

  async function apiPatch(path, body) {
    if (!(await apiProbe())) return null;
    const epoch = sessionEpoch;
    try {
      const r = await fetch(path, {
        method: "PATCH",
        headers: apiHeaders(),
        credentials: "same-origin",
        cache: "no-store",
        signal: sessionAbort.signal,
        body: JSON.stringify(body || {}),
      });
      if (!sessionStillCurrent(epoch)) return { ok: false, aborted: true };
      const j = await r.json().catch(() => null);
      if (!sessionStillCurrent(epoch)) return { ok: false, aborted: true };
      if (!r.ok || (j && j.ok === false)) {
        noteApiFailure(path, j && j.error, path + " " + r.status, { response: j });
        return Object.assign(j || {}, { ok: false, _httpStatus: r.status });
      }
      return j;
    } catch (e) {
      if (e && e.name === "AbortError") return { ok: false, aborted: true };
      if (!sessionStillCurrent(epoch)) return { ok: false, aborted: true };
      noteApiFailure(path, "network", String(e && e.message), { path: path });
      return null;
    }
  }

  function persistEvent(event, props) {
    const p = props || {};
    apiPost("/api/events", {
      event_name: event,
      household_id: API.householdId || state.householdId || p.household_id || null,
      member_id: p.member_id || p.person_id || p.inviter_id || null,
      plan_id: p.plan_id || API.planId || PLAN_ID,
      meal_option_id: p.meal_option_id || p.meal_id || null,
      invite_code: p.invite_code || null,
      share_object_id: p.share_object_id || null,
      channel: p.channel || null,
      attribution_last_touch: p.attribution_last_touch || state.lastTouch || null,
      dinner_plan_id: p.dinner_plan_id || (state.dinnerPlan && state.dinnerPlan.dinner_plan_id) || null,
      meal_id: p.meal_id || null,
      meal_count: p.meal_count,
      source: p.source,
      op: p.op,
      recipe_slug: p.recipe_slug,
      kind: p.kind,
      support: p.support,
      op_count: p.op_count,
      line_count: p.line_count,
      diner_count: p.diner_count,
      basis: p.basis,
    }).catch(function () {});
  }

  function track(event, props) {
    const row = { event, ts: new Date().toISOString(), ...props };
    analyticsLog.push(row);
    console.info("[he-analytics]", event, props || {});
    persistEvent(event, props);
    return row;
  }

  /**
   * Hard limits only. Each label names its scope so "meat", "poultry" and "fish"
   * never overlap by guesswork. An exception tile appears only under its parent
   * and must be ticked on purpose; it maps to a { cashew: permitted } row.
   */
  const constraintOptions = [
    { id: "dairy", label: "No dairy", hint: "Milk, cheese, butter, yogurt" },
    { id: "meat", label: "No meat", hint: "Beef, pork, lamb — and poultry too" },
    { id: "poultry", label: "No poultry", hint: "Chicken, turkey, duck" },
    { id: "fish", label: "No fish", hint: "Salmon, cod, and other finfish" },
    { id: "shellfish", label: "No shellfish", hint: "Shrimp, crab, lobster, clams" },
    { id: "nuts", label: "No nuts", hint: "Peanuts and tree nuts, cashews included" },
    { id: "cashew_ok", label: "Cashews are OK", hint: "An exception to No nuts. Every other nut stays off.", exceptionOf: "nuts" },
    { id: "none", label: "No limits", hint: "Everything’s on the table" },
  ];
  const EXCEPTION_RULES = { cashew_ok: "cashew" };

  /** Client keys → constraint rows. An exception without its parent is dropped. */
  function constraintRowsFromKeys(keys) {
    const list = (keys || []).filter(function (k) { return k && k !== "none"; });
    const rows = [];
    list.forEach(function (k) {
      const exception = EXCEPTION_RULES[k];
      if (exception) {
        const parent = constraintOptions.find(function (c) { return c.id === k; }).exceptionOf;
        if (list.includes(parent)) rows.push({ rule_key: exception, status: "permitted" });
        return;
      }
      rows.push({ rule_key: k, status: "prohibited" });
    });
    return rows;
  }

  function keysFromConstraintRows(rows) {
    const keys = [];
    (rows || []).forEach(function (r) {
      if (r.rule_key && r.rule_key !== "none" && (r.status || "prohibited") === "prohibited") keys.push(r.rule_key);
    });
    (rows || []).forEach(function (r) {
      if (r.status !== "permitted") return;
      const clientKey = Object.keys(EXCEPTION_RULES).find(function (k) { return EXCEPTION_RULES[k] === r.rule_key; });
      const opt = clientKey && constraintOptions.find(function (c) { return c.id === clientKey; });
      if (opt && keys.includes(opt.exceptionOf)) keys.push(clientKey);
    });
    return keys;
  }

  function sameKeys(a, b) {
    const x = (a || []).filter(function (k) { return k !== "none"; }).slice().sort();
    const y = (b || []).filter(function (k) { return k !== "none"; }).slice().sort();
    return x.length === y.length && x.every(function (k, i) { return k === y[i]; });
  }

  async function saveMyConstraints() {
    const hh = API.householdId || state.householdId;
    const me = meMember();
    if (!hh || !me) return null;
    return apiPost(`/api/members/${encodeURIComponent(me.id)}/constraints`, {
      household_id: hh,
      constraints: constraintRowsFromKeys(state.primaryConstraints),
      replace: true,
    });
  }

  /** Fallback only when API plan not loaded (should not drive cook/detail). */
  const meals = [];

  const state = {
    view: "welcome",
    lifecycle: "Unselected", // → Selected → Cooked → Rated
    cookStep: 0,
    householdId: null, // set when POST /api/households succeeds
    householdName: "",
    members: [],
    primaryConstraints: [],
    joinConstraints: [],
    tastePicks: [],
    tasteSaved: [],
    tasteSave: null,
    tasteCatalog: null,
    tasteProfile: null,
    tasteSearch: { onboarding: null, profile: null },
    feedbackSent: {},
    inviteChannel: "share_sheet",
    inviteCode: makeInviteCode(),
    shareObjectId: makeShareId(),
    shareReady: false,
    selectedMealId: null,
    guestPick: null,
    sharedMeals: null, // D1-resolved A/B/C for guest; null = local meals
    lastTouch: "organic",
    ratings: {},
    onboarded: false,
    nextAction: null,
    currentMeals: null,
    settingsChoiceCount: 3,
    settingsCadence: "on_demand",
    activeRecipe: null,
    ratingState: "none",
    previewMealId: null,
    cookingMealId: null,
    outcomeLocked: false,
    lockedMealOptionId: null,
    ratingsByOption: {},
    meId: null,
    savedConstraints: [],
    constraintSave: null,
    navContext: {},
    historyItems: [],
    historyMeal: null,
    previousMeal: null,
    roundBusy: false,
    dinnerPlan: null,
    draftPlanPrefs: { keep_it_easy: false, keep_ingredients_simple: false },
    swapOpener: null,
    swapInFlight: false,
    pendingDinnerToast: null,
    dinnerShop: null,
    householdShop: null,
    shopInStore: false,
    shopAttempt: null,
    shopAddPending: null,
    shopShareId: null,
    dinnerUnfilled: [],
    dinnerDetailMeal: null,
    dinnerCookMealId: null,
    // begin_cook has been sent and not yet confirmed. Does not relabel the recipe CTA.
    dinnerCookPendingId: null,
    planCountGroup: null,
    planCountValue: null,
    planReviewMode: "multi",
    planSingleMode: false,
    planAddElse: false,
    swapMealId: null,
    swappedMealIds: {},
    pendingPlanMealFocus: null,
    findDinnerEntry: "find_dinner",
    mealOptionsMealId: null,
    participantsMealId: null,
    participantsDraft: null,
    participantsGuestDraft: 0,
    detailViewingServings: null,
    swapReplacePosition: null,
    changeCountValue: null,
    changeCountRemoveMealId: null,
    dinnerRateMealId: null,
    ratingPlan: null,
    rateReturnView: null,
    cookUndoSealed: false,
    shopLineMenuId: null,
    shopLineSnapshot: {},
    groceryProviders: [],
  };

  /** The diner using this device. Settings and "Your diet limits" belong to them, not to members[0]. */
  function meMember() {
    let id = state.meId;
    if (!id) {
      try {
        id = localStorage.getItem(LS_MEMBER);
      } catch (_) { /* ignore */ }
    }
    return (id && state.members.find(function (m) { return m.id === id; })) || state.members[0] || null;
  }

  function householdEstablished() {
    return !!(state.householdId || API.householdId) && !!state.onboarded;
  }

  function apiHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (isQaMode()) headers["X-FlavorWeave-Data-Origin"] = "synthetic";
    return headers;
  }

  function identitySnapshot() {
    return {
      previewMealId: state.previewMealId || null,
      selectedMealId: state.selectedMealId || null,
      cookingMealId: state.cookingMealId || null,
      lifecycle: state.lifecycle,
      outcomeLocked: !!state.outcomeLocked,
      lockedMealOptionId: state.lockedMealOptionId || null,
      ratingsByOption: JSON.parse(JSON.stringify(state.ratingsByOption || {})),
      ratings: JSON.parse(JSON.stringify(state.ratings || {})),
    };
  }

  function applyIdentity(next) {
    if (!next) return;
    if (Object.prototype.hasOwnProperty.call(next, "previewMealId")) state.previewMealId = next.previewMealId;
    if (Object.prototype.hasOwnProperty.call(next, "selectedMealId")) state.selectedMealId = next.selectedMealId;
    if (Object.prototype.hasOwnProperty.call(next, "cookingMealId")) state.cookingMealId = next.cookingMealId;
    if (next.lifecycle) state.lifecycle = next.lifecycle;
    if (typeof next.outcomeLocked === "boolean") state.outcomeLocked = next.outcomeLocked;
    if (Object.prototype.hasOwnProperty.call(next, "lockedMealOptionId")) {
      state.lockedMealOptionId = next.lockedMealOptionId;
    }
    if (next.ratingsByOption) state.ratingsByOption = next.ratingsByOption;
    if (next.ratings) {
      activeMembers().forEach(function (m) {
        const row = next.ratings[m.id];
        state.ratings[m.id] = row ? { score: row.score, note: row.note || "" } : { score: null, note: "" };
      });
    }
  }

  function activeMembers() {
    const active = state.members.filter(function (m) {
      return m.status === "Active" || m.status === "active";
    });
    return active.length ? active : state.members;
  }

  function activeMemberCount() {
    const list = activeMembers();
    return list.length || 1;
  }

  /** Context-aware household phrasing (warm for 2, plural for 3–4). */
  function householdCopy(mode) {
    const n = activeMemberCount();
    const m = mode || "default";
    if (n === 2) {
      if (m === "both") return "both of you";
      if (m === "fit") return "both of you";
      if (m === "rate") return "both of you";
      if (m === "invite") return "you’ll both";
      return "your household";
    }
    if (n >= 4) {
      if (m === "fit" || m === "default") return "your crew";
      if (m === "rate") return "everyone in your crew";
      return "your crew";
    }
    if (n === 3) {
      if (m === "fit" || m === "default") return "everyone cooking tonight";
      if (m === "rate") return "everyone in your household";
      return "your household";
    }
    return "your kitchen";
  }

  function dinerCountForPlanMeal(meal) {
    if (!meal) return activeMemberCount();
    const participants = (meal.participant_ids || []).length;
    const guests = Math.max(0, Number(meal.guest_count) || 0);
    const total = participants + guests;
    if (total < 1) return activeMemberCount();
    return Math.min(8, total);
  }

  function servingCountForMeal(meal) {
    const raw = meal || (state.dinnerCookMealId && planMealById(state.dinnerCookMealId));
    if (raw && raw.participant_ids) return dinerCountForPlanMeal(raw);
    if (state.detailViewingServings != null) return state.detailViewingServings;
    return activeMemberCount();
  }

  function householdDinerCount() {
    return activeMemberCount();
  }

  function dinnerCountWord(mealCount) {
    return Number(mealCount) === 1 ? "dinner" : "dinners";
  }

  function shopCookingHeadline(mealCount, householdCount, exceptions) {
    const base = mealCount + " " + dinnerCountWord(mealCount) + " · cooking for " + householdCount;
    if (!exceptions.length) return base;
    if (exceptions.length > 2) return base + " · amounts match each dinner";
    return (
      base +
      exceptions
        .map(function (row) {
          return ", " + row.label + " for " + row.count;
        })
        .join("")
    );
  }

  function dinerExceptionCopy(input) {
    if (input.dinerCount === input.householdCount) return null;
    const guests = Math.max(0, Number(input.guestCount) || 0);
    if (guests > 0) return "For " + input.dinerCount + " · " + guests + (guests === 1 ? " guest" : " guests");
    const eating = input.eatingNames || [];
    const absent = input.absentNames || [];
    if (eating.length === 1 && input.dinerCount === 1) return "For 1 · just " + eating[0];
    if (absent.length === 1) return "For " + input.dinerCount + " · " + absent[0] + "’s out";
    return "For " + input.dinerCount;
  }

  function planMealDinerException(raw) {
    if (!raw) return null;
    const n = dinerCountForPlanMeal(raw);
    const hh = householdDinerCount();
    const eatingIds = raw.participant_ids || [];
    const eatingNames = eatingIds
      .map(function (id) {
        const m = state.members.find(function (x) {
          return x.id === id;
        });
        return m ? m.name : "";
      })
      .filter(Boolean);
    const absentNames = activeMembers()
      .filter(function (m) {
        return eatingIds.indexOf(m.id) < 0;
      })
      .map(function (m) {
        return m.name;
      });
    return dinerExceptionCopy({
      householdCount: hh,
      dinerCount: n,
      guestCount: Math.max(0, Number(raw.guest_count) || 0),
      eatingNames: eatingNames,
      absentNames: absentNames,
    });
  }

  function planMealDinerLabel(raw) {
    const exc = planMealDinerException(raw);
    return exc || "For " + dinerCountForPlanMeal(raw);
  }

  function cookingForLabel(count) {
    return "Cooking for " + count;
  }

  function explanationPayloadForMeal(meal) {
    const raw = meal && meal.meal_id ? meal : planMealById(meal && meal.id);
    const m = raw || meal;
    return {
      recipe_slug: m && m.recipe_slug,
      recipe_version_id: m && m.recipe_version_id,
      row: {
        effort_level: m && m.effort_level,
        ingredient_complexity: m && m.ingredient_complexity,
      },
      plan: state.dinnerPlan ? { intent: state.dinnerPlan.intent } : null,
    };
  }

  function planMealReasonLine(meal) {
    if (!meal || !window.FlavorWeaveExplanation) return "";
    const intent = state.dinnerPlan && state.dinnerPlan.intent;
    if (meal.effort_level === "easy" || (intent && intent.keep_it_easy)) {
      return window.FlavorWeaveExplanation.joinFacts(["Easy, like you asked"], 40);
    }
    if (meal.ingredient_complexity === "simple" || (intent && intent.keep_ingredients_simple)) {
      return window.FlavorWeaveExplanation.joinFacts(["Simple ingredients"], 40);
    }
    return window.FlavorWeaveExplanation.reasonLineFromMeal(meal, null, intent);
  }

  function explanationBlockHtml(id, meal) {
    const reason = planMealReasonLine(meal);
    if (!reason || !window.FlavorWeaveExplanation) return "";
    return (
      '<div data-why-wrap>' +
      window.FlavorWeaveExplanation.disclosureHtml(id, reason, {
        payload: explanationPayloadForMeal(meal),
      }) +
      "</div>"
    );
  }

  function bindWhyInScope(root) {
    if (!root || !window.FlavorWeaveExplanation) return;
    window.FlavorWeaveExplanation.bindDisclosures(root, {
      fetchExplanation: fetchMealExplanation,
      track: track,
    });
  }

  function discoveryParticipantCount() {
    const resp = Discovery && Discovery.getResponse ? Discovery.getResponse() : null;
    const ids = resp && resp.context && resp.context.participant_ids;
    if (ids && ids.length) return ids.length;
    return null;
  }

  function discoveryResultRow(slug) {
    if (!slug || !Discovery) return null;
    const resp = Discovery.getResponse ? Discovery.getResponse() : null;
    if (resp && resp.results) {
      const hit = resp.results.find(function (r) {
        return r.recipe_slug === slug;
      });
      if (hit) return hit;
    }
    const st = Discovery.getState ? Discovery.getState() : null;
    const shelves = (st && st.shelves) || {};
    const keys = Object.keys(shelves);
    for (let i = 0; i < keys.length; i++) {
      const row = shelves[keys[i]];
      const results = row && row.response && row.response.results;
      if (!results) continue;
      const hit = results.find(function (r) {
        return r.recipe_slug === slug;
      });
      if (hit) return hit;
    }
    return null;
  }

  function tasteReasonLineFromRow(row) {
    if (!row) return "";
    const pr = row.primary_reason;
    if (pr !== "taste_love" && pr !== "taste_like") return "";
    const hits = (row.taste_hits || []).slice(0, 2);
    const terms = hits
      .map(function (h) {
        return h.display_name || h.term_slug || "";
      })
      .filter(Boolean);
    if (!terms.length) return "";
    const joined = terms.length === 1 ? terms[0] : terms[0] + " and " + terms[1];
    const other = hits.find(function (h) {
      return h.member_id && h.member_id !== h.viewer_id;
    });
    if (other && other.member_id) {
      const m = state.members.find(function (x) {
        return x.id === other.member_id;
      });
      const who = m ? (meMember() && m.id === meMember().id ? "You" : m.name) : null;
      if (who) {
        return pr === "taste_love" ? who + " loves " + joined : who + " likes " + joined;
      }
    }
    return pr === "taste_love" ? "You told us you love " + joined : "You said you like " + joined;
  }

  function buildDiscoveryWhyLines(row, recipe) {
    const lines = [];
    if (row) {
      const taste = tasteReasonLineFromRow(row);
      if (taste) lines.push(taste);
      if ((row.reasons || []).indexOf("explicit_different") >= 0) {
        lines.push("You haven’t made this one lately");
      }
      if (row.total_minutes != null && row.total_minutes <= 30) {
        lines.push("On the table in " + row.total_minutes + " minutes");
      }
      if (row.effort_level === "easy") lines.push("Easy: short on steps, light on fuss");
      if (row.ingredient_complexity === "simple") lines.push("Familiar ingredients, nothing hard to find");
    } else if (recipe) {
      if (recipe.total_minutes != null && recipe.total_minutes <= 30) {
        lines.push("On the table in " + recipe.total_minutes + " minutes");
      }
      const effort = recipe.effort_level || recipe.effort;
      if (effort === "easy") lines.push("Easy: short on steps, light on fuss");
      const complexity = recipe.ingredient_complexity;
      if (complexity === "simple") lines.push("Familiar ingredients, nothing hard to find");
    }
    return lines.slice(0, 3);
  }

  function syncHouseholdChrome() {
    const inviteLede = document.getElementById("inviteLede");
    if (inviteLede) {
      inviteLede.textContent =
        activeMemberCount() === 2
          ? "They set their own limits. You’ll both see the same three picks tonight."
          : "They set their own limits. Everyone in your household sees the same picks tonight.";
    }
    const demoBtn = document.getElementById("demoNavLabel");
    if (demoBtn) {
      demoBtn.textContent =
        activeMemberCount() === 2 ? "How two profiles work" : "How your household fits together";
    }
    const demoKicker = document.getElementById("demoMealKicker");
    if (demoKicker) {
      demoKicker.textContent =
        activeMemberCount() === 2
          ? "Both of you can eat these"
          : "Everyone in your household can eat these";
    }
    const demoHint = document.getElementById("demoFishHint");
    if (demoHint) {
      demoHint.textContent =
        activeMemberCount() === 2
          ? "Fish stays on the menu unless one of you switches on No fish. Likes reorder the picks; they never override a hard limit."
          : "Fish stays on the menu unless someone switches on No fish. Likes reorder the picks; they never override a hard limit.";
    }
    const rateLede = document.getElementById("rateLede");
    if (rateLede) {
      rateLede.textContent =
        activeMemberCount() === 2
          ? "Each of you scores separately — save partial ratings anytime."
          : "Each person scores separately — save partial ratings anytime.";
    }
    const rateHintDefault = document.getElementById("rateHint");
    if (rateHintDefault && !anyRated()) {
      rateHintDefault.textContent =
        activeMemberCount() === 2
          ? "Submit when both have scored. You can save a partial and finish later."
          : "Submit when everyone has scored. You can save a partial and finish later.";
    }
    const loopTitle = document.getElementById("loopTitle");
    if (loopTitle) {
      loopTitle.textContent =
        activeMemberCount() === 2 ? "Both of you rated dinner" : "Everyone rated dinner";
    }
    const nextRated =
      activeMemberCount() === 2 ? "Both of you rated" : "Everyone rated";
    const eye = document.getElementById("homeEyebrow");
    if (eye && state.nextAction === "loop_complete") eye.textContent = nextRated;
  }

  function selectedMeal() {
    return mealById(state.selectedMealId);
  }

  async function fetchRecipeForMeal(meal) {
    if (!meal) return null;
    const slug = meal.recipe_slug;
    const versionId = meal.recipe_version_id;
    let servings = servingCountForMeal();
    if (meal.discovery) {
      const n = discoveryParticipantCount();
      servings = n != null ? n : null;
    }
    const servingsQs = servings != null ? "?servings=" + servings : "";
    let path = null;
    if (meal.historical && versionId) {
      path = "/api/recipes/version/" + encodeURIComponent(versionId) + (servings != null ? "?servings=" + servings : "");
    } else if (slug) path = "/api/recipes/" + encodeURIComponent(slug) + servingsQs;
    else if (versionId) {
      path = "/api/recipes/version/" + encodeURIComponent(versionId) + (servings != null ? "?servings=" + servings : "");
    }
    if (!path) return null;
    const res = await apiGet(path);
    if (res && res.ok && res.recipe) return res.recipe;
    return null;
  }

  async function ensureRecipeForMeal(meal) {
    if (!meal) return null;
    if (state.activeRecipe && state.activeRecipe._mealId === meal.id) return state.activeRecipe;
    const loaded = await fetchRecipeForMeal(meal);
    if (loaded) {
      loaded._mealId = meal.id;
      const raw = meal.dinner_plan ? planMealById(meal.id) : null;
      if (raw && window.FlavorWeaveMealRecipe) {
        state.activeRecipe = window.FlavorWeaveMealRecipe.mergeIntoRecipe(loaded, raw);
      } else {
        state.activeRecipe = loaded;
      }
    }
    return loaded;
  }

  async function ensureRecipeForSelection() {
    return ensureRecipeForMeal(selectedMeal());
  }

  /** The loaded recipe only if it belongs to this meal; a previewed recipe never paints another meal. */
  function recipeLoadedFor(meal) {
    return meal && state.activeRecipe && state.activeRecipe._mealId === meal.id ? state.activeRecipe : null;
  }

  function cookSteps() {
    return (state.activeRecipe && state.activeRecipe.steps) || [];
  }
  state.ratings = Object.fromEntries(
    state.members.map((m) => [m.id, { score: null, note: "" }])
  );

  function toast(msg, opts) {
    const html = opts && opts.html;
    const duration = (opts && opts.duration) || (opts && opts.undo ? 6000 : 2200);
    if (html || (opts && opts.undo)) toastEl.innerHTML = html ? msg : msg;
    else toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._undo = opts && opts.undo ? opts.undo : null;
    toast._t = setTimeout(function () {
      toastEl.classList.remove("show");
      toast._undo = null;
      if (opts && opts.onDone) opts.onDone();
    }, duration);
  }

  function toastUndo(message, undoFn, duration) {
    toast(
      message + ' <button type="button" class="btn btn-quiet btn-sm toast-undo">Undo</button>',
      { html: true, undo: undoFn, duration: duration || 6000 }
    );
  }

  function syncAvatars() {
    const root = document.getElementById("dinerAvatars");
    root.innerHTML = state.members
      .map(
        (m, i) =>
          `<span class="avatar${i === 0 ? " active" : ""}" title="${escapeHtml(m.name)} (${escapeHtml(m.status)})">${escapeHtml(m.initial)}</span>`
      )
      .join("");
    root.setAttribute(
      "aria-label",
      state.members.length
        ? "Household diners: " + state.members.map((m) => m.name).join(", ")
        : "Household diners"
    );
    document.getElementById("brandSub").textContent = state.householdName || "Your household";
  }

  function memberRowHtml(m) {
    const status = m.status === "Active" || m.status === "active" ? "Active" : m.status;
    const badge = status === "Active" ? "badge--success" : "badge--warning";
    return `
      <div class="member-row" role="listitem">
        <span class="avatar">${escapeHtml(m.initial)}</span>
        <div class="grow"><div class="name">${escapeHtml(m.name)}</div></div>
        <span class="badge badge--sm ${badge}">${escapeHtml(status)}</span>
      </div>`;
  }

  function renderProgressDots() {
    document.querySelectorAll(".progress-dots").forEach((el) => {
      const step = Number(el.dataset.step) || 1;
      el.innerHTML = [1, 2, 3, 4, 5, 6]
        .map((n) => {
          const cls = n === step ? "is-on" : n < step ? "is-done" : "";
          return `<span class="${cls}"></span>`;
        })
        .join("");
    });
  }

  function renderMembers() {
    const root = document.getElementById("memberList");
    root.innerHTML = state.members.map(memberRowHtml).join("");
  }

  function renderConstraintGrid(rootId, selectedIds, onToggle) {
    const root = document.getElementById(rootId);
    root.innerHTML = constraintOptions
      .filter((c) => !c.exceptionOf || selectedIds.includes(c.exceptionOf))
      .map((c) => {
        const on = selectedIds.includes(c.id);
        const cls = "check-tile" + (on ? " is-on" : "") + (c.exceptionOf ? " check-tile--exception" : "");
        return `<label class="${cls}"><input type="checkbox" data-cid="${c.id}" ${on ? "checked" : ""} /> <span class="check-tile__text"><span>${escapeHtml(c.label)}</span><small class="check-tile__hint">${escapeHtml(c.hint)}</small></span></label>`;
      })
      .join("");
    root.onchange = (e) => {
      const input = e.target.closest("input[data-cid]");
      if (!input) return;
      const id = input.dataset.cid;
      const remove = function (key) {
        const j = selectedIds.indexOf(key);
        if (j >= 0) selectedIds.splice(j, 1);
      };
      if (id === "none") {
        selectedIds.length = 0;
        if (input.checked) selectedIds.push("none");
      } else {
        remove("none");
        if (input.checked) {
          if (!selectedIds.includes(id)) selectedIds.push(id);
        } else {
          remove(id);
          constraintOptions
            .filter((c) => c.exceptionOf === id)
            .forEach((c) => remove(c.id));
        }
      }
      if (onToggle) onToggle();
      renderConstraintGrid(rootId, selectedIds, onToggle);
    };
  }

  // —— Tastes (per diner; Love / Like / Less often; never a hard limit) ——

  async function loadTasteCatalog() {
    if (state.tasteCatalog) return state.tasteCatalog;
    const res = await apiGet("/api/tastes/catalog");
    if (res && res.ok) state.tasteCatalog = res;
    return state.tasteCatalog;
  }

  function tasteRanks() {
    return (state.tasteCatalog && state.tasteCatalog.ranks) || Taste.FALLBACK_RANKS;
  }

  const FOCUS_KEYS = ["data-taste-pick", "data-taste-add", "data-taste-rank", "data-taste-remove", "data-feedback-code"];

  /** Re-render without dropping a keyboard user's place. */
  function withFocusKept(paint, fallback) {
    const active = document.activeElement;
    let selector = null;
    let hostId = null;
    if (active && active !== document.body) {
      const key = FOCUS_KEYS.find(function (k) { return active.hasAttribute(k); });
      if (key) {
        selector = `[${key}="${active.getAttribute(key)}"]`;
        if (key === "data-taste-add") selector += `[data-rank="${active.getAttribute("data-rank")}"]`;
        if (key === "data-taste-rank") selector += `[value="${active.value}"]`;
        const host = active.closest("[id]");
        hostId = host ? host.id : null;
      }
    }
    paint();
    if (!selector) return;
    const host = hostId && document.getElementById(hostId);
    const view = app.querySelector(".view.is-active");
    const target = (host && host.querySelector(selector)) || (view && view.querySelector(selector));
    const backup = typeof fallback === "function" ? fallback() : fallback;
    if (target) target.focus({ preventScroll: true });
    else if (backup) backup.focus({ preventScroll: true });
  }

  function tasteSearchOpts(scope) {
    const result = state.tasteSearch[scope];
    if (scope === "profile") {
      return {
        mode: "add",
        ranksBySlug: Taste.ranksBySlug(state.tasteProfile),
        ranks: tasteRanks(),
        explicit: !!(result && result.explicit),
      };
    }
    return { mode: "pick", picked: state.tastePicks, explicit: !!(result && result.explicit) };
  }

  function paintTasteSearch(scope) {
    const el = document.getElementById(scope === "profile" ? "tasteProfileSearchResult" : "tasteSearchResult");
    if (el) el.innerHTML = Taste.searchResultHtml(state.tasteSearch[scope], tasteSearchOpts(scope));
  }

  function paintTasteBrowse(scope) {
    const el = document.getElementById(scope === "profile" ? "tasteProfileBrowse" : "tasteBrowse");
    if (!el || el.hidden || !state.tasteCatalog) return;
    const opts = scope === "profile"
      ? { mode: "add", ranksBySlug: Taste.ranksBySlug(state.tasteProfile), ranks: tasteRanks(), idPrefix: el.id }
      : { mode: "pick", picked: state.tastePicks, idPrefix: el.id };
    el.innerHTML = Taste.browseHtml(state.tasteCatalog.groups, opts);
  }

  function paintTasteOnboarding(lastSlug) {
    const cat = state.tasteCatalog;
    if (!cat) return;
    const starters = cat.starters || [];
    const extras = state.tastePicks
      .filter(function (slug) { return !starters.some(function (t) { return t.slug === slug; }); })
      .map(function (slug) { return Taste.findTerm(cat, slug); })
      .filter(Boolean);
    document.getElementById("tastePicks").innerHTML = Taste.chipGridHtml(starters.concat(extras), state.tastePicks);
    paintTasteBrowse("onboarding");
    paintTasteSearch("onboarding");
    let hint = Taste.encouragement(state.tastePicks.length);
    const term = lastSlug && state.tastePicks.includes(lastSlug) ? Taste.findTerm(cat, lastSlug) : null;
    if (term && !term.on_menu) hint = `${term.name} is noted. Nothing on the menu has it yet — we’ll keep it in mind.`;
    document.getElementById("tastePickHint").textContent = hint;
    document.getElementById("btnSkipTaste").hidden = state.tastePicks.length > 0;
    document.getElementById("btnTasteContinue").textContent = state.tastePicks.length ? "Save and continue" : "Continue";
  }

  async function renderTasteOnboarding() {
    const me = meMember();
    document.getElementById("tasteFor").textContent = me ? me.name + "’s" : "Your";
    const root = document.getElementById("tastePicks");
    const extras = [document.getElementById("tasteSearchForm"), document.getElementById("btnTasteBrowse")];
    if (!state.tasteCatalog) {
      root.setAttribute("aria-busy", "true");
      root.innerHTML = '<span class="skeleton taste-skeleton" aria-hidden="true"></span>'.repeat(6);
      await loadTasteCatalog();
      root.removeAttribute("aria-busy");
    }
    if (!state.tasteCatalog) {
      root.innerHTML = '<p class="taste-offline">We can’t load tastes right now. Skip for now — you can add them anytime from your profile.</p>';
      extras.forEach(function (el) { if (el) el.hidden = true; });
      document.getElementById("tastePickHint").textContent = "";
      document.getElementById("btnSkipTaste").hidden = false;
      return;
    }
    extras.forEach(function (el) { if (el) el.hidden = false; });
    paintTasteOnboarding();
  }

  /** New picks become Love for the signed-in diner; un-picked ones are removed. */
  async function persistOnboardingTastes() {
    const hh = API.householdId || state.householdId;
    if (!hh || !Taste.onboardingChanges(state.tastePicks, state.tasteSaved).length) return;
    await ensureMemberSession();
    const me = meMember();
    if (!me) return;
    const picked = state.tastePicks.slice();
    const res = await apiPost(`/api/members/${encodeURIComponent(me.id)}/tastes`, {
      household_id: hh,
      changes: Taste.onboardingChanges(picked, state.tasteSaved),
    });
    if (res && res.ok) {
      state.tasteSaved = picked;
      if (res.profile) state.tasteProfile = res.profile;
    }
  }

  const tasteSearchSeq = { onboarding: 0, profile: 0 };

  async function runTasteSearch(scope, explicit) {
    const input = document.getElementById(scope === "profile" ? "tasteProfileSearch" : "tasteSearch");
    const q = input ? input.value.trim() : "";
    const seq = ++tasteSearchSeq[scope];
    if (!q) {
      state.tasteSearch[scope] = null;
      paintTasteSearch(scope);
      return;
    }
    const res = await apiGet("/api/tastes/search?q=" + encodeURIComponent(q));
    if (seq !== tasteSearchSeq[scope]) return;
    if (res && res.ok) {
      state.tasteSearch[scope] = Object.assign({}, res, { explicit: !!explicit });
    } else {
      state.tasteSearch[scope] = explicit
        ? { status: "error", query: q, match: null, message: "Search isn’t available right now. Try Browse more.", explicit: true }
        : null;
    }
    paintTasteSearch(scope);
    if (explicit) {
      const host = document.getElementById(scope === "profile" ? "tasteProfileSearchResult" : "tasteSearchResult");
      const first = host && host.querySelector("button");
      if (first) first.focus();
    }
  }

  function toggleTasteBrowse(scope) {
    const btn = document.getElementById(scope === "profile" ? "btnTasteProfileBrowse" : "btnTasteBrowse");
    const panel = document.getElementById(btn.getAttribute("aria-controls"));
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Show fewer" : "Browse more";
    if (open) paintTasteBrowse(scope);
  }

  function profileForMe() {
    const me = meMember();
    if (state.tasteProfile && me && state.tasteProfile.member_id && state.tasteProfile.member_id !== me.id) {
      state.tasteProfile = null;
    }
    return state.tasteProfile;
  }

  function paintTasteProfile() {
    const p = profileForMe() || { told: [], learning: [] };
    document.getElementById("tasteToldList").innerHTML = Taste.profileListHtml(
      p.told,
      tasteRanks(),
      "Nothing yet. Add a few below — tacos, smoky, salmon, whatever makes you hungry."
    );
    document.getElementById("tasteLearningList").innerHTML = Taste.profileListHtml(
      p.learning,
      tasteRanks(),
      "Nothing yet. As you cook and rate, hunches show up here for you to confirm or toss."
    );
    paintTasteSearch("profile");
    paintTasteBrowse("profile");
  }

  function tasteTermFor(slug) {
    const fromCatalog = Taste.findTerm(state.tasteCatalog, slug);
    if (fromCatalog) return fromCatalog;
    const p = state.tasteProfile;
    return p ? (p.told || []).concat(p.learning || []).find(function (i) { return i.slug === slug; }) || null : null;
  }

  function tasteAnnouncement(name, rank) {
    if (rank === "remove") return `Removed ${name}. It’s still on the menu.`;
    if (rank === "less_often") return `${name}: Less often. You’ll see it less, and it stays on the menu.`;
    return `${name}: ${Taste.rankLabelFor(tasteRanks(), rank)}.`;
  }

  async function changeTaste(slug, rank, fallbackFocus) {
    const hh = API.householdId || state.householdId;
    const status = document.getElementById("tasteProfileStatus");
    const term = tasteTermFor(slug);
    if (!hh || !term) return;
    const before = profileForMe();
    state.tasteProfile = Object.assign(Taste.applyLocal(before, slug, rank, term, tasteRanks()), {
      member_id: (before && before.member_id) || (meMember() && meMember().id),
    });
    withFocusKept(paintTasteProfile, fallbackFocus);
    await ensureMemberSession();
    const me = meMember();
    const res = me
      ? await apiPost(`/api/members/${encodeURIComponent(me.id)}/tastes`, {
          household_id: hh,
          changes: [{ vocabulary_slug: slug, rank }],
        })
      : null;
    if (res && res.ok && res.profile) {
      state.tasteProfile = res.profile;
      withFocusKept(paintTasteProfile, fallbackFocus);
      status.textContent = tasteAnnouncement(term.name, rank);
    } else {
      state.tasteProfile = before;
      withFocusKept(paintTasteProfile, fallbackFocus);
      status.textContent = "Couldn’t save that just now. Check your connection and try again.";
    }
  }

  async function renderTasteProfile() {
    const me = meMember();
    document.getElementById("tasteProfileFor").textContent = me ? me.name + "’s" : "Your";
    const told = document.getElementById("tasteToldList");
    const status = document.getElementById("tasteProfileStatus");
    status.textContent = "";
    const hh = API.householdId || state.householdId;
    if (!hh || !me) {
      told.innerHTML = '<li class="taste-empty">Join or create a kitchen first.</li>';
      document.getElementById("tasteLearningList").innerHTML = "";
      return;
    }
    if (!profileForMe()) {
      told.setAttribute("aria-busy", "true");
      told.innerHTML = '<li class="skeleton taste-item-skeleton" aria-hidden="true"></li><li class="skeleton taste-item-skeleton" aria-hidden="true"></li>';
    }
    await ensureMemberSession();
    const meNow = meMember();
    const [, res] = await Promise.all([
      loadTasteCatalog(),
      apiGet(`/api/members/${encodeURIComponent(meNow.id)}/tastes`),
    ]);
    told.removeAttribute("aria-busy");
    if (res && res.ok && res.profile) state.tasteProfile = res.profile;
    else if (!profileForMe()) status.textContent = "We couldn’t load your tastes just now. Try again in a moment.";
    paintTasteProfile();
  }

  function feedbackKey(mealId, memberId) {
    return mealId + ":" + memberId;
  }

  async function sendTasteFeedback(code) {
    const me = meMember();
    const mealId = state.selectedMealId;
    const hh = API.householdId || state.householdId;
    if (!me || !mealId) return;
    const key = feedbackKey(mealId, me.id);
    const sent = state.feedbackSent[key] || [];
    if (sent.includes(code)) {
      toast("Already noted. Thanks!");
      return;
    }
    state.feedbackSent[key] = sent.concat(code);
    withFocusKept(renderRaters);
    toast("Noted. Thanks!");
    if (!hh || !API.planId) return;
    await ensureMemberSession();
    const meal = selectedMeal();
    apiPost(`/api/members/${encodeURIComponent(me.id)}/taste-feedback`, {
      household_id: hh,
      meal_option_id: mealId,
      recipe_version_id: (meal && meal.recipe_version_id) || null,
      code,
    }).catch(function () {});
  }

  function persClass(type) {
    if (type === "new") return "new";
    if (type === "improved") return "improved";
    if (type === "favorite") return "favorite";
    return "";
  }

  function optionsFromApi(options) {
    if (!Array.isArray(options) || !options.length) return null;
    const tones = { A: "tone-a", B: "tone-b", C: "tone-c", D: "tone-a", E: "tone-b" };
    const plates = { A: "🌮", B: "🐟", C: "🍲", D: "🍗", E: "🥣" };
    return options.map((o) => {
      const letter = o.letter || "A";
      let attrs = {};
      if (o.attributes_json) {
        try {
          attrs =
            typeof o.attributes_json === "string" ? JSON.parse(o.attributes_json) : o.attributes_json;
        } catch (_) { attrs = {}; }
      }
      const minutes = o.minutes || attrs.minutes || null;
      const time = (o.time && /\d/.test(String(o.time)) ? o.time : "") || (minutes ? minutes + " min" : "");
      const effort = o.effort || attrs.effort || "";
      const storedChips = (Array.isArray(o.chips) && o.chips.length ? o.chips : null)
        || (Array.isArray(attrs.chips) && attrs.chips.length ? attrs.chips : null)
        || [];
      const mealFormat = o.meal_format || attrs.meal_format || "";
      const chips = storedChips.filter(function (chip) { return String(chip).toLowerCase() !== "shared"; });
      if (mealFormat && !chips.some(function (chip) { return String(chip).toLowerCase() === String(mealFormat).toLowerCase(); })) {
        chips.unshift(mealFormat);
      }
      return {
        letter,
        id: o.meal_option_id || o.id || (PLAN_ID + "-" + letter),
        title: o.title || attrs.title || o.name || ("Option " + letter),
        chips,
        plate: o.plate || attrs.plate || plates[letter] || "🍽️",
        tone: o.tone || attrs.tone || tones[letter] || "tone-a",
        time,
        effort,
        meal_format: mealFormat,
        cuisine: o.cuisine || attrs.cuisine || "",
        recipe_slug: o.recipe_slug || attrs.recipe_slug || null,
        recipe_version_id:
          o.recipe_version_id || o.recipe_version || attrs.recipe_version_id || null,
        pers: o.pers || attrs.pers || null,
      };
    });
  }

  function displayMeals() {
    if (state.currentMeals && state.currentMeals.length) return state.currentMeals;
    return meals;
  }

  function guestMeals() {
    return state.sharedMeals && state.sharedMeals.length ? state.sharedMeals : displayMeals();
  }

  function applyMealOptionsFromServer(list) {
    const mapped = optionsFromApi(list);
    if (mapped && mapped.length) {
      state.currentMeals = mapped;
      const ids = {};
      mapped.forEach(function (m) { ids[m.id] = true; });
      if (state.selectedMealId && !ids[state.selectedMealId]) {
        state.members.forEach(function (m) {
          state.ratings[m.id] = { score: null, note: "" };
        });
      }
      return true;
    }
    return false;
  }

  function mealCardHtml(m, opts) {
    const { selected, goDetail, guest, locked } = opts || {};
    const go = guest
      ? ` data-select="${escapeHtml(m.id)}"`
      : goDetail
        ? ` data-preview="${escapeHtml(m.id)}"`
        : "";
    const time = mealMinutes(m);
    const effort = m.effort || "";
    const metaBits = [];
    if (time) metaBits.push(`<span>${icon("clock")}${escapeHtml(time)}</span>`);
    if (effort) metaBits.push(`<span>${icon("gauge")}${escapeHtml(effort)}</span>`);
    (m.chips || [])
      .filter((c) => !/min/i.test(c))
      .slice(0, 2)
      .forEach((c) => metaBits.push(`<span class="chip">${escapeHtml(c)}</span>`));
    const meta = metaBits.length
      ? `<div class="option-meta" aria-label="Time, effort and style">${metaBits.join("")}</div>`
      : "";
    const pers = m.pers || {};
    const label = persLabel(pers);
    const persBadge = label
      ? `<span class="badge badge--sm ${pers.type === "new" ? "badge--accent" : "badge--match"} pers-chip ${persClass(pers.type)}">${escapeHtml(label)}</span>`
      : "";
    const canChoose = !guest && !locked && !selected;
    const letter = `<span class="option-card__letter" aria-hidden="true">${escapeHtml(m.letter)}</span>`;
    return `
      <article class="option-card is-pickable${selected ? " selected-mark" : ""}${locked && !selected ? " is-past-round" : ""}" role="listitem" tabindex="0" aria-pressed="${selected ? "true" : "false"}"${go} aria-label="Option ${escapeHtml(m.letter)}: ${escapeHtml(m.title)}">
        ${mealMediaHtml(m, { className: "option-card__media", inner: letter, decorative: true })}
        <span class="badge badge--sm badge--fit option-card__pick" aria-hidden="true">${icon("check")}Your pick</span>
        <div class="option-card__body">
          <h2>${escapeHtml(m.title)}</h2>
          <div class="badges">${persBadge}</div>
          ${pers.line ? `<p class="why">${escapeHtml(pers.line)}</p>` : ""}
          ${meta}
          <div class="option-card__actions">
            ${canChoose ? `<button class="btn btn-secondary btn-sm option-card__choose" type="button" data-select="${escapeHtml(m.id)}">${chooseLabel()}</button>` : ""}
            ${goDetail ? `<span class="option-card__cta" aria-hidden="true">View recipe ${icon("arrow-right")}</span>` : ""}
          </div>
        </div>
      </article>`;
  }

  function setChoiceLoading(on) {
    const el = document.getElementById("choiceLoading");
    if (el) el.hidden = !on;
  }

  function roundNoteHtml(prevMeal) {
    if (!prevMeal || !prevMeal.meal_name) return "";
    const score = prevMeal.avg_score != null ? " (" + Number(prevMeal.avg_score).toFixed(1) + "/10)" : "";
    return "Last round: <strong>" + escapeHtml(prevMeal.meal_name) + "</strong>" + escapeHtml(score) + ". It’s saved in History.";
  }

  /** Tonight shows one round. A finished round reads as finished, never as fresh picks. */
  function renderChoicesHead() {
    const eyebrow = document.getElementById("choicesEyebrow");
    const title = document.getElementById("choicesTitle");
    const lede = document.getElementById("choiceStripText");
    const note = document.getElementById("choicesRoundNote");
    const actions = document.getElementById("choicesActions");
    const shareCard = document.getElementById("shareCard");
    const picked = selectedMeal();
    const lockedTitle = picked ? picked.title : "Tonight’s dinner";
    note.hidden = true;
    actions.hidden = true;
    actions.innerHTML = "";
    if (shareCard) shareCard.hidden = false;
    if (state.outcomeLocked && state.lifecycle === "Rated") {
      eyebrow.textContent = "Last round";
      title.textContent = "That round’s a wrap";
      lede.textContent = "You made " + lockedTitle + " and everyone rated it. These picks stay put for reference.";
      actions.hidden = false;
      actions.innerHTML = `<button class="btn btn-primary btn-lg" type="button" data-action="next-dinner">Find our next dinner ${icon("arrow-right", "icon--forward")}</button>`;
      if (shareCard) shareCard.hidden = true;
      return;
    }
    if (state.outcomeLocked) {
      eyebrow.textContent = "Tonight’s picks";
      title.textContent = "Dinner’s cooked";
      lede.textContent = lockedTitle + " is logged. Rate it to wrap this round.";
      actions.hidden = false;
      actions.innerHTML = '<button class="btn btn-primary btn-lg" type="button" data-go="rate">Rate dinner</button>';
      if (shareCard) shareCard.hidden = true;
      return;
    }
    eyebrow.textContent = state.previousMeal ? "Fresh picks · new round" : "Tonight’s picks";
    title.textContent = "Which should we make?";
    stripCopy();
    if (state.previousMeal) {
      note.innerHTML = roundNoteHtml(state.previousMeal);
      note.hidden = false;
    }
  }

  function renderChoices() {
    if (hasCurrentDinnerPlan()) {
      renderTonightPlan();
      return;
    }
    setChoiceLoading(false);
    const list = displayMeals();
    renderChoicesHead();
    const cards = document.getElementById("choiceCards");
    if (!list.length) {
      cards.innerHTML = `<div class="empty-state" role="listitem">
          <span class="empty-state__icon">${icon("tonight")}</span>
          <strong>No picks on the table yet</strong>
          <span>We couldn’t weave tonight’s options just now. Give it another go.</span>
          <button class="btn btn-primary btn-sm" type="button" data-action="retry-choices">Try again</button>
        </div>`;
      return;
    }
    cards.innerHTML = list
      .map((m) =>
        mealCardHtml(m, {
          selected: state.selectedMealId === m.id,
          goDetail: true,
          locked: !!state.outcomeLocked,
        })
      )
      .join("");
    document.getElementById("shareIdMeta").textContent = "Share link ready";
  }

  function renderGuestChoices() {
    const list = guestMeals();
    document.getElementById("guestChoiceCards").innerHTML = list
      .map((m) => mealCardHtml(m, { selected: state.guestPick === m.id, guest: true }))
      .join("");
    const meta = document.getElementById("guestShareMeta");
    if (meta) {
      meta.textContent = state.sharedMeals
        ? "Shared picks for tonight"
        : "Shared picks for tonight";
    }
  }

  function syncBackButton(name, ctx) {
    const back = app.querySelector(`.view[data-view="${name}"] .back[data-back]`);
    if (!back) return;
    const target = Nav.backTarget(name, ctx);
    back.dataset.go = target;
    const label = back.querySelector(".back__label");
    if (label) label.textContent = Nav.backLabel(target);
    back.setAttribute("aria-label", target === "finished" || target === "taste" ? "Back" : "Back to " + Nav.backLabel(target));
  }

  let unknownViewNoted = false;

  function isKnownView(name) {
    if (!name || typeof name !== "string") return false;
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(name)) return false;
    return !!app.querySelector('.view[data-view="' + name + '"]');
  }

  function noteUnknownView() {
    if (unknownViewNoted) return;
    unknownViewNoted = true;
    reportClientError("nav", "unknown_view", "Unknown view");
  }

  /**
   * @param {string} requested view name
   * @param {{ context?: object, parent?: string, source?: string, force?: boolean }} [opts]
   */
  function show(requested, opts) {
    const o = opts || {};
    let name = o.force ? requested : Nav.guardView(requested, householdEstablished());
    if (!isKnownView(name)) {
      noteUnknownView();
      name = "home";
    }
    if (name === "cook" && cookTargetIsFinished()) {
      const meal = cookingMeal();
      const mealId = meal && meal.id;
      const planId = state.dinnerPlan && state.dinnerPlan.dinner_plan_id;
      releaseCookSession(planId, mealId);
      if (state.dinnerPlan && mealId) {
        openDinnerRating(state.dinnerPlan, mealId, "choices", null);
        return;
      }
      name = "choices";
    }
    const prev = state.view;
    if (name === "detail" && prev !== "detail") state.detailTabFor = null;
    if (prev === "constraints" && name !== "constraints") {
      const keys = state.primaryConstraints.slice();
      state.constraintSave = saveMyConstraints()
        .then(function (res) {
          if (res && res.ok) state.savedConstraints = keys;
        })
        .catch(function () {});
    }
    if (name === "planReview" || name === "planConfirm" || name === "planCount" || name === "shopList") {
      state.navContext[name] =
        o.context ||
        Nav.contextFor(name, prev, {
          established: householdEstablished(),
          parent: o.parent,
          source: o.source,
          origin: o.origin,
          mode: o.mode,
          current: state.navContext[name] || null,
        });
    }
    if (name === "find") {
      state.navContext[name] =
        o.context ||
        Nav.contextFor(name, prev, {
          established: householdEstablished(),
          mode: o.mode || "standalone",
          origin: o.origin,
          current: state.navContext[name] || null,
        });
    }
    if (name === "detail" || name === "invite" || name === "rate") {
      state.navContext[name] =
        o.context ||
        Nav.contextFor(name, prev, {
          established: householdEstablished(),
          parent: o.parent,
          source: o.source,
          origin: o.origin,
          mode: o.mode,
          current: state.navContext[name] || null,
        });
    }
    const ctx = state.navContext[name] || null;
    state.view = name;
    app.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("is-active", v.dataset.view === name);
    });
    app.dataset.chrome = Nav.chrome(name, ctx);
    topbar.classList.remove("hidden");
    tabbar.classList.remove("hidden");
    syncBackButton(name, ctx);

    const navKey = Nav.navSection(name, ctx);
    app.querySelectorAll("[data-nav]").forEach((t) => {
      const on = !!navKey && t.dataset.nav === navKey;
      t.classList.toggle("is-on", on);
      if (on) t.setAttribute("aria-current", "page");
      else t.removeAttribute("aria-current");
    });
    if (screenNav) {
      screenNav.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("is-on", b.dataset.go === name);
      });
    }

    if (prev !== name) {
      window.scrollTo(0, 0);
      const focused = document.activeElement;
      const focusLost =
        !focused || focused === document.body || !!focused.closest(".view:not(.is-active)");
      const heading = app.querySelector(".view.is-active h1, .view.is-active h2");
      if (focusLost && heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }

    renderProgressDots();
    syncAvatars();

    if (name === "members") renderMembers();
    if (name === "constraints") {
      const me = meMember();
      document.getElementById("constraintFor").textContent = me ? me.name + "’s" : "Your";
      renderConstraintGrid("constraints", state.primaryConstraints);
      ensureMemberSession().catch(function () {});
    }
    if (name === "taste") renderTasteOnboarding();
    if (prev === "taste" && name !== "taste") state.tasteSave = persistOnboardingTastes().catch(function () {});
    if (name === "invite") {
      renderInviteMode(ctx);
      refreshInviteUi();
      document.getElementById("inviteAttrMeta").textContent =
        "For your kitchen only · ready to share";
      publishInviteCode();
    }
    if (name === "join") renderConstraintGrid("joinConstraints", state.joinConstraints);
    if (name === "choices") {
      (async function () {
        await loadCurrentDinnerPlan();
        if (
          !hasCurrentDinnerPlan() &&
          legacyRoundActive() &&
          !displayMeals().length &&
          (API.householdId || state.householdId)
        ) {
          setChoiceLoading(true);
          await fetchRecommendationsPlan();
        }
        renderChoices();
      })();
      if (state.shareReady) refreshShareUi();
      if (!state.onboarded) {
        state.onboarded = true;
        track("onboarding_completed", { household_id: API.householdId || state.householdId });
      }
    }
    if (name === "settings") renderSettings();
    if (name === "meals") renderMealHistory();
    if (name === "tasteProfile") renderTasteProfile();
    if (name === "shareGuest") {
      renderGuestChoices();
      track("share_choice_viewed", {
        share_object_id: state.shareObjectId,
        anon_or_member: "anon",
        plan_id: PLAN_ID,
      });
    }
    if (name === "detail") {
      // Pin the meal before the recipe request returns. A later render must not
      // snap the tabs back to Overview after a keypress already moved them.
      const openingMeal = detailMeal();
      const openingKey = openingMeal ? openingMeal.id : "";
      if (state.detailTabFor !== openingKey) {
        state.detailTabFor = openingKey;
        selectRecipeTab("tab-overview", false);
      }
      ensureRecipeForMeal(openingMeal).then(function () {
        renderDetail();
      });
    }
    if (name === "cook") {
      // Entering the kitchen confirms the session, even if begin_cook
      // is still on the wire. A pending id alone does not.
      if (state.dinnerCookPendingId) confirmCookSession(state.dinnerCookPendingId);
      ensureRecipeForMeal(cookingMeal()).then(function () {
        renderCook();
      });
    }
    if (name === "rate") {
      if (state.dinnerRateMealId) initPlanRatingsForMeal(state.dinnerRateMealId);
      renderRaters();
      if (!state.tasteCatalog) {
        loadTasteCatalog().then(function () {
          if (state.view === "rate" && state.tasteCatalog) renderRaters();
        });
      }
    }
    if (name === "planCount") renderPlanCount();
    if (name === "planReview") renderPlanReview();
    if (name === "planConfirm") renderPlanConfirm();
    if (name === "shopList") {
      track("shopping_opened", {
        dinner_plan_id: state.dinnerPlan && state.dinnerPlan.dinner_plan_id,
        line_count: ((state.householdShop && state.householdShop.list && state.householdShop.list.lines) || []).length,
      });
      (async function () {
        if (!state.dinnerPlan) await loadCurrentDinnerPlan();
        await refreshDinnerShopping();
        await loadHouseholdShop();
        await refreshGroceryProviders();
        if (state.view === "shopList") renderShopList();
      })();
    }
    if (name === "choices" && hasCurrentDinnerPlan()) {
      renderTonightPlan();
    }
    if (name === "loop") renderLoopSummary();
    if (name === "find" && Discovery) {
      Discovery.onShow();
    }
    if (name === "home") {
      (async function () {
        await loadCurrentDinnerPlan();
        updateHome();
      })();
    }
    if (name === "demo" || name === "invite" || name === "rate" || name === "home") {
      syncHouseholdChrome();
    }
    updateDebug();
    if (state.navHistory && state.navHistory.armInAppBack) state.navHistory.armInAppBack();
  }

  function homeStage(meal) {
    if (!meal) return "pick";
    if (state.lifecycle === "Rated" || state.nextAction === "loop_complete") return "done";
    if (state.lifecycle === "Cooked" || state.nextAction === "rate_meal") return "rate";
    return "cook";
  }

  function stripCopy() {
    const strip = document.getElementById("choiceStripText");
    if (!strip) return;
    const fit = activeMemberCount() === 2 ? "both of you" : householdCopy("fit");
    strip.textContent =
      "Options that fit " + fit + ". Peek at any recipe — nothing’s chosen until you " +
      (activeMemberCount() > 1 ? "vote" : "choose") + ".";
  }

  function updateHome() {
    const ratingCard = document.getElementById("homeRatingWait");
    if (hasCurrentDinnerPlan()) {
      renderHomePlanHero();
      return;
    }
    if (!legacyRoundActive()) {
      renderHomeNoPlanHero();
      return;
    }
    const pill = document.getElementById("homePill");
    const eye = document.getElementById("homeEyebrow");
    const homeTitle = document.getElementById("homeMealTitle");
    const homeMeta = document.getElementById("homeMealMeta");
    const homeCopy = document.getElementById("homeStatusCopy");
    const homeLede = document.getElementById("homeLede");
    const actions = document.getElementById("homeActions");
    const media = document.getElementById("homeMedia");
    const insights = document.getElementById("homeInsights");
    const meal = selectedMeal();
    const stage = homeStage(meal);
    const both = activeMemberCount() === 2;

    if (homeCopy) {
      homeCopy.hidden = false;
      homeCopy.textContent = "Fits " + householdCopy("fit");
    }
    if (pill) pill.hidden = false;

    if (stage === "pick") {
      const options = displayMeals();
      eye.textContent = state.previousMeal ? "Fresh picks · new round" : "Tonight’s picks";
      homeTitle.textContent = options.length
        ? options.length + " " + dinnerCountWord(options.length) + " worth choosing"
        : "Pick tonight’s meal";
      homeLede.textContent =
        (options.length
          ? "Each one clears everyone’s hard limits. Pick one — or send the set so " + householdCopy("both") + " can weigh in."
          : "We’ll weave a few options that fit everyone at the table.") +
        (state.previousMeal && state.previousMeal.meal_name
          ? " Last round’s " + state.previousMeal.meal_name + " is saved in History."
          : "");
      pill.textContent = "Ready";
      homeMeta.hidden = true;
      actions.innerHTML = `<button class="btn btn-primary btn-lg" type="button" data-go="choices">See tonight’s picks ${icon("arrow-right", "icon--forward")}</button>`;
      media.className = "tonight-hero__media" + (options.length > 1 ? " tonight-hero__media--stack" : "");
      media.innerHTML = options.length
        ? options.slice(0, 3).map((m) => mealMediaHtml(m, { decorative: true, eager: true, sizes: "(min-width: 1024px) 18vw, 33vw" })).join("")
        : mealMediaHtml({ recipe_slug: "miso-ginger-salmon" }, { decorative: true, eager: true });
      insights.hidden = true;
      stripCopy();
      return;
    }

    const pers = meal.pers || {};
    homeTitle.textContent = meal.title;
    media.className = "tonight-hero__media";
    media.innerHTML = mealMediaHtml(meal, { eager: true, sizes: "(min-width: 1024px) 55vw, 100vw" });
    const minutes = mealMinutes(meal, recipeLoadedFor(meal));
    homeMeta.hidden = !minutes;
    homeMeta.innerHTML = minutes ? icon("clock") + escapeHtml(minutes) : "";

    if (stage === "cook") {
      eye.textContent = "Tonight’s pick";
      homeLede.textContent = pers.line || "Clears everyone’s hard limits. Cook it, then rate it together.";
      pill.textContent = persLabel(pers) || "Picked";
      actions.innerHTML =
        `<button class="btn btn-primary btn-lg" type="button" data-action="home-cook">Start cooking ${icon("arrow-right", "icon--forward")}</button>` +
        `<button class="btn btn-secondary btn-lg" type="button" data-go="detail">View full recipe</button>`;
    } else if (stage === "rate") {
      const waiting = membersAwaitingRating();
      eye.textContent = state.ratingState === "partial" ? "Cooked · partial ratings saved" : "Cooked · waiting on ratings";
      homeLede.textContent =
        waiting.length && waiting.length < activeMembers().length
          ? "Dinner is logged. " + waiting.join(", ") + (waiting.length === 1 ? " still has a rating" : " still have ratings") + " waiting whenever they’re ready."
          : "Dinner is logged. Rate it while it’s fresh — each of you, 1–10.";
      pill.textContent = "Cooked";
      actions.innerHTML =
        `<button class="btn btn-primary btn-lg" type="button" data-go="rate">Rate dinner</button>` +
        `<button class="btn btn-secondary btn-lg" type="button" data-go="detail">View recipe</button>`;
    } else {
      eye.textContent = both ? "Both of you rated" : "Everyone rated";
      homeLede.textContent = "Saved to History. Those ratings now shape your next round of picks.";
      pill.textContent = "Rated";
      actions.innerHTML =
        `<button class="btn btn-primary btn-lg" type="button" data-action="next-dinner">Find our next dinner ${icon("arrow-right", "icon--forward")}</button>` +
        `<button class="btn btn-secondary btn-lg" type="button" data-go="meals">See meals &amp; ratings</button>`;
    }
    stripCopy();
    fillHomeInsights(meal);
  }

  function fillHomeInsights(meal) {
    const insights = document.getElementById("homeInsights");
    const why = document.getElementById("homeWhy");
    const ingCount = document.getElementById("homeIngCount");
    const stepCount = document.getElementById("homeStepCount");
    why.textContent = (meal.pers && meal.pers.line) || "Clears everyone’s hard limits.";
    const paint = function (recipe) {
      if (!recipe || state.view !== "home") return;
      const ings = (recipe.ingredients || []).length;
      const steps = (recipe.steps || []).length;
      ingCount.textContent = ings ? ings + " ingredients · serves " + (recipe.requested_servings || recipe.servings) : "—";
      stepCount.textContent = steps ? steps + " steps" + (recipe.total_minutes ? " (~" + recipe.total_minutes + " min)" : "") : "—";
      insights.hidden = false;
      const homeMeta = document.getElementById("homeMealMeta");
      if (recipe.total_minutes && homeMeta) {
        homeMeta.hidden = false;
        homeMeta.innerHTML = icon("clock") + recipe.total_minutes + " min";
      }
    };
    const loaded = recipeLoadedFor(meal);
    if (loaded) paint(loaded);
    else {
      insights.hidden = true;
      ensureRecipeForSelection().then(paint).catch(function () {});
    }
  }

  function selectRecipeTab(id, focus) {
    const tabs = document.querySelectorAll("#detailTabs [role=tab]");
    tabs.forEach(function (t) {
      const on = t.id === id;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
      if (on && focus) t.focus();
    });
  }

  /** Card and detail wording for an explicit pick: a vote when more than one active diner decides. */
  function chooseLabel() {
    return activeMemberCount() > 1 ? "Vote for this one" : "Choose this dinner";
  }

  /** Legacy plans stored "Why this" as the label; it only repeats the kicker. */
  function persLabel(pers) {
    const label = pers && pers.label ? String(pers.label).trim() : "";
    if (!label || /^why this/i.test(label)) return "";
    return label;
  }

  function detailPickState(meal) {
    if (!meal) return { text: "", chosen: false, action: "none" };
    if (meal.dinner_plan && state.dinnerPlan) {
      const raw = planMealById(meal.id);
      const ctx = state.navContext.detail || {};
      if (!raw) return { text: "", chosen: false, action: "none" };
      if (raw.state === "selected") return { text: "Tonight’s pick", chosen: true, action: "cook" };
      if (raw.state === "cooking") return { text: "Pick up where you left off.", chosen: true, action: "cook" };
      if (raw.state === "cooked" || raw.state === "partially_rated" || raw.state === "fully_rated") {
        return { text: "", chosen: false, action: "none" };
      }
      if (ctx.origin === "planReview") {
        return { text: "Just looking. Nothing changes until you start cooking.", chosen: false, action: "cook" };
      }
      return { text: "", chosen: false, action: "cook" };
    }
    if (meal.historical) {
      const bits = ["From a past round"];
      if (meal.avg_score != null) bits.push("rated " + Number(meal.avg_score).toFixed(1) + "/10");
      return { text: bits.join(" · ") + ". Viewing it doesn’t add it to tonight.", chosen: false, action: "none" };
    }
    if (meal.id === state.selectedMealId) {
      const logged = state.lifecycle === "Cooked" || state.lifecycle === "Rated";
      return { text: logged ? "Tonight’s pick · cooked and logged" : "Tonight’s pick", chosen: true, action: "cook" };
    }
    if (state.outcomeLocked) {
      return {
        text: "Just looking. This round’s dinner is already logged, so this one stays on the shelf.",
        chosen: false,
        action: "none",
      };
    }
    if (activeMemberCount() > 1) {
      return { text: "Just looking — your vote only counts when you tap Vote for this one.", chosen: false, action: "choose" };
    }
    return { text: "Just looking — nothing’s chosen until you tap Choose this dinner.", chosen: false, action: "choose" };
  }

  function syncDiscoveryDetailActions(meal) {
    const ctx = state.navContext.detail;
    if (!ctx || ctx.source !== "discovery") return false;
    const disc = Discovery && Discovery.getState ? Discovery.getState() : { mode: "standalone" };
    const mode = disc.mode || ctx.mode || "standalone";
    const plan = state.dinnerPlan;
    const position = (disc.urlContext && disc.urlContext.position) || (disc.urlContext && disc.urlContext.meal_id && planMealById(disc.urlContext.meal_id) && planMealById(disc.urlContext.meal_id).position);
    const replaceMeal = disc.urlContext && disc.urlContext.meal_id ? planMealById(disc.urlContext.meal_id) : null;
    const cookBtn = document.getElementById("btnStartCook");
    const previewBtn = document.getElementById("btnPreviewSteps");
    const eyebrow = document.getElementById("detailEyebrow");
    const pickEl = document.getElementById("detailPickState");
    const whyLabel = document.getElementById("detailWhyLabel");
    const whyEl = document.getElementById("detailWhy");
    const whyLines = meal && meal.discoveryWhyLines ? meal.discoveryWhyLines : [];
    if (whyLabel) {
      whyLabel.textContent = "Why this one";
      whyLabel.hidden = !whyLines.length;
    }
    if (whyEl) {
      if (whyLines.length) {
        whyEl.textContent = whyLines.join("\n");
        whyEl.hidden = false;
      } else {
        whyEl.textContent = "";
        whyEl.hidden = true;
      }
    }
    if (eyebrow) {
      if (mode === "standalone") eyebrow.textContent = "Just looking. Nothing changes until you choose.";
      else if (mode === "replace_plan_meal" && replaceMeal) {
        const plan = state.dinnerPlan;
        const single = plan && plan.meal_count === 1;
        eyebrow.textContent =
          (single ? "Swapping tonight’s dinner" : "Swapping Dinner " + replaceMeal.position) +
          " · Now: " +
          planMealTitle(replaceMeal);
      } else if (mode === "choose_for_plan") eyebrow.textContent = "For Dinner " + (position || "—");
      else eyebrow.textContent = "From Discovery";
    }
    if (pickEl) pickEl.textContent = mode === "standalone" ? "" : " ";
    if (cookBtn) {
      cookBtn.hidden = false;
      delete cookBtn.dataset.go;
      if (mode === "standalone") {
        cookBtn.dataset.action = "discovery-cook-tonight";
        cookBtn.textContent = "Cook tonight";
      } else if (mode === "replace_plan_meal") {
        cookBtn.dataset.action = "discovery-use";
        cookBtn.textContent =
          plan && plan.meal_count === 1 ? "Use this for tonight" : "Use this for Dinner " + (replaceMeal && replaceMeal.position);
      } else {
        cookBtn.dataset.action = "discovery-add";
        cookBtn.textContent = "Add this to Dinner " + (position || "—");
      }
    }
    if (previewBtn) {
      if (mode === "standalone") {
        previewBtn.hidden = false;
        previewBtn.className = "btn btn-secondary btn-lg";
        if (hasCurrentDinnerPlan() && plan && !planIsClosed(plan)) {
          previewBtn.dataset.action = "discovery-add-plan";
          previewBtn.textContent = "Add to plan";
        } else {
          previewBtn.dataset.action = "discovery-add-list";
          previewBtn.textContent = "Add to my shopping list";
        }
        delete previewBtn.dataset.go;
        delete previewBtn.dataset.mealId;
      } else {
        previewBtn.hidden = true;
      }
    }
    return true;
  }

  function planMealId(meal) {
    return meal && (meal.id || meal.meal_id);
  }

  /**
   * Resume only after cooking has actually started: the server says so,
   * or the kitchen is open for this meal. An in-flight begin_cook
   * (dinnerCookPendingId) must not relabel the recipe button.
   */
  function mealIsActiveCook(meal) {
    if (!meal) return false;
    const id = planMealId(meal);
    if (id && state.dinnerCookMealId === id) return true;
    if (meal.state === "cooking") return true;
    const raw = id ? planMealById(id) : null;
    return !!(raw && raw.state === "cooking");
  }

  function confirmCookSession(mealId) {
    if (!mealId) return;
    state.dinnerCookMealId = mealId;
    if (state.dinnerCookPendingId === mealId) state.dinnerCookPendingId = null;
    const planId = state.dinnerPlan && state.dinnerPlan.dinner_plan_id;
    if (planId) {
      const saved = readCookStep(planId, mealId);
      if (saved > 0) state.cookStep = saved;
    }
  }

  function cookStepKey(planId, mealId) {
    return "fw_cook_step:" + planId + ":" + mealId;
  }

  function readCookStep(planId, mealId) {
    if (!planId || !mealId) return 0;
    try {
      return Math.max(0, Number(sessionStorage.getItem(cookStepKey(planId, mealId)) || 0) || 0);
    } catch (_) {
      return 0;
    }
  }

  function writeCookStep(planId, mealId, step) {
    if (!planId || !mealId) return;
    try {
      sessionStorage.setItem(cookStepKey(planId, mealId), String(Math.max(0, Number(step) || 0)));
    } catch (_) { /* private mode */ }
  }

  function clearCookStep(planId, mealId) {
    if (!planId || !mealId) return;
    try {
      sessionStorage.removeItem(cookStepKey(planId, mealId));
    } catch (_) { /* private mode */ }
  }

  function mealIsLoggedCooked(mealState) {
    return mealState === "cooked" || mealState === "partially_rated" || mealState === "fully_rated";
  }

  function captureCookStep(planId, mealId) {
    if (mealId && state.dinnerCookMealId === mealId) return Math.max(0, Number(state.cookStep) || 0);
    return readCookStep(planId, mealId);
  }

  /** Drop the open kitchen for a meal that is now cooked. Undo restores the step from its own record. */
  function releaseCookSession(planId, mealId) {
    if (!mealId) return;
    if (state.dinnerCookMealId === mealId) {
      state.dinnerCookMealId = null;
      state.cookStep = 0;
    }
    if (state.dinnerCookPendingId === mealId) state.dinnerCookPendingId = null;
    if (state.cookingMealId === mealId) state.cookingMealId = null;
    clearCookStep(planId, mealId);
  }

  function cookTargetIsFinished() {
    const meal = cookingMeal();
    if (!meal || !meal.dinner_plan) return false;
    const raw = planMealById(meal.id);
    return !!(raw && mealIsLoggedCooked(raw.state));
  }

  function normalizeRatingReturn(view) {
    if (view === "choices" || view === "tonightPlan" || view === "cook") return "choices";
    if (
      view === "home" ||
      view === "meals" ||
      view === "finished" ||
      view === "detail" ||
      view === "find" ||
      view === "settings" ||
      view === "tasteProfile" ||
      view === "planReview" ||
      view === "planConfirm" ||
      view === "shopList" ||
      view === "planCount"
    ) {
      return view;
    }
    return "home";
  }

  function resumeStepNumber(meal) {
    const id = planMealId(meal);
    if (id && state.dinnerCookMealId === id) return Math.max(1, (Number(state.cookStep) || 0) + 1);
    return 1;
  }

  function syncDetailActions(meal) {
    if (syncDiscoveryDetailActions(meal)) return;
    const cookBtn = document.getElementById("btnStartCook");
    const previewBtn = document.getElementById("btnPreviewSteps");
    const eyebrow = document.getElementById("detailEyebrow");
    const pickEl = document.getElementById("detailPickState");
    const pick = detailPickState(meal);
    const rawPlan = meal && meal.dinner_plan ? planMealById(meal.id) : null;
    if (eyebrow) {
      if (rawPlan) {
        eyebrow.textContent = "On your plan · " + planMealLabel(rawPlan);
      } else {
        eyebrow.textContent = pick.chosen
          ? "Tonight’s pick"
          : meal && meal.historical
            ? "From your history"
            : meal && meal.letter
              ? "Option " + meal.letter
              : "Recipe";
      }
    }
    if (pickEl) {
      pickEl.textContent = pick.text;
      pickEl.classList.toggle("pick-state--chosen", pick.chosen);
    }
    if (cookBtn) {
      cookBtn.hidden = pick.action === "none";
      if (mealIsActiveCook(meal)) {
        cookBtn.dataset.action = "cook";
        cookBtn.dataset.go = "cook";
        cookBtn.innerHTML = "Resume step " + resumeStepNumber(meal) + " " + icon("arrow-right", "icon--forward");
      } else if (pick.action === "choose") {
        cookBtn.dataset.action = "choose";
        delete cookBtn.dataset.go;
        cookBtn.textContent = chooseLabel();
      } else if (state.lifecycle === "Cooked" || state.lifecycle === "Rated") {
        cookBtn.dataset.action = "cook";
        cookBtn.dataset.go = "cook";
        cookBtn.innerHTML = "Read the steps " + icon("arrow-right", "icon--forward");
      } else {
        cookBtn.dataset.action = "cook";
        cookBtn.dataset.go = "cook";
        cookBtn.innerHTML = "Start cooking " + icon("arrow-right", "icon--forward");
      }
    }
    if (previewBtn) {
      if (rawPlan && rawPlan.state === "planned") {
        previewBtn.hidden = false;
        previewBtn.className = "btn btn-secondary btn-lg";
        previewBtn.textContent = "Pick for tonight";
        previewBtn.dataset.action = "pick-for-tonight-detail";
        previewBtn.dataset.mealId = meal.id;
        delete previewBtn.dataset.go;
      } else {
        previewBtn.hidden = pick.action !== "choose";
        delete previewBtn.dataset.action;
        delete previewBtn.dataset.mealId;
      }
    }
  }

  function renderDetail() {
    const meal = detailMeal();
    const recipe = state.activeRecipe;
    const titleEl = document.getElementById("detailTitle");
    const mediaEl = document.getElementById("detailMedia");
    const whyEl = document.getElementById("detailWhy");
    const whyLabel = document.getElementById("detailWhyLabel");
    const ingEl = document.getElementById("detailIngredients");
    const stepsEl = document.getElementById("detailSteps");
    const chipsEl = document.getElementById("detailChips");
    const statsEl = document.getElementById("detailStats");
    const notesEl = document.getElementById("detailNotes");
    const servingsNote = document.getElementById("detailServingsNote");
    const detailKey = meal ? meal.id : "";
    if (state.detailTabFor !== detailKey) {
      state.detailTabFor = detailKey;
      selectRecipeTab("tab-overview", false);
    }
    if (mediaEl) {
      mediaEl.outerHTML = mealMediaHtml(meal || {}, {
        className: "recipe__media",
        eager: true,
        sizes: "(min-width: 1024px) 50vw, 100vw",
      }).replace('<div class="', '<div id="detailMedia" class="');
    }
    syncDetailActions(meal);
    if (!meal || !recipe) {
      if (titleEl) titleEl.textContent = meal ? meal.title : "Load a pick first";
      if (whyEl) whyEl.textContent = meal ? "We couldn’t load the full recipe. Check your connection and try again." : "Pick one of tonight’s options to see the recipe.";
      if (statsEl) statsEl.innerHTML = "";
      return;
    }
    if (meal.discovery) {
      meal.discoveryWhyLines = buildDiscoveryWhyLines(
        meal.discoveryRow || discoveryResultRow(meal.recipe_slug),
        recipe
      );
    }
    const pers = meal.pers || {};
    if (titleEl) titleEl.textContent = recipe.title || meal.title;
    if (whyLabel) {
      whyLabel.textContent = meal.historical ? "Last time" : "Why this one";
      if (meal.discovery) whyLabel.hidden = !(meal.discoveryWhyLines && meal.discoveryWhyLines.length);
    }
    if (whyEl) {
      if (meal.discovery) {
        const lines = meal.discoveryWhyLines || [];
        whyEl.textContent = lines.join("\n");
        whyEl.hidden = !lines.length;
      } else if (meal.historical) {
        whyEl.hidden = false;
        whyEl.textContent =
          meal.avg_score != null
            ? "Your table rated it " + Number(meal.avg_score).toFixed(1) + "/10."
            : "Cooked here before.";
      } else {
        const row = meal.discoveryRow || discoveryResultRow(meal.recipe_slug);
        const intent = state.dinnerPlan && state.dinnerPlan.intent;
        const reason =
          window.FlavorWeaveExplanation &&
          window.FlavorWeaveExplanation.reasonLineFromMeal(meal, row, intent);
        if (reason) {
          whyEl.hidden = false;
          whyEl.textContent = reason;
        } else {
          whyEl.hidden = true;
          whyEl.textContent = "";
        }
      }
    }
    let serves = recipe.requested_servings || recipe.servings;
    if (meal.discovery) {
      const n = discoveryParticipantCount();
      if (n != null) serves = n;
      else if (recipe.base_servings != null) serves = recipe.base_servings;
      else if (recipe.servings != null) serves = recipe.servings;
    } else if (!serves) {
      serves = servingCountForMeal();
    }
    if (chipsEl) {
      const badges = [
        meal.historical
          ? '<span class="badge badge--success" id="detailLockChip">' + icon("history") + "Cooked before</span>"
          : meal.discovery
            ? '<span class="badge badge--fit" id="detailLockChip">Fits everyone eating</span>'
            : '<span class="badge badge--fit" id="detailLockChip">Fits ' + escapeHtml(householdCopy("fit")) + "</span>",
      ];
      const rawPlan = meal.dinner_plan ? planMealById(meal.id) : null;
      if (rawPlan && window.FlavorWeaveMealRecipe && window.FlavorWeaveMealRecipe.adaptationChangeCount(rawPlan) > 0) {
        badges.push('<span class="badge badge--your-version">Your version</span>');
      }
      const label = meal.historical ? "" : persLabel(pers);
      if (label) badges.push('<span class="badge badge--match">' + escapeHtml(label) + "</span>");
      if (recipe.total_minutes) badges.push('<span class="badge badge--time">' + icon("clock") + recipe.total_minutes + " min</span>");
      while (badges.length > 3) {
        const timeIdx = badges.findIndex(function (b) {
          return b.indexOf("badge--time") >= 0;
        });
        if (timeIdx >= 0) badges.splice(timeIdx, 1);
        else if (badges.some(function (b) {
          return b.indexOf("badge--match") >= 0;
        })) {
          const matchIdx = badges.findIndex(function (b) {
            return b.indexOf("badge--match") >= 0;
          });
          badges.splice(matchIdx, 1);
        } else badges.pop();
      }
      chipsEl.innerHTML = badges.join("");
    }
    const dinerLine = document.getElementById("detailDinerLine");
    const versionLine = document.getElementById("detailVersionLine");
    const weaveHost = document.getElementById("detailWeaveHost");
    const rawPlanMeal = meal.dinner_plan ? planMealById(meal.id) : null;
    if (dinerLine) {
      if (rawPlanMeal) {
        dinerLine.hidden = false;
        dinerLine.innerHTML =
          cookingForLabel(dinerCountForPlanMeal(rawPlanMeal)) +
          ' · <button type="button" class="btn btn-quiet btn-sm" data-action="open-participants" data-meal-id="' +
          escapeHtml(rawPlanMeal.meal_id) +
          '">Change</button>';
      } else if (meal.discovery && !meal.dinner_plan) {
        const n = state.detailViewingServings != null ? state.detailViewingServings : activeMemberCount();
        dinerLine.hidden = false;
        dinerLine.innerHTML =
          'Cooking for <span class="guest-stepper" role="group" aria-label="Viewing count">' +
          '<button type="button" class="btn btn-quiet btn-sm" data-action="detail-servings-down" aria-label="One fewer">−</button> ' +
          String(n) +
          ' <button type="button" class="btn btn-quiet btn-sm" data-action="detail-servings-up" aria-label="One more">+</button></span>';
      } else {
        dinerLine.hidden = true;
      }
    }
    if (versionLine) {
      const changes = rawPlanMeal && window.FlavorWeaveMealRecipe
        ? window.FlavorWeaveMealRecipe.adaptationChangeCount(rawPlanMeal)
        : 0;
      if (changes > 0) {
        versionLine.hidden = false;
        versionLine.innerHTML =
          "Your version · " +
          changes +
          (changes === 1 ? " change" : " changes") +
          ' · <button type="button" class="btn btn-quiet btn-sm" data-action="see-adapt-changes" data-meal-id="' +
          escapeHtml(rawPlanMeal.meal_id) +
          '">See what changed</button>';
      } else {
        versionLine.hidden = true;
      }
    }
    if (weaveHost) {
      const showWeave = !meal.historical && recipe && recipe.recipe_version_id;
      weaveHost.hidden = !showWeave;
      if (showWeave) {
        mountRecipeWeave();
      }
    }
    if (statsEl) {
      const effortLevel = recipe.effort_level || recipe.effort || meal.effort;
      const stats = [
        ["clock", (recipe.total_minutes || "—") + " minutes", "Total time"],
      ];
      if (!meal.discovery) {
        stats.push(["gauge", recipe.effort_label || effortLevel || "—", "Effort"]);
      } else if (effortLevel === "easy") {
        stats.push(["gauge", "Easy", "Effort"]);
      }
      statsEl.innerHTML = stats
        .map(function (s) {
          return `<div class="stat">${icon(s[0])}<dt>${s[2]}</dt><dd>${escapeHtml(s[1])}</dd></div>`;
        })
        .join("");
    }
    if (servingsNote) {
      const dinerN = rawPlanMeal ? dinerCountForPlanMeal(rawPlanMeal) : serves;
      servingsNote.textContent = cookingForLabel(dinerN);
      if (recipe.base_servings && recipe.base_servings !== dinerN) {
        servingsNote.textContent += " · Recipe written for " + recipe.base_servings + " — amounts adjusted.";
      }
    }
    const changedIds = recipe._changedIngredientIds;
    const changedSteps = recipe._changedStepNumbers;
    if (ingEl) {
      ingEl.innerHTML = (recipe.ingredients || [])
        .map(function (i) {
          const note = i.note ? ` <span class="ing-note">${escapeHtml(i.note)}</span>` : "";
          const id = i.ingredient_id || i.name;
          const changed = changedIds && changedIds.has && changedIds.has(id);
          return (
            '<li class="' +
            (changed ? "is-changed" : "") +
            '"><span class="qty">' +
            escapeHtml(i.quantity || "") +
            "</span><span>" +
            escapeHtml(i.name) +
            note +
            (changed ? '<span class="ing-changed-label">Changed</span>' : "") +
            "</span></li>"
          );
        })
        .join("");
    }
    renderEquipment(recipe);
    if (stepsEl) {
      stepsEl.innerHTML = (recipe.steps || [])
        .map(function (s, idx) {
          const num = s.step_number || idx + 1;
          const changed = changedSteps && changedSteps.has && changedSteps.has(num);
          return (
            '<li class="' +
            (changed ? "is-changed" : "") +
            '" data-n="' +
            (idx + 1) +
            '"><div><strong>' +
            escapeHtml(s.title) +
            "</strong>" +
            (changed ? '<span class="ing-changed-label">Changed</span>' : "") +
            (s.body ? "<p>" + escapeHtml(s.body) + "</p>" : "") +
            "</div></li>"
          );
        })
        .join("");
    }
    if (notesEl) {
      const humanize = function (x) {
        return String(x).replace(/[_-]+/g, " ").replace(/^\w/, function (c) { return c.toUpperCase(); });
      };
      const notes = [];
      if (recipe.prep_minutes != null || recipe.cook_minutes != null) {
        notes.push(["Timing", (recipe.prep_minutes || 0) + " min prep · " + (recipe.cook_minutes || 0) + " min cooking"]);
      }
      if (recipe.methods && recipe.methods.length) notes.push(["Method", recipe.methods.map(humanize).join(", ")]);
      if (recipe.dietary_tags && recipe.dietary_tags.length) notes.push(["Diet notes", recipe.dietary_tags.map(humanize).join(", ")]);
      if (!meal.historical) {
        notes.push(["Household fit", "Clears every active diner’s hard limits. Likes only shape the order."]);
      }
      notesEl.innerHTML = notes
        .map(function (n) {
          return `<div><dt>${escapeHtml(n[0])}</dt><dd>${escapeHtml(n[1])}</dd></div>`;
        })
        .join("");
    }
    track("recipe_opened", {
      plan_id: meal.historical ? meal.plan_id || null : API.planId || null,
      meal_option_id: meal.id,
      recipe_slug: recipe.recipe_slug,
      recipe_version_id: recipe.recipe_version_id,
    });
  }

  function isQaMode() {
    try {
      return new URLSearchParams(location.search).get("qa") === "1"
        || localStorage.getItem("he_qa") === "1";
    } catch (_) {
      return false;
    }
  }

  function applyQaChrome() {
    const on = isQaMode();
    document.body.classList.toggle("qa-on", on);
    if (debug) {
      debug.hidden = !on;
      if (!on) debug.textContent = "";
    }
  }

  function updateDebug() {
    applyQaChrome();
    if (!isQaMode() || !debug) return;
    const scores = state.members
      .map((m) => `${m.initial}:${state.ratings[m.id]?.score ?? "—"}`)
      .join(" ");
    debug.hidden = false;
    debug.textContent = `${state.lifecycle} · 1–10 · ${scores}`;
  }

  function renderCook() {
    if (cookTargetIsFinished()) {
      const meal = cookingMeal();
      const mealId = meal && meal.id;
      releaseCookSession(state.dinnerPlan && state.dinnerPlan.dinner_plan_id, mealId);
      if (state.dinnerPlan && mealId) openDinnerRating(state.dinnerPlan, mealId, "choices", null);
      else show("choices");
      return;
    }
    const steps = cookSteps();
    const i = state.cookStep;
    const cookMeal = document.getElementById("cookMealTitle");
    const cookDiner = document.getElementById("cookDinerLine");
    const meal = cookingMeal();
    const raw = meal && meal.dinner_plan ? planMealById(meal.id) : null;
    if (cookMeal) {
      let title =
        (state.activeRecipe && state.activeRecipe._mealId === (meal && meal.id) && state.activeRecipe.title) ||
        (meal && meal.title) ||
        "Kitchen mode";
      if (raw && window.FlavorWeaveMealRecipe && window.FlavorWeaveMealRecipe.adaptationChangeCount(raw) > 0) {
        title += " · Your version";
      }
      cookMeal.textContent = title;
    }
    if (cookDiner) {
      if (raw) {
        cookDiner.hidden = false;
        cookDiner.textContent = cookingForLabel(dinerCountForPlanMeal(raw));
        cookDiner.dataset.mealId = raw.meal_id;
      } else {
        cookDiner.hidden = true;
      }
    }
    mountRecipeWeave();
    if (!steps.length) {
      document.getElementById("cookStepTitle").textContent = "Recipe not loaded";
      document.getElementById("cookStepBody").textContent =
        "Go back and open the recipe again when you’re online.";
      return;
    }
    const step = steps[i];
    const n = steps.length;
    document.getElementById("cookStepMeta").textContent = `${i + 1} / ${n}`;
    document.getElementById("cookStepLabel").textContent = `Step ${i + 1}`;
    document.getElementById("cookStepTitle").textContent = step.title;
    document.getElementById("cookStepBody").textContent = step.body;
    const ings = step.ingredients || step.ings || [];
    document.getElementById("cookIngList").innerHTML = ings.map((x) => `<li>${escapeHtml(x)}</li>`).join("");
    const prog = document.getElementById("cookProgress");
    prog.setAttribute("aria-valuenow", String(i + 1));
    prog.setAttribute("aria-valuemax", String(n));
    prog.setAttribute("aria-label", `Cooking step ${i + 1} of ${n}`);
    prog.innerHTML = steps
      .map((_, idx) => {
        const cls = idx === i ? "is-on" : idx < i ? "is-done" : "";
        return `<span class="dot ${cls}"></span>`;
      })
      .join("");
    const prev = document.getElementById("btnPrevStep");
    const next = document.getElementById("btnNextStep");
    prev.disabled = i === 0;
    prev.style.visibility = i === 0 ? "hidden" : "visible";
    if (i >= n - 1) {
      next.textContent = "Finish";
      next.className = "btn btn-primary btn-lg btn-finish";
      next.dataset.action = "finish";
    } else {
      next.textContent = "Next";
      next.className = "btn btn-primary btn-lg btn-next";
      next.dataset.action = "next";
    }
  }

  const cookWrites = new Set();
  const mealCookChain = new Map();

  function enqueueMealCook(planId, mealId, task) {
    const key = planId + ":" + mealId;
    const previous = mealCookChain.get(key) || Promise.resolve();
    const current = previous.then(task, task);
    mealCookChain.set(key, current);
    return current;
  }

  function rememberConflictPlan(plan) {
    if (!plan || !plan.dinner_plan_id) return null;
    if (state.dinnerPlan && state.dinnerPlan.dinner_plan_id === plan.dinner_plan_id) applyDinnerPlan(plan);
    if (state.ratingPlan && state.ratingPlan.dinner_plan_id === plan.dinner_plan_id) state.ratingPlan = plan;
    return plan;
  }

  function completionAccepts(op, mealState) {
    if (op === "finish_cook") return mealState === "cooking";
    if (op === "mark_cooked") return mealState === "planned" || mealState === "selected" || mealState === "cooking";
    return false;
  }

  function planHoldingMeal(mealId) {
    if (state.ratingPlan && (state.ratingPlan.meals || []).some(function (meal) { return meal.meal_id === mealId; })) {
      return state.ratingPlan;
    }
    return state.dinnerPlan;
  }

  let cookUndoFn = null;

  function syncCookUndoSpace() {
    const view = document.querySelector("[data-view='rate']");
    const row = document.getElementById("cookUndoRow");
    if (view) view.classList.toggle("has-cook-undo", !!(row && row.childElementCount));
  }

  function clearCookUndoRow() {
    cookUndoFn = null;
    clearTimeout(state.cookUndoTimer);
    state.cookUndoTimer = null;
    const row = document.getElementById("cookUndoRow");
    if (row) row.replaceChildren();
    syncCookUndoSpace();
  }

  function dismissCookUndo() {
    state.cookUndoSealed = true;
    clearCookUndoRow();
  }

  function offerCookUndo(record) {
    state.cookUndoSealed = false;
    const row = document.getElementById("cookUndoRow");
    if (!row) return;
    clearTimeout(state.cookUndoTimer);
    cookUndoFn = function () {
      return undoDinnerCook(record);
    };
    row.replaceChildren();
    const label = document.createElement("span");
    label.textContent = "Logged as cooked.";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-quiet btn-sm cook-undo__btn";
    button.setAttribute("aria-label", "Undo, this dinner is not cooked yet");
    button.textContent = "Undo";
    row.append(label, button);
    syncCookUndoSpace();
    state.cookUndoTimer = setTimeout(clearCookUndoRow, 9000);
  }

  function setHowWasItCopy(meal) {
    const title = document.getElementById("rateTitle");
    const eyebrow = document.querySelector("[data-view='rate'] .eyebrow");
    const lede = document.getElementById("rateLede");
    const back = document.querySelector("[data-view='rate'] .back");
    if (title) title.textContent = "How was it?";
    if (eyebrow) eyebrow.textContent = meal ? planMealTitle(meal) : "How was dinner?";
    if (lede) lede.textContent = "Each person scores separately. You can leave this and rate later.";
    if (back) {
      back.dataset.go = state.rateReturnView || "home";
      const label = back.querySelector(".back__label");
      if (label) label.textContent = "Not now";
      back.setAttribute("aria-label", "Not now");
    }
    if (title) {
      title.setAttribute("tabindex", "-1");
      title.focus();
    }
  }

  function openDinnerRating(plan, mealId, returnView, undoRecord) {
    state.dinnerRateMealId = mealId;
    state.rateReturnView = normalizeRatingReturn(returnView);
    const currentId = state.dinnerPlan && state.dinnerPlan.dinner_plan_id;
    state.ratingPlan = plan && plan.dinner_plan_id && plan.dinner_plan_id !== currentId ? plan : null;
    const meal = plan && (plan.meals || []).find(function (row) { return row.meal_id === mealId; });
    show("rate", { context: Nav.contextFor("rate", state.rateReturnView, { established: true }) });
    setHowWasItCopy(meal);
    if (undoRecord) offerCookUndo(undoRecord);
  }

  async function writeMealMutation(plan, payload) {
    if (!plan || !plan.dinner_plan_id) return null;
    const res = await apiPost(
      "/api/dinner-plans/" + encodeURIComponent(plan.dinner_plan_id) + "/mutations",
      payload
    );
    if (res && res.ok && res.plan) {
      if (state.dinnerPlan && state.dinnerPlan.dinner_plan_id === res.plan.dinner_plan_id) applyDinnerPlan(res.plan);
      if (state.ratingPlan && state.ratingPlan.dinner_plan_id === res.plan.dinner_plan_id) state.ratingPlan = res.plan;
    }
    return res;
  }

  async function reloadPlanDocument(planId) {
    if (!planId) return null;
    const res = await apiGet("/api/dinner-plans/" + encodeURIComponent(planId));
    if (!res || !res.ok || !res.plan) return null;
    if (state.dinnerPlan && state.dinnerPlan.dinner_plan_id === planId) applyDinnerPlan(res.plan);
    if (state.ratingPlan && state.ratingPlan.dinner_plan_id === planId) state.ratingPlan = res.plan;
    return res.plan;
  }

  function mealFromPlan(plan, mealId) {
    return plan && (plan.meals || []).find(function (meal) { return meal.meal_id === mealId; });
  }

  async function completeDinnerMeal(plan, meal, op, returnView) {
    if (!plan || !meal || !meal.meal_id) return;
    const planId = plan.dinner_plan_id;
    const mealId = meal.meal_id;
    const key = planId + ":" + mealId + ":" + op;
    if (cookWrites.has(key)) return;
    cookWrites.add(key);
    try {
      await enqueueMealCook(planId, mealId, function () {
        const livePlan =
          (state.dinnerPlan && state.dinnerPlan.dinner_plan_id === planId && state.dinnerPlan) ||
          (state.ratingPlan && state.ratingPlan.dinner_plan_id === planId && state.ratingPlan) ||
          plan;
        const liveMeal = mealFromPlan(livePlan, mealId) || meal;
        return settleDinnerCompletion(livePlan, liveMeal, op, returnView);
      });
    } finally {
      cookWrites.delete(key);
    }
  }

  async function settleDinnerCompletion(plan, meal, op, returnView) {
    let currentPlan = plan;
    let currentMeal = meal;
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!currentPlan || !currentMeal || !currentMeal.meal_id) {
        toast("We couldn’t log that dinner. Try again.");
        return;
      }
      const res = await writeMealMutation(currentPlan, {
        op: op,
        meal_id: currentMeal.meal_id,
        expected_state: currentMeal.state,
        expected_updated_at: currentPlan.updated_at,
      });
      if (res && res.error === "revision_conflict") {
        const fresh = rememberConflictPlan(res.plan) || (await reloadPlanDocument(currentPlan.dinner_plan_id));
        const nowMeal = mealFromPlan(fresh, currentMeal.meal_id);
        if (nowMeal && mealIsLoggedCooked(nowMeal.state)) {
          releaseCookSession(fresh && fresh.dinner_plan_id, currentMeal.meal_id);
          openDinnerRating(fresh, currentMeal.meal_id, returnView, null);
          return;
        }
        if (attempt === 0 && nowMeal && fresh && fresh.updated_at && completionAccepts(op, nowMeal.state)) {
          currentPlan = fresh;
          currentMeal = nowMeal;
          continue;
        }
        toast("That dinner changed. Have another look.");
        renderActiveDinnerSurfaces();
        if (state.view === "meals" || returnView === "meals") renderMealHistory();
        return;
      }
      if (!res || !res.ok) {
        toast(res && res.error === "illegal_transition" ? "That dinner can’t be logged as cooked." : "We couldn’t log that dinner. Try again.");
        return;
      }
      if (res.completed) {
        track("cook_completed", { dinner_plan_id: res.plan.dinner_plan_id, meal_id: meal.meal_id });
        track("cook_recorded", {
          dinner_plan_id: res.plan.dinner_plan_id,
          meal_id: meal.meal_id,
          plan_id: res.plan.dinner_plan_id,
          meal_option_id: meal.meal_id,
        });
      }
      const planId = res.plan.dinner_plan_id;
      const savedStep = captureCookStep(planId, meal.meal_id);
      const restoreCook = !!(res.completed && op === "finish_cook" && res.prior_state === "cooking");
      releaseCookSession(planId, meal.meal_id);
      const back = normalizeRatingReturn(returnView);
      const undo = res.completed && res.prior_state
        ? {
            planId: planId,
            mealId: meal.meal_id,
            priorState: res.prior_state,
            updatedAt: res.plan.updated_at,
            returnView: back,
            restoreCook: restoreCook,
            cookStep: restoreCook ? savedStep : null,
          }
        : null;
      openDinnerRating(res.plan, meal.meal_id, back, undo);
      return;
    }
  }

  async function undoDinnerCook(record) {
    if (!record || state.cookUndoSealed) return;
    const key = record.planId + ":" + record.mealId + ":undo";
    if (cookWrites.has(key)) return;
    cookWrites.add(key);
    try {
      await enqueueMealCook(record.planId, record.mealId, function () {
        return sendUndoCook(record);
      });
    } finally {
      cookWrites.delete(key);
    }
  }

  async function sendUndoCook(record) {
    const holder =
        (state.dinnerPlan && state.dinnerPlan.dinner_plan_id === record.planId && state.dinnerPlan) ||
        (state.ratingPlan && state.ratingPlan.dinner_plan_id === record.planId && state.ratingPlan) ||
        { dinner_plan_id: record.planId };
      const res = await writeMealMutation(holder, {
        op: "undo_cook",
        meal_id: record.mealId,
        prior_state: record.priorState,
        expected_state: "cooked",
        expected_updated_at: record.updatedAt,
      });
      if (res && res.error === "undo_blocked_rating") {
        if (res.plan) rememberConflictPlan(res.plan);
        toast("A rating is in, so this stays cooked.");
        return;
      }
      if (res && res.error === "revision_conflict") {
        const fresh = rememberConflictPlan(res.plan) || (await reloadPlanDocument(record.planId));
        if (fresh && fresh.updated_at) record.updatedAt = fresh.updated_at;
        const meal = mealFromPlan(fresh, record.mealId);
        if (mealHasRating(meal) || (meal && (meal.state === "partially_rated" || meal.state === "fully_rated"))) {
          toast("A rating is in, so this stays cooked.");
          if (fresh) openDinnerRating(fresh, record.mealId, record.returnView, null);
          return;
        }
        if (meal && meal.state === record.priorState) {
          noteCookUndone(record);
          showUndoneCook(record);
          return;
        }
        toast("Someone else already updated this dinner.");
        renderActiveDinnerSurfaces();
        return;
      }
      if (res && res.error === "undo_expired") {
        toast("That window closed. This stays cooked.");
        return;
      }
      if (!res || !res.ok) {
        toast("Couldn’t undo that. The dinner stays cooked.");
        return;
      }
    if (res.undone) noteCookUndone(record);
    showUndoneCook(record);
  }

  function noteCookUndone(record) {
    track("cook_undone", {
      dinner_plan_id: record.planId,
      meal_id: record.mealId,
      plan_id: record.planId,
      meal_option_id: record.mealId,
    });
  }

  function showUndoneCook(record) {
    let dest = normalizeRatingReturn(record.returnView);
    if (record.restoreCook && record.priorState === "cooking") {
      const step = record.cookStep != null ? Math.max(0, Number(record.cookStep) || 0) : readCookStep(record.planId, record.mealId);
      writeCookStep(record.planId, record.mealId, step);
      state.dinnerCookMealId = record.mealId;
      state.dinnerCookPendingId = null;
      state.cookStep = step;
      dest = "cook";
    } else if (state.dinnerCookMealId === record.mealId) {
      state.dinnerCookMealId = null;
      state.cookStep = 0;
    }
    state.dinnerRateMealId = null;
    state.ratingPlan = null;
    toast("Back to where you left it.");
    show(dest);
    renderActiveDinnerSurfaces();
    if (dest === "meals") renderMealHistory();
  }

  async function loadHistoryPlan(planId) {
    if (!planId) return null;
    if (state.dinnerPlan && state.dinnerPlan.dinner_plan_id === planId) return state.dinnerPlan;
    const res = await apiGet("/api/dinner-plans/" + encodeURIComponent(planId));
    if (!res || !res.ok || !res.plan) return null;
    return res.plan;
  }

  async function completeHistoryMeal(planId, mealId, priorState) {
    const plan = await loadHistoryPlan(planId);
    if (!plan) {
      toast("Couldn’t open that dinner.");
      return;
    }
    const meal = mealFromPlan(plan, mealId) || { meal_id: mealId, state: priorState || "cooking" };
    await completeDinnerMeal(plan, meal, "mark_cooked", "meals");
  }

  async function openHistoryRating(planId, mealId) {
    const plan = await loadHistoryPlan(planId);
    if (!plan) {
      toast("Couldn’t open that dinner.");
      return;
    }
    openDinnerRating(plan, mealId, "meals", null);
  }

  function mealHasRating(meal) {
    return !!(meal && (meal.ratings || []).some(function (row) { return row && row.score != null; }));
  }

  function finishCook() {
    const cooking = cookingMeal();
    if (cooking && cooking.dinner_plan && state.dinnerPlan) {
      const raw = planMealById(cooking.id) || { meal_id: cooking.id, state: "cooking" };
      const planId = state.dinnerPlan.dinner_plan_id;
      writeCookStep(planId, raw.meal_id, state.cookStep);
      void completeDinnerMeal(state.dinnerPlan, raw, "finish_cook", "choices");
      return;
    }
    const next = window.MealIdentity.reduceMealAction(identitySnapshot(), { type: "finish_cook" });
    if (!next.committed) {
      toast(next.error === "already_cooked" ? "This dinner is already logged" : "Choose this dinner before marking it cooked");
      return;
    }
    applyIdentity(next);
    state.ratingState = "awaiting";
    const mealId = state.selectedMealId;
    if (!mealId) {
      toast("Pick a meal first");
      return;
    }
    track("cook_recorded", { plan_id: API.planId || PLAN_ID, meal_option_id: mealId });
    (async () => {
      const planId = (await ensurePlan()) || PLAN_ID;
      const hh = API.householdId || state.householdId;
      if (!hh) return;
      await apiPost("/api/cooks", {
        plan_id: planId,
        meal_option_id: mealId,
        household_id: hh,
        source: "app",
        actor_member_id: state.members[0] && state.members[0].id,
      });
    })();
    show("finished");
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }


  function renderRaters() {
    const root = document.getElementById("raterList");
    const me = meMember();
    const feedback = (state.tasteCatalog && state.tasteCatalog.feedback) || [];
    const faceFor = (score) => {
      if (score == null) return { face: "🍽️", word: "Not rated yet" };
      if (score <= 2) return { face: "😖", word: "Hard miss" };
      if (score <= 4) return { face: "😕", word: "Not quite" };
      if (score <= 6) return { face: "😐", word: "Fine" };
      if (score <= 8) return { face: "🙂", word: "Good one" };
      return { face: "😍", word: "Craving it" };
    };
    const rateIds = state.dinnerRateMealId
      ? (planMealById(state.dinnerRateMealId) && planMealById(state.dinnerRateMealId).participant_ids) || []
      : null;
    const raters = rateIds
      ? activeMembers().filter(function (m) {
          return rateIds.indexOf(m.id) >= 0;
        })
      : activeMembers();
    root.innerHTML = raters
      .map((m) => {
        const r = state.ratings[m.id] || { score: null, note: "" };
        const name = escapeHtml(m.name);
        const reaction = faceFor(r.score);
        const status = r.score
          ? `<span class="rater-status done">${r.score}/10 · ${reaction.word}</span>`
          : `<span class="rater-status">Waiting</span>`;
        const row = (from, to) =>
          Array.from({ length: to - from + 1 }, (_, i) => from + i)
            .map(
              (n) =>
                `<button type="button" class="score${r.score === n ? " is-picked" : ""}" data-person="${escapeHtml(m.id)}" data-score="${n}" aria-label="${name} rates ${n} out of 10" aria-pressed="${r.score === n}">${n}</button>`
            )
            .join("");
        return `
          <div class="rater-card">
            <div class="rater-head">
              <span class="avatar">${escapeHtml(m.initial)}</span>
              <div class="grow"><div class="rater-name">${name}</div>${status}</div>
              <span class="rater-face${r.score ? " is-set" : ""}" aria-hidden="true">${reaction.face}</span>
            </div>
            <div class="score-rows">
              <div class="score-row" role="group" aria-label="${name} scores 1 to 5">${row(1, 5)}</div>
              <div class="score-row" role="group" aria-label="${name} scores 6 to 10">${row(6, 10)}</div>
            </div>
            <div class="anchors" aria-hidden="true"><span>1 hard miss</span><span>5 fine</span><span>10 craving</span></div>
            ${me && me.id === m.id && r.score && state.selectedMealId
              ? Taste.feedbackHtml(feedback, state.feedbackSent[feedbackKey(state.selectedMealId, m.id)] || [], m.id)
              : ""}
            <label class="field">
              <span class="field__label">Note (optional)</span>
              <input type="text" data-note="${escapeHtml(m.id)}" placeholder="Too spicy? Make again?" value="${r.note ? escapeAttr(r.note) : ""}" />
            </label>
          </div>`;
      })
      .join("");
    syncRateButtons();
  }

  function allActiveRated() {
    const active = state.members.filter(function (m) {
      return m.status === "Active" || m.status === "active";
    });
    const list = active.length ? active : state.members;
    if (!list.length) return false;
    return list.every((m) => state.ratings[m.id]?.score != null);
  }
  function bothRated() {
    return allActiveRated();
  }
  function anyRated() {
    return activeMembers().some((m) => state.ratings[m.id]?.score != null);
  }

  function membersAwaitingRating() {
    return activeMembers()
      .filter((m) => state.ratings[m.id]?.score == null)
      .map((m) => m.name);
  }

  function syncRateButtons() {
    const submit = document.getElementById("btnSubmitRated");
    const hint = document.getElementById("rateHint");
    if (state.dinnerRateMealId) {
      const pm = planMealById(state.dinnerRateMealId);
      submit.disabled = !(pm && pm.state === "fully_rated");
    } else submit.disabled = !bothRated();
    if (bothRated()) {
      hint.textContent =
        activeMemberCount() === 2
          ? "Both of you rated — tap submit to close the loop."
          : "Everyone rated — tap submit to close the loop.";
    } else if (anyRated()) {
      const missing = membersAwaitingRating().join(", ");
      hint.textContent = `Waiting on ${missing}. Save partial anytime — others can keep using the app.`;
      state.ratingState = "partial";
    } else {
      hint.textContent =
        "Each person picks 1–10. Save a partial anytime — we never invent scores.";
    }
    updateDebug();
  }

  function renderSettings() {
    document.getElementById("settingsHhName").value = state.householdName || "";
    loadHouseholdShop().then(function (res) {
      if (!res || !res.preferences) return;
      const hh = res.preferences.household || {};
      const member = res.preferences.member || {};
      const method = document.querySelector('input[name="shopHouseholdMethod"][value="' + (hh.method || "instore") + '"]');
      if (method) method.checked = true;
      const service = document.getElementById("shopHouseholdService");
      if (service) service.value = hh.service || "none";
      const store = document.getElementById("shopUsualStore");
      if (store) store.value = hh.usual_store || "";
      const postal = document.getElementById("shopPostal");
      if (postal) postal.value = hh.postal_code || "";
      const memberMethod = document.querySelector('input[name="shopMemberMethod"][value="' + (member.method || "") + '"]');
      if (memberMethod) memberMethod.checked = true;
      const memberService = document.getElementById("shopMemberService");
      if (memberService) memberService.value = member.service || "";
      const memberStore = document.getElementById("shopMemberStore");
      if (memberStore) memberStore.value = member.usual_store || "";
    });
    document.getElementById("settingsChoiceCount").value = String(state.settingsChoiceCount || 3);
    document.getElementById("settingsCadence").value = state.settingsCadence || "on_demand";
    const root = document.getElementById("settingsMembers");
    root.setAttribute("role", "list");
    root.innerHTML = state.members.map(memberRowHtml).join("");
    renderConstraintGrid("settingsConstraints", state.primaryConstraints);
    renderThemeOptions();
  }

  function renderThemeOptions() {
    const root = document.getElementById("themeOptions");
    if (!root || !Theme) return;
    const current = Theme.current();
    root.innerHTML = Theme.themes
      .map(function (t) {
        const checked = t.id === current;
        return `
          <label class="theme-option" data-theme-option="${t.id}">
            <span class="theme-swatch" data-theme="${t.id}" aria-hidden="true">
              <span class="theme-swatch__bar"></span><span class="theme-swatch__dot"></span>
              <span class="theme-swatch__title"></span><span class="theme-swatch__line"></span>
              <span class="theme-swatch__cta"></span><span class="theme-swatch__accent"></span>
            </span>
            <span><span class="theme-option__name">${escapeHtml(t.name)}${t.id === Theme.defaultTheme ? " <span class=\"badge badge--sm badge--neutral\">Default</span>" : ""}</span><span class="theme-option__note">${escapeHtml(t.note)}</span></span>
            <input type="radio" name="fw-theme" value="${t.id}" ${checked ? "checked" : ""} aria-describedby="theme-note-${t.id}" />
            <span class="sr-only" id="theme-note-${t.id}">${escapeHtml(t.note)}</span>
          </label>`;
      })
      .join("");
    root.onchange = function (e) {
      const input = e.target.closest('input[name="fw-theme"]');
      if (!input) return;
      const applied = Theme.set(input.value);
      const meta = Theme.themes.find(function (t) { return t.id === applied; });
      toast((meta ? meta.name : "Theme") + " is on");
      track("theme_changed", { theme: applied });
    };
  }

  function emptyStateHtml(iconName, title, body, action) {
    return `<li class="empty-state">
        <span class="empty-state__icon">${icon(iconName)}</span>
        <strong>${title}</strong>
        <span>${body}</span>
        ${action || ""}
      </li>`;
  }

  function historyStatus(m) {
    if (m.meal_state === "cooking" || m.status === "Cooking") return { label: "Still cooking", cls: "badge--warning" };
    if (m.meal_state === "selected" || m.status === "Selected") return { label: "Picked", cls: "badge--fit" };
    if (m.meal_state === "planned" || m.status === "Planned") return { label: "Not logged", cls: "" };
    if (m.status === "Rated") return { label: "Rated", cls: "badge--success" };
    if (m.status === "Cooked") {
      return { label: m.rating_state === "partial" ? "Partly rated" : "Ready to rate", cls: "badge--warning" };
    }
    return { label: m.status || "Planned", cls: "" };
  }

  function historyRecoveryButton(m) {
    if (!m || m.source !== "dinner_plan" || !m.meal_id || !m.dinner_plan_id) return "";
    if (m.recoverable) {
      return (
        '<button class="btn btn-primary" type="button" data-action="history-mark-cooked" data-meal-id="' +
        escapeHtml(m.meal_id) +
        '" data-plan-id="' +
        escapeHtml(m.dinner_plan_id) +
        '" data-prior-state="' +
        escapeAttr(m.meal_state || "") +
        '">We made this</button>'
      );
    }
    if (!m.can_rate) return "";
    const me = meMember();
    const rated =
      me &&
      (m.ratings || []).some(function (row) {
        return row.member_id === me.id && row.score != null;
      });
    const inMeal = !m.participant_ids || !m.participant_ids.length || (me && m.participant_ids.indexOf(me.id) >= 0);
    if (rated || !inMeal) return "";
    return (
      '<button class="btn btn-primary" type="button" data-action="history-rate" data-meal-id="' +
      escapeHtml(m.meal_id) +
      '" data-plan-id="' +
      escapeHtml(m.dinner_plan_id) +
      '">Rate it</button>'
    );
  }

  async function renderMealHistory() {
    const ul = document.getElementById("mealHistoryList");
    ul.setAttribute("aria-busy", "true");
    ul.innerHTML = '<li class="skeleton history-skeleton" aria-hidden="true"></li><li class="skeleton history-skeleton" aria-hidden="true"></li><li class="skeleton history-skeleton" aria-hidden="true"></li>';
    const hh = API.householdId || state.householdId;
    const done = function (html) {
      ul.innerHTML = html;
      ul.removeAttribute("aria-busy");
    };
    if (!hh) {
      done(emptyStateHtml("users", "No kitchen yet", "Create or join a kitchen to start your history."));
      return;
    }
    const res = await apiGet("/api/households/" + encodeURIComponent(hh) + "/meals/history");
    if (!res || !res.ok || !Array.isArray(res.meals)) {
      done(emptyStateHtml("history", "Couldn’t load meals", "Check your connection and try again.", '<button class="btn btn-secondary btn-sm" type="button" data-go="meals" data-reload="meals">Try again</button>'));
      return;
    }
    const meals = res.meals.filter(function (m) { return m.meal_name; });
    if (!meals.length) {
      done(emptyStateHtml("tonight", "Nothing cooked yet", "Pick tonight’s dinner — it’ll show up here once it’s on the table.", '<button class="btn btn-primary btn-sm" type="button" data-go="choices">See tonight’s picks</button>'));
      return;
    }
    state.historyItems = meals;
    done(
      meals
        .map(function (m, idx) {
          const status = historyStatus(m);
          const rating = m.avg_score != null ? `<span class="badge badge--sm badge--time">${m.avg_score.toFixed(1)}/10 avg</span>` : "";
          const fav = m.favorite ? `<span class="badge badge--sm badge--accent">${icon("heart")}Favorite</span>` : "";
          return `<li class="history-item">
              ${mealMediaHtml({ recipe_slug: m.recipe_slug, title: m.meal_name }, { decorative: true, sizes: "(min-width: 1024px) 30vw, 120px" })}
              <div class="history-item__body">
                <p class="history-item__title">${escapeHtml(m.meal_name)}</p>
                <div class="badges"><span class="badge badge--sm ${status.cls}">${escapeHtml(status.label)}</span>${rating}${fav}</div>
                <div class="history-item__actions">${
                  (m.recipe_slug || m.recipe_version_id
                    ? `<button class="btn btn-quiet" type="button" data-history-recipe="${idx}">View recipe ${icon("arrow-right", "icon--forward")}</button>`
                    : "") + historyRecoveryButton(m)
                }</div>
              </div>
            </li>`;
        })
        .join("")
    );
  }

  function renderLoopSummary() {
    const ul = document.getElementById("loopSummary");
    ul.innerHTML = [
      "Picked tonight’s dinner",
      "Cooked it",
      ...activeMembers().map((m) => `${m.name} rated ${state.ratings[m.id].score}/10`),
    ]
      .map((t) => `<li><span class="ok" aria-hidden="true">${icon("check")}</span> ${escapeHtml(t)}</li>`)
      .join("");
    const loopAttr = document.getElementById("loopAttr");
    if (loopAttr) { loopAttr.hidden = true; loopAttr.textContent = ""; }
  }

  let planInFlight = null;

  /** One plan request at a time, so a double tap never creates two rounds. */
  function fetchRecommendationsPlan() {
    if (planInFlight) return planInFlight;
    planInFlight = requestRecommendationsPlan().finally(function () {
      planInFlight = null;
    });
    return planInFlight;
  }

  async function requestRecommendationsPlan() {
    const hh = API.householdId || state.householdId;
    if (!hh) return null;
    await ensureMemberSession();
    await Promise.all([state.constraintSave, state.tasteSave]);
    const res = await apiPost("/api/recommendations/plan", {
      household_id: hh,
      attribution_last_touch: state.lastTouch,
      attribution_kind:
        state.lastTouch && String(state.lastTouch).startsWith("HE-INV")
          ? "invite_code"
          : state.lastTouch && String(state.lastTouch).startsWith("HE-SHARE")
            ? "share_object_id"
            : state.lastTouch === "organic"
              ? "organic"
              : "unknown",
    });
    if (res && res.ok && res.plan_id) {
      API.planId = res.plan_id;
      applyMealOptionsFromServer(res.meal_options);
      track("plan_generated", { plan_id: res.plan_id, source: "taste_model_v1" });
      return res.plan_id;
    }
    return null;
  }

  function averageRating(bucket) {
    const scores = Object.keys(bucket || {})
      .map(function (k) { return bucket[k] && bucket[k].score; })
      .filter(function (v) { return v != null; });
    if (!scores.length) return null;
    return scores.reduce(function (a, b) { return a + Number(b); }, 0) / scores.length;
  }

  /**
   * Close the finished round on this device and ask the server for a brand-new plan.
   * The old plan, its cook, and its ratings are untouched; they stay in History.
   */
  async function startNextRound() {
    if (state.roundBusy) return;
    if (!(state.outcomeLocked && state.lifecycle === "Rated")) {
      if (state.view !== "choices") toast("Rate tonight’s dinner first — then we’ll line up the next one");
      return;
    }
    state.roundBusy = true;
    try {
      goHomeNoPlan();
    } finally {
      state.roundBusy = false;
    }
  }

  async function ensurePlan() {
    const hh = API.householdId || state.householdId;
    if (!hh) return null;
    if (API.planId) return API.planId;
    const rec = await fetchRecommendationsPlan();
    if (rec) return rec;
    return null;
  }

  function selectMeal(id) {
    const prev = identitySnapshot();
    const next = window.MealIdentity.reduceMealAction(prev, { type: "select", mealOptionId: id });
    if (next.error) {
      toast("That dinner is already logged");
      return;
    }
    applyIdentity(next);
    state.activeRecipe = null;
    track("selection_recorded", {
      plan_id: API.planId || PLAN_ID,
      meal_option_id: id,
      source: "app",
    });
    (async () => {
      const planId = (await ensurePlan()) || PLAN_ID;
      const hh = API.householdId || state.householdId;
      if (!hh || !planId) return;
      await ensureMemberSession();
      const memberId =
        (localStorage.getItem(LS_MEMBER) && state.members.find(function (m) {
          return m.id === localStorage.getItem(LS_MEMBER);
        }) &&
          localStorage.getItem(LS_MEMBER)) ||
        (state.members[0] && state.members[0].id);
      if (activeMemberCount() > 1) {
        const voteRes = await apiPost("/api/plans/" + encodeURIComponent(planId) + "/votes", {
          meal_option_id: id,
          auto_resolve: true,
        });
        if (voteRes && (voteRes.locked || voteRes.error === "selection_locked")) {
          applyIdentity(prev);
          toast("That dinner is already logged");
          return;
        }
        if (voteRes && voteRes.status === "Selected" && voteRes.meal_option_id) {
          state.selectedMealId = voteRes.meal_option_id;
          state.previewMealId = voteRes.meal_option_id;
        } else if (voteRes && voteRes.waiting_on) {
          toast("Vote saved — waiting on others");
          return;
        }
      } else {
        const sel = await apiPost("/api/selections", {
          plan_id: planId,
          meal_option_id: id,
          household_id: hh,
          source: "app",
          actor_member_id: memberId,
        });
        if (sel && (sel.error === "selection_locked" || sel.ok === false)) {
          applyIdentity(prev);
          toast("That dinner is already logged");
          return;
        }
      }
      await ensureRecipeForSelection();
    })();
  }

  /** A past round's meal opens read-only: no choose, no cook, no change to tonight. */
  function openHistoryRecipe(item) {
    if (!item) return;
    state.historyMeal = {
      id: item.meal_option_id,
      plan_id: item.plan_id,
      title: item.meal_name,
      recipe_slug: item.recipe_slug,
      recipe_version_id: item.recipe_version_id,
      avg_score: item.avg_score,
      status: item.status,
      historical: true,
      pers: null,
    };
    state.activeRecipe = null;
    show("detail", { context: { origin: "meals", source: "history" } });
  }

  function openPreview(id) {
    applyIdentity(window.MealIdentity.reduceMealAction(identitySnapshot(), { type: "preview", mealOptionId: id }));
    state.activeRecipe = null;
    show("detail");
  }

  // —— Cycle 3 dinner plans ——
  const LS_DINNER_PLAN = "fw_dinner_plan:";
  const LS_DINNER_PLANS = "fw_dinner_plans:";
  const LS_SHOP_SEEN = "fw_shop_seen:";

  function dinnerPlanPointerKey(hh) {
    return LS_DINNER_PLAN + hh;
  }
  function dinnerPlansRecentKey(hh) {
    return LS_DINNER_PLANS + hh;
  }
  function shopSeenKey(planId) {
    return LS_SHOP_SEEN + planId;
  }
  function shopSnapKey(planId) {
    return "he_shop_snap_" + planId;
  }

  async function refreshMembersFromServer() {
    const snap = await apiGet("/api/sessions/me");
    if (snap && snap.ok) applyServerSnapshot(snap);
    return snap;
  }

  function invitedMembers() {
    return state.members.filter(function (m) {
      const s = m.status === "Active" ? "active" : String(m.status || "").toLowerCase();
      return s === "invited";
    });
  }

  function activeMemberIds() {
    return activeMembers().map(function (m) {
      return m.id;
    });
  }

  function readDinnerPlanPointer() {
    const hh = API.householdId || state.householdId;
    if (!hh) return null;
    try {
      return localStorage.getItem(dinnerPlanPointerKey(hh));
    } catch (_) {
      return null;
    }
  }

  function setDinnerPlanPointer(planId) {
    const hh = API.householdId || state.householdId;
    if (!hh || !planId) return;
    try {
      localStorage.setItem(dinnerPlanPointerKey(hh), planId);
      const key = dinnerPlansRecentKey(hh);
      let list = [];
      try {
        list = JSON.parse(localStorage.getItem(key) || "[]");
      } catch (_) {
        list = [];
      }
      list = [planId].concat(list.filter(function (id) {
        return id !== planId;
      })).slice(0, 5);
      localStorage.setItem(key, JSON.stringify(list));
    } catch (_) { /* ignore */ }
  }

  function clearDinnerPlanPointer() {
    const hh = API.householdId || state.householdId;
    if (!hh) return;
    try {
      localStorage.removeItem(dinnerPlanPointerKey(hh));
    } catch (_) { /* ignore */ }
  }

  function hasCurrentDinnerPlan() {
    return !!(state.dinnerPlan && state.dinnerPlan.dinner_plan_id);
  }

  function legacyRoundActive() {
    if (hasCurrentDinnerPlan()) return false;
    if (state.outcomeLocked && state.lifecycle === "Rated") return false;
    if (state.selectedMealId || state.cookingMealId) return true;
    if (state.lifecycle === "Cooked" || state.lifecycle === "Rated") return true;
    if (state.lifecycle === "Selected") return true;
    return false;
  }

  function planMealClosed(meal) {
    if (!meal) return true;
    const s = meal.state;
    return (
      s === "fully_rated" ||
      s === "fulfilled" ||
      s === "skipped" ||
      s === "abandoned"
    );
  }

  function planIsClosed(plan) {
    if (!plan) return true;
    const openSlots = emptySlotCount(plan);
    if (openSlots > 0) return false;
    return (plan.meals || []).every(planMealClosed);
  }

  function emptySlotCount(plan) {
    if (!plan) return 0;
    const unfilled = state.dinnerUnfilled || [];
    if (unfilled.length) return unfilled.length;
    const mc = plan.meal_count || 0;
    const meals = plan.meals || [];
    return Math.max(0, mc - meals.length);
  }

  function emptySlots(plan) {
    const slots = [];
    const meals = (plan && plan.meals) || [];
    const positions = {};
    meals.forEach(function (m) {
      positions[m.position] = m;
    });
    const unfilled = state.dinnerUnfilled || [];
    unfilled.forEach(function (u) {
      slots.push({ position: u.position, reason: u.reason || "no_eligible_meal", empty: true });
    });
    const known = unfilled.length;
    const extra = Math.max(0, (plan.meal_count || 0) - meals.length - known);
    let nextPos = meals.length + known + 1;
    for (let i = 0; i < extra; i++) {
      slots.push({
        position: nextPos++,
        reason: meals.length ? "no_unused_eligible_meal" : "no_eligible_meal",
        empty: true,
      });
    }
    return slots;
  }

  function applyDinnerPlan(plan, unfilled) {
    if (!plan) {
      state.dinnerPlan = null;
      state.dinnerShop = null;
      state.dinnerUnfilled = [];
      return;
    }
    state.dinnerPlan = plan;
    state.dinnerUnfilled = Array.isArray(unfilled) ? unfilled : state.dinnerUnfilled || [];
    if (plan.shop_lines || plan.shop_deltas) {
      state.dinnerShop = {
        lines: plan.shop_lines || [],
        deltas: plan.shop_deltas || [],
        shopping_started: !!plan.shopping_started,
        shopping_started_at: plan.shopping_started_at,
      };
    }
    setDinnerPlanPointer(plan.dinner_plan_id);
  }

  function dinnerPlanFetchDenied(res) {
    if (!res) return false;
    const http = res._httpStatus || res.status;
    return (
      res.error === "plan_not_found" ||
      res.error === "forbidden_cross_household" ||
      http === 404 ||
      http === 403
    );
  }

  async function fetchDinnerPlanById(id) {
    if (!id) return null;
    const res = await apiGet("/api/dinner-plans/" + encodeURIComponent(id));
    if (!res || !res.ok) {
      if (dinnerPlanFetchDenied(res)) clearDinnerPlanPointer();
      return null;
    }
    applyDinnerPlan(res.plan);
    return res.plan;
  }

  async function loadCurrentDinnerPlan() {
    await ensureMemberSession();
    const hh = API.householdId || state.householdId;
    if (!hh) return null;
    const pointerId = readDinnerPlanPointer();
    const currentRes = await apiGet("/api/dinner-plans/current");
    if (currentRes && currentRes.ok) {
      if (currentRes.plan) {
        applyDinnerPlan(currentRes.plan);
        return currentRes.plan;
      }
      applyDinnerPlan(null);
      if (pointerId) {
        const probe = await apiGet("/api/dinner-plans/" + encodeURIComponent(pointerId));
        if (dinnerPlanFetchDenied(probe)) clearDinnerPlanPointer();
      }
      return null;
    }
    if (pointerId) return fetchDinnerPlanById(pointerId);
    return null;
  }

  function planningApi() {
    return window.FlavorWeavePlanning;
  }

  function draftPrefs() {
    if (!state.draftPlanPrefs) {
      state.draftPlanPrefs = { keep_it_easy: false, keep_ingredients_simple: false };
    }
    return state.draftPlanPrefs;
  }

  function resetDraftPrefs() {
    state.draftPlanPrefs = { keep_it_easy: false, keep_ingredients_simple: false };
  }

  function fillPrefSlot(id, prefs, scope) {
    const el = document.getElementById(id);
    const api = planningApi();
    if (!el || !api) return;
    el.innerHTML = api.chipHtml(prefs, scope);
  }

  function classificationBadges(meal) {
    const api = planningApi();
    if (!api || !meal) return "";
    const html = api.badgeHtml(meal);
    return html ? html + " " : "";
  }

  async function createDinnerPlanRequest(opts) {
    await ensureMemberSession();
    const prefs = (opts && opts.prefs) || draftPrefs();
    const body = {
      meal_count: opts.meal_count,
      entry_point: opts.entry_point,
      participant_ids: opts.participant_ids || activeMemberIds(),
      fill: "planner",
      keep_it_easy: prefs.keep_it_easy === true,
      keep_ingredients_simple: prefs.keep_ingredients_simple === true,
    };
    const res = await apiPost("/api/dinner-plans", body);
    if (res && res.error === "shop_projection_failed") {
      dinnerPlanErrorToast(res);
      if (res.dinner_plan_id) return fetchDinnerPlanById(res.dinner_plan_id);
      return loadCurrentDinnerPlan();
    }
    if (!res || !res.ok) {
      dinnerPlanErrorToast(res);
      return null;
    }
    track("recommendation_generated", {
      meal_count: body.meal_count,
      keep_it_easy: body.keep_it_easy,
      keep_ingredients_simple: body.keep_ingredients_simple,
    });
    const relaxed = res.plan && res.plan.planner && res.plan.planner.preference_relaxations;
    if (relaxed && relaxed.length) track("preference_relaxed", { count: relaxed.length });
    applyDinnerPlan(res.plan, res.unfilled);
    return res.plan;
  }

  function shopLineCompareKey(line) {
    if (!line || !line.ingredient_id) return null;
    return String(line.ingredient_id) + "\0" + String(line.unit || "");
  }

  function sameParticipantIdsForListToast(current, next) {
    const a = (current || []).slice().sort();
    const b = (next || []).slice().sort();
    if (a.length !== b.length) return false;
    return a.every(function (id, index) {
      return id === b[index];
    });
  }

  function shopLinesMateriallyChanged(beforeLines, afterLines) {
    function row(line) {
      if (!line) return null;
      return {
        quantity: Number(line.quantity) || 0,
        still_needed: !!line.still_needed,
        list_state: line.list_state || "open",
      };
    }
    const before = {};
    (beforeLines || []).forEach(function (l) {
      const key = shopLineCompareKey(l);
      const r = row(l);
      if (key && r) before[key] = r;
    });
    const after = {};
    (afterLines || []).forEach(function (l) {
      const key = shopLineCompareKey(l);
      const r = row(l);
      if (key && r) after[key] = r;
    });
    const ids = {};
    Object.keys(before).forEach(function (id) {
      ids[id] = true;
    });
    Object.keys(after).forEach(function (id) {
      ids[id] = true;
    });
    const eps = 1e-6;
    return Object.keys(ids).some(function (id) {
      const b = before[id];
      const a = after[id];
      if (!b || !a) return true;
      return (
        Math.abs(b.quantity - a.quantity) > eps ||
        b.still_needed !== a.still_needed ||
        b.list_state !== a.list_state
      );
    });
  }

  function shopListChangeCountsFromDiff(beforeLines, afterLines) {
    function row(line) {
      if (!line) return null;
      return {
        quantity: Number(line.quantity) || 0,
        still_needed: !!line.still_needed,
        list_state: line.list_state || "open",
      };
    }
    function neededQty(r) {
      return r && r.still_needed ? r.quantity : 0;
    }
    const before = {};
    (beforeLines || []).forEach(function (l) {
      const key = shopLineCompareKey(l);
      const r = row(l);
      if (key && r) before[key] = r;
    });
    const after = {};
    (afterLines || []).forEach(function (l) {
      const key = shopLineCompareKey(l);
      const r = row(l);
      if (key && r) after[key] = r;
    });
    const ids = {};
    Object.keys(before).forEach(function (id) {
      ids[id] = true;
    });
    Object.keys(after).forEach(function (id) {
      ids[id] = true;
    });
    let added = 0;
    let removed = 0;
    const eps = 1e-6;
    Object.keys(ids).forEach(function (id) {
      const b = before[id];
      const a = after[id];
      if (!b && a) {
        if (a.still_needed) added++;
        return;
      }
      if (b && !a) {
        if (b.still_needed) removed++;
        return;
      }
      if (!b || !a) return;
      const bNeed = neededQty(b);
      const aNeed = neededQty(a);
      if (!b.still_needed && a.still_needed) added++;
      else if (b.still_needed && !a.still_needed) removed++;
      else if (b.still_needed && a.still_needed) {
        if (aNeed > bNeed + eps) added++;
        else if (bNeed > aNeed + eps) removed++;
      }
    });
    return { added: added, removed: removed };
  }

  function flushDinnerToast() {
    if (!state.pendingDinnerToast) return;
    const message = state.pendingDinnerToast;
    state.pendingDinnerToast = null;
    toast(message.text, message.opts);
  }

  async function mutateDinnerPlan(payload, options) {
    const plan = state.dinnerPlan;
    if (!plan) {
      showHeldShopProjectionNotice();
      return null;
    }
    const shopOps = {
      set_line_state: true,
      swap_meal: true,
      set_participants: true,
      set_leftovers: true,
      set_eating_out: true,
      remove_meal: true,
      add_meal: true,
      skip_meal: true,
      set_count: true,
      reorder: true,
      finalize: true,
    };
    const affectsList = shopOps[payload.op];
    const shopLinesBefore =
      affectsList
        ? ((state.dinnerShop && state.dinnerShop.lines) || plan.shop_lines || []).slice()
        : null;
    if (planShoppingStarted() && state.dinnerShop) {
      snapshotShopLinesForTags();
    }
    await ensureMemberSession();
    const res = await apiPost(
      "/api/dinner-plans/" + encodeURIComponent(plan.dinner_plan_id) + "/mutations",
      payload
    );
    if (res && res.error === "shop_projection_failed") {
      const saved =
        (await loadCurrentDinnerPlan()) ||
        (await fetchDinnerPlanById(res.dinner_plan_id || plan.dinner_plan_id));
      renderActiveDinnerSurfaces();
      if (options && options.suppressToast && saved) {
        state.pendingDinnerToast = { text: shopProjectionFailedCopy(), opts: null };
      } else {
        clearHeldShopProjectionNotice();
        dinnerPlanErrorToast(res);
      }
      return saved;
    }
    if (!res || !res.ok) {
      showHeldShopProjectionNotice();
      if (!(options && options.suppressToast)) dinnerPlanErrorToast(res);
      if (res && (res.error === "outcome_locked" || res.error === "version_locked" || res.error === "illegal_transition")) {
        await loadCurrentDinnerPlan();
        renderActiveDinnerSurfaces();
      }
      if (options && options.suppressToast) return { failed: true, error: res && res.error };
      return null;
    }
    applyDinnerPlan(res.plan);
    const planEditOps = {
      add_meal: true,
      remove_meal: true,
      swap_meal: true,
      set_participants: true,
      set_guest_count: true,
      apply_adaptation: true,
      clear_adaptation: true,
      set_count: true,
    };
    if (planEditOps[payload.op]) {
      track("plan_edited", { op: payload.op, dinner_plan_id: res.plan.dinner_plan_id });
    }
    if (payload.op === "select_meal") {
      const m = (res.plan.meals || []).find(function (x) {
        return x.meal_id === payload.meal_id;
      });
      track("dinner_selected", {
        dinner_plan_id: res.plan.dinner_plan_id,
        meal_id: payload.meal_id,
        recipe_slug: m && m.recipe_slug,
      });
    }
    if (state.view === "shopList") await refreshDinnerShopping();
    if (affectsList) {
      const participantNoop =
        payload.op === "set_participants" &&
        (function () {
          const meal = (plan.meals || []).find(function (m) {
            return m.meal_id === payload.meal_id;
          });
          return meal && sameParticipantIdsForListToast(meal.participant_ids, payload.participant_ids);
        })();
      if (!participantNoop) {
        const shopLinesAfter =
          (state.dinnerShop && state.dinnerShop.lines) || res.plan.shop_lines || [];
        const listChanged = shopLinesMateriallyChanged(shopLinesBefore || [], shopLinesAfter);
        if (listChanged) {
          const shoppingStarted =
            !!(res.plan && res.plan.shopping_started_at) ||
            planShoppingStarted();
          if (shoppingStarted) {
            const counts = shopListChangeCountsFromDiff(shopLinesBefore || [], shopLinesAfter);
            if (options && options.suppressToast) {
              const text = listChangeMessage(counts.added, counts.removed);
              if (text) {
                state.pendingDinnerToast = {
                  text: text + ' <button type="button" class="btn btn-quiet btn-sm" data-go="shopList">See list</button>',
                  opts: { html: true },
                };
              }
            } else {
              toastListChangeCounts(counts.added, counts.removed);
            }
          } else if (options && options.suppressToast) {
            state.pendingDinnerToast = { text: "List updated.", opts: null };
          } else {
            toast("List updated.");
          }
        }
      }
      clearHeldShopProjectionNotice();
    }
    return res.plan;
  }

  function shopProjectionFailedCopy() {
    return "The plan is saved. The shopping list didn’t update. Open the list to try again.";
  }

  function isShopProjectionNotice(message) {
    return !!(message && message.text === shopProjectionFailedCopy());
  }

  function showHeldShopProjectionNotice() {
    if (!isShopProjectionNotice(state.pendingDinnerToast)) return;
    flushDinnerToast();
  }

  function clearHeldShopProjectionNotice() {
    if (!isShopProjectionNotice(state.pendingDinnerToast)) return;
    state.pendingDinnerToast = null;
  }

  function dinnerPlanErrorToast(res) {
    const code = res && res.error;
    if (code === "shop_projection_failed") toast(shopProjectionFailedCopy());
    else if (code === "hard_limit_blocked") toast("That one doesn’t work for everyone at this dinner. Pick another.");
    else if (code === "forbidden_member")
      toast("Only diners who’ve joined your kitchen can eat this one. Mark them active in Settings or use “They’re at the table”.");
    else if (code === "plan_full") toast("Your plan is full. Add a night first.");
    else if (code === "meal_count_too_small") toast("Remove a dinner first, then lower the number.");
    else if (code === "forbidden_cross_household" || code === "plan_not_found") toast("This plan isn’t in your kitchen.");
    else if (code === "unknown_recipe") toast("That dinner isn’t on the menu anymore. Pick another.");
    else if (code === "adaptation_not_applicable")
      toast(
        (res && res.acknowledgement) ||
          "That swap doesn't work for everyone eating this dinner, so we'd leave it out."
      );
    else toast("We couldn’t reach the kitchen. Try again.");
  }

  function swapFailureCopy(code) {
    if (code === "hard_limit_blocked") return "That one doesn’t work for everyone at this dinner. Pick another.";
    if (code === "unknown_recipe") return "That dinner isn’t on the menu anymore. Pick another.";
    return "Couldn’t swap that dinner. Try another.";
  }

  function showSwapError(message) {
    const err = document.getElementById("swapSheetError");
    if (!err) return;
    err.hidden = !message;
    err.textContent = message || "";
  }

  function listChangeMessage(added, removed) {
    if (!added && !removed) return "";
    let msg = "Your list changed.";
    if (added) msg += " " + added + " added,";
    if (removed) msg += " " + removed + " no longer needed.";
    return msg.replace(/,$/, "");
  }

  function toastListChangeCounts(added, removed) {
    const msg = listChangeMessage(added, removed);
    if (!msg) return;
    toast(
      msg + ' <button type="button" class="btn btn-quiet btn-sm" data-go="shopList">See list</button>',
      { html: true }
    );
  }

  async function refreshDinnerShopping() {
    const plan = state.dinnerPlan;
    if (!plan) return;
    const res = await apiGet("/api/dinner-plans/" + encodeURIComponent(plan.dinner_plan_id) + "/shopping");
    if (res && res.ok) {
      state.dinnerShop = {
        lines: res.lines || [],
        deltas: res.deltas || [],
        shopping_started: !!res.shopping_started,
        shopping_started_at: res.shopping_started_at,
      };
    }
  }

  async function previewDinnerAlternatives(participantIds, plan) {
    const p = plan || state.dinnerPlan;
    const dinner_count = Math.min(14, ((p && p.meals && p.meals.length) || 0) + 3);
    const body = {
      dinner_count: dinner_count || 3,
      entry_point: (p && p.entry_point) || "plan_dinners",
      participant_ids: participantIds || activeMemberIds(),
    };
    if (p && p.intent) {
      if (p.intent.meal_styles) body.meal_styles = p.intent.meal_styles;
      if (p.intent.practical_hints) body.practical_hints = p.intent.practical_hints;
      if (p.intent.max_cook_minutes) body.max_cook_minutes = p.intent.max_cook_minutes;
      body.keep_it_easy = p.intent.keep_it_easy === true;
      body.keep_ingredients_simple = p.intent.keep_ingredients_simple === true;
    }
    const res = await apiPost("/api/dinner-plans/preview", body);
    if (!res || !res.ok || !res.preview) return [];
    const used = {};
    (p && p.meals || []).forEach(function (m) {
      if (m.recipe_slug) used[m.recipe_slug] = true;
    });
    const alts = (res.preview.slots || [])
      .filter(function (slot) {
        return slot.result === "recommended" && slot.recipe_version_id && !used[slot.recipe_slug];
      })
      .slice(0, 3);
    if (alts.some(function (slot) { return slot.preference_relaxed; })) {
      track("preference_relaxed", { surface: "swap" });
    }
    return alts;
  }

  function planMealTitle(meal) {
    if (!meal) return "";
    if (meal.kind === "leftovers") return "Leftovers";
    if (meal.kind === "eating_out") return "Eating out";
    return meal.title || meal.recipe_slug || "Dinner";
  }

  function planMealStateBadge(meal) {
    if (!meal) return "";
    const s = meal.state;
    if (meal.kind === "recipe") {
      if (s === "selected") return '<span class="badge badge--match">Tonight’s pick</span> ';
      if (s === "cooking") return '<span class="badge badge--accent">Cooking now</span> ';
      if (s === "cooked") return '<span class="badge badge--warning">Ready to rate</span> ';
      if (s === "partially_rated") {
      return (
        '<span class="badge badge--warning">Waiting on ' +
        escapeHtml(planRatingWaitingNames(meal)) +
        "</span> "
      );
    }
      if (s === "fully_rated") return '<span class="badge badge--success">Everyone rated</span> ';
      if (s === "skipped") return '<span class="badge badge--sm">Skipped</span> ';
      if (s === "abandoned") return '<span class="badge badge--sm">Didn’t happen</span> ';
    }
    if (meal.kind === "leftovers" && s === "planned") return '<span class="badge badge--sm">Leftovers night</span> ';
    if (meal.kind === "eating_out" && s === "planned") return '<span class="badge badge--sm">Eating out</span> ';
    if (s === "fulfilled") return '<span class="badge badge--success">Done</span> ';
    return "";
  }

  function planMealLabel(meal, position) {
    if (meal && meal.scheduled_date) {
      try {
        const d = new Date(meal.scheduled_date + "T12:00:00");
        return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      } catch (_) { /* ignore */ }
    }
    return "Dinner " + (meal && meal.position != null ? meal.position : position);
  }

  function uiMealFromPlanMeal(meal) {
    if (!meal) return null;
    return {
      id: meal.meal_id,
      meal_id: meal.meal_id,
      title: planMealTitle(meal),
      recipe_slug: meal.recipe_slug,
      recipe_version_id: meal.recipe_version_id,
      kind: meal.kind,
      state: meal.state,
      position: meal.position,
      scheduled_date: meal.scheduled_date,
      participant_ids: meal.participant_ids || [],
      guest_count: meal.guest_count || 0,
      adaptation: meal.adaptation || null,
      pinned_ingredients: meal.pinned_ingredients,
      pinned_steps: meal.pinned_steps,
      effort_level: meal.effort_level || null,
      ingredient_complexity: meal.ingredient_complexity || null,
      dinner_plan: true,
      plate: meal.kind === "leftovers" ? "🥡" : meal.kind === "eating_out" ? "🍽️" : "🍽️",
    };
  }

  function mealById(id) {
    if (!id) return null;
    if (state.dinnerPlan && state.dinnerPlan.meals) {
      const dm = state.dinnerPlan.meals.find(function (m) {
        return m.meal_id === id;
      });
      if (dm) return uiMealFromPlanMeal(dm);
    }
    if (state.dinnerDetailMeal && state.dinnerDetailMeal.id === id) return state.dinnerDetailMeal;
    return displayMeals().find(function (m) {
      return m.id === id;
    }) || null;
  }

  function detailMeal() {
    const ctx = state.navContext.detail;
    if (ctx && ctx.source === "history") return state.historyMeal;
    if (state.dinnerDetailMeal) return state.dinnerDetailMeal;
    return mealById(state.previewMealId || state.selectedMealId);
  }

  function cookingMeal() {
    if (state.dinnerCookMealId) return mealById(state.dinnerCookMealId);
    if (state.dinnerCookPendingId) return mealById(state.dinnerCookPendingId);
    return mealById(state.cookingMealId || state.selectedMealId);
  }

  function openPlanMealDetail(mealId, origin) {
    const meal = mealById(mealId);
    if (!meal || meal.kind === "leftovers" || meal.kind === "eating_out") return;
    state.dinnerDetailMeal = meal;
    state.previewMealId = mealId;
    state.activeRecipe = null;
    const from = origin === "tonightPlan" ? "choices" : origin || "planReview";
    show("detail", {
      context: Nav.contextFor("detail", from, {
        established: householdEstablished(),
        origin: origin || "planReview",
        source: origin === "tonightPlan" ? "tonight_plan" : "dinner_plan",
      }),
    });
  }

  async function startFindSomethingElse() {
    const plan = state.dinnerPlan;
    if (!plan) return;
    if (plan.meal_count >= 14) {
      toast("Your plan is full. Skip or remove a dinner first.");
      return;
    }
    const alts = await previewDinnerAlternatives(activeMemberIds(), plan);
    if (!alts.length) {
      toast("That’s every dinner that fits your table right now.");
      return;
    }
    const slot = alts[0];
    const afterCount = await mutateDinnerPlan({ op: "set_count", meal_count: plan.meal_count + 1 });
    if (!afterCount) return;
    await mutateDinnerPlan({
      op: "add_meal",
      kind: "recipe",
      recipe_version_id: slot.recipe_version_id,
      participant_ids: activeMemberIds(),
    });
    state.planAddElse = true;
    state.planSingleMode = true;
    show("planReview", {
      context: Nav.contextFor("planReview", "choices", { established: true, mode: "compose" }),
    });
    renderPlanReview();
  }

  function stillNeedCount(plan) {
    const lines = (state.dinnerShop && state.dinnerShop.lines) || (plan && plan.shop_lines) || [];
    return lines.filter(function (l) {
      return l.still_needed && l.list_state === "open";
    }).length;
  }

  function renderHomeNoPlanHero() {
    const eye = document.getElementById("homeEyebrow");
    const homeTitle = document.getElementById("homeMealTitle");
    const homeLede = document.getElementById("homeLede");
    const actions = document.getElementById("homeActions");
    const media = document.getElementById("homeMedia");
    const insights = document.getElementById("homeInsights");
    const pill = document.getElementById("homePill");
    const homeMeta = document.getElementById("homeMealMeta");
    const homeCopy = document.getElementById("homeStatusCopy");
    if (homeCopy) homeCopy.hidden = true;
    if (pill) pill.hidden = true;
    if (homeMeta) homeMeta.hidden = true;
    eye.textContent = "Dinner, sorted";
    homeTitle.textContent = "What’s for dinner?";
    homeLede.textContent = "Plan a few nights at once, or look around for tonight.";
    actions.innerHTML =
      '<button class="btn btn-primary btn-lg" type="button" data-action="plan-dinners">Plan our dinners</button>' +
      '<button class="btn btn-secondary btn-lg" type="button" data-action="find-dinner">Find a dinner</button>' +
      (planningApi() ? planningApi().chipHtml(draftPrefs(), "draft") : "");
    media.className = "tonight-hero__media";
    media.innerHTML = mealMediaHtml({ recipe_slug: "miso-ginger-salmon" }, { decorative: true, eager: true });
    insights.hidden = true;
    renderHomeRatingWait();
  }

  function renderHomePlanHero() {
    const plan = state.dinnerPlan;
    const eye = document.getElementById("homeEyebrow");
    const homeTitle = document.getElementById("homeMealTitle");
    const homeLede = document.getElementById("homeLede");
    const actions = document.getElementById("homeActions");
    const media = document.getElementById("homeMedia");
    const insights = document.getElementById("homeInsights");
    const pill = document.getElementById("homePill");
    const homeCopy = document.getElementById("homeStatusCopy");
    if (homeCopy) homeCopy.hidden = true;
    if (pill) pill.hidden = true;
    const n = plan.meal_count;
    const meals = plan.meals || [];
    const cooking = meals.find(function (m) {
      return m.state === "cooking";
    });
    const selected = meals.find(function (m) {
      return m.state === "selected";
    });
    const k = stillNeedCount(plan);
    let primary = "";
    let secondary = "";
    if (!plan.finalized_at && !meals.some(function (m) {
      return m.state !== "planned" && m.kind === "recipe";
    })) {
      eye.textContent = "Your plan";
      homeTitle.textContent = "Your plan is almost ready";
      homeLede.textContent = n + (n === 1 ? " dinner picked" : " dinners picked") + ". Have a look and make it yours.";
      primary = '<button class="btn btn-primary btn-lg" type="button" data-go="planReview">Finish the plan</button>';
    } else if (planIsClosed(plan)) {
      eye.textContent = "Your plan";
      homeTitle.textContent = "That plan’s a wrap";
      homeLede.textContent = "Every dinner is cooked, rated, or set aside.";
      primary = '<button class="btn btn-primary btn-lg" type="button" data-action="plan-dinners">Plan our next dinners</button>';
      secondary = '<button class="btn btn-secondary btn-lg" type="button" data-action="find-dinner">Find a dinner</button>';
    } else if (cooking) {
      eye.textContent = "Your plan";
      homeTitle.textContent = planMealTitle(cooking) + " is cooking";
      homeLede.textContent = "When it’s on the table, you can say so.";
      primary =
        '<button class="btn btn-primary btn-lg" type="button" data-action="mark-cooked" data-meal-id="' +
        escapeHtml(cooking.meal_id) +
        '">We made this</button>';
      secondary =
        '<button class="btn btn-secondary btn-lg" type="button" data-action="dp-back-kitchen" data-meal-id="' +
        escapeHtml(cooking.meal_id) +
        '">Back to the kitchen</button>' +
        '<button class="btn btn-quiet btn-lg" type="button" data-go="shopList">Shopping list</button>';
      media.innerHTML = mealMediaHtml(uiMealFromPlanMeal(cooking), { eager: true });
    } else if (selected) {
      eye.textContent = "Tonight";
      homeTitle.textContent = planMealTitle(selected);
      homeLede.textContent = "Tonight’s pick. Cook it whenever you’re ready.";
      primary = '<button class="btn btn-primary btn-lg" type="button" data-action="dp-start-cook">Start cooking</button>';
      secondary =
        '<button class="btn btn-secondary btn-lg" type="button" data-go="choices">See other dinners</button>' +
        '<button class="btn btn-quiet btn-lg" type="button" data-go="shopList">Shopping list</button>';
      media.innerHTML = mealMediaHtml(uiMealFromPlanMeal(selected), { eager: true });
    } else if (mealsAwaitingMyRating().length) {
      const waiting = mealsAwaitingMyRating()[0];
      eye.textContent = "Your plan";
      homeTitle.textContent = planMealTitle(waiting);
      homeLede.textContent = "Cooked. Rate it whenever you’re ready.";
      primary =
        '<button class="btn btn-primary btn-lg" type="button" data-action="home-rate-cooked" data-meal-id="' +
        escapeHtml(waiting.meal_id) +
        '">How was it?</button>';
      secondary = '<button class="btn btn-secondary btn-lg" type="button" data-go="shopList">Shopping list</button>';
      media.innerHTML = mealMediaHtml(uiMealFromPlanMeal(waiting), { eager: true });
    } else if (!plan.shopping_started_at) {
      eye.textContent = "Your plan";
      homeTitle.textContent = n === 1 ? "1 dinner planned" : n + " dinners planned";
      homeLede.textContent = "Your list is ready when you are.";
      primary = '<button class="btn btn-primary btn-lg" type="button" data-go="shopList">Shopping list</button>';
      secondary = '<button class="btn btn-secondary btn-lg" type="button" data-go="choices">What are we cooking tonight?</button>';
    } else {
      eye.textContent = "Your plan";
      homeTitle.textContent = n === 1 ? "1 dinner planned" : n + " dinners planned";
      homeLede.textContent = k === 0 ? "You’ve got everything." : k + " things left to get.";
      primary = '<button class="btn btn-primary btn-lg" type="button" data-go="shopList">Shopping list</button>';
      secondary = '<button class="btn btn-secondary btn-lg" type="button" data-go="choices">What are we cooking tonight?</button>';
    }
    if (!cooking && !selected) {
      media.className = "tonight-hero__media tonight-hero__media--stack";
      media.innerHTML = meals
        .slice(0, 3)
        .map(function (m) {
          return mealMediaHtml(uiMealFromPlanMeal(m), { decorative: true });
        })
        .join("");
    }
    actions.classList.toggle("hero-actions--stack", !!cooking);
    actions.innerHTML = primary + secondary;
    if (selected && selected.kind === "recipe") {
      const reason = planMealReasonLine(selected);
      const whyHost = document.getElementById("homeWhy");
      if (reason && whyHost && whyHost.parentElement) {
        insights.hidden = false;
        whyHost.parentElement.innerHTML =
          '<p class="insight__label">Why this one</p>' + (explanationBlockHtml("home-hero", selected) || "");
        bindWhyInScope(insights);
        ensureRecipeForMeal(uiMealFromPlanMeal(selected)).then(function (recipe) {
          if (!recipe) return;
          const ingCount = document.getElementById("homeIngCount");
          const stepCount = document.getElementById("homeStepCount");
          if (ingCount) ingCount.textContent = (recipe.ingredients || []).length + " ingredients";
          if (stepCount) {
            stepCount.textContent =
              (recipe.steps || []).length +
              " steps" +
              (recipe.total_minutes ? " (~" + recipe.total_minutes + " min)" : "");
          }
        });
      } else {
        insights.hidden = true;
      }
    } else {
      insights.hidden = true;
    }
    renderHomeRatingWait();
  }

  function mealsAwaitingMyRating() {
    const out = [];
    const me = meMember();
    if (!me || !state.dinnerPlan) return out;
    (state.dinnerPlan.meals || []).forEach(function (m) {
      if (m.kind !== "recipe") return;
      if (m.state !== "cooked" && m.state !== "partially_rated") return;
      const parts = m.participant_ids || [];
      if (parts.indexOf(me.id) < 0) return;
      const rated = (m.ratings || []).some(function (r) {
        return r.member_id === me.id;
      });
      if (!rated) out.push(m);
    });
    return out;
  }

  function renderHomeRatingWait() {
    const card = document.getElementById("homeRatingWait");
    if (!card) return;
    const waiting = mealsAwaitingMyRating();
    if (!waiting.length) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    document.getElementById("homeRatingWaitTitle").textContent = planMealTitle(waiting[0]);
    const more = document.getElementById("btnHomeMoreRates");
    if (waiting.length > 1) {
      more.hidden = false;
      more.textContent = waiting.length - 1 + " more to rate";
    } else more.hidden = true;
  }

  function weaveDepsForPlan() {
    return {
      track: track,
      activeMemberIds: activeMemberIds,
      applyDinnerPlan: applyDinnerPlan,
      show: show,
      navContextFor: function (a, b, c) {
        return Nav.contextFor(a, b, c);
      },
      planningApi: planningApi,
      getDinnerPlan: function () {
        return state.dinnerPlan;
      },
      mutateDinnerPlan: mutateDinnerPlan,
      renderPlanReview: renderPlanReview,
      renderPlanReviewPartial: renderPlanReviewPartial,
      focusPlanMeal: function (mealId) {
        state.pendingPlanMealFocus = mealId;
        const card = document.querySelector('.plan-meal-card[data-meal-id="' + mealId + '"]');
        if (card) {
          card.classList.add("plan-meal-card--changed");
          card.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "nearest",
          });
        }
        focusPendingPlanMeal();
      },
      mountPlanReview: mountPlanReviewWeave,
      openPlanDatesSheet: openPlanDatesSheet,
      minAllowedMealCount: minAllowedMealCount,
      insertPlanMealSkeleton: insertPlanMealSkeleton,
      fadeRemovePlanMealCard: fadeRemovePlanMealCard,
      dinerLimits: dinerLimitIds,
    };
  }

  /** Seafood limit ids for the diners at the table; Weave hides fish prompts from them. */
  function dinerLimitIds() {
    const ids = new Set();
    const mids = activeMemberIds();
    for (const row of state.householdConstraintRows || []) {
      if (row.member_id && mids.indexOf(row.member_id) < 0) continue;
      if (row.status === "permitted") continue;
      if (row.rule_key === "fish" || row.rule_key === "finfish") ids.add("no_finfish");
      if (row.rule_key === "shellfish") ids.add("no_shellfish");
    }
    return [...ids];
  }

  function mountPlanCountWeave() {
    const B = window.FlavorWeaveWeaveBridge;
    if (!B) return;
    state.weavePlanCount = B.planMountCount(weaveDepsForPlan());
  }

  function applyPlanCountComposer() {
    const ai = !!(window.FlavorWeaveAi && window.FlavorWeaveAi.consumerUi);
    const lede = document.getElementById("planCountLede");
    const divider = document.getElementById("planCountDivider");
    const host = document.getElementById("planWeaveHost");
    if (lede) {
      lede.textContent = ai ? "Tell us what the week needs, or choose how many below." : "Choose how many dinners.";
    }
    if (divider) divider.hidden = !ai;
    if (host) host.hidden = !ai;
    if (ai) mountPlanCountWeave();
  }

  function mountPlanReviewWeave() {
    const gate = window.FlavorWeaveAi;
    if (gate && gate.consumerUi == null && gate.ready) {
      gate.ready.then(mountPlanReviewWeave);
      return;
    }
    const ai = !!(gate && gate.consumerUi);
    const host = document.getElementById("planReviewWeaveHost");
    if (!ai) {
      if (host) host.hidden = true;
      return;
    }
    if (host) host.hidden = false;
    const plan = state.dinnerPlan;
    if (state.weavePlanReview && state.weavePlanReviewPlanId === plan?.dinner_plan_id) {
      window.FlavorWeavePlanReview = state.weavePlanReview;
      state.weavePlanReview.render?.();
      return;
    }
    const B = window.FlavorWeaveWeaveBridge;
    if (!B) return;
    const prefs = document.getElementById("planReviewPrefs");
    if (prefs) prefs.hidden = true;
    state.weavePlanReviewPlanId = plan?.dinner_plan_id || null;
    state.weavePlanReview = B.planMountReview(weaveDepsForPlan());
    if (state.weavePlanReview) {
      window.FlavorWeavePlanReview = state.weavePlanReview;
    }
    if (state.weavePlanReview?.restoreFromCache && !state.weavePlanReview.ctrl?.echo && !state.weavePlanReview.ctrl?.choice) {
      state.weavePlanReview.restoreFromCache();
    }
  }

  function renderPlanReviewPartial(changed) {
    const plan = state.dinnerPlan;
    if (!plan || !changed || !changed.length) return;
    changed.forEach(function (pos) {
      const meal = (plan.meals || []).find(function (m) {
        return m.position === pos;
      });
      if (!meal) return;
      const el = document.querySelector('.plan-meal-card[data-meal-id="' + meal.meal_id + '"]');
      if (!el) return;
      const tmp = document.createElement("div");
      tmp.innerHTML = renderPlanMealCard(meal);
      const newCard = tmp.firstElementChild;
      if (newCard) {
        newCard.classList.add("plan-meal-card--changed");
        el.replaceWith(newCard);
      }
    });
  }

  function renderPlanCount() {
    const root = document.getElementById("planCountOptions");
    const groups = [
      { id: "few", label: "Next few days", sub: "2 to 4 dinners", chips: [2, 3, 4] },
      { id: "week", label: "This week", sub: "You choose how many", chips: [3, 4, 5, 6, 7], hint: "Most weeks have a night or two off." },
      { id: "custom", label: "Custom", sub: "Up to 14", chips: Array.from({ length: 14 }, function (_, i) {
        return i + 1;
      }) },
    ];
    root.innerHTML = groups
      .map(function (g) {
        return (
          '<div class="plan-count-option" data-plan-group="' +
          g.id +
          '"><strong>' +
          escapeHtml(g.label) +
          "</strong><p class=\"meta\">" +
          escapeHtml(g.sub) +
          '</p><div class="plan-count-chips" hidden role="radiogroup" aria-label="' +
          escapeHtml(g.label) +
          '">' +
          g.chips
            .map(function (n) {
              return (
                '<button type="button" class="chip-tog" data-plan-count="' +
                n +
                '" role="radio" aria-checked="false">' +
                n +
                "</button>"
              );
            })
            .join("") +
          "</div>" +
          (g.hint ? '<p class="meta plan-count-hint" hidden>' + escapeHtml(g.hint) + "</p>" : "") +
          "</div>"
        );
      })
      .join("");
    state.planCountGroup = null;
    state.planCountValue = null;
    fillPrefSlot("planCountPrefs", draftPrefs(), "draft");
    syncPlanCountSubmit();
    const gate = window.FlavorWeaveAi;
    if (gate && gate.consumerUi == null && gate.ready) gate.ready.then(applyPlanCountComposer);
    else applyPlanCountComposer();
  }

  function syncPlanCountSubmit() {
    const btn = document.getElementById("btnPlanCountSubmit");
    if (!btn) return;
    if (!state.planCountValue) {
      btn.disabled = true;
      btn.textContent = "Choose a number";
    } else {
      btn.disabled = false;
      btn.textContent =
        state.planCountValue === 1 ? "Plan 1 dinner" : "Plan " + state.planCountValue + " dinners";
    }
  }

  async function submitPlanCount() {
    if (!state.planCountValue) return;
    const loading = document.getElementById("planCountLoading");
    if (loading) loading.hidden = false;
    const plan = await createDinnerPlanRequest({
      meal_count: state.planCountValue,
      entry_point: "plan_dinners",
    });
    if (loading) loading.hidden = true;
    if (!plan) return;
    state.planReviewMode = "multi";
    state.planSingleMode = false;
    show("planReview", { context: Nav.contextFor("planReview", "planCount", { established: true, mode: "compose" }) });
    renderPlanReview();
  }

  async function startFindDinner(entry) {
    const loading = document.getElementById("planCountLoading");
    if (loading) loading.hidden = false;
    const plan = await createDinnerPlanRequest({
      meal_count: 1,
      entry_point: entry || "find_dinner",
    });
    if (loading) loading.hidden = true;
    if (!plan) return;
    state.planReviewMode = "single";
    state.planSingleMode = true;
    state.findDinnerEntry = entry || "find_dinner";
    show("planReview", { context: Nav.contextFor("planReview", "home", { established: true, mode: "compose" }) });
    renderPlanReview();
  }

  function openDiscoveryStandalone(entry) {
    if (!Discovery) return;
    Discovery.open({ mode: "standalone", entry: entry || "nav" });
  }

  function openDiscoveryReplace(mealId, origin, entry) {
    const plan = state.dinnerPlan;
    if (!plan || !mealId) return;
    const meal = planMealById(mealId);
    if (!Discovery || !meal) return;
    Discovery.open({
      mode: "replace_plan_meal",
      dinner_plan_id: plan.dinner_plan_id,
      meal_id: mealId,
      origin: origin || state.view,
      entry: entry || "swap_see_all",
    });
  }

  function openDiscoveryChoose(slot) {
    const plan = state.dinnerPlan;
    if (!plan || !Discovery) return;
    const meal = slot && slot.meal_id ? planMealById(slot.meal_id) : null;
    const participants =
      meal && meal.participant_ids && meal.participant_ids.length
        ? meal.participant_ids.slice()
        : activeMemberIds().slice();
    Discovery.open({
      mode: "choose_for_plan",
      dinner_plan_id: plan.dinner_plan_id,
      meal_id: slot && slot.meal_id,
      position: slot && slot.position,
      participant_ids: participants,
      origin: "planReview",
      entry: "empty_slot",
    });
  }

  function planMealBySlug(slug) {
    const plan = state.dinnerPlan;
    if (!plan || !slug) return null;
    return (plan.meals || []).find(function (m) {
      return m.recipe_slug === slug || m.slug === slug;
    });
  }

  async function openDiscoveryRecipe(slug, recipeVersionId) {
    state.discoveryRecipeVersionId = recipeVersionId || null;
    const row = discoveryResultRow(slug);
    const discoveryWhyLines = buildDiscoveryWhyLines(row, null);
    state.dinnerDetailMeal = {
      id: "disc-" + slug,
      title: (row && row.title) || slug.replace(/-/g, " "),
      recipe_slug: slug,
      recipe_version_id: recipeVersionId,
      dinner_plan: false,
      discovery: true,
      discoveryRow: row,
      discoveryWhyLines: discoveryWhyLines,
    };
    state.previewMealId = state.dinnerDetailMeal.id;
    state.activeRecipe = null;
    const disc = Discovery && Discovery.getState ? Discovery.getState() : { mode: "standalone" };
    const restore = Discovery && Discovery.captureState ? Discovery.captureState() : {};
    if (Discovery && Discovery.captureState) {
      history.replaceState({ fw: 1, view: "find", restore }, "", location.pathname + location.search);
    }
    history.pushState(
      { fw: 1, view: "detail", origin: "find", restore },
      "",
      "/meal/" + encodeURIComponent(slug) + "?from=find"
    );
    show("detail", {
      context: Nav.contextFor("detail", "find", {
        established: householdEstablished(),
        source: "discovery",
        mode: disc.mode,
        origin: "find",
      }),
    });
  }

  async function discoveryCookTonight() {
    const versionId = state.discoveryRecipeVersionId;
    if (!versionId) return;
    const resp = Discovery && Discovery.getResponse ? Discovery.getResponse() : null;
    const participants =
      resp && resp.context && resp.context.participant_ids && resp.context.participant_ids.length
        ? resp.context.participant_ids
        : activeMemberIds();
    const slug = state.dinnerDetailMeal && state.dinnerDetailMeal.recipe_slug;
    const onPlan = planMealBySlug(slug);
    if (onPlan && (onPlan.state === "planned" || onPlan.state === "selected" || onPlan.state === "cooking")) {
      if (onPlan.state !== "cooking") await mutateDinnerPlan({ op: "select_meal", meal_id: onPlan.meal_id });
      toast("It's tonight's pick.");
      state.dinnerDetailMeal = uiMealFromPlanMeal(onPlan);
      state.previewMealId = state.dinnerDetailMeal.id;
      state.navContext.detail = Nav.contextFor("detail", "choices", {
        established: householdEstablished(),
        source: "tonight_plan",
        origin: "tonightPlan",
      });
      renderDetail();
      return;
    }
    let plan = state.dinnerPlan;
    if (!hasCurrentDinnerPlan() || planIsClosed(plan)) {
      plan = await createDinnerPlanRequest({
        meal_count: 1,
        entry_point: "find_dinner",
        participant_ids: participants,
      });
      if (!plan) return;
      const meals = plan.meals || [];
      if (meals.length && meals[0].recipe_version_id !== versionId) {
        await mutateDinnerPlan({
          op: "swap_meal",
          meal_id: meals[0].meal_id,
          recipe_version_id: versionId,
          participant_ids: participants,
        });
      } else if (!meals.length) {
        await mutateDinnerPlan({
          op: "add_meal",
          kind: "recipe",
          recipe_version_id: versionId,
          participant_ids: participants,
        });
      }
      await mutateDinnerPlan({ op: "finalize" });
    } else {
      if (plan.meal_count >= 14) {
        toast("Your plan is full. Skip or remove a dinner first.");
        return;
      }
      await mutateDinnerPlan({ op: "set_count", meal_count: plan.meal_count + 1 });
      await mutateDinnerPlan({
        op: "add_meal",
        kind: "recipe",
        recipe_version_id: versionId,
        participant_ids: participants,
      });
      await mutateDinnerPlan({ op: "select_meal", meal_id: (state.dinnerPlan.meals || []).slice(-1)[0].meal_id });
    }
    plan = state.dinnerPlan;
    const picked = (plan.meals || []).find(function (m) {
      return m.recipe_version_id === versionId;
    });
    if (picked && picked.state !== "selected") {
      await mutateDinnerPlan({ op: "select_meal", meal_id: picked.meal_id });
    }
    track("discovery_action", { mode: "standalone", action: "cook_tonight", recipe_version_id: versionId });
    toast("It's tonight's pick.");
    if (picked) {
      state.dinnerDetailMeal = uiMealFromPlanMeal(picked);
      state.previewMealId = state.dinnerDetailMeal.id;
      state.navContext.detail = Nav.contextFor("detail", "choices", {
        established: householdEstablished(),
        source: "tonight_plan",
        origin: "tonightPlan",
      });
      renderDetail();
    }
  }

  function discoveryOpenRows(plan) {
    return (plan.meals || []).filter(function (m) {
      return m.kind === "recipe" && !m.recipe_version_id;
    });
  }

  async function discoveryAddToPlanSlot(mealId, versionId, participants) {
    const row = planMealById(mealId);
    if (!row) return;
    await mutateDinnerPlan({
      op: "swap_meal",
      meal_id: mealId,
      recipe_version_id: versionId,
      participant_ids: participants,
    });
    toast("Added as Dinner " + row.position + ".");
    track("discovery_action", { mode: "standalone", action: "add_to_plan", recipe_version_id: versionId });
    renderDetail();
  }

  function openDiscAddPlanSheet(versionId, participants, openRows) {
    const sheet = document.getElementById("discAddPlanSheet");
    const lede = document.getElementById("discAddPlanLede");
    const options = document.getElementById("discAddPlanOptions");
    const cancel = document.getElementById("discAddPlanCancel");
    if (!sheet || !options) {
      discoveryAddToPlanSlot(openRows[0].meal_id, versionId, participants);
      return;
    }
    if (lede) lede.textContent = "Which open dinner should this fill?";
    options.innerHTML = openRows
      .map(function (row) {
        return (
          '<button type="button" class="sheet-menu__btn" data-disc-add-slot="' +
          escapeHtml(row.meal_id) +
          '">Dinner ' +
          row.position +
          "</button>"
        );
      })
      .join("");
    const onPick = async function (ev) {
      const btn = ev.target.closest("[data-disc-add-slot]");
      if (!btn) return;
      ev.preventDefault();
      sheet.close();
      options.removeEventListener("click", onPick);
      if (cancel) cancel.removeEventListener("click", onCancel);
      await discoveryAddToPlanSlot(btn.dataset.discAddSlot, versionId, participants);
    };
    const onCancel = function () {
      sheet.close();
      options.removeEventListener("click", onPick);
      if (cancel) cancel.removeEventListener("click", onCancel);
    };
    options.addEventListener("click", onPick);
    if (cancel) cancel.addEventListener("click", onCancel);
    sheet.showModal();
  }

  async function discoveryAddToPlan() {
    const versionId = state.discoveryRecipeVersionId;
    if (!versionId) return;
    const resp = Discovery && Discovery.getResponse ? Discovery.getResponse() : null;
    const participants =
      resp && resp.context && resp.context.participant_ids && resp.context.participant_ids.length
        ? resp.context.participant_ids
        : activeMemberIds();
    let plan = state.dinnerPlan;
    if (!hasCurrentDinnerPlan() || planIsClosed(plan)) {
      plan = await createDinnerPlanRequest({ meal_count: 1, entry_point: "find_dinner", participant_ids: participants });
      if (!plan) return;
      const meals = plan.meals || [];
      if (!meals.length) {
        await mutateDinnerPlan({
          op: "add_meal",
          kind: "recipe",
          recipe_version_id: versionId,
          participant_ids: participants,
        });
      } else if (meals[0].recipe_version_id !== versionId) {
        await mutateDinnerPlan({
          op: "swap_meal",
          meal_id: meals[0].meal_id,
          recipe_version_id: versionId,
          participant_ids: participants,
        });
      }
      await mutateDinnerPlan({ op: "finalize" });
      toast("Added to your plan.");
      track("discovery_action", { mode: "standalone", action: "add_to_list", recipe_version_id: versionId });
      show("shopList", { context: Nav.contextFor("shopList", "detail", { established: true }) });
      return;
    }
    const openRows = discoveryOpenRows(plan);
    if (openRows.length > 1) {
      openDiscAddPlanSheet(versionId, participants, openRows);
      return;
    }
    if (openRows.length === 1) {
      await discoveryAddToPlanSlot(openRows[0].meal_id, versionId, participants);
      return;
    } else if (plan.meal_count >= 14) {
      toast("Your plan is full. Add a night first.");
      return;
    } else {
      await mutateDinnerPlan({ op: "set_count", meal_count: plan.meal_count + 1 });
      const added = await mutateDinnerPlan({
        op: "add_meal",
        kind: "recipe",
        recipe_version_id: versionId,
        participant_ids: participants,
      });
      const pos = added && added.meals ? added.meals.length : plan.meal_count;
      toast("Added as Dinner " + pos + ".");
    }
    track("discovery_action", { mode: "standalone", action: "add_to_plan", recipe_version_id: versionId });
    renderDetail();
  }

  async function discoveryPick(recipeVersionId, action, opts) {
    const disc = Discovery && Discovery.getState ? Discovery.getState() : null;
    const resp = disc && disc.response;
    const sel = resp && resp.selection;
    if (!sel || !recipeVersionId) return;
    const fromDetail = (opts && opts.fromDetail) || state.view === "detail";
    track("discovery_action", { mode: disc.mode, action, recipe_version_id: recipeVersionId });
    const payload = {
      op: sel.op,
      meal_id: sel.meal_id,
      recipe_version_id: recipeVersionId,
      participant_ids: sel.participant_ids,
    };
    const row =
      (resp.results || []).find(function (r) {
        return r.recipe_version_id === recipeVersionId;
      }) || discoveryResultRow(state.dinnerDetailMeal && state.dinnerDetailMeal.recipe_slug);
    const pickedTitle = (row && row.title) || (state.dinnerDetailMeal && state.dinnerDetailMeal.title) || "dinner";
    const plan = await mutateDinnerPlan(payload, { suppressToast: true });
    if (!plan || plan.failed) return;
    if (action === "use_this" && sel.meal_id) {
      state.swappedMealIds = state.swappedMealIds || {};
      state.swappedMealIds[sel.meal_id] = true;
      state.pendingPlanMealFocus = sel.meal_id;
    }
    if (state.pendingDinnerToast) flushDinnerToast();
    else if (action === "use_this") toast("Swapped in " + pickedTitle + ".");
    else toast("Added to your plan.");
    const origin = (state.navContext.find && state.navContext.find.origin) || "planReview";
    const exitView = origin === "choices" ? "choices" : origin === "home" ? "home" : "planReview";
    show(exitView);
    renderActiveDinnerSurfaces();
  }

  function planReviewCopy() {
    const plan = state.dinnerPlan;
    if (!plan) return;
    const eyebrow = document.getElementById("planReviewEyebrow");
    const title = document.getElementById("planReviewTitle");
    const lede = document.getElementById("planReviewLede");
    const ctx = state.navContext.planReview || {};
    if (state.planAddElse) {
      eyebrow.textContent = "Find a dinner";
      title.textContent = "Here’s something else";
      lede.textContent = "It joins your plan for tonight. Everything else stays put.";
      return;
    }
    if (state.planSingleMode || plan.meal_count === 1) {
      eyebrow.textContent = "Find a dinner";
      title.textContent = "Here’s a good one";
      lede.textContent = "Picked for your table. Swap it if it’s not the night for it.";
      return;
    }
    if (ctx.mode === "edit") {
      eyebrow.textContent = "Your plan · " + plan.meal_count + " " + dinnerCountWord(plan.meal_count);
      title.textContent = "Your plan";
      lede.textContent = "Swap, move, or set aside any dinner that hasn’t been cooked.";
      return;
    }
    const allEmpty = (plan.meals || []).length === 0 && emptySlotCount(plan) === plan.meal_count;
    if (allEmpty) {
      title.textContent = "We couldn’t fill this plan";
      lede.textContent = "Your table’s limits rule out every dinner we have right now.";
      return;
    }
    eyebrow.textContent = "Your plan · " + plan.meal_count + " " + dinnerCountWord(plan.meal_count);
    title.textContent = "Here’s a good plan";
    lede.textContent = "One dinner per night, picked for your table. Swap anything that doesn’t feel right.";
  }

  function renderPlanMealCard(meal, slot, showStateBadge) {
    if (slot && slot.empty) {
      const reason = slot.reason || "no_eligible_meal";
      const isNoUnused = reason === "no_unused_eligible_meal";
      return (
        '<div class="plan-meal-card empty-state" role="listitem" data-empty-position="' +
        slot.position +
        '"><strong>' +
        (isNoUnused ? "That’s every dinner that fits" : "Nothing on the menu fits this table yet") +
        "</strong><p class=\"meta\">" +
        (isNoUnused
          ? "Your plan already has all of them. Repeat one you love, or take the night off from cooking."
          : "Between everyone’s limits, none of our dinners work here. Try a different table, or take the night off from cooking.") +
        '</p><div class="plan-meal-card__actions">' +
        '<button type="button" class="btn btn-secondary btn-sm" data-action="disc-pick-slot" data-empty-position="' +
        slot.position +
        '">Pick one yourself</button>' +
        '<button type="button" class="btn btn-quiet btn-sm" data-action="empty-participants">Change who’s eating</button>' +
        '<button type="button" class="btn btn-quiet btn-sm" data-action="empty-leftovers">Make it leftovers</button>' +
        '<button type="button" class="btn btn-quiet btn-sm" data-action="empty-out">We’re eating out</button>' +
        "</div></div>"
      );
    }
    if (!meal) return "";
    const ui = uiMealFromPlanMeal(meal);
    const swapped = state.swappedMealIds && state.swappedMealIds[meal.meal_id];
    if (meal.kind === "leftovers" || meal.kind === "eating_out") {
      return (
        '<article class="plan-meal-card plan-meal-card--quiet" role="listitem" data-meal-id="' +
        escapeHtml(meal.meal_id) +
        '"><p class="eyebrow">' +
        escapeHtml(planMealLabel(meal)) +
        "</p><h2>" +
        escapeHtml(planMealTitle(meal)) +
        '</h2><p class="meta">Nothing to shop for.</p><button type="button" class="btn btn-quiet btn-sm" data-action="meal-more" data-meal-id="' +
        escapeHtml(meal.meal_id) +
        '" aria-label="More for ' +
        escapeHtml(planMealLabel(meal)) +
        '">⋯</button></article>'
      );
    }
    const canSwap = meal.state === "planned" || meal.state === "selected";
    const rawForCard = meal;
    const dinerExc = planMealDinerException(rawForCard);
    const dinerBtn =
      '<button type="button" class="plan-meal-diner' +
      (dinerExc ? " is-exception" : "") +
      '" data-action="open-participants" data-meal-id="' +
      escapeHtml(meal.meal_id) +
      '" aria-label="For ' +
      dinerCountForPlanMeal(rawForCard) +
      ", change who's eating Dinner " +
      meal.position +
      '">' +
      icon("users") +
      " " +
      escapeHtml(planMealDinerLabel(rawForCard)) +
      "</button>";
    const whyBlock = explanationBlockHtml("plan-" + meal.meal_id, meal);
    const adapted =
      window.FlavorWeaveMealRecipe && window.FlavorWeaveMealRecipe.adaptationChangeCount(rawForCard) > 0
        ? '<span class="badge badge--your-version">Your version</span> '
        : "";
    return (
      '<article class="plan-meal-card" role="listitem" data-meal-id="' +
      escapeHtml(meal.meal_id) +
      '">' +
      mealMediaHtml(ui, { className: "plan-meal-card__media", decorative: true }) +
      '<div class="plan-meal-card__body"><p class="eyebrow">' +
      escapeHtml(planMealLabel(meal)) +
      "</p><h2><button type=\"button\" class=\"btn-quiet plan-meal-title\" data-action=\"open-plan-meal\" data-meal-id=\"" +
      escapeHtml(meal.meal_id) +
      '">' +
      escapeHtml(planMealTitle(meal)) +
      "</button></h2>" +
      adapted +
      (swapped ? '<span class="badge badge--match">Swapped in</span> ' : "") +
      classificationBadges(meal) +
      (showStateBadge ? planMealStateBadge(meal) : "") +
      '<div class="plan-meal-meta">' +
      dinerBtn +
      "</div>" +
      whyBlock +
      '<div class="plan-meal-card__actions">' +
      (canSwap
        ? '<button type="button" class="btn btn-secondary btn-sm" data-action="swap-meal" data-meal-id="' +
          escapeHtml(meal.meal_id) +
          '" aria-label="Swap ' +
          escapeHtml(planMealLabel(meal)) +
          ", " +
          escapeHtml(planMealTitle(meal)) +
          '">Swap</button>'
        : "") +
      '<button type="button" class="btn btn-quiet btn-sm" data-action="meal-more" data-meal-id="' +
      escapeHtml(meal.meal_id) +
      '" aria-label="More for ' +
      escapeHtml(planMealLabel(meal)) +
      '">⋯</button></div></div></article>'
    );
  }

  function focusPendingPlanMeal() {
    const mealId = state.pendingPlanMealFocus;
    if (!mealId) return;
    state.pendingPlanMealFocus = null;
    requestAnimationFrame(function () {
      const btn = document.querySelector('.plan-meal-card[data-meal-id="' + mealId + '"] .plan-meal-title');
      if (btn) btn.focus();
    });
  }

  async function fetchMealExplanation(payload) {
    const res = await apiPost("/api/explain", payload);
    return res && res.ok ? res : { text: payload.template || "", source: "fallback" };
  }

  function renderPlanReview() {
    const plan = state.dinnerPlan;
    if (!plan) return;
    planReviewCopy();
    const list = document.getElementById("planMealCards");
    const meals = (plan.meals || []).slice().sort(function (a, b) {
      return a.position - b.position;
    });
    const slots = emptySlots(plan);
    const ctx = state.navContext.planReview || {};
    let html = meals
      .map(function (m) {
        let card = renderPlanMealCard(m);
        if (ctx.star && m.kind === "recipe") {
          const me = meMember();
          const myVote = (state.dinnerPlan.votes || []).find(function (v) {
            return v.member_id === (me && me.id);
          });
          const starred = myVote && myVote.meal_id === m.meal_id;
          const starNames = voteNamesForMeal(m.meal_id);
          card +=
            '<button type="button" class="btn btn-secondary btn-sm" data-action="plan-star" data-meal-id="' +
            escapeHtml(m.meal_id) +
            '" aria-pressed="' +
            (starred ? "true" : "false") +
            '">Star it</button>' +
            (starNames.length
              ? '<p class="meta">Starred by ' + escapeHtml(starNames.join(", ")) + "</p>"
              : "");
        }
        return card;
      })
      .join("");
    html += slots
      .map(function (s) {
        return renderPlanMealCard(null, s);
      })
      .join("");
    list.innerHTML = html;
    bindWhyInScope(list);
    focusPendingPlanMeal();
    fillPrefSlot("planReviewPrefs", plan.intent, "active");
    renderPlanStarIntro();
    const btnGood = document.getElementById("btnPlanLooksGood");
    const btnBack = document.getElementById("btnPlanBackHome");
    const allEmpty = meals.length === 0 && slots.length === plan.meal_count;
    if (allEmpty) {
      btnGood.hidden = true;
      btnBack.hidden = false;
    } else if (state.planSingleMode) {
      btnGood.hidden = true;
      btnBack.hidden = true;
      if (state.planAddElse) {
        document.getElementById("planReviewActions").innerHTML =
          '<button class="btn btn-primary btn-lg" type="button" data-action="cook-this-tonight">Cook this tonight</button>';
      } else {
        document.getElementById("planReviewActions").innerHTML =
          '<button class="btn btn-primary btn-lg" type="button" data-action="single-make">Let’s make this</button>' +
          '<button class="btn btn-secondary btn-lg" type="button" data-action="single-shop">Add to my shopping list</button>';
      }
    } else if (ctx.mode === "edit") {
      btnGood.textContent = "Done";
      btnGood.hidden = false;
      btnBack.hidden = true;
    } else {
      btnGood.textContent = "Looks good";
      btnGood.hidden = false;
      btnBack.hidden = true;
    }
    const k = stillNeedCount(plan);
    const side = document.getElementById("planReviewSide");
    if (window.matchMedia("(min-width: 1024px)").matches && !state.planSingleMode) {
      side.hidden = false;
      document.getElementById("planReviewSideKicker").textContent = "Your plan · " + plan.meal_count + " " + dinnerCountWord(plan.meal_count);
      document.getElementById("planReviewSideShop").textContent =
        k === 0 ? "Nothing to shop for." : k + " things on your list";
    } else side.hidden = true;
    mountPlanReviewWeave();
  }

  function renderPlanConfirm() {
    const plan = state.dinnerPlan;
    if (!plan) return;
    const meals = plan.meals || [];
    let leftovers = 0;
    let out = 0;
    meals.forEach(function (m) {
      if (m.kind === "leftovers") leftovers++;
      if (m.kind === "eating_out") out++;
    });
    const recipeCount = meals.filter(function (m) {
      return m.kind === "recipe";
    }).length;
    const k = stillNeedCount(plan);
    let lede = recipeCount + (recipeCount === 1 ? " dinner" : " dinners");
    if (leftovers) lede += ", 1 leftovers night";
    if (out) lede += ", 1 night out";
    lede += " · " + (k === 0 ? "Nothing to shop for." : k + " things on your list");
    document.getElementById("planConfirmLede").textContent = lede;
    document.getElementById("planConfirmList").innerHTML = meals
      .map(function (m) {
        return "<li>" + escapeHtml(planMealLabel(m)) + " · " + escapeHtml(planMealTitle(m)) + "</li>";
      })
      .join("");
    const open = emptySlots(plan);
    const openEl = document.getElementById("planConfirmOpenSlot");
    if (open.length) {
      openEl.hidden = false;
      openEl.textContent = "Dinner " + open[0].position + " is still open. You can fill it later.";
    } else openEl.hidden = true;
  }

  const SHOP_QTY_FRACS = [
    [1 / 8, "1/8"],
    [1 / 4, "1/4"],
    [3 / 8, "3/8"],
    [1 / 3, "1/3"],
    [1 / 2, "1/2"],
    [2 / 3, "2/3"],
    [3 / 4, "3/4"],
  ];
  const SHOP_QTY_EPS = 1e-6;
  /** 1/3 and 2/3 are stored as 0.333 and 0.667. This tolerance is only for those two. */
  const SHOP_STORED_THIRD_TOL = 0.00051;

  function shopFractionTolerance(target) {
    if (Math.abs(target - 1 / 3) < 1e-12 || Math.abs(target - 2 / 3) < 1e-12) return SHOP_STORED_THIRD_TOL;
    return SHOP_QTY_EPS;
  }

  function formatShopQuantityAmount(num) {
    const sign = num < 0 ? "-" : "";
    const abs = Math.abs(num);
    const whole = Math.floor(abs + SHOP_QTY_EPS);
    const fracPart = abs - whole;
    if (fracPart < SHOP_QTY_EPS) return sign + String(whole);
    for (let i = 0; i < SHOP_QTY_FRACS.length; i++) {
      const pair = SHOP_QTY_FRACS[i];
      if (Math.abs(fracPart - pair[0]) < shopFractionTolerance(pair[0])) {
        return whole > 0 ? sign + whole + " " + pair[1] : sign + pair[1];
      }
    }
    const trimmed = String(abs);
    const short = trimmed.indexOf(".") >= 0 ? trimmed.replace(/\.?0+$/, "") : trimmed;
    return sign + short;
  }

  function shopLineKey(ingredientId, unit) {
    return ingredientId + "\0" + (unit || "");
  }

  function persistShopLineSnapshot() {
    const plan = state.dinnerPlan;
    if (!plan) return;
    try {
      localStorage.setItem(shopSnapKey(plan.dinner_plan_id), JSON.stringify(state.shopLineSnapshot));
    } catch (_) { /* ignore */ }
  }

  function loadShopLineSnapshotFromStorage() {
    const plan = state.dinnerPlan;
    if (!plan || Object.keys(state.shopLineSnapshot).length) return;
    try {
      const raw = localStorage.getItem(shopSnapKey(plan.dinner_plan_id));
      if (raw) state.shopLineSnapshot = JSON.parse(raw);
    } catch (_) { /* ignore */ }
  }

  function rebuildShopSnapshotFromDeltas(lines, unseenDeltas) {
    const snap = {};
    (lines || []).forEach(function (l) {
      if (!l.still_needed) return;
      snap[shopLineKey(l.ingredient_id, l.unit)] = { quantity: l.quantity, list_state: l.list_state };
    });
    const sorted = (unseenDeltas || [])
      .slice()
      .sort(function (a, b) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    sorted.forEach(function (d) {
      const key = shopLineKey(d.ingredient_id, d.unit);
      const qty = Number(d.quantity) || 0;
      if (d.kind === "added") {
        if (!snap[key]) return;
        const cur = Number(snap[key].quantity) || 0;
        const next = cur - qty;
        if (next <= SHOP_QTY_EPS) delete snap[key];
        else snap[key].quantity = next;
      } else if (d.kind === "no_longer_needed") {
        if (snap[key]) snap[key].quantity = (Number(snap[key].quantity) || 0) + qty;
        else snap[key] = { quantity: qty, list_state: "open" };
      }
    });
    return snap;
  }

  function ensureShopLineSnapshotForTags() {
    const plan = state.dinnerPlan;
    const shop = state.dinnerShop;
    if (!plan || !shop || !planShoppingStarted()) return;
    loadShopLineSnapshotFromStorage();
    if (Object.keys(state.shopLineSnapshot).length) return;
    const unseen = deltasSinceShopSeen();
    if (unseen.length) {
      state.shopLineSnapshot = rebuildShopSnapshotFromDeltas(shop.lines || [], unseen);
      persistShopLineSnapshot();
      return;
    }
    snapshotShopLinesForTags();
  }

  function formatShopQty(line) {
    if (line.quantity == null || line.quantity === "") return "";
    const raw = line.quantity;
    const num = typeof raw === "number" ? raw : Number(raw);
    let amount;
    if (!Number.isNaN(num) && String(raw).trim() !== "") {
      amount = formatShopQuantityAmount(num);
    } else {
      amount = String(raw);
    }
    const unit = line.unit;
    if (!unit || unit === "count") return amount;
    return amount + " " + unit;
  }

  const SHOP_AISLES = [
    ["produce", "Produce"],
    ["dairy", "Dairy"],
    ["meat", "Meat"],
    ["bakery", "Bakery"],
    ["pantry", "Pantry"],
    ["frozen", "Frozen"],
    ["household", "Household"],
    ["other", "Other"],
  ];

  function householdLines() {
    return (state.householdShop && state.householdShop.list && state.householdShop.list.lines) || [];
  }

  function shopStateWord(listState) {
    if (listState === "purchased") return "Bought";
    if (listState === "already_have") return "Already have";
    if (listState === "skipped") return "Skipping";
    return "Still need";
  }

  const SHOP_QTY_UNICODE = { "1/8": "⅛", "1/4": "¼", "3/8": "⅜", "1/3": "⅓", "1/2": "½", "2/3": "⅔", "3/4": "¾" };

  function unicodeShopQty(ascii) {
    return String(ascii).replace(/\d+\/\d+/g, function (token) {
      return SHOP_QTY_UNICODE[token] || token;
    });
  }

  function shopDisplayName(line) {
    const raw = (line && (line.product_name || line.display_name)) || "Item";
    const text = String(raw).trim();
    if (!text) return "Item";
    if (text !== text.toLowerCase()) return text;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function shopQtyPresentation(line) {
    if (line && line.quantity_label) {
      return { display: line.quantity_label, accessible: line.quantity_accessible || line.quantity_label };
    }
    if (!line || line.buy_quantity == null || line.buy_quantity === "") return { display: "", accessible: "" };
    const unit = !line.unit || line.unit === "unparsed" || line.unit === "count" ? "count" : line.unit;
    const accessible = formatShopQty({ quantity: line.buy_quantity, unit: unit });
    return { display: unicodeShopQty(accessible), accessible: accessible };
  }

  let shopListWriteEpoch = 0;

  async function loadHouseholdShop() {
    const seenWrite = shopListWriteEpoch;
    const epoch = sessionEpoch;
    const res = await apiGet("/api/household-shop");
    if (!sessionStillCurrent(epoch) || (res && res.aborted)) return null;
    if (!res || !res.ok || !res.list) return null;
    const current = state.householdShop && state.householdShop.list;
    // Revisions only order reads of the same list. An archived list is replaced
    // by a new one whose revision starts again at 1.
    const sameList = !!(current && current.shop_list_id && current.shop_list_id === res.list.shop_list_id);
    const currentRev = sameList ? Number(current.revision) || 0 : 0;
    const incomingRev = Number(res.list.revision) || 0;
    if (sameList && seenWrite !== shopListWriteEpoch && incomingRev <= currentRev) return state.householdShop;
    if (sameList && incomingRev < currentRev) return state.householdShop;
    state.householdShop = res;
    return res;
  }

  async function mutateHouseholdShop(body) {
    shopListWriteEpoch += 1;
    const list = state.householdShop && state.householdShop.list;
    const payload = Object.assign({ expected_revision: list ? list.revision : 1 }, body);
    state.shopAttempt = payload;
    const res = await apiPost("/api/household-shop", payload);
    if (res && res.ok && res.list) {
      state.householdShop = Object.assign({}, state.householdShop || {}, { list: res.list });
      state.shopAttempt = null;
      const conflict = document.getElementById("shopConflict");
      if (conflict) conflict.hidden = true;
      return res;
    }
    if (res && res._httpStatus === 409 && res.list) {
      state.householdShop = Object.assign({}, state.householdShop || {}, { list: res.list });
      state.shopAttempt = res.attempted || payload;
      const conflict = document.getElementById("shopConflict");
      if (conflict) conflict.hidden = false;
      renderShopList();
      return res;
    }
    if (!res) toast("Couldn’t reach the list. Your words are still here.");
    else if (res.error === "item_name_required") toast("Add a bit more of a name.");
    else toast("Couldn’t save that. Try again.");
    return res;
  }

  function shopRequestId(prefix) {
    return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  async function trackShopExport(type, stage, surface) {
    const epoch = sessionEpoch;
    const body = {
      event_name: "shop_export",
      type: type,
      surface: surface || "shop_sheet",
      stage: stage,
    };
    if (stage === "succeeded" || stage === "generated") body.ok = true;
    else if (stage === "failed" || stage === "cancelled") body.ok = false;
    try {
      await fetch("/api/events", {
        method: "POST",
        credentials: "same-origin",
        headers: apiHeaders(),
        cache: "no-store",
        signal: sessionAbort.signal,
        body: JSON.stringify(body),
      });
    } catch (_) { /* an aborted telemetry post is not a client error */ }
    return sessionStillCurrent(epoch);
  }

  async function shopExport(kind) {
    const format = kind === "csv" ? "csv" : kind === "print" ? "print" : "txt";
    const exportType = kind === "print" ? "print" : kind === "copy" ? "copy" : "download";
    const epoch = sessionEpoch;
    void trackShopExport(exportType, "attempted", "shop_menu");
    let res;
    try {
      res = await fetch("/api/household-shop/export?format=" + format, {
        credentials: "same-origin",
        cache: "no-store",
        signal: sessionAbort.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        void trackShopExport(exportType, "cancelled", "shop_menu");
        return;
      }
      toast("Couldn’t prepare the list. Your list is still here.");
      void trackShopExport(exportType, "failed", "shop_menu");
      return;
    }
    if (!sessionStillCurrent(epoch)) return;
    if (!res.ok) {
      toast("Couldn’t prepare the list. Your list is still here.");
      void trackShopExport(exportType, "failed", "shop_menu");
      return;
    }
    const text = await res.text();
    if (!sessionStillCurrent(epoch)) return;
    if (kind === "copy") {
      const ok = await copyText(text);
      toast(ok ? "List copied" : "Couldn’t copy — try the download");
      void trackShopExport("copy", ok ? "succeeded" : "failed", "shop_menu");
      return;
    }
    if (kind === "print") {
      const root = document.getElementById("shopPrintRoot");
      if (root) {
        root.hidden = false;
        root.textContent = text;
      }
      window.print();
      void trackShopExport("print", "succeeded", "shop_menu");
      return;
    }
    const blob = new Blob([text], { type: kind === "csv" ? "text/csv" : "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = kind === "csv" ? "flavorweave-list.csv" : "flavorweave-list.txt";
    a.click();
    URL.revokeObjectURL(url);
    void trackShopExport("download", "succeeded", "shop_menu");
  }

  async function shopNativeShare() {
    const epoch = sessionEpoch;
    void trackShopExport("share", "attempted", "shop_menu");
    let res;
    try {
      res = await fetch("/api/household-shop/export?format=txt", {
        credentials: "same-origin",
        cache: "no-store",
        signal: sessionAbort.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        void trackShopExport("share", "cancelled", "shop_menu");
        return;
      }
      toast("Couldn’t prepare the list. Your list is still here.");
      void trackShopExport("share", "failed", "shop_menu");
      return;
    }
    if (!sessionStillCurrent(epoch)) return;
    if (!res.ok) {
      toast("Couldn’t prepare the list. Your list is still here.");
      void trackShopExport("share", "failed", "shop_menu");
      return;
    }
    const text = await res.text();
    if (navigator.share) {
      try {
        await navigator.share({ title: "The list", text: text });
        void trackShopExport("share", "succeeded", "shop_menu");
        return;
      } catch (err) {
        if (err && err.name === "AbortError") {
          void trackShopExport("share", "cancelled", "shop_menu");
          return;
        }
      }
    }
    const ok = await copyText(text);
    toast(ok ? "List copied" : "Sharing isn’t available here");
    void trackShopExport(ok ? "copy" : "share", ok ? "succeeded" : "failed", "shop_menu");
  }

  async function shopOpenShare() {
    const res = await apiPost("/api/household-shop/shares", {});
    if (!res || !res.ok) {
      toast("Couldn’t make a link. The list is still here.");
      return;
    }
    state.shopShareId = res.share_id;
    const input = document.getElementById("shopShareUrl");
    const exp = document.getElementById("shopShareExpires");
    const url = location.origin + "/shop/shared/" + res.share_id;
    if (input) {
      input.value = url;
      input.setSelectionRange(0, 0);
      input.scrollLeft = 0;
    }
    if (exp) exp.textContent = "Stops working " + (res.expires_at || "").slice(0, 10) + ". You can stop it sooner.";
    document.getElementById("shopShareSheet").showModal();
  }

  async function shopRevoke() {
    if (!state.shopShareId) return;
    const res = await apiPost("/api/household-shop/shares", { op: "revoke", share_id: state.shopShareId });
    if (res && res.ok) {
      state.shopShareId = null;
      toast("Link stopped");
      const sheet = document.getElementById("shopShareSheet");
      if (sheet && sheet.open) sheet.close();
    } else toast("Couldn’t stop the link");
  }

  function recipeExportAudience() {
    const meal = detailMeal();
    const raw = meal && meal.dinner_plan ? planMealById(meal.id) : null;
    if (raw) {
      return {
        diner_count: dinerCountForPlanMeal(raw),
        guest_count: Math.max(0, Number(raw.guest_count) || 0),
      };
    }
    const viewing = state.detailViewingServings != null ? state.detailViewingServings : activeMemberCount();
    return { diner_count: viewing, guest_count: 0 };
  }

  async function exportRecipe(kind) {
    const recipe = state.activeRecipe;
    if (!recipe) return;
    const audience = recipeExportAudience();
    const res = await apiPost("/api/household-shop/recipe-export", {
      title: recipe.title || (detailMeal() && detailMeal().title) || "Recipe",
      diner_count: audience.diner_count,
      guest_count: audience.guest_count,
      ingredients: (recipe.ingredients || []).map(function (item) {
        const qty = typeof item.quantity === "number" ? item.quantity : Number(item.quantity);
        return {
          name: item.name,
          quantity: Number.isFinite(qty) ? qty : null,
          unit: item.unit || null,
        };
      }),
      steps: (recipe.steps || []).map(function (step) {
        return step.body || step.text || step.title || "";
      }),
    });
    if (!res || !res.ok) {
      toast("Couldn’t prepare the recipe");
      return;
    }
    if (kind === "print") {
      const root = document.getElementById("shopPrintRoot");
      if (root) {
        root.hidden = false;
        root.textContent = res.text;
      }
      window.print();
      return;
    }
    const ok = await copyText(res.text);
    toast(ok ? "Recipe copied" : "Couldn’t copy");
  }

  function renderShopList() {
    const page = document.getElementById("shopPage");
    const lines = householdLines();
    if (page) page.classList.toggle("shop-page--instore", !!state.shopInStore);
    const eyebrow = document.getElementById("shopEyebrow");
    const addInput = document.getElementById("shopAddInput");
    const addButton = document.querySelector("#shopAddForm button[type='submit']");
    const listReady = !!(state.householdShop && state.householdShop.list);
    if (addInput) addInput.disabled = !listReady;
    if (addButton) addButton.disabled = !listReady;
    if (!state.householdShop) {
      if (eyebrow) eyebrow.textContent = "The list";
      document.getElementById("shopProgress").textContent = "Loading the list…";
      return;
    }
    const plan = state.dinnerPlan;
    if (plan && planShoppingStarted()) ensureShopLineSnapshotForTags();
    const headline = state.householdShop.headline || "";
    if (eyebrow) {
      eyebrow.textContent = state.shopInStore ? "In the store" : headline || "For your household";
    }
    const title = document.getElementById("shopListTitle");
    if (title) title.textContent = "The list";
    const openNeed = lines.filter(function (l) {
      return l.still_needed && l.list_state === "open";
    });
    document.getElementById("shopProgress").textContent = state.shopInStore
      ? openNeed.length + " left"
      : openNeed.length
        ? openNeed.length + " to get"
        : lines.length
          ? "All set. Enjoy dinner."
          : "Nothing on the list yet";
    const dinners = [];
    const house = [];
    const hand = [];
    const dropped = [];
    lines.forEach(function (line) {
      if (!line.still_needed) {
        dropped.push(line);
        return;
      }
      const parked = line.list_state === "already_have" || line.list_state === "skipped" || (line.list_state === "purchased" && !state.shopInStore);
      if (parked) {
        hand.push(line);
        return;
      }
      if (line.origin === "general") house.push(line);
      else dinners.push(line);
    });
    function byAisle(rows) {
      return SHOP_AISLES.map(function (pair) {
        const group = rows.filter(function (line) {
          return (line.category || "other") === pair[0];
        });
        group.sort(function (a, b) {
          const ap = a.list_state === "purchased" ? 1 : 0;
          const bp = b.list_state === "purchased" ? 1 : 0;
          return ap - bp || String(a.display_name).localeCompare(String(b.display_name));
        });
        if (!group.length) return "";
        return '<section class="shop-aisle"><h2 class="shop-aisle__title">' + pair[1] + "</h2>" + group.map(rowHtml).join("") + "</section>";
      }).join("");
    }
    const mealNames = new Set();
    lines.forEach(function (line) {
      (line.meal_titles || []).forEach(function (title) {
        if (title) mealNames.add(title);
      });
    });
    const showMeal = mealNames.size > 1;
    function rowHtml(line) {
      const bought = line.list_state === "purchased";
      const name = shopDisplayName(line);
      const qtyBits = shopQtyPresentation(line);
      const qty = qtyBits.display;
      const qtyAccess = qtyBits.accessible || qty;
      const note = line.reconcile_note
        ? '<span class="shop-reconcile">' + escapeHtml(line.reconcile_note) + "</span>"
        : showMeal && line.meal_titles && line.meal_titles.length
          ? '<span class="shop-row__meals">' + escapeHtml(line.meal_titles.slice(0, 2).join(", ")) + "</span>"
          : "";
      const qtyText = qty || (line.list_state === "open" ? "" : shopStateWord(line.list_state));
      return (
        '<div class="shop-row' +
        (bought ? " shop-row--bought" : "") +
        '" data-line-id="' +
        escapeHtml(line.line_id) +
        '"><button type="button" class="shop-row__toggle" role="checkbox" aria-checked="' +
        (bought ? "true" : "false") +
        '" aria-label="' +
        escapeHtml(shopStateWord(line.list_state) + ", " + name + (qtyAccess ? ", " + qtyAccess : "")) +
        '" data-shop-toggle="' +
        escapeHtml(line.line_id) +
        '"><span class="shop-row__check' +
        (bought ? " is-on" : "") +
        '"></span><span><span class="shop-row__name">' +
        escapeHtml(name) +
        "</span>" +
        (qtyText
          ? '<span class="shop-row__qty"' +
            (qty && qtyAccess !== qty ? ' aria-label="' + escapeHtml(qtyAccess) + '"' : "") +
            ">" +
            escapeHtml(qtyText) +
            "</span>"
          : "") +
        note +
        "</span></button>" +
        '<button type="button" class="shop-row__more" data-shop-more="' +
        escapeHtml(line.line_id) +
        '" aria-label="More for ' +
        escapeHtml(name) +
        '">⋯</button></div>'
      );
    }
    const left = document.getElementById("shopColLeft");
    const right = document.getElementById("shopColRight");
    let leftHtml = '<h2 class="section-title">From the dinners</h2>' + (byAisle(dinners) || '<p class="meta">No dinner ingredients right now.</p>');
    let rightHtml = '<h2 class="section-title">Around the house</h2>' + (byAisle(house) || '<p class="meta">Add paper towels, coffee, detergent — anything the dinners don’t cover.</p>');
    if (hand.length) {
      rightHtml +=
        '<h2 class="section-title">In hand</h2><div id="shopHaveRows">' +
        hand.map(rowHtml).join("") +
        "</div>";
    }
    if (dropped.length) {
      rightHtml +=
        '<h2 class="section-title">No longer needed</h2><p class="meta">The plan moved on. Bought rows stay until you clear completed.</p>' +
        dropped.map(rowHtml).join("");
    }
    if (!lines.length) {
      leftHtml = '<div class="empty-state"><strong>The list is open</strong><p class="meta">Add bananas, oat milk, or paper towels. Dinner ingredients land here when a plan is active.</p></div>';
      rightHtml = "";
    }
    if (left) left.innerHTML = leftHtml;
    if (right) right.innerHTML = rightHtml;
    const prefs = (state.householdShop.preferences && state.householdShop.preferences.household) || {};
    const trip = state.householdShop.list.trip_method || prefs.method || "instore";
    const inStoreBtn = document.getElementById("btnShopInStore");
    const orderBtn = document.getElementById("btnShopOrder");
    const doneBtn = document.getElementById("btnShopDone");
    if (inStoreBtn) inStoreBtn.classList.toggle("is-emphasis", trip !== "order_online");
    if (orderBtn) orderBtn.classList.toggle("is-emphasis", trip === "order_online");
    if (doneBtn) doneBtn.hidden = !state.shopInStore;
    if (inStoreBtn) inStoreBtn.hidden = !!state.shopInStore;
    if (orderBtn) orderBtn.hidden = !!state.shopInStore || !(state.groceryProviders && state.groceryProviders.length);
    renderShopChangesBanner();
    if (window.FlavorWeaveShopHandoff) {
      window.FlavorWeaveShopHandoff.syncReturnBanner({ apiPost: apiPost });
    }
  }

  function openShopLineSheet(lineId) {
    const line = householdLines().find(function (l) {
      return l.line_id === lineId;
    });
    if (!line) return;
    state.shopLineMenuId = lineId;
    const name = shopDisplayName(line);
    document.getElementById("shopLineTitle").textContent = name;
    const mealTitles = line.meal_titles && line.meal_titles.length
      ? line.meal_titles
      : (line.meal_ids || [])
          .map(function (id) {
            const m = planMealById(id);
            return m ? planMealTitle(m) : "";
          })
          .filter(Boolean);
    let mealCopy = mealTitles.slice(0, 3).join(", ");
    if (mealTitles.length > 3) mealCopy += " and " + (mealTitles.length - 3) + " more";
    document.getElementById("shopLineMeals").textContent = mealCopy ? "For " + mealCopy : "";
    const prepEl = document.getElementById("shopLinePrep");
    if (line.preparation) {
      prepEl.hidden = false;
      prepEl.textContent = line.preparation;
    } else prepEl.hidden = true;
    const reconcile = document.getElementById("shopLineReconcile");
    if (reconcile) {
      reconcile.hidden = !line.reconcile_note;
      reconcile.textContent = line.reconcile_note || "";
    }
    const nameInput = document.getElementById("shopEditName");
    const qtyInput = document.getElementById("shopEditQty");
    const unitInput = document.getElementById("shopEditUnit");
    const catInput = document.getElementById("shopEditCategory");
    if (nameInput) nameInput.value = line.display_name || "";
    if (qtyInput) qtyInput.value = line.buy_quantity == null ? "" : String(line.buy_quantity);
    if (unitInput) unitInput.value = line.unit || "unparsed";
    if (catInput) catInput.value = line.category || "other";
    const actions = [];
    if (line.override_stale) {
      actions.push('<button type="button" class="sheet-menu__btn" data-action="shop-keep">Keep my amount</button>');
      actions.push('<button type="button" class="sheet-menu__btn" data-action="shop-use-recipe">Use the recipe amount</button>');
    }
    if (line.list_state !== "already_have") {
      actions.push('<button type="button" class="sheet-menu__btn" data-action="shop-set" data-state="already_have">Already have it</button>');
    }
    if (line.list_state !== "skipped") {
      actions.push('<button type="button" class="sheet-menu__btn" data-action="shop-set" data-state="skipped">Skip this trip</button>');
    }
    if (line.list_state !== "purchased") {
      actions.push('<button type="button" class="sheet-menu__btn" data-action="shop-set" data-state="purchased">Mark bought</button>');
    }
    if (line.list_state !== "open") {
      actions.push('<button type="button" class="sheet-menu__btn" data-action="shop-set" data-state="open">Still need it</button>');
    }
    const recipeMealId = (line.meal_ids || []).find(function (id) {
      const m = planMealById(id);
      return m && m.kind === "recipe";
    }) || (line.meal_ids || [])[0];
    if (recipeMealId && planMealById(recipeMealId)) {
      actions.push(
        '<button type="button" class="sheet-menu__btn" data-action="shop-view-recipe" data-meal-id="' +
          escapeHtml(recipeMealId) +
          '">View recipe</button>'
      );
    }
    if (line.origin === "general" || (line.sources || []).some(function (src) { return src.origin === "general"; })) {
      actions.push('<button type="button" class="sheet-menu__btn" data-action="shop-delete">Remove the typed item</button>');
    }
    document.getElementById("shopLineActions").innerHTML = actions.join("");
    document.getElementById("shopLineSheet").showModal();
  }

  function shopEyebrowTargetMealId(plan) {
    const recipeMeals = (plan.meals || []).filter(function (m) {
      return m.kind === "recipe";
    });
    if (!recipeMeals.length) return null;
    const hh = householdDinerCount();
    const exceptions = recipeMeals.filter(function (m) {
      return dinerCountForPlanMeal(m) !== hh;
    });
    if (exceptions.length === 1) return exceptions[0].meal_id;
    return recipeMeals[0].meal_id;
  }

  function renderShopChangesBanner() {
    const plan = state.dinnerPlan;
    const shop = state.dinnerShop;
    const banner = document.getElementById("shopChangesBanner");
    if (!banner || !plan || !shop || !shop.shopping_started_at) {
      banner.hidden = true;
      return;
    }
    let seen = 0;
    try {
      seen = Number(localStorage.getItem(shopSeenKey(plan.dinner_plan_id)) || 0);
    } catch (_) { /* ignore */ }
    const deltas = shop.deltas || [];
    const fresh = deltas.filter(function (d) {
      return new Date(d.created_at).getTime() > seen;
    });
    if (!fresh.length) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    document.getElementById("shopChangesBody").innerHTML = fresh
      .slice(0, 5)
      .map(function (d) {
        const label = d.kind === "added" ? "Added" : "No longer needed";
        return "<p>" + label + ": " + escapeHtml(formatShopQty(d)) + " " + escapeHtml(d.display_name || "") + "</p>";
      })
      .join("");
  }

  function renderTonightPlan() {
    const plan = state.dinnerPlan;
    const root = document.getElementById("tonightPlanRoot");
    const legacy = document.getElementById("choiceCards");
    const shareCard = document.getElementById("shareCard");
    if (!plan || planIsClosed(plan)) {
      root.hidden = true;
      legacy.hidden = false;
      if (shareCard) shareCard.hidden = false;
      const tonightMenu = document.getElementById("btnTonightMenu");
      if (tonightMenu) tonightMenu.hidden = true;
      renderTonightNoPlan();
      return;
    }
    root.hidden = false;
    legacy.hidden = true;
    if (shareCard) shareCard.hidden = true;
    const tonightMenu = document.getElementById("btnTonightMenu");
    if (tonightMenu) tonightMenu.hidden = false;
    document.getElementById("choicesEyebrow").textContent = "From your plan";
    document.getElementById("choicesTitle").textContent = "What are we cooking tonight?";
    const meals = plan.meals || [];
    const cooking = meals.filter(function (m) {
      return m.state === "cooking";
    });
    const selected = meals.filter(function (m) {
      return m.state === "selected";
    });
    const ready = meals.filter(function (m) {
      return m.state === "planned";
    });
    const rate = meals.filter(function (m) {
      return m.state === "cooked" || m.state === "partially_rated";
    });
    const done = meals.filter(function (m) {
      return planMealClosed(m);
    });
    let lede = "Cook any of these, in any order.";
    if (cooking.length) lede = planMealTitle(cooking[0]) + " is cooking. Pick up where you left off.";
    else if (selected.length) lede = "Tonight’s pick is " + planMealTitle(selected[0]) + ". Or cook any other one.";
    document.getElementById("choiceStripText").textContent = lede;
    fillPrefSlot("tonightPlanPrefs", plan.intent, "active");
    let html = "";
    if (cooking.length) {
      html += "<h2 class=\"section-title\">In the kitchen</h2>";
      html += cooking
        .map(function (m) {
          return (
            '<div class="tonight-plan-meal">' +
            '<div class="plan-meal-card__actions plan-meal-card__actions--stack">' +
            '<button class="btn btn-primary" type="button" data-action="mark-cooked" data-meal-id="' +
            escapeHtml(m.meal_id) +
            '">We made this</button>' +
            '<button class="btn btn-secondary" type="button" data-action="dp-back-kitchen" data-meal-id="' +
            escapeHtml(m.meal_id) +
            '">Back to the kitchen</button></div>' +
            renderPlanMealCard(m) +
            "</div>"
          );
        })
        .join("");
    }
    const readyList = selected.concat(ready.filter(function (m) {
      return m.kind === "recipe" || m.kind === "leftovers" || m.kind === "eating_out";
    }));
    if (readyList.length) {
      html += '<h2 class="section-title">Ready to cook</h2>';
      html += readyList
        .map(function (m) {
          let actions = "";
          if (m.kind === "recipe") {
            actions = '<div class="plan-meal-card__actions plan-meal-card__actions--stack">';
            actions +=
              '<button type="button" class="btn btn-primary" data-action="cook-plan-meal" data-meal-id="' +
              escapeHtml(m.meal_id) +
              '">Cook this</button>';
            if (m.state === "selected" || m.state === "planned") {
              actions +=
                '<button type="button" class="btn btn-secondary" data-action="mark-cooked" data-meal-id="' +
                escapeHtml(m.meal_id) +
                '">We made this</button>';
            }
            if (m.state === "planned") {
              actions +=
                '<button type="button" class="btn btn-quiet" data-action="pick-for-tonight" data-meal-id="' +
                escapeHtml(m.meal_id) +
                '">Pick for tonight</button>';
            }
            actions += "</div>";
          } else if (m.kind === "leftovers") {
            actions =
              '<button type="button" class="btn btn-primary btn-sm" data-action="fulfill-meal" data-meal-id="' +
              escapeHtml(m.meal_id) +
              '">We had leftovers</button>';
          } else if (m.kind === "eating_out") {
            actions =
              '<button type="button" class="btn btn-secondary btn-sm" data-action="fulfill-meal" data-meal-id="' +
              escapeHtml(m.meal_id) +
              '">We ate out</button>';
          }
          return '<div class="tonight-plan-meal">' + renderPlanMealCard(m, null, true) + actions + "</div>";
        })
        .join("");
    }
    if (rate.length) {
      html += '<h2 class="section-title">Rate when you’re ready</h2>';
      html += rate
        .map(function (m) {
          const me = meMember();
          const owes =
            me &&
            (m.participant_ids || []).indexOf(me.id) >= 0 &&
            !(m.ratings || []).some(function (r) {
              return r.member_id === me.id && r.score != null;
            });
          const rateBtn = owes
            ? '<button type="button" class="btn btn-primary" data-action="rate-plan-meal" data-meal-id="' +
              escapeHtml(m.meal_id) +
              '">Rate it</button>'
            : "";
          return '<div class="tonight-plan-meal">' + renderPlanMealCard(m, null, true) + rateBtn + "</div>";
        })
        .join("");
    }
    if (done.length) {
      html += "<p class=\"meta\">" + done.length + " done · Show</p>";
    }
    document.getElementById("tonightPlanSections").innerHTML = html;
    bindWhyInScope(document.getElementById("tonightPlanSections"));
    document.getElementById("tonightFindMore").hidden = planIsClosed(plan);
    const actionsEl = document.getElementById("choicesActions");
    if (actionsEl) {
      actionsEl.hidden = false;
      actionsEl.innerHTML =
        '<button class="btn btn-secondary btn-sm" type="button" data-go="shopList">Shopping list</button>';
    }
  }

  function renderTonightNoPlan() {
    if (hasCurrentDinnerPlan()) return;
    if (legacyRoundActive()) {
      renderChoicesHead();
      return;
    }
    document.getElementById("choicesEyebrow").textContent = "Tonight";
    document.getElementById("choicesTitle").textContent = "What are we cooking tonight?";
    document.getElementById("choiceStripText").textContent = "We’ll pick one that works for everyone eating.";
    document.getElementById("choicesActions").hidden = false;
    document.getElementById("choicesActions").innerHTML =
      '<button class="btn btn-primary btn-lg" type="button" data-action="pick-one">Pick one for us</button>' +
      '<button class="btn btn-secondary btn-lg" type="button" data-action="find-dinner-tonight">Find a dinner</button>' +
      '<button class="btn btn-quiet btn-lg" type="button" data-action="plan-dinners">Plan a few dinners</button>';
    document.getElementById("choiceCards").innerHTML = "";
    document.getElementById("shareCard").hidden = true;
  }

  function renderActiveDinnerSurfaces() {
    if (state.view === "home") updateHome();
    if (state.view === "choices") renderTonightPlan();
    if (state.view === "planReview") renderPlanReview();
    if (state.view === "planConfirm") renderPlanConfirm();
    if (state.view === "shopList") renderShopList();
  }

  async function applyAdaptationFromAdvice(rawMeal, advice, scopeLabel) {
    if (!rawMeal || !advice) return;
    const before = rawMeal.adaptation ? JSON.stringify(rawMeal.adaptation) : null;
    const adaptationPayload = advice.override
      ? {
          support: advice.support || "advice",
          acknowledgement: advice.acknowledgement || advice.override.acknowledgement,
          kind: advice.kind || advice.override.kind,
          override_json: advice.override,
        }
      : {
          support: advice.support || "advice",
          acknowledgement: advice.acknowledgement,
          kind: advice.kind,
          ingredient_ops: advice.ingredient_ops || [],
          step_notes: advice.step_notes || [],
        };
    const plan = await mutateDinnerPlan({
      op: "apply_adaptation",
      meal_id: rawMeal.meal_id,
      adaptation: adaptationPayload,
    });
    if (!plan) return;
    track("adaptation_applied", {
      meal_id: rawMeal.meal_id,
      recipe_slug: rawMeal.recipe_slug,
      kind: advice.kind,
      op_count: (advice.ingredient_ops || []).length,
    });
    const uiMeal = mealById(rawMeal.meal_id);
    state.activeRecipe = null;
    await ensureRecipeForMeal(uiMeal);
    renderDetail();
    renderPlanReview();
    renderTonightPlan();
    if (state.view === "cook") renderCook();
    const msg = "Applied to " + scopeLabel + ". Shopping list updated.";
    toastUndo(msg, async function () {
      await mutateDinnerPlan({ op: "clear_adaptation", meal_id: rawMeal.meal_id });
      track("adaptation_undone", { meal_id: rawMeal.meal_id, recipe_slug: rawMeal.recipe_slug });
      state.activeRecipe = null;
      await ensureRecipeForMeal(mealById(rawMeal.meal_id));
      renderDetail();
      renderPlanReview();
    });
    const focusEl = document.getElementById("detailVersionLine");
    if (focusEl && !focusEl.hidden) focusEl.focus({ preventScroll: true });
  }

  function openAdaptChangesSheet(mealId) {
    const raw = planMealById(mealId);
    if (!raw) return;
    const summaries = window.FlavorWeaveMealRecipe
      ? window.FlavorWeaveMealRecipe.adaptationOpSummaries(raw)
      : [];
    const title = document.getElementById("adaptChangesTitle");
    const asked = document.getElementById("adaptChangesAsked");
    const list = document.getElementById("adaptChangesList");
    if (title) title.textContent = "What changed in Dinner " + raw.position;
    const ack = raw.adaptation && raw.adaptation.override_json && raw.adaptation.override_json.acknowledgement;
    if (asked) {
      asked.textContent = ack ? 'You asked: "' + ack + '"' : "";
      asked.hidden = !ack;
    }
    if (list) {
      list.innerHTML = summaries
        .map(function (s) {
          return (
            '<li><div><strong>' +
            escapeHtml(s.title) +
            "</strong><p class=\"meta\">" +
            escapeHtml(s.detail) +
            '</p></div><button type="button" class="btn btn-quiet btn-sm" data-adapt-undo-op="' +
            s.index +
            '" data-meal-id="' +
            escapeHtml(raw.meal_id) +
            '">Undo</button></li>'
          );
        })
        .join("");
    }
    state.adaptChangesMealId = mealId;
    state.adaptChangesOpener = document.activeElement;
    document.getElementById("adaptChangesSheet").showModal();
  }

  async function undoAdaptationOp(mealId, opIndex) {
    const raw = planMealById(mealId);
    if (!raw || !raw.adaptation || !raw.adaptation.override_json) return;
    const ops = (raw.adaptation.override_json.ops || []).slice();
    ops.splice(opIndex, 1);
    if (!ops.length) {
      await mutateDinnerPlan({ op: "clear_adaptation", meal_id: mealId });
    } else {
      const next = Object.assign({}, raw.adaptation.override_json, { ops });
      await mutateDinnerPlan({
        op: "apply_adaptation",
        meal_id: mealId,
        adaptation: { override_json: next, support: "advice" },
      });
    }
    track("adaptation_undone", { meal_id: mealId, recipe_slug: raw.recipe_slug });
    state.activeRecipe = null;
    await ensureRecipeForMeal(mealById(mealId));
    renderDetail();
    renderPlanReview();
    openAdaptChangesSheet(mealId);
  }

  async function clearAllAdaptation(mealId) {
    const raw = planMealById(mealId);
    if (!raw || !raw.adaptation) return;
    await mutateDinnerPlan({ op: "clear_adaptation", meal_id: mealId });
    document.getElementById("adaptChangesSheet").close();
    toastUndo("Back to the original recipe.", async function () {
      if (raw.adaptation) {
        await mutateDinnerPlan({
          op: "apply_adaptation",
          meal_id: mealId,
          adaptation: { override_json: raw.adaptation.override_json, support: "advice" },
        });
      }
      state.activeRecipe = null;
      await ensureRecipeForMeal(mealById(mealId));
      renderDetail();
    });
    state.activeRecipe = null;
    await ensureRecipeForMeal(mealById(mealId));
    renderDetail();
    renderPlanReview();
  }

  function mountRecipeWeave() {
    const RW = window.FlavorWeaveRecipeAdapt;
    if (!RW || state.recipeWeaveReady) return;
    state.recipeWeaveReady = true;
    const deps = {
      currentMeal: function () {
        return state.view === "cook" ? cookingMeal() : detailMeal();
      },
      currentRecipe: function () {
        return state.activeRecipe;
      },
      getDinnerPlan: function () {
        return state.dinnerPlan;
      },
      planMealById: planMealById,
      activeMemberIds: activeMemberIds,
      dinerCountForMeal: function (meal) {
        const raw = meal && meal.dinner_plan ? planMealById(meal.id) : meal;
        return dinerCountForPlanMeal(raw || meal);
      },
      adaptationChangeCount: function (raw) {
        return window.FlavorWeaveMealRecipe ? window.FlavorWeaveMealRecipe.adaptationChangeCount(raw) : 0;
      },
      applyAdaptationFromAdvice: applyAdaptationFromAdvice,
      openParticipants: openParticipantsSheet,
      track: track,
    };
    RW.mountDetail(deps);
    RW.mountCookSheet(deps);
    RW.bindWeaveActions(deps);
  }

  function planMealById(mealId) {
    const plan = planHoldingMeal(mealId);
    if (!plan || !mealId) return null;
    return (plan.meals || []).find(function (m) {
      return m.meal_id === mealId;
    }) || null;
  }

  function planShoppingStarted() {
    const shop = state.dinnerShop;
    const plan = state.dinnerPlan;
    return !!(shop && shop.shopping_started_at) || !!(plan && plan.shopping_started_at);
  }

  function getShopSeenTs() {
    const plan = state.dinnerPlan;
    if (!plan) return 0;
    try {
      return Number(localStorage.getItem(shopSeenKey(plan.dinner_plan_id)) || 0);
    } catch (_) {
      return 0;
    }
  }

  function deltasSinceShopSeen() {
    const shop = state.dinnerShop;
    if (!shop || !planShoppingStarted()) return [];
    const seen = getShopSeenTs();
    return (shop.deltas || []).filter(function (d) {
      return new Date(d.created_at).getTime() > seen;
    });
  }

  function shopTagsVisible() {
    return planShoppingStarted() && deltasSinceShopSeen().length > 0;
  }

  function shopLineChangeMeta(line) {
    if (!shopTagsVisible() || !line || !line.still_needed) return null;
    const key = shopLineKey(line.ingredient_id, line.unit);
    const deltas = deltasSinceShopSeen().filter(function (d) {
      return shopLineKey(d.ingredient_id, d.unit) === key;
    });
    const snap = state.shopLineSnapshot[key];
    const newQty = Number(line.quantity) || 0;
    const oldQty = snap ? Number(snap.quantity) || 0 : null;
    const wasOnSnapshot = snap != null;
    const addedDeltas = deltas.filter(function (d) {
      return d.kind === "added";
    });
    if (!wasOnSnapshot && addedDeltas.length) {
      return { tag: "Added", tagClass: "badge--accent badge--sm", qtyLine: null };
    }
    if (wasOnSnapshot && oldQty != null && newQty > oldQty + SHOP_QTY_EPS) {
      if (line.list_state === "purchased" || line.list_state === "already_have") {
        const extra = newQty - oldQty;
        const extraLabel = extra ? formatShopQty({ quantity: extra, unit: line.unit }) : "more";
        return {
          tag: extra ? "Get " + extraLabel + " more" : "Get more",
          tagClass: "badge--warning badge--sm",
          qtyLine:
            formatShopQty(line) +
            " now · you have " +
            formatShopQty({ quantity: snap.quantity, unit: line.unit }),
        };
      }
      return {
        tag: "More needed",
        tagClass: "badge--sm",
        qtyLine: formatShopQty(line) + " now · was " + formatShopQty({ quantity: snap.quantity, unit: line.unit }),
      };
    }
    if (line.surplus_quantity > 0 && newQty > SHOP_QTY_EPS) {
      const was = newQty + Number(line.surplus_quantity);
      return {
        tag: "Less needed",
        tagClass: "badge--sm",
        qtyLine:
          formatShopQty(line) + " now · was " + formatShopQty({ quantity: was, unit: line.unit }),
      };
    }
    return null;
  }

  function snapshotShopLinesForTags() {
    const shop = state.dinnerShop;
    if (!shop) return;
    const snap = {};
    (shop.lines || []).forEach(function (l) {
      snap[shopLineKey(l.ingredient_id, l.unit)] = { quantity: l.quantity, list_state: l.list_state };
    });
    state.shopLineSnapshot = snap;
    persistShopLineSnapshot();
  }

  function mealOptionsAllowed(meal) {
    if (!meal) return {};
    if (state.planSingleMode && !state.planAddElse) {
      const closed = planMealClosed(meal);
      return { who: !closed, date: false, leftovers: false, eatingOut: false, planDinner: false, move: false, skip: false, remove: false };
    }
    const closed = planMealClosed(meal);
    const recipePlanned = meal.kind === "recipe" && (meal.state === "planned" || meal.state === "selected");
    const nonRecipePlanned = (meal.kind === "leftovers" || meal.kind === "eating_out") && meal.state === "planned";
    const plan = state.dinnerPlan;
    const multi = plan && plan.meal_count > 1;
    const meals = (plan && plan.meals) || [];
    const idx = meals.findIndex(function (m) {
      return m.meal_id === meal.meal_id;
    });
    return {
      who: !closed,
      date: !closed,
      leftovers: recipePlanned || (meal.kind === "eating_out" && meal.state === "planned"),
      eatingOut: recipePlanned || (meal.kind === "leftovers" && meal.state === "planned"),
      planDinner: nonRecipePlanned,
      move: !closed && meals.length > 1,
      skip: recipePlanned || nonRecipePlanned || meal.state === "selected" || meal.state === "cooking",
      remove: meal.state === "planned" && multi && state.view === "planReview",
    };
  }

  function openMealOptionsSheet(mealId) {
    const meal = planMealById(mealId);
    if (!meal) return;
    state.mealOptionsMealId = mealId;
    const allow = mealOptionsAllowed(meal);
    const title = document.getElementById("mealOptionsTitle");
    title.textContent = "Dinner " + meal.position + ": " + planMealTitle(meal);
    const rows = [];
    if (meal.kind === "recipe" && (meal.state === "planned" || meal.state === "selected")) {
      rows.push('<button type="button" class="sheet-menu__btn" data-action="mo-find-else">Find something else</button>');
    }
    if (allow.who) {
      rows.push('<button type="button" class="sheet-menu__btn" data-action="mo-participants">Who’s eating</button>');
    }
    if (allow.date) {
      rows.push(
        '<button type="button" class="sheet-menu__btn" data-action="mo-date">' +
          (meal.scheduled_date ? "Change the day" : "Set a day") +
          "</button>"
      );
    }
    if (allow.leftovers) rows.push('<button type="button" class="sheet-menu__btn" data-action="mo-leftovers">Make it leftovers</button>');
    if (allow.eatingOut) rows.push('<button type="button" class="sheet-menu__btn" data-action="mo-eating-out">We’re eating out</button>');
    if (allow.planDinner) {
      rows.push('<button type="button" class="sheet-menu__btn" data-action="mo-plan-dinner">Plan a dinner here instead</button>');
    }
    if (allow.move && meal.position > 1) {
      rows.push('<button type="button" class="sheet-menu__btn" data-action="mo-up">Move up</button>');
    }
    if (allow.move && meal.position < (state.dinnerPlan.meals || []).length) {
      rows.push('<button type="button" class="sheet-menu__btn" data-action="mo-down">Move down</button>');
    }
    if (allow.skip) rows.push('<button type="button" class="sheet-menu__btn" data-action="mo-skip">Skip this one</button>');
    if (allow.remove) rows.push('<button type="button" class="sheet-menu__btn" data-action="mo-remove">Remove this night</button>');
    document.getElementById("mealOptionsMenu").innerHTML = rows.join("");
    document.getElementById("mealOptionsSheet").showModal();
  }

  function renderParticipantsTiles() {
    document.getElementById("participantsTiles").innerHTML = activeMembers()
      .map(function (m) {
        const on = state.participantsDraft.indexOf(m.id) >= 0;
        const label = m.name;
        return (
          '<button type="button" class="check-tile' +
          (on ? " is-on" : "") +
          '" data-participant-id="' +
          escapeHtml(m.id) +
          '" aria-pressed="' +
          (on ? "true" : "false") +
          '"><span class="avatar">' +
          escapeHtml(m.initial) +
          "</span><span>" +
          escapeHtml(label) +
          "</span></button>"
        );
      })
      .join("");
    const invited = invitedMembers();
    const invitedEl = document.getElementById("participantsInvited");
    if (invitedEl) {
      if (invited.length) {
        invitedEl.hidden = false;
        invitedEl.innerHTML =
          invited
            .map(function (m) {
              return (
                '<span class="member-row member-row--compact">' +
                escapeHtml(m.name) +
                ' · waiting to join · <button type="button" class="btn btn-quiet btn-sm" data-action="participant-activate" data-member-id="' +
                escapeHtml(m.id) +
                '">They’re at the table</button></span>'
              );
            })
            .join(" ") +
          " Only active diners can be saved to this dinner.";
      } else {
        invitedEl.hidden = true;
        invitedEl.textContent = "";
      }
    }
    syncParticipantsSave();
  }

  async function activateMemberForParticipants(memberId) {
    const hh = API.householdId || state.householdId;
    const member = state.members.find(function (m) {
      return m.id === memberId;
    });
    if (!hh || !member) return;
    await ensureMemberSession();
    const res = await apiPatch("/api/households/" + encodeURIComponent(hh), {
      members: [{ member_id: memberId, display_name: member.name, status: "active" }],
    });
    if (!res || !res.ok) {
      toast("Couldn’t add them yet — they may still need to accept your invite.");
      return;
    }
    if (Array.isArray(res.members)) {
      state.members = res.members.map(function (m) {
        const name = m.display_name || m.member_id;
        return {
          id: m.member_id,
          name,
          initial: (name[0] || "?").toUpperCase(),
          status: m.status === "active" ? "Active" : m.status === "invited" ? "Invited" : m.status,
        };
      });
      syncAvatars();
    }
    if (state.participantsDraft.indexOf(memberId) < 0) state.participantsDraft.push(memberId);
    renderParticipantsTiles();
    toast(member.name + " can join this dinner now.");
  }

  async function openParticipantsSheet(mealId) {
    const meal = planMealById(mealId);
    if (!meal) return;
    await refreshMembersFromServer();
    state.participantsMealId = mealId;
    state.participantsDraft = (meal.participant_ids || activeMemberIds()).slice();
    state.participantsGuestDraft = Math.max(0, Number(meal.guest_count) || 0);
    document.getElementById("participantsTitle").textContent = "Who’s eating Dinner " + meal.position + "?";
    renderParticipantsTiles();
    syncParticipantsGuestUi();
    document.getElementById("participantsSheet").showModal();
  }

  function syncParticipantsSave() {
    const hint = document.getElementById("participantsHint");
    const btn = document.getElementById("btnParticipantsSave");
    const ok = state.participantsDraft && state.participantsDraft.length > 0;
    if (hint) hint.hidden = ok;
    if (btn) btn.disabled = !ok;
  }

  function syncParticipantsGuestUi() {
    const guestEl = document.getElementById("participantsGuestCount");
    const summary = document.getElementById("participantsCookingSummary");
    const note = document.getElementById("participantsGuestNote");
    if (!guestEl) return;
    guestEl.textContent = String(state.participantsGuestDraft || 0);
    const diners = (state.participantsDraft || []).length + (state.participantsGuestDraft || 0);
    if (summary) summary.textContent = "Cooking for " + diners;
    if (note) note.hidden = !(state.participantsGuestDraft > 0);
  }

  async function saveParticipantsSheet() {
    const mealId = state.participantsMealId;
    if (!mealId || !state.participantsDraft || !state.participantsDraft.length) return;
    const meal = planMealById(mealId);
    const resP = await mutateDinnerPlan({
      op: "set_participants",
      meal_id: mealId,
      participant_ids: state.participantsDraft,
    });
    if (!resP) return;
    const resG = await mutateDinnerPlan({
      op: "set_guest_count",
      meal_id: mealId,
      guest_count: state.participantsGuestDraft || 0,
    });
    if (resG) {
      document.getElementById("participantsSheet").close();
      renderActiveDinnerSurfaces();
      if (meal) {
        toast(
          "Dinner " + meal.position + " is now for " + dinerCountForPlanMeal(planMealById(mealId)) + ". Shopping list updated."
        );
      }
    }
  }

  function openPlanDatesSheet() {
    const plan = state.dinnerPlan;
    if (!plan) return;
    const meals = (plan.meals || []).slice().sort(function (a, b) {
      return a.position - b.position;
    });
    document.getElementById("planDatesFields").innerHTML = meals
      .map(function (m) {
        return (
          '<label class="field"><span class="field__label">' +
          escapeHtml(planMealLabel(m)) +
          " · " +
          escapeHtml(planMealTitle(m)) +
          '</span><input type="date" data-date-meal="' +
          escapeHtml(m.meal_id) +
          '" value="' +
          escapeHtml(m.scheduled_date || "") +
          '" /><button type="button" class="btn btn-quiet btn-sm" data-action="date-clear" data-meal-id="' +
          escapeHtml(m.meal_id) +
          '">Clear</button></label>'
        );
      })
      .join("");
    document.getElementById("planDatesSheet").showModal();
  }

  async function savePlanDates() {
    const plan = state.dinnerPlan;
    if (!plan) return;
    const inputs = document.querySelectorAll("#planDatesFields [data-date-meal]");
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const meal = planMealById(input.dataset.dateMeal);
      const val = input.value || null;
      const was = meal ? meal.scheduled_date : null;
      if ((was || "") !== (val || "")) {
        await mutateDinnerPlan({ op: "set_date", meal_id: input.dataset.dateMeal, date: val });
      }
    }
    document.getElementById("planDatesSheet").close();
    renderActiveDinnerSurfaces();
    if (state.weavePlanReview?.reresolveAfterDates) {
      await state.weavePlanReview.reresolveAfterDates();
    }
  }

  function insertPlanMealSkeleton(position) {
    const list = document.getElementById("planMealCards");
    if (!list) return function () {};
    const el = document.createElement("article");
    el.className = "plan-meal-card plan-meal-card--skeleton skeleton";
    el.setAttribute("role", "listitem");
    el.dataset.skeletonPosition = String(position);
    list.appendChild(el);
    return function removeSkeleton() {
      el.remove();
    };
  }

  function fadeRemovePlanMealCard(mealId) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return new Promise(function (resolve) {
      const el = document.querySelector('.plan-meal-card[data-meal-id="' + mealId + '"]');
      if (!el) {
        resolve();
        return;
      }
      if (reduced) {
        el.remove();
        resolve();
        return;
      }
      el.classList.add("plan-meal-card--removing");
      setTimeout(function () {
        el.remove();
        resolve();
      }, 120);
    });
  }

  function openChangeCountSheet() {
    const plan = state.dinnerPlan;
    if (!plan) return;
    state.changeCountValue = plan.meal_count;
    state.changeCountRemoveMealId = null;
    const chips = document.getElementById("changeCountChips");
    chips.innerHTML = Array.from({ length: 14 }, function (_, i) {
      const n = i + 1;
      return (
        '<button type="button" class="chip-tog' +
        (n === plan.meal_count ? " is-on" : "") +
        '" data-change-count="' +
        n +
        '" role="radio" aria-checked="' +
        (n === plan.meal_count ? "true" : "false") +
        '">' +
        n +
        "</button>"
      );
    }).join("");
    document.getElementById("changeCountRemove").hidden = true;
    document.getElementById("btnChangeCountApply").disabled = true;
    document.getElementById("changeCountSheet").showModal();
  }

  function minAllowedMealCount() {
    const plan = state.dinnerPlan;
    if (!plan) return 1;
    return (plan.meals || []).filter(function (m) {
      return m.state !== "planned" && m.state !== "selected";
    }).length;
  }

  async function fillNewSlotsFromPreview(count) {
    const plan = state.dinnerPlan;
    let added = 0;
    while ((plan.meals || []).length < count) {
      const alts = await previewDinnerAlternatives(activeMemberIds(), state.dinnerPlan);
      if (!alts.length) break;
      const slot = alts[0];
      const res = await mutateDinnerPlan({
        op: "add_meal",
        kind: "recipe",
        recipe_version_id: slot.recipe_version_id,
        participant_ids: activeMemberIds(),
      });
      if (!res) break;
      added++;
    }
    return added;
  }

  async function applyChangeCount() {
    const plan = state.dinnerPlan;
    const target = state.changeCountValue;
    if (!plan || !target) return;
    if (target < minAllowedMealCount()) {
      toast("Remove a dinner first, then lower the number.");
      return;
    }
    if (target < plan.meal_count && state.changeCountRemoveMealId) {
      await mutateDinnerPlan({ op: "remove_meal", meal_id: state.changeCountRemoveMealId });
    }
    if (target !== plan.meal_count) {
      await mutateDinnerPlan({ op: "set_count", meal_count: target });
    }
    await fillNewSlotsFromPreview(target);
    document.getElementById("changeCountSheet").close();
    renderActiveDinnerSurfaces();
  }

  async function reorderMeal(mealId, direction) {
    const plan = state.dinnerPlan;
    const meals = (plan.meals || []).slice().sort(function (a, b) {
      return a.position - b.position;
    });
    const i = meals.findIndex(function (m) {
      return m.meal_id === mealId;
    });
    if (i < 0) return;
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= meals.length) return;
    const tmp = meals[i];
    meals[i] = meals[j];
    meals[j] = tmp;
    await mutateDinnerPlan({ op: "reorder", meal_ids: meals.map(function (m) {
      return m.meal_id;
    }) });
    renderActiveDinnerSurfaces();
  }

  async function replaceSlotWithRecipe(mealId, recipeVersionId, options) {
    const meal = planMealById(mealId);
    if (!meal) return null;
    const quiet = options && options.suppressToast ? { suppressToast: true } : null;
    const position = meal.position;
    const participants = meal.participant_ids || activeMemberIds();
    const date = meal.scheduled_date;
    const removed = await mutateDinnerPlan({ op: "remove_meal", meal_id: mealId }, quiet);
    if (!removed || removed.failed) return removed && removed.failed ? removed : null;
    const added = await mutateDinnerPlan({
      op: "add_meal",
      kind: "recipe",
      recipe_version_id: recipeVersionId,
      participant_ids: participants,
      scheduled_date: date,
    }, quiet);
    if (!added || added.failed) {
      await loadCurrentDinnerPlan();
      showHeldShopProjectionNotice();
      if (!(options && options.suppressToast)) toast("That didn’t work. Your plan is unchanged.");
      return added && added.failed ? added : { failed: true, error: "swap_failed" };
    }
    const newMeal = (state.dinnerPlan.meals || []).slice().sort(function (a, b) {
      return b.position - a.position;
    })[0];
    if (!newMeal) return;
    const ordered = (state.dinnerPlan.meals || [])
      .slice()
      .sort(function (a, b) {
        return a.position - b.position;
      })
      .filter(function (m) {
        return m.meal_id !== newMeal.meal_id;
      });
    ordered.splice(position - 1, 0, newMeal);
    await mutateDinnerPlan({
      op: "reorder",
      meal_ids: ordered.map(function (m) {
        return m.meal_id;
      }),
    }, quiet);
    renderActiveDinnerSurfaces();
    return true;
  }

  function initPlanRatingsForMeal(mealId) {
    const meal = planMealById(mealId);
    if (!meal) return;
    const parts = meal.participant_ids || [];
    state.ratings = {};
    parts.forEach(function (pid) {
      const row = (meal.ratings || []).find(function (r) {
        return r.member_id === pid;
      });
      state.ratings[pid] = { score: row && row.score != null ? row.score : null, note: "" };
    });
  }

  function planRatingComplete(mealId) {
    const meal = planMealById(mealId);
    if (!meal) return false;
    return meal.state === "fully_rated";
  }

  function planRatingWaitingNames(meal) {
    const me = meMember();
    const parts = meal.participant_ids || [];
    const rated = new Set(
      (meal.ratings || [])
        .filter(function (r) {
          return r.score != null;
        })
        .map(function (r) {
          return r.member_id;
        })
    );
    const waiting = parts.filter(function (id) {
      return !rated.has(id);
    });
    const names = waiting.map(function (id) {
      if (me && id === me.id) return "you";
      const m = state.members.find(function (x) {
        return x.id === id;
      });
      return m ? m.name : id;
    });
    if (names.length <= 2) return names.join(" and ");
    return names.slice(0, 2).join(", ") + " and " + (names.length - 2) + " more";
  }

  function renderPlanStarIntro() {
    const ctx = state.navContext.planReview || {};
    const intro = document.getElementById("planReviewStarIntro");
    if (!ctx.star || !intro) {
      if (intro) intro.hidden = true;
      return;
    }
    const plan = state.dinnerPlan;
    const planner = state.members.find(function (m) {
      return m.id === plan.created_by_member_id;
    });
    const name = planner ? planner.name : "Someone";
    intro.hidden = false;
    intro.textContent =
      name + " planned " + plan.meal_count + " dinners. Star the one you’re most excited about.";
  }

  function voteNamesForMeal(mealId) {
    const votes = (state.dinnerPlan && state.dinnerPlan.votes) || [];
    const names = votes
      .filter(function (v) {
        return v.meal_id === mealId;
      })
      .map(function (v) {
        const m = state.members.find(function (x) {
          return x.id === v.member_id;
        });
        return m ? m.name : "";
      })
      .filter(Boolean);
    return names;
  }

  function showPlanLoop(mealId) {
    const meal = planMealById(mealId);
    const title = planMealTitle(meal);
    document.getElementById("loopTitle").textContent = "Everyone rated " + title;
    const plan = state.dinnerPlan;
    const open = !planIsClosed(plan);
    const actions = document.querySelector('.view[data-view="loop"] .actions');
    if (actions) {
      actions.innerHTML =
        (open
          ? '<button class="btn btn-primary btn-lg" type="button" data-go="choices">Back to tonight’s options</button>'
          : '<button class="btn btn-primary btn-lg" type="button" data-action="plan-dinners">Plan our next dinners</button>') +
        '<button class="btn btn-secondary btn-lg" type="button" data-go="home">Back home</button>';
    }
    state.dinnerRateMealId = null;
    show("loop");
    renderLoopSummary();
  }

  async function openSwapSheet(mealId) {
    const plan = state.dinnerPlan;
    const meal = (plan.meals || []).find(function (m) {
      return m.meal_id === mealId;
    });
    if (!meal) return;
    state.swapMealId = mealId;
    document.getElementById("swapSheetTitle").textContent =
      plan.meal_count === 1 ? "Swap tonight’s dinner" : "Swap Dinner " + meal.position;
    document.getElementById("swapSheetNow").textContent = "Now: " + planMealTitle(meal);
    const alts = await previewDinnerAlternatives(meal.participant_ids, plan);
    const box = document.getElementById("swapAlternatives");
    if (!alts.length) {
      box.innerHTML = "<p class=\"meta\">That’s every dinner that fits your table right now.</p>";
    } else {
      box.innerHTML = alts
        .map(function (slot) {
          return (
            '<div class="swap-alt"><div class="swap-alt__thumb">' +
            mealMediaHtml({ recipe_slug: slot.recipe_slug, title: slot.title }, { decorative: true }) +
            "</div><div><strong>" +
            escapeHtml(slot.title || slot.recipe_slug) +
            '</strong><p class="meta">About ' +
            (slot.total_minutes || "—") +
            " min</p>" +
            classificationBadges(slot) +
            explanationBlockHtml("swap-" + slot.recipe_version_id, slot) +
            '<button type="button" class="btn btn-secondary btn-sm" data-action="swap-use" data-version="' +
            escapeHtml(slot.recipe_version_id) +
            '">Use this</button></div></div>'
          );
        })
        .join("");
      bindWhyInScope(box);
    }
    showSwapError("");
    state.swapInFlight = false;
    state.swapOpener = document.activeElement;
    track("swap_requested", { meal_id: mealId, position: meal.position });
    const seeAllBtn = document.getElementById("btnSwapSeeAll");
    if (seeAllBtn) {
      seeAllBtn.hidden = !alts.length;
      seeAllBtn.textContent = plan.meal_count === 1 ? "See all options for tonight" : "See all options";
    }
    document.getElementById("swapSheet").showModal();
  }

  function closeSwapSheet() {
    const sheet = document.getElementById("swapSheet");
    if (sheet && sheet.open) sheet.close();
    showSwapError("");
    state.swapInFlight = false;
  }

  async function handleDinnerPlanClick(e) {
    const planBtn = e.target.closest("[data-action='plan-dinners']");
    if (planBtn) {
      e.preventDefault();
      resetDraftPrefs();
      show("planCount", { context: Nav.contextFor("planCount", state.view, { established: true }) });
      renderPlanCount();
      return true;
    }
    const prefBtn = e.target.closest("[data-plan-pref]");
    if (prefBtn) {
      e.preventDefault();
      const key = prefBtn.getAttribute("data-plan-pref");
      const api = planningApi();
      if (!api) return true;
      const active = prefBtn.closest("[data-plan-prefs='active']");
      if (active && state.dinnerPlan) {
        const next = api.togglePref(state.dinnerPlan.intent, key);
        track("planning_preference_selected", next);
        const saved = await mutateDinnerPlan({
          op: "set_planning_preferences",
          keep_it_easy: next.keep_it_easy,
          keep_ingredients_simple: next.keep_ingredients_simple,
        });
        if (saved) renderActiveDinnerSurfaces();
        return true;
      }
      state.draftPlanPrefs = api.togglePref(draftPrefs(), key);
      track("planning_preference_selected", state.draftPlanPrefs);
      const on = state.draftPlanPrefs[key] === true;
      prefBtn.classList.toggle("is-on", on);
      prefBtn.setAttribute("aria-pressed", on ? "true" : "false");
      return true;
    }
    const findBtn = e.target.closest("[data-action='find-dinner'], [data-action='find-dinner-tonight']");
    if (findBtn) {
      e.preventDefault();
      const entry = findBtn.dataset.action === "find-dinner-tonight" ? "tonight" : "home_hero";
      openDiscoveryStandalone(entry);
      return true;
    }
    const pickOne = e.target.closest("[data-action='pick-one']");
    if (pickOne) {
      e.preventDefault();
      track("discovery_pick_one", {});
      startFindDinner("find_dinner");
      return true;
    }
    const swap = e.target.closest("[data-action='swap-meal']");
    if (swap) {
      e.preventDefault();
      openSwapSheet(swap.dataset.mealId);
      return true;
    }
    const swapSeeAll = e.target.closest("[data-action='swap-see-all']");
    if (swapSeeAll) {
      e.preventDefault();
      const mid = state.swapMealId;
      closeSwapSheet();
      openDiscoveryReplace(mid, state.view, "swap_see_all");
      return true;
    }
    const swapKeep = e.target.closest("[data-action='swap-keep']");
    if (swapKeep) {
      e.preventDefault();
      closeSwapSheet();
      return true;
    }
    const swapUse = e.target.closest("[data-action='swap-use']");
    if (swapUse) {
      e.preventDefault();
      if (state.swapInFlight) return true;
      state.swapInFlight = true;
      swapUse.disabled = true;
      showSwapError("");
      const mealId = state.swapMealId;
      let res = null;
      if (state.swapReplacePosition) {
        res = await replaceSlotWithRecipe(mealId, swapUse.dataset.version, { suppressToast: true });
        state.swapReplacePosition = null;
      } else {
        res = await mutateDinnerPlan(
          {
            op: "swap_meal",
            meal_id: mealId,
            recipe_version_id: swapUse.dataset.version,
          },
          { suppressToast: true }
        );
      }
      if (res && res.failed) {
        showHeldShopProjectionNotice();
        state.swapInFlight = false;
        swapUse.disabled = false;
        showSwapError(swapFailureCopy(res.error));
        return true;
      }
      if (res) {
        state.swappedMealIds = state.swappedMealIds || {};
        state.swappedMealIds[mealId] = true;
        track("swap_chosen", { meal_id: mealId, recipe_version_id: swapUse.dataset.version });
        closeSwapSheet();
        if (state.pendingDinnerToast) flushDinnerToast();
        else toast("Swapped in.");
        renderActiveDinnerSurfaces();
      } else {
        state.swapInFlight = false;
        swapUse.disabled = false;
      }
      return true;
    }
    const openPart = e.target.closest("[data-action='open-participants']");
    if (openPart) {
      e.preventDefault();
      openParticipantsSheet(openPart.dataset.mealId);
      return true;
    }
    const seeAdapt = e.target.closest("[data-action='see-adapt-changes']");
    if (seeAdapt) {
      e.preventDefault();
      openAdaptChangesSheet(seeAdapt.dataset.mealId);
      return true;
    }
    const adaptUndo = e.target.closest("[data-adapt-undo-op]");
    if (adaptUndo) {
      e.preventDefault();
      void undoAdaptationOp(adaptUndo.dataset.mealId, Number(adaptUndo.dataset.adaptUndoOp));
      return true;
    }
    const servDown = e.target.closest("[data-action='detail-servings-down']");
    if (servDown) {
      e.preventDefault();
      state.detailViewingServings = Math.max(1, (state.detailViewingServings || activeMemberCount()) - 1);
      state.activeRecipe = null;
      ensureRecipeForMeal(detailMeal()).then(renderDetail);
      return true;
    }
    const servUp = e.target.closest("[data-action='detail-servings-up']");
    if (servUp) {
      e.preventDefault();
      state.detailViewingServings = Math.min(8, (state.detailViewingServings || activeMemberCount()) + 1);
      state.activeRecipe = null;
      ensureRecipeForMeal(detailMeal()).then(renderDetail);
      return true;
    }
    const mealMore = e.target.closest("[data-action='meal-more']");
    if (mealMore) {
      e.preventDefault();
      openMealOptionsSheet(mealMore.dataset.mealId);
      return true;
    }
    const mo = e.target.closest("[data-action^='mo-']");
    if (mo) {
      e.preventDefault();
      const mealId = state.mealOptionsMealId;
      const meal = planMealById(mealId);
      document.getElementById("mealOptionsSheet").close();
      const act = mo.dataset.action;
      if (act === "mo-find-else") {
        openDiscoveryReplace(mealId, state.view, "meal_more");
        return true;
      }
      if (act === "mo-participants") openParticipantsSheet(mealId);
      else if (act === "mo-date") {
        document.getElementById("planDatesFields").innerHTML =
          '<label class="field"><span class="field__label">' +
          escapeHtml(planMealTitle(meal)) +
          '</span><input type="date" data-date-meal="' +
          escapeHtml(mealId) +
          '" value="' +
          escapeHtml(meal.scheduled_date || "") +
          '" /><button type="button" class="btn btn-quiet btn-sm" data-action="date-clear" data-meal-id="' +
          escapeHtml(mealId) +
          '">No day</button></label>';
        document.getElementById("planDatesTitle").textContent = meal.scheduled_date ? "Change the day" : "Set a day";
        document.getElementById("planDatesSheet").showModal();
      } else if (act === "mo-leftovers") {
        await mutateDinnerPlan({ op: "set_leftovers", meal_id: mealId });
        renderActiveDinnerSurfaces();
      } else if (act === "mo-eating-out") {
        await mutateDinnerPlan({ op: "set_eating_out", meal_id: mealId });
        renderActiveDinnerSurfaces();
      } else if (act === "mo-plan-dinner") {
        state.swapMealId = mealId;
        state.swapReplacePosition = true;
        openSwapSheet(mealId);
      } else if (act === "mo-up") reorderMeal(mealId, "up");
      else if (act === "mo-down") reorderMeal(mealId, "down");
      else if (act === "mo-skip") {
        const ok = await confirmDialog({
          title: "Skip " + planMealTitle(meal) + "?",
          body: planShoppingStarted()
            ? "Anything only it needed moves to No longer needed. Your checks stay."
            : "Its ingredients come off your list.",
          ok: "Skip it",
          cancel: "Keep it",
        });
        if (ok) {
          await mutateDinnerPlan({ op: "skip_meal", meal_id: mealId });
          renderActiveDinnerSurfaces();
        }
      } else if (act === "mo-remove") {
        await mutateDinnerPlan({ op: "remove_meal", meal_id: mealId });
        await mutateDinnerPlan({ op: "set_count", meal_count: state.dinnerPlan.meal_count - 1 });
        renderActiveDinnerSurfaces();
      }
      return true;
    }
    const planStar = e.target.closest("[data-action='plan-star']");
    if (planStar) {
      e.preventDefault();
      const me = meMember();
      const mid = me && me.id;
      const mealId = planStar.dataset.mealId;
      const myVote = (state.dinnerPlan.votes || []).find(function (v) {
        return v.member_id === mid;
      });
      const nextId = myVote && myVote.meal_id === mealId ? null : mealId;
      await mutateDinnerPlan({ op: "vote", meal_id: nextId, member_id: mid });
      renderPlanReview();
      return true;
    }
    const planAddDays = e.target.closest("[data-action='plan-add-days']");
    if (planAddDays) {
      e.preventDefault();
      openPlanDatesSheet();
      return true;
    }
    const changeCountOpen = e.target.closest("[data-action='plan-change-count']");
    if (changeCountOpen) {
      e.preventDefault();
      openChangeCountSheet();
      return true;
    }
    const changeChip = e.target.closest("[data-change-count]");
    if (changeChip) {
      e.preventDefault();
      const n = Number(changeChip.dataset.changeCount);
      state.changeCountValue = n;
      document.querySelectorAll("[data-change-count]").forEach(function (b) {
        b.classList.toggle("is-on", b === changeChip);
      });
      const plan = state.dinnerPlan;
      const removeBox = document.getElementById("changeCountRemove");
      const applyBtn = document.getElementById("btnChangeCountApply");
      if (n < plan.meal_count) {
        const removable = (plan.meals || []).filter(function (m) {
          return m.state === "planned";
        });
        removeBox.hidden = false;
        removeBox.innerHTML =
          "<p class=\"meta\">Which dinner should go?</p>" +
          removable
            .map(function (m) {
              return (
                '<label class="check-tile"><input type="radio" name="removeMeal" value="' +
                escapeHtml(m.meal_id) +
                '" /> ' +
                escapeHtml(planMealLabel(m)) +
                " · " +
                escapeHtml(planMealTitle(m)) +
                "</label>"
              );
            })
            .join("") +
          '<label class="check-tile"><input type="radio" name="removeMeal" value="" /> Empty slot</label>';
        applyBtn.disabled = true;
      } else {
        removeBox.hidden = true;
        state.changeCountRemoveMealId = null;
        applyBtn.disabled = n === plan.meal_count;
      }
      if (n > plan.meal_count) applyBtn.disabled = false;
      return true;
    }
    const applyCount = e.target.closest("#btnChangeCountApply");
    if (applyCount) {
      e.preventDefault();
      await applyChangeCount();
      return true;
    }
    const shopMore = e.target.closest("[data-shop-more]");
    if (shopMore) {
      e.preventDefault();
      openShopLineSheet(shopMore.dataset.shopMore);
      return true;
    }
    const shopRecipe = e.target.closest("[data-action='shop-view-recipe']");
    if (shopRecipe) {
      e.preventDefault();
      document.getElementById("shopLineSheet").close();
      openPlanMealDetail(shopRecipe.dataset.mealId, "shopList");
      return true;
    }
    const shopSet = e.target.closest("[data-action='shop-set']");
    if (shopSet) {
      e.preventDefault();
      const saved = await mutateHouseholdShop({
        op: "set_state",
        line_id: state.shopLineMenuId,
        list_state: shopSet.dataset.state,
      });
      if (saved && saved.ok) document.getElementById("shopLineSheet").close();
      renderShopList();
      return true;
    }
    const shopKeep = e.target.closest("[data-action='shop-keep'], [data-action='shop-use-recipe']");
    if (shopKeep) {
      e.preventDefault();
      const saved = await mutateHouseholdShop({
        op: "resolve_override",
        line_id: state.shopLineMenuId,
        keep: shopKeep.dataset.action === "shop-keep",
      });
      if (saved && saved.ok) document.getElementById("shopLineSheet").close();
      renderShopList();
      return true;
    }
    const shopDelete = e.target.closest("[data-action='shop-delete']");
    if (shopDelete) {
      e.preventDefault();
      const saved = await mutateHouseholdShop({ op: "delete_general", line_id: state.shopLineMenuId });
      if (saved && saved.ok) document.getElementById("shopLineSheet").close();
      renderShopList();
      return true;
    }
    const dateClear = e.target.closest("[data-action='date-clear']");
    if (dateClear) {
      e.preventDefault();
      const input = document.querySelector('[data-date-meal="' + dateClear.dataset.mealId + '"]');
      if (input) input.value = "";
      return true;
    }
    const activateParticipant = e.target.closest("[data-action='participant-activate']");
    if (activateParticipant && activateParticipant.closest("#participantsSheet")) {
      e.preventDefault();
      await activateMemberForParticipants(activateParticipant.dataset.memberId);
      return true;
    }
    const participantTile = e.target.closest("[data-participant-id]");
    if (participantTile && participantTile.closest("#participantsTiles")) {
      e.preventDefault();
      const id = participantTile.dataset.participantId;
      const i = state.participantsDraft.indexOf(id);
      if (i >= 0) state.participantsDraft.splice(i, 1);
      else state.participantsDraft.push(id);
      renderParticipantsTiles();
      return true;
    }
    const openMeal = e.target.closest("[data-action='open-plan-meal']");
    if (openMeal) {
      e.preventDefault();
      const origin = state.view === "choices" ? "tonightPlan" : "planReview";
      openPlanMealDetail(openMeal.dataset.mealId, origin);
      return true;
    }
    const shopToggle = e.target.closest("[data-shop-toggle]");
    if (shopToggle) {
      e.preventDefault();
      const lineId = shopToggle.dataset.shopToggle;
      const line = householdLines().find(function (l) {
        return l.line_id === lineId;
      });
      if (!line) return true;
      const next = line.list_state === "open" ? "purchased" : "open";
      await mutateHouseholdShop({ op: "set_state", line_id: lineId, list_state: next });
      renderShopList();
      return true;
    }
    const good = e.target.closest("#btnPlanLooksGood, #btnPlanReviewSideOk");
    if (good) {
      e.preventDefault();
      const ctx = state.navContext.planReview;
      if (ctx && ctx.mode === "edit") {
        show("choices");
        return true;
      }
      show("planConfirm", { context: Nav.contextFor("planConfirm", "planReview", { established: true }) });
      renderPlanConfirm();
      return true;
    }
    const finShop = e.target.closest("#btnPlanFinalizeShop");
    if (finShop) {
      e.preventDefault();
      track("plan_finalized", { dinner_plan_id: state.dinnerPlan && state.dinnerPlan.dinner_plan_id });
      await mutateDinnerPlan({ op: "finalize" });
      await refreshDinnerShopping();
      show("shopList", { context: Nav.contextFor("shopList", "planConfirm", { established: true }) });
      renderShopList();
      return true;
    }
    const haveAll = e.target.closest("#btnPlanHaveEverything");
    if (haveAll) {
      e.preventDefault();
      track("plan_finalized", { dinner_plan_id: state.dinnerPlan && state.dinnerPlan.dinner_plan_id });
      await mutateDinnerPlan({ op: "finalize" });
      show("choices");
      renderTonightPlan();
      return true;
    }
    const singleMake = e.target.closest("[data-action='single-make']");
    if (singleMake) {
      e.preventDefault();
      const meal = state.dinnerPlan.meals[0];
      track("plan_finalized", { dinner_plan_id: state.dinnerPlan && state.dinnerPlan.dinner_plan_id });
      await mutateDinnerPlan({ op: "finalize" });
      await mutateDinnerPlan({ op: "select_meal", meal_id: meal.meal_id });
      openPlanMealDetail(meal.meal_id, "planReview");
      return true;
    }
    const singleShop = e.target.closest("[data-action='single-shop']");
    if (singleShop) {
      e.preventDefault();
      track("plan_finalized", { dinner_plan_id: state.dinnerPlan && state.dinnerPlan.dinner_plan_id });
      await mutateDinnerPlan({ op: "finalize" });
      await refreshDinnerShopping();
      show("shopList");
      renderShopList();
      return true;
    }
    const dpCook = e.target.closest("[data-action='dp-start-cook']");
    if (dpCook) {
      e.preventDefault();
      const sel = (state.dinnerPlan.meals || []).find(function (m) {
        return m.state === "selected";
      }) || (state.dinnerPlan.meals || []).find(function (m) {
        return m.state === "planned" && m.kind === "recipe";
      });
      if (sel) openPlanMealDetail(sel.meal_id, "tonightPlan");
      return true;
    }
    const dpKitchen = e.target.closest("[data-action='dp-back-kitchen']");
    if (dpKitchen) {
      e.preventDefault();
      const id = dpKitchen.dataset.mealId;
      const meal = (state.dinnerPlan.meals || []).find(function (m) {
        return m.state === "cooking" || m.meal_id === id;
      });
      if (meal) {
        state.dinnerCookMealId = meal.meal_id;
        state.dinnerCookPendingId = null;
        state.cookStep = readCookStep(state.dinnerPlan.dinner_plan_id, meal.meal_id);
        state.dinnerDetailMeal = uiMealFromPlanMeal(meal);
        show("cook");
      }
      return true;
    }
    const gotIt = e.target.closest("#btnShopChangesGotIt");
    if (gotIt) {
      e.preventDefault();
      try {
        localStorage.setItem(shopSeenKey(state.dinnerPlan.dinner_plan_id), String(Date.now()));
      } catch (_) { /* ignore */ }
      document.getElementById("shopChangesBanner").hidden = true;
      snapshotShopLinesForTags();
      renderShopList();
      return true;
    }
    const ask = e.target.closest("[data-action='plan-ask-table']");
    if (ask) {
      e.preventDefault();
      const url = appBaseUrl().replace(/\/$/, "") + "/?dinner_plan=" + encodeURIComponent(state.dinnerPlan.dinner_plan_id);
      document.getElementById("askTableUrl").value = url;
      document.getElementById("askTableSheet").showModal();
      return true;
    }
    const copyPlan = e.target.closest("#btnCopyPlanLink");
    if (copyPlan) {
      e.preventDefault();
      const input = document.getElementById("askTableUrl");
      input.select();
      navigator.clipboard.writeText(input.value).then(function () {
        toast("Link copied");
      });
      return true;
    }
    const countSubmit = e.target.closest("#btnPlanCountSubmit");
    if (countSubmit) {
      e.preventDefault();
      await submitPlanCount();
      return true;
    }
    const countChip = e.target.closest("[data-plan-count]");
    if (countChip) {
      e.preventDefault();
      state.planCountValue = Number(countChip.dataset.planCount);
      document.querySelectorAll("[data-plan-count]").forEach(function (b) {
        const on = b === countChip;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-checked", on ? "true" : "false");
      });
      syncPlanCountSubmit();
      return true;
    }
    const groupPick = e.target.closest(".plan-count-option");
    if (groupPick && !e.target.closest("[data-plan-count]")) {
      e.preventDefault();
      document.querySelectorAll(".plan-count-option").forEach(function (el) {
        const on = el === groupPick;
        el.classList.toggle("is-selected", on);
        const chips = el.querySelector(".plan-count-chips");
        const hint = el.querySelector(".plan-count-hint");
        if (chips) chips.hidden = !on;
        if (hint) hint.hidden = !on;
      });
      const nums = Array.from(groupPick.querySelectorAll("[data-plan-count]")).map(function (b) {
        return Number(b.dataset.planCount);
      });
      if (state.planCountValue && nums.indexOf(state.planCountValue) < 0) {
        state.planCountValue = null;
        document.querySelectorAll("[data-plan-count]").forEach(function (b) {
          b.classList.remove("is-on");
          b.setAttribute("aria-checked", "false");
        });
      }
      syncPlanCountSubmit();
      return true;
    }
    const seeAllDinners = e.target.closest("[data-action='see-all-dinners']");
    if (seeAllDinners) {
      e.preventDefault();
      openDiscoveryStandalone("tonight");
      return true;
    }
    const tonightFind = e.target.closest("[data-action='tonight-find-composer']");
    if (tonightFind) {
      e.preventDefault();
      openDiscoveryStandalone("tonight");
      setTimeout(function () {
        const field = document.querySelector("#discWeaveHost .weave-composer__field");
        field?.focus();
      }, 400);
      return true;
    }
    const pickTonight = e.target.closest("[data-action='pick-for-tonight'], [data-action='pick-for-tonight-detail']");
    if (pickTonight) {
      e.preventDefault();
      await mutateDinnerPlan({ op: "select_meal", meal_id: pickTonight.dataset.mealId });
      renderTonightPlan();
      renderDetail();
      return true;
    }
    const fulfill = e.target.closest("[data-action='fulfill-meal']");
    if (fulfill) {
      e.preventDefault();
      await mutateDinnerPlan({ op: "fulfill_meal", meal_id: fulfill.dataset.mealId });
      renderTonightPlan();
      return true;
    }
    const discPick = e.target.closest("[data-action='disc-pick-slot']");
    if (discPick) {
      e.preventDefault();
      const pos = Number(discPick.dataset.emptyPosition);
      const meals = (state.dinnerPlan && state.dinnerPlan.meals) || [];
      const row = meals.find(function (m) {
        return m.position === pos && m.kind === "recipe" && !m.recipe_version_id;
      });
      openDiscoveryChoose(row ? { meal_id: row.meal_id, position: pos } : { position: pos });
      return true;
    }
    const emptyLo = e.target.closest("[data-action='empty-leftovers']");
    if (emptyLo) {
      e.preventDefault();
      const slotEl = e.target.closest("[data-empty-position]");
      const pos = slotEl ? Number(slotEl.dataset.emptyPosition) : 0;
      await mutateDinnerPlan({
        op: "add_meal",
        kind: "leftovers",
        participant_ids: activeMemberIds(),
        position: pos || undefined,
      });
      renderPlanReview();
      return true;
    }
    const emptyOut = e.target.closest("[data-action='empty-out']");
    if (emptyOut) {
      e.preventDefault();
      const slotEl2 = e.target.closest("[data-empty-position]");
      const pos2 = slotEl2 ? Number(slotEl2.dataset.emptyPosition) : 0;
      await mutateDinnerPlan({
        op: "add_meal",
        kind: "eating_out",
        participant_ids: activeMemberIds(),
        position: pos2 || undefined,
      });
      renderPlanReview();
      return true;
    }
    const shopShowHave = e.target.closest("[data-action='shop-show-have']");
    if (shopShowHave) {
      e.preventDefault();
      const rows = document.getElementById("shopHaveRows");
      if (rows) rows.hidden = false;
      shopShowHave.hidden = true;
      return true;
    }
    const cookTonight = e.target.closest("[data-action='cook-plan-meal']");
    if (cookTonight) {
      e.preventDefault();
      openPlanMealDetail(cookTonight.dataset.mealId, "tonightPlan");
      return true;
    }
    const ratePlan = e.target.closest("[data-action='rate-plan-meal']");
    if (ratePlan) {
      e.preventDefault();
      state.dinnerDetailMeal = mealById(ratePlan.dataset.mealId);
      openDinnerRating(state.dinnerPlan, ratePlan.dataset.mealId, "choices", null);
      return true;
    }
    const made = e.target.closest("[data-action='mark-cooked']");
    if (made) {
      e.preventDefault();
      const raw = planMealById(made.dataset.mealId);
      if (raw && state.dinnerPlan) {
        void completeDinnerMeal(state.dinnerPlan, raw, "mark_cooked", state.view || "home");
      }
      return true;
    }
    const homeRate = e.target.closest("#btnHomeRateWait, [data-action='home-rate-cooked']");
    if (homeRate) {
      e.preventDefault();
      const waiting = mealsAwaitingMyRating();
      const mealId = homeRate.dataset.mealId || (waiting[0] && waiting[0].meal_id);
      if (mealId) openDinnerRating(state.dinnerPlan, mealId, "home", null);
      return true;
    }
    const historyMade = e.target.closest("[data-action='history-mark-cooked']");
    if (historyMade) {
      e.preventDefault();
      void completeHistoryMeal(historyMade.dataset.planId, historyMade.dataset.mealId, historyMade.dataset.priorState);
      return true;
    }
    const historyRate = e.target.closest("[data-action='history-rate']");
    if (historyRate) {
      e.preventDefault();
      void openHistoryRating(historyRate.dataset.planId, historyRate.dataset.mealId);
      return true;
    }
    const cookElse = e.target.closest("[data-action='cook-this-tonight']");
    if (cookElse) {
      e.preventDefault();
      const meal = (state.dinnerPlan.meals || []).slice(-1)[0];
      if (!meal) return true;
      await mutateDinnerPlan({ op: "select_meal", meal_id: meal.meal_id });
      openPlanMealDetail(meal.meal_id, "tonightPlan");
      state.planAddElse = false;
      return true;
    }
    return false;
  }

  function goHomeNoPlan() {
    show("home");
    updateHome();
  }

  // —— Navigation ——
  app.addEventListener("click", async (e) => {
    if (await handleDinnerPlanClick(e)) return;

    const pick = e.target.closest("[data-taste-pick]");
    if (pick) {
      const slug = pick.dataset.tastePick;
      state.tastePicks = Taste.togglePick(state.tastePicks, slug);
      withFocusKept(function () { paintTasteOnboarding(slug); });
      return;
    }

    const add = e.target.closest("[data-taste-add]");
    if (add) {
      const slug = add.dataset.tasteAdd;
      const rank = add.dataset.rank || "like";
      const current = Taste.ranksBySlug(profileForMe())[slug];
      const fromSearch = !!add.closest("#tasteProfileSearchResult");
      if (current && !fromSearch) {
        document.getElementById("tasteProfileStatus").textContent =
          "That’s already in your tastes. Change it in your list above.";
        return;
      }
      if (current === rank) return;
      changeTaste(slug, rank);
      return;
    }

    const removeTaste = e.target.closest("[data-taste-remove]");
    if (removeTaste) {
      const item = removeTaste.closest(".taste-item");
      const list = item && item.parentElement;
      const next = item && (item.nextElementSibling || item.previousElementSibling);
      const nextSlug = next && next.dataset.tasteItem;
      const heading = document.getElementById(list && list.id === "tasteLearningList" ? "profileLearningTitle" : "profileToldTitle");
      changeTaste(removeTaste.dataset.tasteRemove, "remove", function () {
        const btn = nextSlug && document.querySelector(`[data-taste-remove="${nextSlug}"]`);
        if (btn) return btn;
        heading.setAttribute("tabindex", "-1");
        return heading;
      });
      return;
    }

    const fb = e.target.closest("[data-feedback-code]");
    if (fb) {
      sendTasteFeedback(fb.dataset.feedbackCode);
      return;
    }

    if (e.target.closest("#btnTasteBrowse")) {
      toggleTasteBrowse("onboarding");
      return;
    }
    if (e.target.closest("#btnTasteProfileBrowse")) {
      toggleTasteBrowse("profile");
      return;
    }

    const select = e.target.closest("[data-select]");
    if (select && select.closest('[data-view="choices"], [data-view="shareGuest"]')) {
      const id = select.dataset.select;
      if (state.view === "shareGuest") {
        state.guestPick = id;
        renderGuestChoices();
        track("share_choice_acted", {
          share_object_id: state.shareObjectId,
          action: "vote",
          meal_option_id: id,
        });
        return;
      }
      selectMeal(id);
      if (select.dataset.go === "detail") {
        show("detail");
      } else {
        renderChoices();
      }
      return;
    }

    const historyBtn = e.target.closest("[data-history-recipe]");
    if (historyBtn) {
      openHistoryRecipe(state.historyItems[Number(historyBtn.dataset.historyRecipe)]);
      return;
    }

    const nextDinner = e.target.closest('[data-action="next-dinner"]');
    if (nextDinner) {
      e.preventDefault();
      startNextRound();
      return;
    }

    const retryChoices = e.target.closest('[data-action="retry-choices"]');
    if (retryChoices) {
      e.preventDefault();
      setChoiceLoading(true);
      fetchRecommendationsPlan().then(renderChoices);
      return;
    }

    const preview = e.target.closest("[data-preview]");
    if (preview && preview.closest('[data-view="choices"]') && !e.target.closest("[data-select]")) {
      openPreview(preview.dataset.preview);
      return;
    }

    const homeCook = e.target.closest('[data-action="home-cook"]');
    if (homeCook) {
      e.preventDefault();
      startCooking();
      return;
    }

    const brandHome = e.target.closest("#brandHome");
    if (brandHome) {
      e.preventDefault();
      show(state.householdId || API.householdId ? "home" : "welcome");
      return;
    }

    const tab = e.target.closest('#detailTabs [role="tab"]');
    if (tab) {
      selectRecipeTab(tab.id, false);
      return;
    }

    const go = e.target.closest("[data-go]");
    if (go && !go.disabled && !go.dataset.select) {
      e.preventDefault();
      if (
        go.classList.contains("back") &&
        state.navHistory &&
        state.navHistory.topOpenDialog &&
        state.navHistory.topOpenDialog()
      ) {
        state.navHistory.handleBack();
        return;
      }
      if (go.dataset.go === "detail") {
        state.previewMealId = state.selectedMealId;
        state.activeRecipe = null;
      }
      if (go.dataset.go === "find") {
        if (
          state.view === "detail" &&
          state.navContext.detail &&
          state.navContext.detail.origin === "find" &&
          state.navHistory
        ) {
          state.navHistory.handleBack();
          return;
        }
        if (Discovery) {
          Discovery.openStandaloneFromNav();
          return;
        }
      }
      show(go.dataset.go);
    }
  });

  const detailTabs = document.getElementById("detailTabs");
  if (detailTabs) detailTabs.addEventListener("keydown", (e) => {
    const tabs = Array.from(detailTabs.querySelectorAll('[role="tab"]'));
    const fromTarget = e.target && e.target.closest ? e.target.closest('[role="tab"]') : null;
    let i = tabs.indexOf(fromTarget || document.activeElement);
    if (i < 0 && detailTabs.contains(document.activeElement)) {
      i = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    }
    if (i < 0) return;
    let next = null;
    if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
    else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === "Home") next = tabs[0];
    else if (e.key === "End") next = tabs[tabs.length - 1];
    if (!next) return;
    e.preventDefault();
    selectRecipeTab(next.id, true);
  });

  if (screenNav) screenNav.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) show(go.dataset.go, { force: true });
  });

  function setFieldError(inputId, errorId, invalid) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    if (input) input.setAttribute("aria-invalid", invalid ? "true" : "false");
    if (error) error.hidden = !invalid;
  }

  ["hhName", "ownerName"].forEach((fieldId) => {
    const input = document.getElementById(fieldId);
    if (!input) return;
    input.addEventListener("input", () => {
      if (input.value.trim()) setFieldError(fieldId, fieldId + "Error", false);
    });
  });

  document.getElementById("btnCreateHh").addEventListener("click", async () => {
    const kitchenName = document.getElementById("hhName").value.trim();
    const ownerName = document.getElementById("ownerName").value.trim();
    setFieldError("hhName", "hhNameError", !kitchenName);
    setFieldError("ownerName", "ownerNameError", !ownerName);
    if (!kitchenName || !ownerName) {
      const first = document.getElementById(!kitchenName ? "hhName" : "ownerName");
      if (first) first.focus();
      return;
    }
    state.householdName = kitchenName;
    const existingHh = API.householdId || state.householdId;
    if (existingHh && state.members.length) {
      const owner = meMember() || state.members[0];
      owner.name = ownerName;
      owner.initial = ownerName[0].toUpperCase();
      await apiPatch(`/api/households/${encodeURIComponent(existingHh)}`, {
        display_name: kitchenName,
        members: [{ member_id: owner.id, display_name: ownerName }],
      });
      syncAvatars();
      syncHouseholdChrome();
      show("members");
      return;
    }
    state.inviteCode = makeInviteCode();
    if (!state.members.length) {
      const mid = "owner-" + randToken(4).toLowerCase();
      state.members.push({
        id: mid,
        name: ownerName,
        initial: ownerName[0].toUpperCase(),
        status: "Active",
      });
      state.ratings[mid] = { score: null, note: "" };
    }
    track("household_created", {
      household_name: state.householdName,
      invite_code: state.inviteCode,
    });
    const res = await apiPost("/api/households", {
      display_name: state.householdName,
      acquisition_source: "organic",
    });
    if (res && res.household_id) {
      state.householdId = res.household_id;
      API.householdId = res.household_id;
      rememberSessionIds(res.household_id, state.members[0] && state.members[0].id);
      for (let i = 0; i < state.members.length; i++) {
        const m = state.members[i];
        await apiPost(`/api/households/${encodeURIComponent(res.household_id)}/members`, {
          member_id: m.id,
          display_name: m.name,
          role: m.id === state.members[0].id ? "owner" : "member",
          status: m.status === "Invited" ? "invited" : "active",
        });
        if (i === 0) await ensureMemberSession();
      }
      await ensureMemberSession();
    }
    show("members");
  });

  document.getElementById("btnAddMember").addEventListener("click", async () => {
    const input = document.getElementById("newMemberName");
    const name = input.value.trim();
    if (!name) return;
    if (state.members.length >= 4) {
      toast("Up to 4 people in a kitchen");
      return;
    }
    const mid =
      name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "") +
      "-" +
      randToken(3).toLowerCase();
    state.members.push({
      id: mid,
      name,
      initial: name[0].toUpperCase(),
      status: "Active",
    });
    state.ratings[mid] = { score: null, note: "" };
    input.value = "";
    renderMembers();
    syncAvatars();
    syncHouseholdChrome();
    const hh = API.householdId || state.householdId;
    if (hh) {
      await ensureMemberSession();
      await apiPost(`/api/households/${encodeURIComponent(hh)}/members`, {
        member_id: mid,
        display_name: name,
        role: "member",
        status: "active",
      });
    }
  });

  const btnGuestFewer = document.getElementById("btnGuestFewer");
  const btnGuestMore = document.getElementById("btnGuestMore");
  if (btnGuestFewer) {
    btnGuestFewer.addEventListener("click", function () {
      state.participantsGuestDraft = Math.max(0, (state.participantsGuestDraft || 0) - 1);
      syncParticipantsGuestUi();
    });
  }
  if (btnGuestMore) {
    btnGuestMore.addEventListener("click", function () {
      const diners = (state.participantsDraft || []).length + (state.participantsGuestDraft || 0);
      if (diners >= 8) {
        toast("Recipes go up to 8.");
        return;
      }
      state.participantsGuestDraft = Math.min(6, (state.participantsGuestDraft || 0) + 1);
      syncParticipantsGuestUi();
    });
  }

  document.getElementById("btnSkipTaste").addEventListener("click", () => {
    state.tastePicks = [];
    show("invite");
  });

  const tasteSearchTimers = {};
  app.addEventListener("submit", (e) => {
    const form = e.target.closest("form[data-taste-search]");
    if (!form) return;
    e.preventDefault();
    clearTimeout(tasteSearchTimers[form.dataset.tasteSearch]);
    runTasteSearch(form.dataset.tasteSearch, true);
  });

  app.addEventListener("input", (e) => {
    const form = e.target.closest("form[data-taste-search]");
    if (!form || e.target.type !== "search") return;
    const scope = form.dataset.tasteSearch;
    clearTimeout(tasteSearchTimers[scope]);
    tasteSearchTimers[scope] = setTimeout(function () { runTasteSearch(scope, false); }, 250);
  });

  app.addEventListener("change", (e) => {
    const radio = e.target.closest("input[data-taste-rank]");
    if (!radio || !radio.checked) return;
    changeTaste(radio.dataset.tasteRank, radio.value);
  });

  document.getElementById("inviteChannels").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-channel]");
    if (!chip) return;
    state.inviteChannel = chip.dataset.channel;
    document.querySelectorAll("#inviteChannels .channel-chip").forEach((c) => {
      c.classList.toggle("is-on", c === chip);
    });
    document.getElementById("inviteAttrMeta").textContent =
      "Ready to send";
  });

  document.getElementById("btnSendInvite").addEventListener("click", async () => {
    const hh = API.householdId || state.householdId;
    const inviter = meMember();
    await publishInviteCode();
    track("invite_sent", {
      household_id: hh || state.householdId || "HH-demo",
      inviter_id: inviter && inviter.id,
      channel: state.inviteChannel,
      invite_code: state.inviteCode,
      utm_source: "share",
      utm_medium: state.inviteChannel === "sms" ? "sms" : "referral",
      utm_campaign: "alpha_warm",
    });
    state.lastTouch = state.inviteCode;
    const partner = state.members.find((m) => m.status === "Invited");
    await ensureMemberSession();
    const ctx = state.navContext.invite;
    if (ctx && ctx.mode === "household") {
      const ok = await copyText(inviteUrl(state.inviteCode));
      toast(ok ? "Invite link copied — send it their way" : "Invite ready — copy the link below");
      return;
    }
    if (partner) toast("Invite ready for " + partner.name);
    else toast("Invite sent");
    show("home");
    updateHome();
  });

  document.getElementById("btnSkipInvite").addEventListener("click", async () => {
    await ensureMemberSession();
    leaveInvite();
  });

  document.getElementById("btnAcceptInvite").addEventListener("click", async () => {
    const code = document.getElementById("joinCode").value.trim() || state.inviteCode;
    const name = document.getElementById("joinName").value.trim() || "Partner";
    const keys = state.joinConstraints.filter(function (k) {
      return k !== "none";
    });
    const dest = sessionStorage.getItem("he_join_dest") || location.pathname + location.search;
    const res = await apiPost("/api/invites/join", {
      invite_code: code,
      display_name: name,
      constraint_keys: keys,
      channel: "deep_link",
    });
    if (res && res.error === "wrong_household_logged_in") {
      const wrong = document.getElementById("joinWrongHousehold");
      const joinOut = document.getElementById("btnJoinSignOut");
      if (wrong) wrong.hidden = false;
      if (joinOut) joinOut.hidden = false;
      toast("You’re signed into another kitchen — sign out first");
      return;
    }
    if (res && (res.error === "invite_expired" || res.error === "invite_inactive")) {
      toast("This invite expired — ask for a fresh link");
      return;
    }
    if (!res || !res.ok) {
      toast("Couldn’t join — check the code and try again");
      return;
    }
    applyServerSnapshot(res);
    state.householdId = res.household_id;
    API.householdId = res.household_id;
    rememberSessionIds(res.household_id, res.member_id);
    state.lastTouch = code;
    track("invite_accepted", {
      household_id: res.household_id,
      member_id: res.member_id,
      invite_code: code,
      channel: "deep_link",
      already_member: res.already_member,
    });
    API.planId = null;
    toast(res.already_member ? "Welcome back" : "You’re in — diet limits saved");
    if (dest && dest !== location.pathname) history.replaceState(null, "", dest);
    show("home");
    updateHome();
  });

  function refreshShareUi() {
    const url = shareUrl(state.shareObjectId);
    const meta = document.getElementById("shareIdMeta");
    if (meta) meta.textContent = "Link ready — copy & send";
    const field = document.getElementById("shareUrlField");
    const input = document.getElementById("shareUrlInput");
    const copyBtn = document.getElementById("btnCopyShareUrl");
    const previewBtn = document.getElementById("btnPreviewShare");
    const createBtn = document.getElementById("btnShareChoices");
    if (field && input) {
      field.hidden = false;
      input.value = url;
      input.setAttribute("aria-label", "Share link");
    }
    if (copyBtn) {
      copyBtn.hidden = false;
      copyBtn.classList.remove("btn-ghost");
      copyBtn.classList.add("btn-primary");
    }
    if (previewBtn) previewBtn.hidden = false;
    if (createBtn) createBtn.textContent = "Make a new link";
    const guestMeta = document.getElementById("guestShareMeta");
    if (guestMeta) guestMeta.textContent = "Shared picks for tonight";
  }

  /** Same invite card in both places; only the frame around it changes. */
  function renderInviteMode(ctx) {
    const household = !!(ctx && ctx.mode === "household");
    const eyebrow = document.getElementById("inviteEyebrow");
    const title = document.getElementById("inviteTitle");
    const progress = document.getElementById("inviteProgress");
    const skip = document.getElementById("btnSkipInvite");
    const keeps = document.getElementById("inviteKeepsNote");
    if (eyebrow) eyebrow.textContent = household ? "Invite" : "Step 5 of 6";
    if (title) title.textContent = household ? "Pull up another chair" : "Invite someone to cook with";
    if (progress) progress.hidden = household;
    if (keeps) keeps.hidden = !household;
    if (skip) {
      skip.textContent = household ? "Done" : "Skip — show tonight’s picks";
      skip.dataset.mode = household ? "household" : "onboarding";
    }
  }

  function leaveInvite() {
    const ctx = state.navContext.invite;
    if (ctx && ctx.mode === "household") {
      show(Nav.backTarget("invite", ctx));
      return;
    }
    show("home");
    updateHome();
    let seen = false;
    try {
      seen = !!localStorage.getItem("he_shop_onboard");
    } catch (_) {
      seen = true;
    }
    if (!seen) {
      const dlg = document.getElementById("shopOnboardSheet");
      if (dlg && typeof dlg.showModal === "function" && !dlg.open) dlg.showModal();
    }
  }

  function refreshInviteUi() {
    const codeEl = document.getElementById("inviteCodeDisplay");
    if (codeEl) codeEl.textContent = state.inviteCode;
    const field = document.getElementById("inviteUrlField");
    const input = document.getElementById("inviteUrlInput");
    if (field && input) {
      field.hidden = false;
      input.value = inviteUrl(state.inviteCode);
    }
  }

  /**
   * The code on the invite screen has to exist in D1 before anyone can join.
   * The server binds the inviter to the signed-in member.
   */
  async function publishInviteCode() {
    const hh = API.householdId || state.householdId;
    if (!hh || !(await apiProbe())) return null;
    await ensureMemberSession();
    const res = await apiPost("/api/invites", {
      household_id: hh,
      channel: state.inviteChannel || "copy",
      invite_code: state.inviteCode,
    });
    if (res && res.invite_code) {
      state.inviteCode = res.invite_code;
      refreshInviteUi();
      return res.invite_code;
    }
    const codeEl = document.getElementById("inviteCodeDisplay");
    if (codeEl) codeEl.textContent = "—";
    const input = document.getElementById("inviteUrlInput");
    if (input) input.value = "";
    return null;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); return true; }
      catch (e) { return false; }
      finally { ta.remove(); }
    }
  }

  document.getElementById("btnShareChoices").addEventListener("click", async () => {
    state.shareObjectId = makeShareId();
    state.shareReady = true;
    // Persist to D1 when API live so device B can resolve the same A/B/C
    let url = shareUrl(state.shareObjectId);
    const hh = API.householdId || state.householdId;
    if (hh && (await apiProbe())) {
      const planId = (await ensurePlan()) || PLAN_ID;
      const res = await apiPost("/api/shares", {
        household_id: hh,
        plan_id: planId,
        token: state.shareObjectId,
        share_object_id: state.shareObjectId,
        created_by_member_id: state.members[0] && state.members[0].id,
        channel: "copy",
        options: displayMeals().map((m) => ({
          letter: m.letter,
          meal_option_id: m.id,
          name: m.title,
          title: m.title,
          chips: m.chips,
          plate: m.plate,
          tone: m.tone,
          pers: m.pers,
          time: m.time,
          effort: m.effort,
          minutes: m.time ? parseInt(m.time, 10) : null,
          meal_format: m.meal_format,
          cuisine: m.cuisine,
          recipe_slug: m.recipe_slug,
          recipe_version: m.recipe_version_id,
          recipe_version_id: m.recipe_version_id,
        })),
      });
      if (res && res.token) {
        state.shareObjectId = res.token;
        if (res.share_url) url = res.share_url;
        if (res.plan_id) API.planId = res.plan_id;
      }
    }
    refreshShareUi();
    track("share_choice_created", {
      plan_id: API.planId || PLAN_ID,
      share_object_id: state.shareObjectId,
      member_id: state.members[0] && state.members[0].id,
      share_url: url,
      utm_source: "share",
      utm_medium: "referral",
      utm_campaign: "alpha_warm",
    });
    state.lastTouch = state.shareObjectId;
    // Stay on choices with a clear copyable URL (not guest-view-only).
    show("choices");
    const ok = await copyText(url);
    if (ok) {
      toast("Link copied — send it to whoever’s cooking with you");
      track("share_choice_acted", {
        share_object_id: state.shareObjectId,
        action: "copy_link",
      });
    } else {
      toast("Link ready — tap Copy share link");
    }
  });

  const btnCopyShare = document.getElementById("btnCopyShareUrl");
  if (btnCopyShare) {
    btnCopyShare.addEventListener("click", async () => {
      const url = shareUrl(state.shareObjectId);
      const ok = await copyText(url);
      toast(ok ? "Link copied — send it to whoever’s cooking with you" : "Couldn’t copy — select the link");
      track("share_choice_acted", {
        share_object_id: state.shareObjectId,
        action: "copy_link",
      });
    });
  }

  const btnPreviewShare = document.getElementById("btnPreviewShare");
  if (btnPreviewShare) {
    btnPreviewShare.addEventListener("click", () => {
      if (!state.shareObjectId) {
        state.shareObjectId = makeShareId();
        refreshShareUi();
      }
      show("shareGuest");
    });
  }

  const btnCopyInvite = document.getElementById("btnCopyInvite");
  if (btnCopyInvite) {
    btnCopyInvite.addEventListener("click", async () => {
      const url = inviteUrl(state.inviteCode);
      const ok = await copyText(url);
      toast(ok ? "Invite link copied" : "Couldn’t copy — select the link");
    });
  }

  document.getElementById("btnGuestSelect").addEventListener("click", () => {
    if (!state.guestPick) {
      toast("Pick one of the three first");
      return;
    }
    track("share_choice_acted", {
      share_object_id: state.shareObjectId,
      action: "select",
      meal_option_id: state.guestPick,
    });
    toast("Saved — join to cook & rate together");
  });

  function rememberVisibleCookStep() {
    const planId = state.dinnerPlan && state.dinnerPlan.dinner_plan_id;
    const mealId = state.dinnerCookMealId || state.dinnerCookPendingId;
    if (planId && mealId) writeCookStep(planId, mealId, state.cookStep);
  }

  document.getElementById("btnPrevStep").addEventListener("click", () => {
    if (state.cookStep > 0) {
      state.cookStep -= 1;
      rememberVisibleCookStep();
      renderCook();
    }
  });

  document.getElementById("btnNextStep").addEventListener("click", (e) => {
    if (e.currentTarget.dataset.action === "finish") {
      finishCook();
      return;
    }
    const steps = cookSteps();
    if (state.cookStep < steps.length - 1) {
      state.cookStep += 1;
      rememberVisibleCookStep();
      renderCook();
    }
  });

  /** Themed confirm sheet; falls back to window.confirm where <dialog> is unsupported. */
  function confirmDialog(opts) {
    const dlg = document.getElementById("confirmDialog");
    if (!dlg || typeof dlg.showModal !== "function") {
      return Promise.resolve(window.confirm(opts.body || opts.title));
    }
    document.getElementById("confirmTitle").textContent = opts.title;
    document.getElementById("confirmBody").textContent = opts.body || "";
    document.getElementById("confirmOk").textContent = opts.ok || "OK";
    document.getElementById("confirmCancel").textContent = opts.cancel || "Cancel";
    return new Promise(function (resolve) {
      dlg.returnValue = "";
      dlg.addEventListener(
        "close",
        function () {
          resolve(dlg.returnValue === "ok");
        },
        { once: true }
      );
      dlg.showModal();
      document.getElementById("confirmCancel").focus();
    });
  }

  document.getElementById("btnExitCook").addEventListener("click", async () => {
    const cooking = cookingMeal();
    if (cooking && cooking.dinner_plan && state.dinnerPlan) {
      const raw = planMealById(cooking.id);
      const leave = await confirmDialog({
        title: "Leave the kitchen?",
        body: planMealTitle(raw) + " goes back on your plan. Nothing is marked cooked.",
        ok: "Leave",
        cancel: "Keep cooking",
      });
      if (leave) {
        await mutateDinnerPlan({ op: "exit_cook", meal_id: cooking.id });
        clearCookStep(state.dinnerPlan && state.dinnerPlan.dinner_plan_id, cooking.id);
        state.dinnerCookMealId = null;
        state.dinnerCookPendingId = null;
        state.cookStep = 0;
        show("choices");
        renderTonightPlan();
      }
      return;
    }
    const leave = await confirmDialog({
      title: "Leave kitchen mode?",
      body: "Dinner isn’t marked as cooked yet. You can start cooking again from the recipe any time.",
      ok: "Exit",
      cancel: "Keep cooking",
    });
    if (leave) {
      const wasCooking = state.cookingMealId;
      applyIdentity(window.MealIdentity.reduceMealAction(identitySnapshot(), { type: "exit_cook" }));
      state.previewMealId = wasCooking || state.selectedMealId || state.previewMealId;
      show("detail");
    }
  });

  function startCooking(navigate) {
    const meal = detailMeal() || selectedMeal();
    const mealId = meal && meal.id;
    if (!mealId) {
      toast("Choose a dinner from tonight’s options first");
      return false;
    }
    if (meal.dinner_plan && state.dinnerPlan) {
      const raw = planMealById(mealId);
      if (raw && mealIsLoggedCooked(raw.state)) {
        openDinnerRating(state.dinnerPlan, mealId, "choices", null);
        return true;
      }
      const confirmed = state.dinnerCookMealId === mealId;
      const serverCooking = !!(raw && raw.state === "cooking") || meal.state === "cooking";
      if (confirmed || serverCooking) {
        confirmCookSession(mealId);
        if (navigate !== false) show("cook");
        return true;
      }
      // Same meal already waiting on begin_cook: don't send it twice or reset the step.
      if (state.dinnerCookPendingId === mealId) {
        if (navigate !== false) show("cook");
        return true;
      }
      state.cookStep = 0;
      state.dinnerCookPendingId = mealId;
      const planId = state.dinnerPlan.dinner_plan_id;
      void enqueueMealCook(planId, mealId, async function () {
        const plan = await mutateDinnerPlan({ op: "begin_cook", meal_id: mealId });
        if (state.dinnerCookPendingId === mealId) state.dinnerCookPendingId = null;
        if (!plan) {
          const still = planMealById(mealId);
          if (state.dinnerCookMealId === mealId && !(still && still.state === "cooking")) {
            state.dinnerCookMealId = null;
            if (state.view === "detail") renderDetail();
          }
          return null;
        }
        confirmCookSession(mealId);
        if (navigate !== false && state.view !== "cook") show("cook");
        else if (state.view === "detail") renderDetail();
        return plan;
      });
      return true;
    }
    applyIdentity(window.MealIdentity.reduceMealAction(identitySnapshot(), { type: "begin_cook", mealOptionId: mealId }));
    state.cookStep = 0;
    if (mealId === state.selectedMealId) {
      track("cook_started", {
        plan_id: API.planId || PLAN_ID,
        meal_option_id: mealId,
      });
    }
    if (navigate !== false) show("cook");
    return true;
  }

  document.getElementById("btnStartCook").addEventListener("click", async (e) => {
    const act = e.currentTarget.dataset.action;
    if (act === "discovery-cook-tonight") {
      e.stopImmediatePropagation();
      await discoveryCookTonight();
      return;
    }
    if (act === "discovery-use" || act === "discovery-add") {
      e.stopImmediatePropagation();
      await discoveryPick(state.discoveryRecipeVersionId, act === "discovery-use" ? "use_this" : "add_this", {
        fromDetail: true,
      });
      return;
    }
    if (act === "choose" || !act) {
      const meal = detailMeal();
      const pick = detailPickState(meal);
      // The shell button says "Start cooking" until the recipe paints.
      // On a slow round trip that click must choose, not open the kitchen
      // or mark a cook that has not started.
      if (act === "choose" || pick.action === "choose") {
        e.stopImmediatePropagation();
        if (meal) selectMeal(meal.id);
        renderDetail();
        return;
      }
    }
    if (!startCooking(false)) e.stopImmediatePropagation();
  });

  const btnPreviewSteps = document.getElementById("btnPreviewSteps");
  if (btnPreviewSteps) {
    btnPreviewSteps.addEventListener("click", async function (e) {
      e.stopImmediatePropagation();
      const act = btnPreviewSteps.dataset.action;
      if (act === "discovery-add-plan" || act === "discovery-add-list") {
        await discoveryAddToPlan();
        return;
      }
      startCooking(true);
    });
  }

  app.addEventListener("click", (e) => {
    const scoreBtn = e.target.closest(".score[data-person]");
    if (scoreBtn) {
      const id = scoreBtn.dataset.person;
      const score = Number(scoreBtn.dataset.score);
      if (state.dinnerRateMealId && (state.dinnerPlan || state.ratingPlan)) {
        state.cookUndoSealed = true;
        dismissCookUndo();
        state.ratings[id] = state.ratings[id] || { score: null, note: "" };
        state.ratings[id].score = score;
        const plan = planHoldingMeal(state.dinnerRateMealId);
        writeMealMutation(plan, {
          op: "rate_meal",
          meal_id: state.dinnerRateMealId,
          member_id: id,
          score: score,
        }).then(function (res) {
          if (res && res.plan) initPlanRatingsForMeal(state.dinnerRateMealId);
          renderRaters();
        });
        return;
      }
      const mealId = state.selectedMealId;
      if (!mealId) return;
      const ratedRecipe = recipeLoadedFor(selectedMeal());
      const versionId = ratedRecipe && ratedRecipe.recipe_version_id;
      const rated = window.MealIdentity.reduceMealAction(identitySnapshot(), {
        type: "rate",
        memberId: id,
        score: score,
        recipeVersionId: versionId,
      });
      if (rated.error) {
        toast("Rate the dinner you cooked");
        return;
      }
      applyIdentity(rated);
      track("rating_submitted", {
        person_id: id,
        score,
        scale: "1-10",
        meal_option_id: mealId,
        partial: !bothRated(),
      });
      (async () => {
        const planId = (await ensurePlan()) || PLAN_ID;
        const hh = API.householdId || state.householdId;
        if (!hh) return;
        await apiPost("/api/ratings", {
          plan_id: planId,
          meal_option_id: mealId,
          household_id: hh,
          member_id: id,
          score,
          note: (state.ratings[id] && state.ratings[id].note) || null,
          source: "app",
          attribution_last_touch: state.lastTouch,
        });
      })();
      renderRaters();
    }
  });

  app.addEventListener("input", (e) => {
    const note = e.target.closest("[data-note]");
    if (note) {
      if (!state.ratings[note.dataset.note]) state.ratings[note.dataset.note] = { score: null, note: "" };
      state.ratings[note.dataset.note].note = note.value;
      const notedMeal = state.selectedMealId;
      if (notedMeal) {
        if (!state.ratingsByOption[notedMeal]) state.ratingsByOption[notedMeal] = {};
        const prior = state.ratingsByOption[notedMeal][note.dataset.note] || {};
        state.ratingsByOption[notedMeal][note.dataset.note] = {
          score: state.ratings[note.dataset.note].score,
          note: note.value,
          recipe_version_id: prior.recipe_version_id || null,
        };
      }
    }
  });

  document.getElementById("btnSavePartial").addEventListener("click", () => {
    if (state.dinnerRateMealId) {
      const dest = state.rateReturnView || "home";
      show(dest);
      if (dest === "choices") renderTonightPlan();
      if (dest === "meals") renderMealHistory();
      if (dest === "home") updateHome();
      if (!toast._undo) toast("Saved — rate when you’re ready");
      return;
    }
    if (state.lifecycle === "Selected" || state.lifecycle === "Unselected") state.lifecycle = "Cooked";
    if (bothRated()) {
      state.lifecycle = "Rated";
      track("loop_completed", {
        household_id: API.householdId || state.householdId,
        plan_id: API.planId || PLAN_ID,
        attribution_last_touch: state.lastTouch,
      });
      show("loop");
      return;
    }
    updateDebug();
    toast(
      anyRated()
        ? activeMemberCount() === 2
          ? "Saved — waiting on the other rating"
          : `Saved — waiting on ${membersAwaitingRating().join(", ")}`
        : "Pick at least one person’s 1–10"
    );
    if (anyRated()) show("home");
  });

  document.getElementById("btnSubmitRated").addEventListener("click", () => {
    if (state.dinnerRateMealId) {
      const meal = planMealById(state.dinnerRateMealId);
      if (!meal || meal.state !== "fully_rated") {
        toast("Submit when everyone has scored");
        return;
      }
      showPlanLoop(state.dinnerRateMealId);
      return;
    }
    if (!bothRated()) return;
    state.lifecycle = "Rated";
    track("loop_completed", {
      household_id: API.householdId || state.householdId,
      plan_id: API.planId || PLAN_ID,
      meal_option_id: state.selectedMealId,
      attribution_last_touch: state.lastTouch,
      ratings: Object.fromEntries(
        state.members.map((m) => [m.id, state.ratings[m.id].score])
      ),
    });
    show("loop");
  });

  // Expose for QA / analytics inspection
  window.__HE_ANALYTICS__ = analyticsLog;
  window.__HE_STATE__ = state;
  window.__HE_API__ = API;
  applyQaChrome();
  // Keyboard: activate meal cards with Enter/Space
  app.addEventListener("keydown", (e) => {
    const card = e.target.closest(".option-card.is-pickable");
    if (!card) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    card.click();
  });


  document.getElementById("btnSaveSettings").addEventListener("click", async function () {
    const hh = API.householdId || state.householdId;
    if (!hh) return;
    const nameInput = document.getElementById("settingsHhName");
    const typedName = nameInput.value.trim();
    if (!typedName) {
      nameInput.value = state.householdName || "";
      toast("Your kitchen needs a name — kept “" + (state.householdName || "your kitchen") + "”");
    } else {
      state.householdName = typedName;
    }
    state.settingsChoiceCount = Number(document.getElementById("settingsChoiceCount").value) || 3;
    state.settingsCadence = document.getElementById("settingsCadence").value || "on_demand";
    await ensureMemberSession();
    await apiPatch("/api/households/" + encodeURIComponent(hh), {
      display_name: state.householdName,
      meal_choice_count: state.settingsChoiceCount,
      scheduling_cadence: state.settingsCadence,
    });
    syncHouseholdChrome();
    if (sameKeys(state.primaryConstraints, state.savedConstraints || [])) {
      toast("Settings saved");
      return;
    }
    const res = await saveMyConstraints();
    if (!res || !res.ok) {
      toast("Couldn’t save your limits — try again");
      return;
    }
    state.savedConstraints = state.primaryConstraints.slice();
    if (state.outcomeLocked) {
      toast("Saved — your next round of picks will follow these limits");
      return;
    }
    applyIdentity({
      previewMealId: null,
      selectedMealId: null,
      cookingMealId: null,
      lifecycle: "Unselected",
      outcomeLocked: false,
      lockedMealOptionId: null,
    });
    API.planId = null;
    state.currentMeals = null;
    state.activeRecipe = null;
    toast("Saved — tonight’s picks will refresh to match");
  });

  apiProbe().then(function (ok) {
    if (ok) console.info("[he-api] D1 live — write paths enabled");
    else console.info("[he-api] offline/unbound — in-memory only");
    try {
      if (window.matchMedia("(display-mode: standalone)").matches) return;
      const hint = document.getElementById("installHint");
      if (hint && ok) hint.hidden = false;
    } catch (_) { /* ignore */ }
  });

  function deepLinkTokensFromLocation() {
    const parts = location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const q = new URLSearchParams(location.search);
    let share = q.get("share");
    let invite = q.get("invite");
    if (parts[0] === "share" && parts[1]) share = decodeURIComponent(parts[1]);
    if (parts[0] === "invite" && parts[1]) invite = decodeURIComponent(parts[1]);
    if (parts[0] === "recover" && parts[1]) {
      return { recoverToken: decodeURIComponent(parts[1]), dest: q.get("dest") || "/" };
    }
    if (parts[0] === "rate") {
      return { ratePlan: parts[1] || null, share, invite };
    }
    return { share, invite };
  }

  function openContextMenu(menuEl, anchor, items) {
    menuEl.innerHTML = items
      .map(function (item) {
        return (
          '<li><button type="button" data-menu-action="' +
          escapeHtml(item.action) +
          '">' +
          escapeHtml(item.label) +
          "</button></li>"
        );
      })
      .join("");
    const rect = anchor.getBoundingClientRect();
    menuEl.style.top = rect.bottom + 4 + "px";
    menuEl.style.left = Math.min(rect.left, window.innerWidth - 200) + "px";
    menuEl.hidden = false;
  }

  document.addEventListener("click", function (e) {
    const planMenuBtn = e.target.closest("#btnPlanReviewMenu");
    if (planMenuBtn) {
      e.preventDefault();
      openContextMenu(document.getElementById("planContextMenu"), planMenuBtn, [
        { action: "plan-change-count", label: "Change the number of dinners" },
        { action: "plan-ask-table", label: "Ask the table" },
        { action: "plan-start-over", label: "Start over" },
      ]);
      return;
    }
    const shopMenuBtn = e.target.closest("#btnShopMenu");
    if (shopMenuBtn) {
      e.preventDefault();
      openContextMenu(document.getElementById("shopContextMenu"), shopMenuBtn, [
        { action: "plan-edit", label: "Edit plan" },
        { action: "shop-copy", label: "Copy list" },
        { action: "shop-native", label: "Share" },
        { action: "shop-print", label: "Print" },
        { action: "shop-txt", label: "Download .txt" },
        { action: "shop-csv", label: "Download .csv" },
        { action: "shop-link", label: "Sharing link" },
        state.shopShareId ? { action: "shop-revoke", label: "Stop sharing" } : null,
        { action: "shop-clear", label: "Clear completed" },
      ].filter(Boolean));
      return;
    }
    const tonightMenuBtn = e.target.closest("#btnTonightMenu");
    if (tonightMenuBtn) {
      e.preventDefault();
      openContextMenu(document.getElementById("tonightContextMenu"), tonightMenuBtn, [
        { action: "tonight-edit-plan", label: "Edit plan" },
        { action: "tonight-shop", label: "Shopping list" },
        { action: "tonight-new-plan", label: "Start a new plan" },
      ]);
      return;
    }
    const menuAct = e.target.closest("[data-menu-action]");
    if (menuAct) {
      document.getElementById("planContextMenu").hidden = true;
      document.getElementById("shopContextMenu").hidden = true;
      document.getElementById("tonightContextMenu").hidden = true;
      const act = menuAct.dataset.menuAction;
      if (act === "plan-start-over") show("planCount", { context: Nav.contextFor("planCount", "planReview", { established: true }) });
      else if (act === "plan-edit" || act === "tonight-edit-plan") {
        show("planReview", { context: Nav.contextFor("planReview", state.view, { established: true, mode: "edit" }) });
        renderPlanReview();
      } else if (act === "tonight-shop") {
        show("shopList", { context: Nav.contextFor("shopList", "choices", { established: true }) });
      } else if (act === "tonight-new-plan") {
        const dlg = document.getElementById("newPlanSheet");
        if (dlg && typeof dlg.showModal === "function") dlg.showModal();
      } else if (act === "plan-change-count") openChangeCountSheet();
      else if (act === "shop-copy") void shopExport("copy");
      else if (act === "shop-native") void shopNativeShare();
      else if (act === "shop-print") void shopExport("print");
      else if (act === "shop-txt") void shopExport("txt");
      else if (act === "shop-csv") void shopExport("csv");
      else if (act === "shop-link") void shopOpenShare();
      else if (act === "shop-revoke") void shopRevoke();
      else if (act === "shop-clear") {
        void mutateHouseholdShop({ op: "clear_completed" }).then(function () {
          renderShopList();
        });
      }
      else if (act === "plan-ask-table") {
        const url = appBaseUrl().replace(/\/$/, "") + "/?dinner_plan=" + encodeURIComponent(state.dinnerPlan.dinner_plan_id);
        document.getElementById("askTableUrl").value = url;
        document.getElementById("askTableSheet").showModal();
      }
      return;
    }
    if (!e.target.closest(".context-menu")) {
      document.getElementById("planContextMenu").hidden = true;
      document.getElementById("shopContextMenu").hidden = true;
      document.getElementById("tonightContextMenu").hidden = true;
    }
  });

  document.getElementById("shopAddForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const input = document.getElementById("shopAddInput");
    const text = input.value;
    const submitted = String(text || "");
    if (!submitted.trim()) {
      toast("Add a bit more of a name.");
      return;
    }
    const pending = state.shopAddPending;
    const requestId = pending && pending.text === submitted ? pending.requestId : shopRequestId("add");
    state.shopAddPending = { text: submitted, requestId: requestId };
    state.shopAddRequest = requestId;
    const saved = await mutateHouseholdShop({
      op: "add_item",
      text: submitted,
      client_request_id: requestId,
    });
    if (saved && saved.ok && input.value === submitted) input.value = "";
    if (saved && saved.ok && state.shopAddPending && state.shopAddPending.requestId === requestId) {
      state.shopAddPending = null;
      state.shopAddRequest = null;
    }
    renderShopList();
  });
  document.getElementById("btnShopRetry").addEventListener("click", async function () {
    const attempt = state.shopAttempt;
    if (!attempt || !state.householdShop) return;
    const saved = await mutateHouseholdShop(Object.assign({}, attempt, {
      expected_revision: state.householdShop.list.revision,
    }));
    renderShopList();
    if (saved && saved.ok) {
      const input = document.getElementById("shopAddInput");
      if (input && attempt.op === "add_item" && input.value === attempt.text) input.value = "";
      if (state.shopAddPending && attempt.op === "add_item" && state.shopAddPending.text === attempt.text) {
        state.shopAddPending = null;
      }
      state.shopAddRequest = null;
    }
  });
  let shopAppParts = [];
  let shopAppPartIndex = 0;

  function showShopReturnNote() {
    const note = document.getElementById("shopExportReturn");
    if (note) note.hidden = false;
  }

  async function refreshGroceryProviders() {
    const res = await apiGet("/api/grocery/capabilities");
    if (!res || res.aborted) return;
    const providers = ((res && res.providers) || []).filter(function (provider) {
      return provider && provider.configured && provider.id && provider.id !== "instore";
    });
    state.groceryProviders = providers;
    const connected = document.getElementById("shopHowConnected");
    const copy = document.getElementById("shopHowConnectedCopy");
    if (connected) connected.hidden = providers.length === 0;
    if (copy && providers.length) {
      copy.textContent = "A grocery service is connected for this kitchen. You’ll review the items before anything leaves FlavorWeave.";
    }
    const orderBtn = document.getElementById("btnShopOrder");
    if (orderBtn && state.view === "shopList") {
      orderBtn.hidden = !!state.shopInStore || providers.length === 0;
    }
  }

  function renderAppPartPager() {
    const box = document.getElementById("shopAppParts");
    const label = document.getElementById("shopAppPartLabel");
    const prev = document.getElementById("btnShopPartPrev");
    const next = document.getElementById("btnShopPartNext");
    if (!box) return;
    if (shopAppParts.length < 2) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    if (label) label.textContent = "Part " + (shopAppPartIndex + 1) + " of " + shopAppParts.length;
    if (prev) prev.disabled = shopAppPartIndex <= 0;
    if (next) next.disabled = shopAppPartIndex >= shopAppParts.length - 1;
  }

  async function fetchAppExport(purpose) {
    const epoch = sessionEpoch;
    let res;
    try {
      res = await fetch("/api/household-shop/export?format=app" + (purpose === "image" ? "&for=image" : ""), {
        credentials: "same-origin",
        cache: "no-store",
        signal: sessionAbort.signal,
      });
    } catch (error) {
      if (error && error.name === "AbortError") return { ok: false, aborted: true };
      return null;
    }
    if (!sessionStillCurrent(epoch)) return { ok: false, aborted: true };
    if (!res.ok) return null;
    const body = await res.json().catch(function () { return null; });
    if (!sessionStillCurrent(epoch)) return { ok: false, aborted: true };
    return body;
  }

  /** The sheet is a modal in the top layer, so a toast can sit behind it. Mirror feedback inside the sheet. */
  function howFeedback(message) {
    toast(message);
    const status = document.getElementById("shopHowStatus");
    if (status) {
      status.textContent = message;
      status.hidden = false;
    }
  }

  async function copyCurrentAppPart() {
    const text = shopAppParts[shopAppPartIndex] || "";
    if (!text) {
      howFeedback("Nothing to copy. The list is empty.");
      void trackShopExport("copy_app", "failed", "shop_sheet");
      return;
    }
    const ok = await copyText(text);
    howFeedback(ok
      ? "Copied. Paste this into your grocery app, then review the items before buying."
      : "Couldn’t copy. Your list is still here.");
    void trackShopExport("copy_app", ok ? "succeeded" : "failed", "shop_sheet");
    if (ok) showShopReturnNote();
  }

  async function shopCopyForApp() {
    const body = await fetchAppExport();
    if (body && body.aborted) {
      void trackShopExport("copy_app", "attempted", "shop_sheet");
      void trackShopExport("copy_app", "cancelled", "shop_sheet");
      return;
    }
    if (!body || !body.ok) {
      howFeedback("Couldn’t prepare the list. Your list is still here.");
      void trackShopExport("copy_app", "attempted", "shop_sheet");
      void trackShopExport("copy_app", "failed", "shop_sheet");
      return;
    }
    shopAppParts = Array.isArray(body.parts) ? body.parts : [];
    shopAppPartIndex = 0;
    renderAppPartPager();
    if (!shopAppParts.length) {
      howFeedback("Nothing to copy. The list is empty.");
      void trackShopExport("copy_app", "attempted", "shop_sheet");
      void trackShopExport("copy_app", "failed", "shop_sheet");
      return;
    }
    if (shopAppParts.length === 1) {
      void trackShopExport("copy_app", "attempted", "shop_sheet");
      await copyCurrentAppPart();
      return;
    }
    howFeedback("This list is in " + shopAppParts.length + " parts. Copy each part. Nothing is left out.");
    const copyPart = document.getElementById("btnShopCopyPart");
    if (copyPart) copyPart.focus();
  }

  function imageRowsFromExport(body) {
    return ((body && body.rows) || []).map(function (row) {
      return {
        quantity: (row && (row.quantity_human || row.quantity_unicode || row.quantity)) || "",
        name: shopDisplayName({ product_name: row && row.name, display_name: row && row.name }),
      };
    });
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) { resolve(blob); }, "image/png");
    });
  }

  async function shopSaveImage() {
    const image = window.FlavorWeaveShopImage;
    void trackShopExport("image", "attempted", "shop_sheet");
    if (!image) {
      howFeedback("Couldn’t prepare the image. Try Copy for my grocery app.");
      void trackShopExport("image", "failed", "shop_sheet");
      return;
    }
    let body = null;
    try {
      body = await fetchAppExport("image");
    } catch (_) {
      body = null;
    }
    if (!body || body.aborted || !body.ok) {
      howFeedback(image.imageHandoffFeedback({}).message);
      void trackShopExport("image", body && body.aborted ? "cancelled" : "failed", "shop_sheet");
      return;
    }
    let fontFamily = image.SHOP_IMAGE && image.SHOP_IMAGE.fontFamily;
    if (typeof image.ensureShopImageFont === "function") {
      try {
        const face = await image.ensureShopImageFont();
        if (face && face.fontFamily) fontFamily = face.fontFamily;
      } catch (_) { /* keep the fallback stack */ }
    }
    let canvases = [];
    try {
      canvases = image.renderShoppingListCanvases(imageRowsFromExport(body), {
        dpr: Math.min(window.devicePixelRatio || 2, 3),
        fontFamily: fontFamily,
      });
    } catch (_) {
      howFeedback(image.imageHandoffFeedback({}).message);
      void trackShopExport("image", "failed", "shop_sheet");
      return;
    }
    const blobs = [];
    for (let i = 0; i < canvases.length; i++) blobs.push(await canvasToBlob(canvases[i]));
    const files = blobs.filter(Boolean).map(function (blob, index) {
      const name = blobs.length > 1 ? "shopping-list-" + (index + 1) + ".png" : "shopping-list.png";
      return new File([blob], name, { type: "image/png" });
    });
    if (!files.length) {
      howFeedback(image.imageHandoffFeedback({}).message);
      void trackShopExport("image", "failed", "shop_sheet");
      return;
    }
    const plan = image.imageHandoffPlan({
      canShare: navigator.canShare ? navigator.canShare.bind(navigator) : null,
      share: navigator.share ? navigator.share.bind(navigator) : null,
      downloadAvailable: typeof document.createElement("a").download === "string",
    });
    let method = plan.method;
    if (method === "share" && navigator.canShare && !navigator.canShare({ files: files })) {
      method = typeof document.createElement("a").download === "string" ? "download" : "open-tab";
    }
    if (method === "share") {
      try {
        await navigator.share({ files: files, title: "Shopping list" });
        howFeedback(image.imageHandoffFeedback({ method: "share", completed: true }).message);
        void trackShopExport("image", "succeeded", "shop_sheet");
        showShopReturnNote();
        return;
      } catch (err) {
        if (err && err.name === "AbortError") {
          howFeedback(image.imageHandoffFeedback({ method: "share", errorName: "AbortError", completed: false }).message);
          void trackShopExport("image", "cancelled", "shop_sheet");
          return;
        }
        // NotAllowedError (gesture expired) or a share target failure: fall back honestly.
        method = typeof document.createElement("a").download === "string" ? "download" : "open-tab";
      }
    }
    if (method === "download") {
      files.forEach(function (file) {
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      });
      howFeedback(image.imageHandoffFeedback({ method: "download" }).message);
      void trackShopExport("download", "succeeded", "shop_sheet");
      showShopReturnNote();
      return;
    }
    files.forEach(function (file) {
      const url = URL.createObjectURL(file);
      window.open(url, "_blank", "noopener");
    });
    howFeedback(image.imageHandoffFeedback({ method: "open-tab" }).message);
    void trackShopExport("image", "succeeded", "shop_sheet");
    showShopReturnNote();
  }

  function syncShopHowMore() {
    const rows = document.querySelector("#shopHowSheet .shop-how__rows");
    if (!rows) return;
    const more = rows.scrollTop + rows.clientHeight < rows.scrollHeight - 8;
    rows.classList.toggle("is-more-below", more);
  }

  function openHowSheet() {
    const dlg = document.getElementById("shopHowSheet");
    if (!dlg || typeof dlg.showModal !== "function") return;
    void refreshGroceryProviders().then(function () {
      syncShopHowMore();
    });
    const status = document.getElementById("shopHowStatus");
    if (status) {
      status.textContent = "";
      status.hidden = true;
    }
    if (!dlg.open) dlg.showModal();
    const rows = dlg.querySelector(".shop-how__rows");
    if (rows && !rows.dataset.moreBound) {
      rows.dataset.moreBound = "1";
      rows.addEventListener("scroll", syncShopHowMore, { passive: true });
    }
    const first = document.getElementById("btnShopHowStore");
    if (first) first.focus();
    requestAnimationFrame(syncShopHowMore);
  }

  async function enterInStore() {
    const saved = await mutateHouseholdShop({ op: "set_trip_method", trip_method: "instore" });
    if (saved && saved.aborted) return;
    state.shopInStore = true;
    if (!saved || !saved.ok) toast("You’re looking at the store list. This trip’s choice didn’t save.");
    const dlg = document.getElementById("shopHowSheet");
    if (dlg && dlg.open) dlg.close();
    renderShopList();
  }

  function privateStorageKey(key, keepJoinDest) {
    if (!key) return false;
    if (key === "fw_theme" || key.indexOf("fw_theme:") === 0 || key === "he_qa") return false;
    if (keepJoinDest && key === "he_join_dest") return false;
    if (key === "he_household_id" || key === "he_member_id" || key === "he_shop_onboard") return true;
    if (key.indexOf("fw_dinner_plan") === 0) return true;
    if (key.indexOf("fw_shop_seen:") === 0) return true;
    if (key.indexOf("he_shop_snap_") === 0) return true;
    if (key.indexOf("fw_cook_step:") === 0) return true;
    if (key.indexOf("fw_weave") === 0) return true;
    if (key.indexOf("fw_handoff") === 0) return true;
    if (key.indexOf("he_disc_cache:") === 0) return true;
    if (key === "he_find_standalone_url" || key === "he_join_dest") return true;
    return false;
  }

  function clearNamedStorage(store, keepJoinDest) {
    try {
      const drop = [];
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (privateStorageKey(key, keepJoinDest)) drop.push(key);
      }
      drop.forEach(function (key) { store.removeItem(key); });
    } catch (_) { /* private mode */ }
  }

  function wipePrivateClientState(opts) {
    const keepJoinDest = !!(opts && opts.keepJoinDest);
    abortSessionWork();
    state.householdId = null;
    API.householdId = null;
    API.planId = null;
    state.householdName = "";
    state.members = [];
    state.meId = null;
    state.householdShop = null;
    state.dinnerPlan = null;
    state.dinnerShop = null;
    state.shopInStore = false;
    state.shopShareId = null;
    state.shopAttempt = null;
    state.shopAddPending = null;
    state.shopAddRequest = null;
    state.primaryConstraints = [];
    state.savedConstraints = [];
    state.ratings = {};
    state.ratingsByOption = {};
    state.currentMeals = null;
    state.selectedMealId = null;
    state.onboarded = false;
    state.groceryProviders = [];
    state.shopLineSnapshot = {};
    shopAppParts = [];
    shopAppPartIndex = 0;
    clearNamedStorage(localStorage, keepJoinDest);
    clearNamedStorage(sessionStorage, keepJoinDest);
    if (Theme && Theme.useMember) Theme.useMember(null);
  }

  let signOutBusy = false;
  let signOutOpts = null;

  function beginSignOutCover() {
    document.documentElement.dataset.signingOut = "1";
    const cover = document.getElementById("signOutCover");
    if (cover) cover.hidden = false;
  }

  function endSignOutCover() {
    delete document.documentElement.dataset.signingOut;
    const cover = document.getElementById("signOutCover");
    if (cover) cover.hidden = true;
  }

  function showSignOutFailure() {
    endSignOutCover();
    const sheet = document.getElementById("signOutFailed");
    if (sheet && typeof sheet.showModal === "function" && !sheet.open) sheet.showModal();
  }

  async function signOut(opts) {
    if (signOutBusy) return;
    signOutOpts = opts || null;
    const rejoin = !!(opts && opts.rejoin);
    const api = window.FlavorWeaveSignOut;
    if (!api || typeof api.confirmServerSignOut !== "function") {
      showSignOutFailure();
      return;
    }
    signOutBusy = true;
    beginSignOutCover();
    const failed = document.getElementById("signOutFailed");
    if (failed && failed.open) failed.close();
    let result;
    try {
      result = await api.confirmServerSignOut(fetch.bind(window), { timeoutMs: api.timeoutMs });
    } catch (_) {
      result = { ok: false, reason: "network" };
    }
    if (!result || !result.ok || !result.confirmed) {
      signOutBusy = false;
      showSignOutFailure();
      return;
    }
    wipePrivateClientState({ keepJoinDest: rejoin });
    endSignOutCover();
    const wrong = document.getElementById("joinWrongHousehold");
    const joinOut = document.getElementById("btnJoinSignOut");
    if (wrong) wrong.hidden = true;
    if (joinOut) joinOut.hidden = true;
    if (rejoin) {
      signOutBusy = false;
      show("join");
      toast("Signed out. Join with your name.");
      return;
    }
    location.replace("/");
  }

  document.getElementById("btnShopInStore").addEventListener("click", function () {
    openHowSheet();
  });
  document.getElementById("btnShopHowStore").addEventListener("click", function () {
    void enterInStore();
  });
  document.getElementById("btnShopCopyApp").addEventListener("click", function () {
    void shopCopyForApp();
  });
  document.getElementById("btnShopSaveImage").addEventListener("click", function () {
    void shopSaveImage();
  });
  document.getElementById("btnShopPartPrev").addEventListener("click", function () {
    if (shopAppPartIndex <= 0) return;
    shopAppPartIndex -= 1;
    renderAppPartPager();
  });
  document.getElementById("btnShopPartNext").addEventListener("click", function () {
    if (shopAppPartIndex >= shopAppParts.length - 1) return;
    shopAppPartIndex += 1;
    renderAppPartPager();
  });
  document.getElementById("btnShopCopyPart").addEventListener("click", function () {
    void trackShopExport("copy_app", "attempted", "shop_sheet");
    void copyCurrentAppPart();
  });
  document.getElementById("btnShopHowConnected").addEventListener("click", function () {
    const how = document.getElementById("shopHowSheet");
    if (how && how.open) how.close();
    document.getElementById("btnShopOrder").click();
  });
  document.getElementById("btnSignOut").addEventListener("click", function () {
    void signOut();
  });
  document.getElementById("btnJoinSignOut").addEventListener("click", function () {
    void signOut({ rejoin: true });
  });
  const btnSignOutRetry = document.getElementById("btnSignOutRetry");
  if (btnSignOutRetry) {
    btnSignOutRetry.addEventListener("click", function () {
      const sheet = document.getElementById("signOutFailed");
      if (sheet && sheet.open) sheet.close();
      void signOut(signOutOpts);
    });
  }
  const btnSignOutStay = document.getElementById("btnSignOutStay");
  if (btnSignOutStay) {
    btnSignOutStay.addEventListener("click", function () {
      const sheet = document.getElementById("signOutFailed");
      if (sheet && sheet.open) sheet.close();
      endSignOutCover();
    });
  }
  document.getElementById("btnShopOrder").addEventListener("click", function () {
    if (window.FlavorWeaveShopHandoff) {
      window.FlavorWeaveShopHandoff.open({
        apiGet: apiGet,
        apiPost: apiPost,
        getShop: function () {
          return state.householdShop;
        },
        openLine: openShopLineSheet,
        reload: loadHouseholdShop,
        toast: toast,
      });
      return;
    }
    document.getElementById("shopOrderSheet").showModal();
  });
  document.getElementById("btnShopDone").addEventListener("click", function () {
    state.shopInStore = false;
    show(Nav.backTarget("shopList", state.navContext.shopList));
  });
  document.getElementById("btnShopEditSave").addEventListener("click", async function () {
    const qtyRaw = document.getElementById("shopEditQty").value.trim();
    const saved = await mutateHouseholdShop({
      op: "edit_line",
      line_id: state.shopLineMenuId,
      patch: {
        display_name: document.getElementById("shopEditName").value,
        quantity: qtyRaw === "" ? null : Number(qtyRaw),
        unit: document.getElementById("shopEditUnit").value,
        category: document.getElementById("shopEditCategory").value,
      },
    });
    if (saved && saved.ok) document.getElementById("shopLineSheet").close();
    renderShopList();
  });
  document.getElementById("btnShopShareCopy").addEventListener("click", async function () {
    const ok = await copyText(document.getElementById("shopShareUrl").value);
    toast(ok ? "Link copied" : "Couldn’t copy the link");
  });
  document.getElementById("btnShopShareRevoke").addEventListener("click", function () {
    void shopRevoke();
  });
  document.getElementById("btnShopOnboardSkip").addEventListener("click", function () {
    try { localStorage.setItem("he_shop_onboard", "skip"); } catch (_) { /* private mode */ }
    document.getElementById("shopOnboardSheet").close();
  });
  async function finishShopOnboard(method) {
    try { localStorage.setItem("he_shop_onboard", method); } catch (_) { /* private mode */ }
    await apiPost("/api/household-shop/preferences", { scope: "household", method: method });
    document.getElementById("shopOnboardSheet").close();
  }
  document.getElementById("btnShopOnboardStore").addEventListener("click", function () {
    void finishShopOnboard("instore");
  });
  document.getElementById("btnShopOnboardOnline").addEventListener("click", function () {
    void finishShopOnboard("order_online");
  });
  document.getElementById("btnSaveShopping").addEventListener("click", async function () {
    const method = (document.querySelector('input[name="shopHouseholdMethod"]:checked') || {}).value || "instore";
    const memberMethod = (document.querySelector('input[name="shopMemberMethod"]:checked') || {}).value;
    const household = await apiPost("/api/household-shop/preferences", {
      scope: "household",
      method: method,
      service: document.getElementById("shopHouseholdService").value,
      usual_store: document.getElementById("shopUsualStore").value,
      postal_code: document.getElementById("shopPostal").value,
    });
    const member = await apiPost("/api/household-shop/preferences", {
      scope: "member",
      method: memberMethod || null,
      service: document.getElementById("shopMemberService").value || null,
      usual_store: document.getElementById("shopMemberStore").value,
    });
    toast(household && household.ok && member && member.ok ? "Shopping saved" : "Couldn’t save shopping");
  });
  document.getElementById("btnShopForgetPostal").addEventListener("click", async function () {
    document.getElementById("shopPostal").value = "";
    await apiPost("/api/household-shop/preferences", { scope: "household", postal_code: "" });
    toast("Postal code cleared");
  });
  document.getElementById("btnRecipeCopy").addEventListener("click", function () {
    void exportRecipe("copy");
  });
  document.getElementById("btnRecipePrint").addEventListener("click", function () {
    void exportRecipe("print");
  });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible" || state.view !== "shopList") return;
    loadHouseholdShop().then(function () {
      if (state.view === "shopList") renderShopList();
    });
  });

  document.getElementById("newPlanSheet").addEventListener("close", function () {
    if (document.getElementById("newPlanSheet").returnValue === "ok") {
      show("planCount", { context: Nav.contextFor("planCount", "choices", { established: true }) });
    }
  });

  const cookUndoRow = document.getElementById("cookUndoRow");
  if (cookUndoRow) {
    cookUndoRow.addEventListener("click", function (e) {
      const undo = e.target.closest(".cook-undo__btn");
      if (!undo || !cookUndoFn || state.cookUndoSealed) return;
      e.preventDefault();
      const fn = cookUndoFn;
      clearCookUndoRow();
      void fn();
    });
  }

  toastEl.addEventListener("click", function (e) {
    const undo = e.target.closest(".toast-undo");
    if (undo && toast._undo) {
      e.preventDefault();
      void toast._undo();
      toastEl.classList.remove("show");
      toast._undo = null;
      return;
    }
    const go = e.target.closest("[data-go]");
    if (!go) return;
    e.preventDefault();
    show(go.dataset.go);
  });

  document.getElementById("btnCookViewRecipe")?.addEventListener("click", function () {
    const meal = cookingMeal();
    if (!meal) return;
    state.dinnerDetailMeal = meal;
    state.previewMealId = meal.id;
    show("detail", {
      context: Nav.contextFor("detail", "cook", {
        established: householdEstablished(),
        origin: "cook",
        source: "dinner_plan",
      }),
    });
  });
  document.getElementById("shopEyebrow")?.addEventListener("click", function () {
    const plan = state.dinnerPlan;
    if (!plan) return;
    const mealId = shopEyebrowTargetMealId(plan);
    if (mealId) openParticipantsSheet(mealId);
  });
  document.getElementById("btnCookChangeRecipe")?.addEventListener("click", function () {
    mountRecipeWeave();
    const sheet = document.getElementById("cookAdaptSheet");
    if (sheet) sheet.showModal();
    const field = document.querySelector("#cookWeaveHost .weave-composer__field");
    if (field) field.focus();
  });
  document.getElementById("cookDinerLine")?.addEventListener("click", function () {
    const id = document.getElementById("cookDinerLine").dataset.mealId;
    if (id) openParticipantsSheet(id);
  });
  document.getElementById("btnAdaptBackOriginal")?.addEventListener("click", function () {
    if (state.adaptChangesMealId) void clearAllAdaptation(state.adaptChangesMealId);
  });
  document.getElementById("adaptChangesSheet")?.addEventListener("close", function () {
    const opener = state.adaptChangesOpener;
    state.adaptChangesOpener = null;
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  });

  document.getElementById("planDatesForm").addEventListener("submit", function (e) {
    e.preventDefault();
    savePlanDates();
  });
  document.getElementById("btnPlanDatesCancel").addEventListener("click", function () {
    document.getElementById("planDatesSheet").close();
  });
  document.getElementById("participantsForm").addEventListener("submit", function (e) {
    e.preventDefault();
    saveParticipantsSheet();
  });
  document.getElementById("btnParticipantsCancel").addEventListener("click", function () {
    document.getElementById("participantsSheet").close();
  });
  document.getElementById("btnChangeCountCancel").addEventListener("click", function () {
    document.getElementById("changeCountSheet").close();
  });
  document.getElementById("swapSheet").addEventListener("close", function () {
    state.swapInFlight = false;
    showSwapError("");
    const opener = state.swapOpener;
    state.swapOpener = null;
    if (opener && typeof opener.focus === "function") {
      try { opener.focus(); } catch (_) { /* the opener may already be gone */ }
    }
  });
  document.addEventListener("change", function (e) {
    if (e.target.name === "removeMeal") {
      state.changeCountRemoveMealId = e.target.value || null;
      document.getElementById("btnChangeCountApply").disabled = false;
    }
  });

  if (window.FlavorWeaveNavHistory) {
    state.navHistory = window.FlavorWeaveNavHistory.create({
      getState: function () {
        return { view: state.view, navContext: state.navContext };
      },
      show: show,
      Nav: Nav,
      getFindRestore: function () {
        return Discovery && Discovery.captureState ? Discovery.captureState() : null;
      },
    });
    state.navHistory.init();
  }

  if (Discovery) {
    Discovery.init({
      apiGet: apiGet,
      track: track,
      escapeHtml: escapeHtml,
      mealMediaHtml: mealMediaHtml,
      hydrateMealMedia: hydrateMealMedia,
      showView: function (name, opts) {
        show(name, opts || {});
      },
      getView: function () {
        return state.view;
      },
      navContext: function () {
        return state.navContext.find || {};
      },
      getDinnerPlan: function () {
        return state.dinnerPlan;
      },
      planMealById: planMealById,
      planMealTitle: planMealTitle,
      activeMembers: activeMembers,
      dinerLimits: dinerLimitIds,
      memberName: function (id) {
        const m = state.members.find(function (x) {
          return x.id === id;
        });
        if (!m) return null;
        const me = meMember();
        return me && m.id === me.id ? "you" : m.name;
      },
      openDiscoveryRecipe: openDiscoveryRecipe,
      discoveryPick: discoveryPick,
      loadTasteCatalog: loadTasteCatalog,
      tasteReasonLine: function (row, memberName) {
        if (!row || (row.primary_reason !== "taste_love" && row.primary_reason !== "taste_like")) return "";
        const hits = (row.taste_hits || []).slice(0, 2);
        const terms = hits
          .map(function (h) {
            return h.display_name || h.term_slug || "";
          })
          .filter(Boolean);
        if (!terms.length) return "";
        const joined = terms.length === 1 ? terms[0] : terms[0] + " and " + terms[1];
        return row.primary_reason === "taste_love" ? "You told us you love " + joined : "You said you like " + joined;
      },
    });
    window.addEventListener("popstate", function (ev) {
      const parts = location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
      if (parts[0] === "find") {
        const landed = ev.state || {};
        if (landed.fwGuard || landed.transient) return;
        if (landed.fw && landed.view && landed.view !== "find") return;
        const mode = (landed.find && landed.find.mode) || "standalone";
        show("find", {
          context: Nav.contextFor("find", "detail", {
            established: householdEstablished(),
            mode: mode,
            origin: (landed.find && landed.find.urlContext && landed.find.urlContext.origin) || "find",
          }),
        });
        Discovery.restoreFromHistory(ev.state);
        return;
      }
    });
  }

  // Deep links: /share/* · /invite/* · /recover/* (+ legacy ?query)
  (async function bootFromQuery() {
    const pathParts = location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (pathParts[0] === "shop" && pathParts.length === 1) {
      const restoredShop = await restoreSession();
      if (!restoredShop) {
        show("welcome");
        return;
      }
      show("shopList");
      return;
    }
    if (pathParts[0] === "shop" && pathParts[1] === "shared" && pathParts[2]) {
      let robots = document.querySelector('meta[name="robots"]');
      if (!robots) {
        robots = document.createElement("meta");
        robots.setAttribute("name", "robots");
        document.head.appendChild(robots);
      }
      robots.setAttribute("content", "noindex");
      show("shopShare");
      const token = decodeURIComponent(pathParts[2]);
      let body = null;
      try {
        const res = await fetch("/api/shop/shared/" + encodeURIComponent(token), { credentials: "same-origin" });
        body = await res.json();
        if (!res.ok) body = null;
      } catch (_) {
        body = null;
      }
      const host = document.getElementById("shopShareBody");
      if (!body || !body.ok || !body.snapshot) {
        if (host) host.innerHTML = '<p class="meta">This link has stopped working.</p>';
        return;
      }
      const snap = body.snapshot;
      const meta = document.getElementById("shopShareMeta");
      if (meta) meta.textContent = (snap.headline ? snap.headline + " · " : "") + "A snapshot. It does not update.";
      if (host) {
        host.innerHTML = (snap.sections || [])
          .map(function (section) {
            const items = (section.items || [])
              .map(function (item) {
                const qty = item.quantity == null || item.quantity === "" ? "" : String(item.quantity);
                const unit = item.unit || "";
                const amount = qty ? (unit ? qty + " " + unit : qty) : "";
                return "<li>" + escapeHtml((amount ? amount + " " : "") + (item.name || "Item")) + "</li>";
              })
              .join("");
            return '<section class="shop-aisle"><h2 class="shop-aisle__title">' + escapeHtml(section.name || "") + "</h2><ul>" + items + "</ul></section>";
          })
          .join("");
      }
      return;
    }
    if (pathParts[0] === "find" && Discovery) {
      const restored = await restoreSession();
      if (restored) {
        await loadCurrentDinnerPlan();
        Discovery.openFromLocation();
        return;
      }
      show("welcome");
      return;
    }
    if (pathParts[0] === "meal" && pathParts[1]) {
      const slug = decodeURIComponent(pathParts[1]);
      const from = new URLSearchParams(location.search).get("from");
      const restored = await restoreSession();
      if (!restored) {
        show("welcome");
        return;
      }
      await loadCurrentDinnerPlan();
      if (from === "find") {
        await openDiscoveryRecipe(slug);
        return;
      }
      const plan = state.dinnerPlan;
      const planMeal =
        plan &&
        (plan.meals || []).find(function (m) {
          return m.kind === "recipe" && m.recipe_slug === slug;
        });
      if (planMeal) {
        openPlanMealDetail(planMeal.meal_id, "tonightPlan");
        return;
      }
      await openDiscoveryRecipe(slug);
      return;
    }
    const link = deepLinkTokensFromLocation();
    if (link.recoverToken) {
      const consumed = await fetch("/api/recovery/consume", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: link.recoverToken }),
      });
      const body = await consumed.json().catch(function () {
        return null;
      });
      if (body && body.ok) {
        const dest = link.dest || body.destination_path || "/";
        history.replaceState(null, "", dest);
        const restored = await restoreSession();
        if (restored) {
          show(restored.next_view || "home");
          return;
        }
      }
      show("welcome");
      return;
    }
    const share = link.share;
    const invite = link.invite;
    if (share && share.startsWith("HE-SHARE")) {
      state.shareObjectId = share;
      state.lastTouch = share;
      refreshShareUi();
      show("shareGuest");
      if (await apiProbe()) {
        const res = await apiGet("/api/shares/" + encodeURIComponent(share));
        if (res && res.ok && Array.isArray(res.options) && res.options.length) {
          state.sharedMeals = optionsFromApi(res.options);
          if (res.plan_id) API.planId = res.plan_id;
          if (res.household_id) {
            // Guest attribution only — do not bind as owner household
            state.lastTouch = res.token || share;
          }
          renderGuestChoices();
          const meta = document.getElementById("guestShareMeta");
          if (meta) meta.textContent = "Shared picks for tonight";
        } else {
          console.warn("[he-api] share resolve miss — showing local demo cards", share);
        }
      }
      return;
    }
    if (invite && invite.startsWith("HE-INV")) {
      sessionStorage.setItem("he_join_dest", location.pathname + location.search);
      state.inviteCode = invite;
      state.lastTouch = invite;
      const jc = document.getElementById("joinCode");
      if (jc) jc.value = invite;
      show("join");
      if (await apiProbe()) {
        const res = await apiGet("/api/invites/" + encodeURIComponent(invite));
        if (res && res.ok) {
          state.inviteCode = res.invite_code || invite;
          if (jc) jc.value = state.inviteCode;
          if (res.household_display_name) {
            const joinHint = document.getElementById("joinHouseholdHint");
            if (joinHint) {
              joinHint.hidden = false;
              joinHint.textContent = "Joining " + res.household_display_name;
            }
          }
        } else {
          console.warn("[he-api] invite resolve miss", invite);
        }
      }
      return;
    }
    const qPlan = new URLSearchParams(location.search).get("dinner_plan");
    if (qPlan) {
      const restoredPlan = await restoreSession();
      if (restoredPlan) {
        const plan = await fetchDinnerPlanById(qPlan);
        if (plan) {
          history.replaceState(null, "", location.pathname);
          show("planReview", {
            context: Nav.contextFor("planReview", null, { established: true, mode: "compose", star: true }),
          });
          renderPlanReview();
          return;
        }
        toast("This plan isn’t in your kitchen.");
        show("home");
        return;
      }
    }
    const restored = await restoreSession();
    if (restored) {
      const target =
        restored.next_action === "onboarding"
          ? onboardingResumeView(restored)
          : restored.next_view || "home";
      await loadCurrentDinnerPlan();
      show(target);
      return;
    }
    show("welcome");
    syncHouseholdChrome();
  })();

  window.addEventListener("pageshow", function (ev) {
    if (!ev.persisted) return;
    const prior = state.view;
    beginSignOutCover();
    show("welcome");
    fetch("/api/sessions/me", { credentials: "same-origin", cache: "no-store" })
      .then(function (response) {
        if (response.status === 401) {
          wipePrivateClientState();
          endSignOutCover();
          show("welcome");
          return null;
        }
        if (!response.ok) {
          endSignOutCover();
          if (prior && prior !== "welcome") show(prior);
          return null;
        }
        return response.json();
      })
      .then(function (snap) {
        if (!snap || !snap.ok) return;
        endSignOutCover();
        applyServerSnapshot(snap);
        const target = snap.next_action === "onboarding" ? onboardingResumeView(snap) : snap.next_view || "home";
        show(target);
      })
      .catch(function () {
        endSignOutCover();
        if (prior && prior !== "welcome") show(prior);
      });
  });
})();
