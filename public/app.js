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

  const PLAN_ID = "local-plan";

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

  /** Recipe-specific photo when the catalog has one; quiet plate fallback otherwise. */
  function mealMediaHtml(meal, opts) {
    const o = opts || {};
    const img = Media.imageFor(meal);
    const cls = "meal-media" + (o.className ? " " + o.className : "");
    const fallback = `<span class="meal-media__fallback" aria-hidden="true">${escapeHtml((meal && meal.plate) || "🍽️")}</span>`;
    if (!img) return `<div class="${cls}">${o.inner || ""}${fallback}</div>`;
    const alt = o.decorative ? "" : escapeHtml((meal && (meal.title || meal.name)) || img.alt);
    const loading = o.eager ? 'fetchpriority="high"' : 'loading="lazy"';
    return `<div class="${cls}"><img src="${img.src}" srcset="${img.srcset}" sizes="${o.sizes || "(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 40vw"}" alt="${alt}" width="1200" height="900" decoding="async" ${loading} onerror="this.remove()" />${fallback}${o.inner || ""}</div>`;
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
  const API = { available: null, householdId: null, planId: null };
  /** Recovery hints only — session is HttpOnly cookie (not localStorage). */
  const LS_HH = "he_household_id";
  const LS_MEMBER = "he_member_id";

  function rememberSessionIds(householdId, memberId) {
    try {
      if (householdId) localStorage.setItem(LS_HH, householdId);
      if (memberId) localStorage.setItem(LS_MEMBER, memberId);
    } catch (_) { /* private mode */ }
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
    if (Array.isArray(snap.constraints) && state.members[0]) {
      const primaryId = state.members[0].id;
      state.primaryConstraints = snap.constraints
        .filter(function (c) {
          return c.member_id === primaryId && c.status === "prohibited";
        })
        .map(function (c) {
          return c.rule_key;
        });
    }
    if (Array.isArray(snap.ratings)) {
      snap.ratings.forEach(function (r) {
        if (state.ratings[r.member_id]) state.ratings[r.member_id].score = r.score;
      });
    }
    if (snap.plan_id) API.planId = snap.plan_id;
    if (Array.isArray(snap.meal_options) && snap.meal_options.length) {
      const fromApi = optionsFromApi(snap.meal_options);
      if (fromApi) state.currentMeals = fromApi;
    }
    if (snap.selected_meal_option_id) state.selectedMealId = snap.selected_meal_option_id;
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
    if (snap.next_action === "start_choices" || snap.next_action === "pick_meal") return "choices";
    if (!state.members.length) return "members";
    if (state.members.length >= 2) return "choices";
    const hasConstraints = state.primaryConstraints.length > 0;
    if (!hasConstraints && !snap.plan_id) return "constraints";
    return snap.next_view || "home";
  }

  async function apiProbe() {
    if (API.available !== null) return API.available;
    try {
      const r = await fetch("/api/health", { method: "GET", credentials: "same-origin" });
      if (!r.ok) { API.available = false; return false; }
      const j = await r.json();
      API.available = !!(j && j.ok && j.d1 === "ok");
      return API.available;
    } catch (_) {
      API.available = false;
      return false;
    }
  }

  function reportClientError(surface, code, message, extra) {
    apiPost("/api/client-errors", {
      surface,
      code,
      message,
      path: location.pathname + location.search,
      household_id: API.householdId || state.householdId,
      ...(extra || {}),
    }).catch(function () {});
  }

  async function apiPost(path, body) {
    if (!(await apiProbe())) return null;
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body || {}),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || (j && j.ok === false)) {
        console.warn("[he-api]", path, r.status, j);
        reportClientError("api", j && j.error, path + " " + r.status, { response: j });
        return Object.assign(j || {}, { ok: false, _httpStatus: r.status });
      }
      return j;
    } catch (e) {
      console.warn("[he-api]", path, e);
      reportClientError("api", "network", String(e && e.message), { path });
      return null;
    }
  }

  async function apiGet(path) {
    if (!(await apiProbe())) return null;
    try {
      const r = await fetch(path, {
        method: "GET",
        credentials: "same-origin",
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || (j && j.ok === false)) {
        console.warn("[he-api]", path, r.status, j);
        reportClientError("api", j && j.error, path + " " + r.status, { response: j });
        return Object.assign(j || {}, { ok: false, _httpStatus: r.status });
      }
      return j;
    } catch (e) {
      console.warn("[he-api]", path, e);
      reportClientError("api", "network", String(e && e.message), { path });
      return null;
    }
  }

  async function apiPatch(path, body) {
    if (!(await apiProbe())) return null;
    try {
      const r = await fetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body || {}),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || (j && j.ok === false)) {
        reportClientError("api", j && j.error, path + " " + r.status, { response: j });
        return Object.assign(j || {}, { ok: false, _httpStatus: r.status });
      }
      return j;
    } catch (e) {
      reportClientError("api", "network", String(e && e.message), { path });
      return null;
    }
  }

  function persistEvent(event, props) {
    apiPost("/api/events", {
      event_name: event,
      household_id: API.householdId || state.householdId || (props && props.household_id) || null,
      member_id: (props && (props.member_id || props.person_id || props.inviter_id)) || null,
      plan_id: (props && props.plan_id) || API.planId || PLAN_ID,
      meal_option_id: (props && props.meal_option_id) || null,
      invite_code: (props && props.invite_code) || null,
      share_object_id: (props && props.share_object_id) || null,
      channel: (props && props.channel) || null,
      attribution_last_touch: (props && props.attribution_last_touch) || state.lastTouch || null,
    }).catch(function () {});
  }

  function track(event, props) {
    const row = { event, ts: new Date().toISOString(), ...props };
    analyticsLog.push(row);
    console.info("[he-analytics]", event, props || {});
    persistEvent(event, props);
    return row;
  }

  const constraintOptions = [
    { id: "dairy", label: "Dairy-free" },
    { id: "meat", label: "No meat*" },
    { id: "poultry", label: "No poultry" },
    { id: "shellfish", label: "No shellfish" },
    { id: "nuts", label: "Nuts except cashew" },
    { id: "none", label: "None" },
  ];

  const sparkOptions = [
    { id: "crispy", label: "Crispy textures" },
    { id: "tacos", label: "Taco night" },
    { id: "curry", label: "Curry bowls" },
    { id: "fish", label: "Finfish OK" },
    { id: "sheet", label: "Sheet-pan easy" },
    { id: "bright", label: "Bright / citrus" },
  ];

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
    sparks: [],
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
    tasteCorrectionSpark: null,
    settingsChoiceCount: 3,
    settingsCadence: "on_demand",
    activeRecipe: null,
    ratingState: "none",
  };

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

  function servingCountForMeal() {
    return activeMemberCount();
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
          ? "*Fish is fine when both of you allow it. Soft likes never override hard limits."
          : "*Fish is fine when your household allows it. Soft likes never override hard limits.";
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
    if (!state.selectedMealId) return null;
    return displayMeals().find(function (m) {
      return m.id === state.selectedMealId;
    }) || null;
  }

  async function fetchRecipeForMeal(meal) {
    if (!meal) return null;
    const slug = meal.recipe_slug;
    const versionId = meal.recipe_version_id;
    const servings = servingCountForMeal();
    let path = null;
    if (slug) path = "/api/recipes/" + encodeURIComponent(slug) + "?servings=" + servings;
    else if (versionId) {
      path = "/api/recipes/version/" + encodeURIComponent(versionId) + "?servings=" + servings;
    }
    if (!path) return null;
    const res = await apiGet(path);
    if (res && res.ok && res.recipe) return res.recipe;
    return null;
  }

  async function ensureRecipeForSelection() {
    const meal = selectedMeal();
    if (!meal) return null;
    if (
      state.activeRecipe &&
      (state.activeRecipe.recipe_slug === meal.recipe_slug ||
        state.activeRecipe.recipe_version_id === meal.recipe_version_id)
    ) {
      return state.activeRecipe;
    }
    const loaded = await fetchRecipeForMeal(meal);
    if (loaded) state.activeRecipe = loaded;
    return state.activeRecipe;
  }

  function cookSteps() {
    return (state.activeRecipe && state.activeRecipe.steps) || [];
  }
  state.ratings = Object.fromEntries(
    state.members.map((m) => [m.id, { score: null, note: "" }])
  );

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2200);
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
      .map((c) => {
        const on = selectedIds.includes(c.id);
        return `<label class="check-tile${on ? " is-on" : ""}"><input type="checkbox" data-cid="${c.id}" ${on ? "checked" : ""} /> <span>${c.label}</span></label>`;
      })
      .join("");
    root.onchange = (e) => {
      const input = e.target.closest("input[data-cid]");
      if (!input) return;
      const id = input.dataset.cid;
      const label = input.closest("label");
      if (id === "none") {
        selectedIds.length = 0;
        if (input.checked) selectedIds.push("none");
      } else {
        const i = selectedIds.indexOf("none");
        if (i >= 0) selectedIds.splice(i, 1);
        if (input.checked) {
          if (!selectedIds.includes(id)) selectedIds.push(id);
        } else {
          const j = selectedIds.indexOf(id);
          if (j >= 0) selectedIds.splice(j, 1);
        }
      }
      if (onToggle) onToggle();
      renderConstraintGrid(rootId, selectedIds, onToggle);
    };
  }

  function renderSparks() {
    const root = document.getElementById("tasteSparks");
    root.innerHTML = sparkOptions
      .map((s) => {
        const on = state.sparks.includes(s.id);
        return `<button type="button" class="chip-tog${on ? " is-on" : ""}" data-spark="${s.id}" aria-pressed="${on}">${s.label}</button>`;
      })
      .join("");
    document.getElementById("sparkHint").textContent = `${state.sparks.length} of 3 selected`;
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
      let pers = o.pers;
      if (!pers && o.attributes_json) {
        try {
          const attrs =
            typeof o.attributes_json === "string" ? JSON.parse(o.attributes_json) : o.attributes_json;
          if (attrs && attrs.pers) pers = attrs.pers;
        } catch (_) { /* ignore */ }
      }
      return {
        letter,
        id: o.meal_option_id || o.id || (PLAN_ID + "-" + letter),
        title: o.title || o.name || ("Option " + letter),
        chips: Array.isArray(o.chips) && o.chips.length ? o.chips : ["Shared"],
        plate: o.plate || plates[letter] || "🍽️",
        tone: o.tone || tones[letter] || "tone-a",
        time: o.time || "",
        effort: o.effort || "",
        recipe_slug: o.recipe_slug || null,
        recipe_version_id: o.recipe_version_id || null,
        pers: pers || {
          type: "why",
          label: "Shared pick",
          line: "Someone shared these picks with you",
        },
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
      return true;
    }
    return false;
  }

  function mealCardHtml(m, opts) {
    const { selected, goDetail } = opts || {};
    const go = goDetail ? ` data-go="detail" data-select="${escapeHtml(m.id)}"` : ` data-select="${escapeHtml(m.id)}"`;
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
    const persBadge = pers.label
      ? `<span class="badge badge--sm ${pers.type === "new" ? "badge--accent" : "badge--match"} pers-chip ${persClass(pers.type)}">${escapeHtml(pers.label)}</span>`
      : "";
    const letter = `<span class="option-card__letter" aria-hidden="true">${escapeHtml(m.letter)}</span>`;
    return `
      <article class="option-card is-pickable${selected ? " selected-mark" : ""}" role="listitem" tabindex="0" aria-pressed="${selected ? "true" : "false"}"${go} aria-label="Option ${escapeHtml(m.letter)}: ${escapeHtml(m.title)}">
        ${mealMediaHtml(m, { className: "option-card__media", inner: letter, decorative: true })}
        <span class="badge badge--sm badge--fit option-card__pick" aria-hidden="true">${icon("check")}Your pick</span>
        <div class="option-card__body">
          <h2>${escapeHtml(m.title)}</h2>
          <div class="badges">${persBadge}</div>
          ${pers.line ? `<p class="why">${escapeHtml(pers.line)}</p>` : ""}
          ${meta}
        </div>
        ${goDetail ? `<span class="option-card__cta" aria-hidden="true">View recipe ${icon("arrow-right")}</span>` : ""}
      </article>`;
  }

  function setChoiceLoading(on) {
    const el = document.getElementById("choiceLoading");
    if (el) el.hidden = !on;
  }

  function renderChoices() {
    setChoiceLoading(false);
    const list = displayMeals();
    document.getElementById("choiceCards").innerHTML = list
      .map((m) => mealCardHtml(m, { selected: state.selectedMealId === m.id, goDetail: true }))
      .join("");
    document.getElementById("shareIdMeta").textContent = "Share link ready";
  }

  function renderGuestChoices() {
    const list = guestMeals();
    document.getElementById("guestChoiceCards").innerHTML = list
      .map((m) => mealCardHtml(m, { selected: state.guestPick === m.id }))
      .join("");
    const meta = document.getElementById("guestShareMeta");
    if (meta) {
      meta.textContent = state.sharedMeals
        ? "Shared picks for tonight"
        : "Shared picks for tonight";
    }
  }

  /** full: header nav + mobile tabs · focus: header nav only · brand: wordmark only · none: cook */
  function chromeFor(name) {
    if (name === "cook") return "none";
    if (["home", "choices", "meals", "tasteProfile", "settings", "demo"].includes(name)) return "full";
    if (name === "detail" || name === "rate") return "focus";
    return "brand";
  }

  function show(name) {
    const prev = state.view;
    // Persist hard constraints when leaving constraints screen (per primary diner)
    if (prev === "constraints" && name !== "constraints") {
      const hh = API.householdId || state.householdId;
      const primary = state.members[0];
      if (hh && primary) {
        apiPost(`/api/members/${encodeURIComponent(primary.id)}/constraints`, {
          household_id: hh,
          keys: state.primaryConstraints.slice(),
        }).catch(function () {});
      }
    }
    state.view = name;
    app.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("is-active", v.dataset.view === name);
    });
    app.dataset.chrome = chromeFor(name);
    topbar.classList.remove("hidden");
    tabbar.classList.remove("hidden");

    const navMap = { detail: "home", rate: "home", demo: "home", invite: "home" };
    const navKey = navMap[name] || name;
    app.querySelectorAll("[data-nav]").forEach((t) => {
      const on = t.dataset.nav === navKey;
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
      document.getElementById("constraintFor").textContent = state.members[0]?.name || "Your";
      renderConstraintGrid("constraints", state.primaryConstraints);
      ensureMemberSession().catch(function () {});
    }
    if (name === "taste") renderSparks();
    if (prev === "taste" && name !== "taste") persistSparksToServer().catch(function () {});
    if (name === "invite") {
      refreshInviteUi();
      document.getElementById("inviteAttrMeta").textContent =
        "For your kitchen only · ready to share";
    }
    if (name === "join") renderConstraintGrid("joinConstraints", state.joinConstraints);
    if (name === "choices") {
      (async function () {
        if (!API.planId && (API.householdId || state.householdId)) {
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
      ensureRecipeForSelection().then(function () {
        renderDetail();
      });
    }
    if (name === "cook") {
      ensureRecipeForSelection().then(function () {
        renderCook();
      });
    }
    if (name === "rate") renderRaters();
    if (name === "loop") renderLoopSummary();
    if (name === "home") updateHome();
    if (name === "demo" || name === "invite" || name === "rate" || name === "home") {
      syncHouseholdChrome();
    }
    updateDebug();
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
    strip.textContent = "Options that fit " + fit + ". Tap one — or send the set.";
  }

  function updateHome() {
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

    if (homeCopy) homeCopy.textContent = "Fits " + householdCopy("fit");

    if (stage === "pick") {
      const options = displayMeals();
      eye.textContent = "Tonight’s picks";
      homeTitle.textContent = options.length
        ? options.length + " dinners worth choosing"
        : "Pick tonight’s meal";
      homeLede.textContent = options.length
        ? "Each one clears everyone’s hard limits. Pick one — or send the set so " + householdCopy("both") + " can weigh in."
        : "We’ll weave a few options that fit everyone at the table.";
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
    const minutes = mealMinutes(meal, state.activeRecipe);
    homeMeta.hidden = !minutes;
    homeMeta.innerHTML = minutes ? icon("clock") + escapeHtml(minutes) : "";

    if (stage === "cook") {
      eye.textContent = "Tonight’s pick";
      homeLede.textContent = pers.line || "Clears everyone’s hard limits. Cook it, then rate it together.";
      pill.textContent = pers.label || "Picked";
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
      homeLede.textContent = "Logged and learned. The next picks get a little smarter.";
      pill.textContent = "Rated";
      actions.innerHTML =
        `<button class="btn btn-primary btn-lg" type="button" data-go="meals">See meals &amp; ratings</button>` +
        `<button class="btn btn-secondary btn-lg" type="button" data-go="tasteProfile">Taste profile</button>`;
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
    if (state.activeRecipe) paint(state.activeRecipe);
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

  function renderDetail() {
    const meal = selectedMeal();
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
    selectRecipeTab("tab-overview", false);
    if (mediaEl) {
      mediaEl.outerHTML = mealMediaHtml(meal || {}, {
        className: "recipe__media",
        eager: true,
        sizes: "(min-width: 1024px) 50vw, 100vw",
      }).replace('<div class="', '<div id="detailMedia" class="');
    }
    if (!meal || !recipe) {
      if (titleEl) titleEl.textContent = meal ? meal.title : "Load a pick first";
      if (whyEl) whyEl.textContent = meal ? "We couldn’t load the full recipe. Check your connection and try again." : "Pick one of tonight’s options to see the recipe.";
      if (statsEl) statsEl.innerHTML = "";
      return;
    }
    const pers = meal.pers || {};
    if (titleEl) titleEl.textContent = recipe.title || meal.title;
    if (whyLabel) whyLabel.textContent = pers.label ? "Why this one · " + pers.label : "Why this one";
    if (whyEl) whyEl.textContent = pers.line || "Clears your household’s hard limits.";
    const serves = recipe.requested_servings || recipe.servings || servingCountForMeal();
    if (chipsEl) {
      const badges = ['<span class="badge badge--fit" id="detailLockChip">Fits ' + escapeHtml(householdCopy("fit")) + "</span>"];
      if (pers.label) badges.push('<span class="badge badge--match">' + escapeHtml(pers.label) + "</span>");
      if (recipe.total_minutes) badges.push('<span class="badge badge--time">' + icon("clock") + recipe.total_minutes + " min</span>");
      chipsEl.innerHTML = badges.join("");
    }
    if (statsEl) {
      const stats = [
        ["users", serves + (serves === 1 ? " serving" : " servings"), "Serves"],
        ["clock", (recipe.total_minutes || "—") + " minutes", "Total time"],
        ["gauge", recipe.effort || meal.effort || "—", "Effort"],
      ];
      statsEl.innerHTML = stats
        .map(function (s) {
          return `<div class="stat">${icon(s[0])}<dt>${s[2]}</dt><dd>${escapeHtml(s[1])}</dd></div>`;
        })
        .join("");
    }
    if (servingsNote) {
      servingsNote.textContent =
        recipe.base_servings && recipe.base_servings !== serves
          ? "Scaled for " + serves + " (written for " + recipe.base_servings + ")."
          : "Amounts for " + serves + ".";
    }
    if (ingEl) {
      ingEl.innerHTML = (recipe.ingredients || [])
        .map(function (i) {
          const note = i.note ? ` <span class="ing-note">${escapeHtml(i.note)}</span>` : "";
          return `<li><span class="qty">${escapeHtml(i.quantity || "")}</span><span>${escapeHtml(i.name)}${note}</span></li>`;
        })
        .join("");
    }
    if (stepsEl) {
      stepsEl.innerHTML = (recipe.steps || [])
        .map(function (s, idx) {
          return `<li data-n="${idx + 1}"><div><strong>${escapeHtml(s.title)}</strong>${s.body ? `<p>${escapeHtml(s.body)}</p>` : ""}</div></li>`;
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
      notes.push(["Household fit", "Clears every active diner’s hard limits. Soft likes only shape the order."]);
      notesEl.innerHTML = notes
        .map(function (n) {
          return `<div><dt>${escapeHtml(n[0])}</dt><dd>${escapeHtml(n[1])}</dd></div>`;
        })
        .join("");
    }
    track("recipe_opened", {
      plan_id: API.planId || null,
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
  // Keyboard: activate meal cards with Enter/Space
  app.addEventListener("keydown", (e) => {
    const card = e.target.closest(".option-card.is-pickable");
    if (!card) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    card.click();
  });

    if (!isQaMode() || !debug) return;
    const scores = state.members
      .map((m) => `${m.initial}:${state.ratings[m.id]?.score ?? "—"}`)
      .join(" ");
    debug.hidden = false;
    debug.textContent = `${state.lifecycle} · 1–10 · ${scores}`;
  }

  function renderCook() {
    const steps = cookSteps();
    const i = state.cookStep;
    const cookMeal = document.getElementById("cookMealTitle");
    const meal = selectedMeal();
    if (cookMeal) {
      cookMeal.textContent = (state.activeRecipe && state.activeRecipe.title) || (meal && meal.title) || "Kitchen mode";
    }
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

  function finishCook() {
    state.lifecycle = "Cooked";
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
    const faceFor = (score) => {
      if (score == null) return { face: "🍽️", word: "Not rated yet" };
      if (score <= 2) return { face: "😖", word: "Hard miss" };
      if (score <= 4) return { face: "😕", word: "Not quite" };
      if (score <= 6) return { face: "😐", word: "Fine" };
      if (score <= 8) return { face: "🙂", word: "Good one" };
      return { face: "😍", word: "Craving it" };
    };
    root.innerHTML = activeMembers()
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
    submit.disabled = !bothRated();
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

  async function persistSparksToServer() {
    const hh = API.householdId || state.householdId;
    if (!hh || !state.sparks.length) return;
    await ensureMemberSession();
    for (let i = 0; i < state.sparks.length; i++) {
      await apiPost("/api/preference-evidence", {
        tag: state.sparks[i],
        kind: "like",
        source: "onboarding_spark",
      });
    }
  }

  function renderSettings() {
    document.getElementById("settingsHhName").value = state.householdName || "";
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
    if (m.status === "Rated") return { label: "Rated", cls: "badge--success" };
    if (m.status === "Cooked") {
      return { label: m.rating_state === "partial" ? "Partly rated" : "Rating waiting", cls: "badge--warning" };
    }
    if (m.status === "Selected") return { label: "Picked", cls: "badge--fit" };
    return { label: m.status || "Planned", cls: "" };
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
    done(
      meals
        .map(function (m) {
          const status = historyStatus(m);
          const rating = m.avg_score != null ? `<span class="badge badge--sm badge--time">${m.avg_score.toFixed(1)}/10 avg</span>` : "";
          const fav = m.favorite ? `<span class="badge badge--sm badge--accent">${icon("heart")}Favorite</span>` : "";
          return `<li class="history-item">
              ${mealMediaHtml({ recipe_slug: m.recipe_slug, title: m.meal_name }, { decorative: true, sizes: "(min-width: 1024px) 30vw, 120px" })}
              <div class="history-item__body">
                <p class="history-item__title">${escapeHtml(m.meal_name)}</p>
                <div class="badges"><span class="badge badge--sm ${status.cls}">${escapeHtml(status.label)}</span>${rating}${fav}</div>
              </div>
            </li>`;
        })
        .join("")
    );
  }

  const tasteLineIcons = { like: "heart", avoid: "x", history: "history", starter: "spark" };

  async function renderTasteProfile() {
    const ul = document.getElementById("tasteProfileLines");
    const meta = document.getElementById("tasteProfileMeta");
    ul.setAttribute("aria-busy", "true");
    ul.innerHTML = '<li class="skeleton" style="height:72px" aria-hidden="true"></li><li class="skeleton" style="height:72px" aria-hidden="true"></li>';
    if (meta) meta.hidden = true;
    const hh = API.householdId || state.householdId;
    const done = function (html) {
      ul.innerHTML = html;
      ul.removeAttribute("aria-busy");
    };
    if (!hh) {
      done(`<li class="taste-line--starter"><span class="taste-line__icon">${icon("users")}</span><span>Join or create a kitchen first.</span></li>`);
      return;
    }
    const res = await apiGet("/api/households/" + encodeURIComponent(hh) + "/taste-profile");
    if (!res || !res.ok) {
      done(`<li class="taste-line--starter"><span class="taste-line__icon">${icon("spark")}</span><span>Not enough to go on yet — cook and rate a dinner or two.</span></li>`);
    } else {
      done(
        (res.profile.lines || [])
          .map(function (line) {
            const kind = tasteLineIcons[line.kind] ? line.kind : "starter";
            return `<li class="taste-line--${kind}"><span class="taste-line__icon">${icon(tasteLineIcons[kind])}</span><span>${escapeHtml(line.text)}</span></li>`;
          })
          .join("")
      );
      const rated = res.profile.meals_rated;
      if (meta && typeof rated === "number") {
        meta.hidden = false;
        meta.textContent = rated
          ? "Based on " + rated + (rated === 1 ? " rating" : " ratings") + " so far."
          : "No ratings yet — this fills in as you cook.";
      }
    }
    const corr = document.getElementById("tasteCorrections");
    corr.innerHTML = sparkOptions
      .map(function (s) {
        const on = state.tasteCorrectionSpark === s.id;
        return `<button type="button" class="chip-tog${on ? " is-on" : ""}" data-corr="${s.id}" aria-pressed="${on}">${s.label}</button>`;
      })
      .join("");
    corr.onclick = function (e) {
      const b = e.target.closest("[data-corr]");
      if (!b) return;
      state.tasteCorrectionSpark = b.dataset.corr;
      corr.querySelectorAll("[data-corr]").forEach(function (el) {
        const on = el.dataset.corr === state.tasteCorrectionSpark;
        el.classList.toggle("is-on", on);
        el.setAttribute("aria-pressed", String(on));
      });
    };
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

  async function fetchRecommendationsPlan() {
    const hh = API.householdId || state.householdId;
    if (!hh) return null;
    await ensureMemberSession();
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

  async function ensurePlan() {
    const hh = API.householdId || state.householdId;
    if (!hh) return null;
    if (API.planId) return API.planId;
    const rec = await fetchRecommendationsPlan();
    if (rec) return rec;
    return null;
  }

  function selectMeal(id) {
    state.selectedMealId = id;
    state.activeRecipe = null;
    state.lifecycle = "Selected";
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
        if (voteRes && voteRes.status === "Selected" && voteRes.meal_option_id) {
          state.selectedMealId = voteRes.meal_option_id;
        } else if (voteRes && voteRes.waiting_on) {
          toast("Vote saved — waiting on others");
          return;
        }
      } else {
        await apiPost("/api/selections", {
          plan_id: planId,
          meal_option_id: id,
          household_id: hh,
          source: "app",
          actor_member_id: memberId,
        });
      }
      await ensureRecipeForSelection();
    })();
  }

  // —— Navigation ——
  app.addEventListener("click", (e) => {
    const spark = e.target.closest("[data-spark]");
    if (spark) {
      const id = spark.dataset.spark;
      const i = state.sparks.indexOf(id);
      if (i >= 0) state.sparks.splice(i, 1);
      else if (state.sparks.length < 3) state.sparks.push(id);
      else toast("Pick up to 3 — tap one off to swap");
      renderSparks();
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
      show(go.dataset.go);
    }
  });

  const detailTabs = document.getElementById("detailTabs");
  if (detailTabs) detailTabs.addEventListener("keydown", (e) => {
    const tabs = Array.from(detailTabs.querySelectorAll('[role="tab"]'));
    const i = tabs.indexOf(document.activeElement);
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
    if (go) show(go.dataset.go);
  });

  document.getElementById("btnCreateHh").addEventListener("click", async () => {
    state.householdName = document.getElementById("hhName").value.trim() || "Our kitchen";
    state.inviteCode = makeInviteCode();
    if (!state.members.length) {
      const label = state.householdName.split(/[&+,]/)[0].trim() || "You";
      const mid = "owner-" + randToken(4).toLowerCase();
      state.members.push({
        id: mid,
        name: label,
        initial: label[0].toUpperCase(),
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
      status: "Invited",
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
        status: "invited",
      });
    }
  });

  document.getElementById("btnSkipTaste").addEventListener("click", () => {
    state.sparks = [];
    show("invite");
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
    if (hh && (await apiProbe())) {
      const res = await apiPost("/api/invites", {
        household_id: hh,
        inviter_member_id: state.members[0] && state.members[0].id,
        channel: state.inviteChannel || "copy",
        invite_code: state.inviteCode,
      });
      if (res && res.invite_code) {
        state.inviteCode = res.invite_code;
        refreshInviteUi();
      }
    }
    track("invite_sent", {
      household_id: hh || state.householdId || "HH-demo",
      inviter_id: state.members[0]?.id,
      channel: state.inviteChannel,
      invite_code: state.inviteCode,
      utm_source: "share",
      utm_medium: state.inviteChannel === "sms" ? "sms" : "referral",
      utm_campaign: "alpha_warm",
    });
    state.lastTouch = state.inviteCode;
    const partner = state.members.find((m) => m.status === "Invited");
    if (partner) toast("Invite ready for " + partner.name);
    else toast("Invite sent");
    await ensureMemberSession();
    show("choices");
  });

  document.getElementById("btnSkipInvite").addEventListener("click", async () => {
    await ensureMemberSession();
    show("choices");
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
      toast("You’re signed into another kitchen — sign out first");
      reportClientError("invite", res.error, "cross household join blocked");
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
    await fetchRecommendationsPlan();
    toast(res.already_member ? "Welcome back" : "You’re in — diet limits saved");
    if (dest && dest !== location.pathname) history.replaceState(null, "", dest);
    show("choices");
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

  document.getElementById("btnPrevStep").addEventListener("click", () => {
    if (state.cookStep > 0) {
      state.cookStep -= 1;
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
    const leave = await confirmDialog({
      title: "Leave kitchen mode?",
      body: "Dinner isn’t marked as cooked yet. You can start cooking again from the recipe any time.",
      ok: "Exit",
      cancel: "Keep cooking",
    });
    if (leave) show("detail");
  });

  function startCooking(navigate) {
    if (!state.selectedMealId) {
      toast("Pick a meal from tonight’s options first");
      return false;
    }
    state.cookStep = 0;
    track("cook_started", {
      plan_id: API.planId || PLAN_ID,
      meal_option_id: state.selectedMealId,
    });
    if (navigate !== false) show("cook");
    return true;
  }

  document.getElementById("btnStartCook").addEventListener("click", (e) => {
    if (!startCooking(false)) e.stopImmediatePropagation();
  });

  app.addEventListener("click", (e) => {
    const scoreBtn = e.target.closest(".score[data-person]");
    if (scoreBtn) {
      const id = scoreBtn.dataset.person;
      const score = Number(scoreBtn.dataset.score);
      if (!state.ratings[id]) state.ratings[id] = { score: null, note: "" };
      state.ratings[id].score = score;
      const mealId = state.selectedMealId;
      if (!mealId) return;
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
    }
  });

  document.getElementById("btnSavePartial").addEventListener("click", () => {
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
    state.householdName = document.getElementById("settingsHhName").value.trim() || state.householdName;
    state.settingsChoiceCount = Number(document.getElementById("settingsChoiceCount").value) || 3;
    state.settingsCadence = document.getElementById("settingsCadence").value || "on_demand";
    const primary = state.members[0];
    await ensureMemberSession();
    await apiPatch("/api/households/" + encodeURIComponent(hh), {
      display_name: state.householdName,
      meal_choice_count: state.settingsChoiceCount,
      scheduling_cadence: state.settingsCadence,
      constraints: primary
        ? state.primaryConstraints
            .filter(function (k) {
              return k !== "none";
            })
            .map(function (rule_key) {
              return { member_id: primary.id, rule_key, status: "prohibited" };
            })
        : [],
    });
    toast("Settings saved — picks will reflect new limits");
    API.planId = null;
    state.currentMeals = null;
  });

  document.getElementById("btnSaveTasteCorrection").addEventListener("click", async function () {
    if (!state.tasteCorrectionSpark) {
      toast("Tap something you want more or less of");
      return;
    }
    await ensureMemberSession();
    await apiPost("/api/preference-evidence", {
      tag: state.tasteCorrectionSpark,
      kind: "like",
      source: "taste_correction",
    });
    toast("Got it — we’ll factor that into the next picks");
    state.tasteCorrectionSpark = null;
    renderTasteProfile();
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

  // Deep links: /share/* · /invite/* · /recover/* (+ legacy ?query)
  (async function bootFromQuery() {
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
    const restored = await restoreSession();
    if (restored) {
      const target =
        restored.next_action === "onboarding"
          ? onboardingResumeView(restored)
          : restored.next_view || "home";
      show(target);
      return;
    }
    show("welcome");
    syncHouseholdChrome();
  })();
})();
