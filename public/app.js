/**
 * Harbor Eats consumer prototype (product/prototype only — no competing tree)
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

  const PLAN_ID = "HE-2026-09-23-P01";
  const MEAL_A = "HE-2026-09-23-P01-A";

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
  /** Live product origin for share/invite links (FamilyPlate-class PLG). */
  const CANONICAL_ORIGIN = "https://harbor-eats-app.elephantharbor.workers.dev";

  function appBaseUrl() {
    // Always absolute to the live consumer product so a pasted link works
    // from SMS/iMessage — not guest-view-only, not host-relative to github.io.
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
    if (snap.selected_meal_option_id) state.selectedMealId = snap.selected_meal_option_id;
    if (snap.lifecycle) {
      state.lifecycle = snap.lifecycle === "Generated" ? "Unselected" : snap.lifecycle;
    }
    state.nextAction = snap.next_action || null;
    state.onboarded = snap.next_action !== "onboarding";
    if (snap.session) {
      rememberSessionIds(snap.session.household_id, snap.session.member_id);
    }
  }

  async function ensureMemberSession() {
    const hh = API.householdId || state.householdId;
    const primary = state.members[0];
    if (!hh || !primary) return false;
    const res = await apiPost("/api/sessions", {
      household_id: hh,
      member_id: primary.id,
    });
    if (res && res.ok) {
      rememberSessionIds(hh, primary.id);
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
        return null;
      }
      return j;
    } catch (e) {
      console.warn("[he-api]", path, e);
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
        return null;
      }
      return j;
    } catch (e) {
      console.warn("[he-api]", path, e);
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

  const meals = [
    {
      letter: "A",
      id: MEAL_A,
      title: "Crispy Chipotle Tofu Tacos",
      chips: ["Plant", "40 min", "Air fry"],
      plate: "🌮",
      tone: "tone-a",
      time: "40 min",
      effort: "Easy",
      pers: { type: "why", label: "Why this", line: "Fits both of you · crispy + taco night" },
    },
    {
      letter: "B",
      id: PLAN_ID + "-B",
      title: "Blackstone Miso-Ginger Salmon",
      chips: ["Fish", "35 min"],
      plate: "🐟",
      tone: "tone-b",
      time: "35 min",
      effort: "Medium",
      pers: { type: "new", label: "Trying something new", line: "A little adventure — miso-ginger fish" },
    },
    {
      letter: "C",
      id: PLAN_ID + "-C",
      title: "Coconut Chickpea Spinach Curry",
      chips: ["Plant", "40 min"],
      plate: "🍛",
      tone: "tone-c",
      time: "40 min",
      effort: "Easy",
      pers: { type: "favorite", label: "Returning favorite", line: "Familiar flavors both of you liked" },
    },
  ];

  const steps = [
    {
      title: "Press & season tofu",
      body: "Press tofu 10–15 min, cube into ¾-inch pieces, and pat dry. Toss with oil, cornstarch, chipotle, paprika, cumin, garlic powder, salt, and pepper until coated.",
      ings: ["14 oz extra-firm tofu", "1 tbsp oil", "1 tbsp cornstarch", "Chipotle + spices"],
    },
    {
      title: "Air fry until crisp",
      body: "Air fry at 400°F (200°C) for 14–18 minutes, shaking halfway, until edges are deep golden and crisp. Pan method: medium-high skillet 8–10 min, turning. Finish with juice of ½ lime.",
      ings: ["Seasoned tofu cubes", "Juice of ½ lime"],
    },
    {
      title: "Make the lime slaw",
      body: "Toss shredded cabbage, carrot, cilantro, lime juice, oil, optional maple, salt, and pepper. Rest 5 minutes so it softens slightly.",
      ings: ["3 cups cabbage", "½ cup carrot", "Cilantro", "Lime + oil"],
    },
    {
      title: "Warm tortillas",
      body: "Warm corn tortillas in a dry skillet 20–30 seconds per side until pliable and lightly toasted.",
      ings: ["6 small corn tortillas"],
    },
    {
      title: "Build & serve",
      body: "Build tacos: crispy tofu, lime slaw, avocado slices, lime wedges. Serve immediately. Hot sauce optional (check nut-free).",
      ings: ["Tofu", "Slaw", "Avocado", "Lime wedges"],
    },
  ];

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
  };
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
          `<span class="avatar${i === 0 ? " active" : ""}" title="${m.name} (${m.status})">${m.initial}</span>`
      )
      .join("");
    document.getElementById("brandSub").textContent = state.householdName || "Your kitchen";
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
    root.innerHTML = state.members
      .map(
        (m) => `
      <div class="member-row">
        <span class="avatar active">${m.initial}</span>
        <div class="grow">
          <div class="name">${m.name}</div>
          <div class="role">${m.status}</div>
        </div>
      </div>`
      )
      .join("");
  }

  function renderConstraintGrid(rootId, selectedIds, onToggle) {
    const root = document.getElementById(rootId);
    root.innerHTML = constraintOptions
      .map((c) => {
        const on = selectedIds.includes(c.id);
        return `<label class="${on ? "is-on" : ""}"><input type="checkbox" data-cid="${c.id}" ${on ? "checked" : ""} /> ${c.label}</label>`;
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
        return `<button type="button" class="chip chip-tog${on ? " is-on" : ""}" data-spark="${s.id}">${s.label}</button>`;
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
    const tones = { A: "tone-a", B: "tone-b", C: "tone-c" };
    const plates = { A: "🌮", B: "🐟", C: "🍲" };
    return options.map((o) => {
      const letter = o.letter || "A";
      return {
        letter,
        id: o.meal_option_id || o.id || (PLAN_ID + "-" + letter),
        title: o.title || o.name || ("Option " + letter),
        chips: Array.isArray(o.chips) && o.chips.length ? o.chips : ["Shared"],
        plate: o.plate || plates[letter] || "🍽️",
        tone: o.tone || tones[letter] || "tone-a",
        pers: o.pers || { type: "why", label: "Shared pick", line: "Someone shared these three with you" },
      };
    });
  }

  function guestMeals() {
    return state.sharedMeals && state.sharedMeals.length ? state.sharedMeals : meals;
  }

    function mealCardHtml(m, opts) {
    const { selected, goDetail } = opts || {};
    const go = goDetail ? ` data-go="detail" data-select="${m.id}"` : ` data-select="${m.id}"`;
    const tone = m.tone || "tone-a";
    const plate = m.plate || "🍽️";
    const time = m.time || (m.chips || []).find((c) => /min/i.test(c)) || "";
    const effort = m.effort || "";
    const metaBits = [];
    if (time) metaBits.push(`<span>${time}</span>`);
    if (effort) metaBits.push(`<span>${effort}</span>`);
    const meta = metaBits.length
      ? `<div class="option-meta" aria-label="Time and effort">${metaBits.join("")}</div>`
      : "";
    const selectedAttr = selected ? ' aria-pressed="true"' : ' aria-pressed="false"';
    return `
      <article class="option-card is-pickable${selected ? " selected-mark" : ""}" role="listitem" tabindex="0"${selectedAttr}${go} aria-label="Option ${m.letter}: ${m.title}">
        <div class="option-plate ${tone}" aria-hidden="true"><span class="letter-mini">${m.letter}</span><span>${plate}</span></div>
        <div class="option-body">
          <h2>${m.title}</h2>
          <div class="chips">${m.chips.map((c) => `<span class="chip">${c}</span>`).join("")}</div>
          ${meta}
          <span class="pers-chip ${persClass(m.pers.type)}">${m.pers.label}</span>
          <p class="why">${m.pers.line}</p>
        </div>
        <span class="chev" aria-hidden="true">›</span>
      </article>`;
  }

  function renderChoices() {
    document.getElementById("choiceCards").innerHTML = meals
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
    const hideChrome =
      name === "cook" ||
      name === "welcome" ||
      name === "shareGuest" ||
      name === "join";
    const hideTabs =
      hideChrome ||
      name === "finished" ||
      name === "loop" ||
      name === "create" ||
      name === "members" ||
      name === "constraints" ||
      name === "taste" ||
      name === "invite" ||
      name === "demo";
    topbar.classList.toggle("hidden", hideChrome);
    tabbar.classList.toggle("hidden", hideTabs);

    const tabMap = { home: "home", choices: "choices", detail: "home", invite: "invite", rate: "home" };
    tabbar.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("is-on", t.dataset.go === (tabMap[name] || name));
    });
    if (screenNav) {
      screenNav.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("is-on", b.dataset.go === name);
      });
    }

    const active = app.querySelector(".view.is-active .scroll");
    if (active) active.scrollTop = 0;

    renderProgressDots();
    syncAvatars();

    if (name === "members") renderMembers();
    if (name === "constraints") {
      document.getElementById("constraintFor").textContent = state.members[0]?.name || "Your";
      renderConstraintGrid("constraints", state.primaryConstraints);
      ensureMemberSession().catch(function () {});
    }
    if (name === "taste") renderSparks();
    if (name === "invite") {
      refreshInviteUi();
      document.getElementById("inviteAttrMeta").textContent =
        "For your kitchen only · ready to share";
    }
    if (name === "join") renderConstraintGrid("joinConstraints", state.joinConstraints);
    if (name === "choices") {
      renderChoices();
      if (state.shareReady) refreshShareUi();
      if (!state.onboarded) state.onboarded = true;
    }
    if (name === "shareGuest") {
      renderGuestChoices();
      track("share_choice_viewed", {
        share_object_id: state.shareObjectId,
        anon_or_member: "anon",
        plan_id: PLAN_ID,
      });
    }
    if (name === "cook") renderCook();
    if (name === "rate") renderRaters();
    if (name === "loop") renderLoopSummary();
    if (name === "home") updateHome();
    updateDebug();
  }

  function updateHome() {
    const pill = document.getElementById("homePill");
    const eye = document.getElementById("homeEyebrow");
    pill.textContent =
      state.lifecycle === "Unselected" ? "Ready"
      : state.lifecycle === "Selected" ? "Picked"
      : state.lifecycle === "Cooked" ? "Cooked"
      : state.lifecycle === "Rated" ? "Rated"
      : state.lifecycle;
    const nextHints = {
      pick_meal: "What should I do next? · Pick tonight’s meal",
      cook_meal: "What should I do next? · Start cooking",
      rate_meal: "What should I do next? · Rate what you cooked",
      start_choices: "What should I do next? · See your three picks",
      loop_complete: "Both of you rated",
    };
    eye.textContent =
      (state.nextAction && nextHints[state.nextAction])
        ? nextHints[state.nextAction]
        : state.lifecycle === "Rated"
        ? "Both of you rated"
        : state.lifecycle === "Cooked"
          ? "Cooked · waiting on ratings"
          : state.lifecycle === "Selected"
            ? "Ready to cook"
            : "Tonight’s picks";
    const meal = meals.find((m) => m.id === state.selectedMealId) || meals[0];
    document.getElementById("homeMealTitle").textContent = meal.title;
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
    const i = state.cookStep;
    const step = steps[i];
    const n = steps.length;
    document.getElementById("cookStepMeta").textContent = `${i + 1} / ${n}`;
    document.getElementById("cookStepLabel").textContent = `Step ${i + 1}`;
    document.getElementById("cookStepTitle").textContent = step.title;
    document.getElementById("cookStepBody").textContent = step.body;
    document.getElementById("cookIngList").innerHTML = step.ings.map((x) => `<li>${x}</li>`).join("");
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
      next.className = "btn btn-finish";
      next.dataset.action = "finish";
    } else {
      next.textContent = "Next";
      next.className = "btn btn-next";
      next.dataset.action = "next";
    }
  }

  function finishCook() {
    state.lifecycle = "Cooked";
    const mealId = state.selectedMealId || MEAL_A;
    track("cook_recorded", { plan_id: PLAN_ID, meal_option_id: mealId });
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
    root.innerHTML = state.members
      .map((m) => {
        const r = state.ratings[m.id] || { score: null, note: "" };
        const status = r.score
          ? `<span class="rater-status done">${r.score}/10</span>`
          : `<span class="rater-status">Waiting</span>`;
        const row = (from, to) =>
          Array.from({ length: to - from + 1 }, (_, i) => from + i)
            .map(
              (n) =>
                `<button type="button" class="score${r.score === n ? " is-picked" : ""}" data-person="${m.id}" data-score="${n}" aria-label="${m.name} rates ${n} out of 10" aria-pressed="${r.score === n}">${n}</button>`
            )
            .join("");
        return `
          <div class="rater-card">
            <div class="rater-head">
              <span class="avatar active">${m.initial}</span>
              <div><div class="rater-name">${m.name}</div>${status}</div>
            </div>
            <div class="score-row" role="group" aria-label="${m.name} scores 1 to 5">${row(1, 5)}</div>
            <div class="score-row" role="group" aria-label="${m.name} scores 6 to 10">${row(6, 10)}</div>
            <div class="anchors"><span>1 hard miss</span><span>5 fine</span><span>10 craving</span></div>
            <label class="field">
              <span>Note (optional)</span>
              <input type="text" data-note="${m.id}" placeholder="too spicy, make again…" value="${r.note ? escapeAttr(r.note) : ""}" />
            </label>
          </div>`;
      })
      .join("");
    syncRateButtons();
  }

  function bothRated() {
    if (state.members.length < 2) return false;
    return state.members.every((m) => state.ratings[m.id]?.score != null);
  }
  function anyRated() {
    return state.members.some((m) => state.ratings[m.id]?.score != null);
  }

  function syncRateButtons() {
    const submit = document.getElementById("btnSubmitRated");
    const hint = document.getElementById("rateHint");
    submit.disabled = !bothRated();
    if (bothRated()) {
      hint.textContent = "Both of you rated — tap submit to save.";
    } else if (anyRated()) {
      const missing = state.members
        .filter((m) => state.ratings[m.id]?.score == null)
        .map((m) => m.name)
        .join(", ");
      hint.textContent = `Waiting on ${missing}. You can save and finish later.`;
    } else {
      hint.textContent =
        "Each of you picks 1–10. Save a partial anytime — we wait for both.";
    }
    updateDebug();
  }

  function renderLoopSummary() {
    const ul = document.getElementById("loopSummary");
    ul.innerHTML = [
      "Picked tonight’s dinner",
      "Cooked it",
      ...state.members.map((m) => `${m.name} rated ${state.ratings[m.id].score}/10`),
    ]
      .map((t) => `<li><span class="ok">✓</span> ${t}</li>`)
      .join("");
    const loopAttr = document.getElementById("loopAttr");
    if (loopAttr) { loopAttr.hidden = true; loopAttr.textContent = ""; }
  }

  async function ensurePlan() {
    const hh = API.householdId || state.householdId;
    if (!hh) return null;
    if (API.planId) return API.planId;
    const res = await apiPost("/api/plans", {
      plan_id: PLAN_ID,
      household_id: hh,
      meal_options: meals.map((m) => ({
        letter: m.letter,
        meal_option_id: m.id,
        name: m.title,
      })),
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
    if (res && res.plan_id) {
      API.planId = res.plan_id;
      return res.plan_id;
    }
    return null;
  }

  function selectMeal(id) {
    state.selectedMealId = id;
    state.lifecycle = "Selected";
    track("selection_recorded", {
      plan_id: PLAN_ID,
      meal_option_id: id,
      source: "app",
    });
    (async () => {
      const planId = (await ensurePlan()) || PLAN_ID;
      const hh = API.householdId || state.householdId;
      if (!hh) return;
      await apiPost("/api/selections", {
        plan_id: planId,
        meal_option_id: id,
        household_id: hh,
        source: "app",
        actor_member_id: state.members[0] && state.members[0].id,
      });
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

    const go = e.target.closest("[data-go]");
    if (go && !go.disabled && !go.dataset.select) {
      e.preventDefault();
      show(go.dataset.go);
    }
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

  document.getElementById("btnAcceptInvite").addEventListener("click", () => {
    const code = document.getElementById("joinCode").value.trim() || state.inviteCode;
    const name = document.getElementById("joinName").value.trim() || "Partner";
    // Second diner sets OWN constraints — never inherit primary
    let member = state.members.find((m) => m.name.toLowerCase() === name.toLowerCase());
    if (!member) {
      member = {
        id: name.toLowerCase().replace(/\s+/g, "-"),
        name,
        initial: name[0].toUpperCase(),
        status: "Active",
      };
      state.members.push(member);
      state.ratings[member.id] = { score: null, note: "" };
    } else {
      member.status = "Active";
    }
    track("invite_accepted", {
      household_id: "HH-demo",
      member_id: member.id,
      invite_code: code,
      channel: "deep_link",
      own_constraints: state.joinConstraints.slice(),
      // Explicit: constraints are per-diner, not copied from primary
      inherited_primary_constraints: false,
    });
    state.lastTouch = code;
    toast("You’re in — diet limits saved");
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
        options: meals.map((m) => ({
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
    if (state.cookStep < steps.length - 1) {
      state.cookStep += 1;
      renderCook();
    }
  });

  document.getElementById("btnExitCook").addEventListener("click", () => {
    if (confirm("Exit without finishing? You can come back to cook later.")) {
      show("detail");
    }
  });

  document.getElementById("btnStartCook").addEventListener("click", () => {
    if (!state.selectedMealId) selectMeal(MEAL_A);
    state.cookStep = 0;
  });

  app.addEventListener("click", (e) => {
    const scoreBtn = e.target.closest(".score[data-person]");
    if (scoreBtn) {
      const id = scoreBtn.dataset.person;
      const score = Number(scoreBtn.dataset.score);
      if (!state.ratings[id]) state.ratings[id] = { score: null, note: "" };
      state.ratings[id].score = score;
      const mealId = state.selectedMealId || MEAL_A;
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
        household_id: "HH-demo",
        plan_id: PLAN_ID,
        attribution_last_touch: state.lastTouch,
      });
      show("loop");
      return;
    }
    updateDebug();
    toast(
      anyRated()
        ? "Saved — waiting on the other rating"
        : "Pick at least one person’s 1–10"
    );
    if (anyRated()) show("home");
  });

  document.getElementById("btnSubmitRated").addEventListener("click", () => {
    if (!bothRated()) return;
    state.lifecycle = "Rated";
    track("loop_completed", {
      household_id: "HH-demo",
      plan_id: PLAN_ID,
      meal_option_id: state.selectedMealId || MEAL_A,
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


  apiProbe().then(function (ok) {
    if (ok) console.info("[he-api] D1 live — write paths enabled");
    else console.info("[he-api] offline/unbound — in-memory only");
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
  })();
})();
