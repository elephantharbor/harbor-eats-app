/**
 * Harbor Eats consumer prototype (product/prototype only — no competing tree)
 * Sample meal: HE-2026-09-23-P01-A Crispy Chipotle Tofu Tacos
 * Ratings: 1–10 dual per diner (Cora confirmed; 1–5 revoked). In-memory only.
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

  const INVITE_CODE = "HE-INV-HH001A";
  const SHARE_OBJECT_ID = "HE-SHARE-demo01";
  const PLAN_ID = "HE-2026-09-23-P01";
  const MEAL_A = "HE-2026-09-23-P01-A";

  /** Analytics stub — console + in-memory log; never invents loops */
  const analyticsLog = [];
  function track(event, props) {
    const row = { event, ts: new Date().toISOString(), ...props };
    analyticsLog.push(row);
    // eslint-disable-next-line no-console
    console.info("[he-analytics]", event, props || {});
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
      pers: { type: "why", label: "Why this", line: "Passes both locks · texture + format probe" },
    },
    {
      letter: "B",
      id: PLAN_ID + "-B",
      title: "Blackstone Miso-Ginger Salmon",
      chips: ["Fish", "35 min"],
      pers: { type: "new", label: "Trying something new", line: "Exploration — Blackstone finfish" },
    },
    {
      letter: "C",
      id: PLAN_ID + "-C",
      title: "Coconut Chickpea Spinach Curry",
      chips: ["Plant", "40 min"],
      pers: { type: "favorite", label: "Returning favorite", line: "Demo slot — high prior craving" },
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
    householdName: "Tom & Renata",
    members: [
      { id: "tom", name: "Tom", initial: "T", status: "Active" },
      { id: "renata", name: "Renata", initial: "R", status: "Invited" },
    ],
    primaryConstraints: ["dairy", "meat", "poultry", "shellfish", "nuts"],
    joinConstraints: ["shellfish"],
    sparks: [],
    inviteChannel: "share_sheet",
    inviteCode: INVITE_CODE,
    shareObjectId: SHARE_OBJECT_ID,
    selectedMealId: null,
    guestPick: null,
    lastTouch: "organic",
    ratings: {},
    onboarded: false,
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
    document.getElementById("brandSub").textContent = state.householdName || "Your household";
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

  function mealCardHtml(m, opts) {
    const { selected, goDetail } = opts || {};
    const go = goDetail ? ` data-go="detail" data-select="${m.id}"` : ` data-select="${m.id}"`;
    return `
      <article class="option-card is-pickable${selected ? " selected-mark" : ""}"${go}>
        <div class="letter">${m.letter}</div>
        <div class="option-body">
          <h2>${m.title}</h2>
          <div class="chips">${m.chips.map((c) => `<span class="chip">${c}</span>`).join("")}</div>
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
    document.getElementById("shareIdMeta").textContent = `share_object_id: ${state.shareObjectId} · plan ${PLAN_ID}`;
  }

  function renderGuestChoices() {
    document.getElementById("guestChoiceCards").innerHTML = meals
      .map((m) => mealCardHtml(m, { selected: state.guestPick === m.id }))
      .join("");
    document.getElementById("guestShareMeta").textContent = `${state.shareObjectId} · plan ${PLAN_ID}`;
  }

  function show(name) {
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
    screenNav.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("is-on", b.dataset.go === name);
    });

    const active = app.querySelector(".view.is-active .scroll");
    if (active) active.scrollTop = 0;

    renderProgressDots();
    syncAvatars();

    if (name === "members") renderMembers();
    if (name === "constraints") {
      document.getElementById("constraintFor").textContent = state.members[0]?.name || "Your";
      renderConstraintGrid("constraints", state.primaryConstraints);
    }
    if (name === "taste") renderSparks();
    if (name === "invite") {
      document.getElementById("inviteCodeDisplay").textContent = state.inviteCode;
      document.getElementById("inviteAttrMeta").textContent =
        `invite_code=${state.inviteCode} · channel=${state.inviteChannel} · utm_source=share · this HH only`;
    }
    if (name === "join") renderConstraintGrid("joinConstraints", state.joinConstraints);
    if (name === "choices") {
      renderChoices();
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
    pill.textContent = state.lifecycle === "Unselected" ? "Ready" : state.lifecycle;
    eye.textContent =
      state.lifecycle === "Rated"
        ? "Loop closed"
        : state.lifecycle === "Cooked"
          ? "Cooked · awaiting dual rate"
          : state.lifecycle === "Selected"
            ? "Selected · awaiting cook"
            : "Pick from choices";
    const meal = meals.find((m) => m.id === state.selectedMealId) || meals[0];
    document.getElementById("homeMealTitle").textContent = meal.title;
  }

  function updateDebug() {
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
    document.getElementById("cookProgress").innerHTML = steps
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
    track("cook_recorded", { plan_id: PLAN_ID, meal_option_id: state.selectedMealId || MEAL_A });
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
          ? `<span class="rater-status done">Rated ${r.score}/10</span>`
          : `<span class="rater-status">Not rated</span>`;
        const row = (from, to) =>
          Array.from({ length: to - from + 1 }, (_, i) => from + i)
            .map(
              (n) =>
                `<button type="button" class="score${r.score === n ? " is-picked" : ""}" data-person="${m.id}" data-score="${n}" aria-label="${m.name} ${n}">${n}</button>`
            )
            .join("");
        return `
          <div class="rater-card">
            <div class="rater-head">
              <span class="avatar active">${m.initial}</span>
              <div><div class="rater-name">${m.name}</div>${status}</div>
            </div>
            <div class="score-row" role="group" aria-label="${m.name} 1–5">${row(1, 5)}</div>
            <div class="score-row" role="group" aria-label="${m.name} 6–10">${row(6, 10)}</div>
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
      hint.textContent = "Both diners rated — submit to close the Completed Meal Loop.";
    } else if (anyRated()) {
      const missing = state.members
        .filter((m) => state.ratings[m.id]?.score == null)
        .map((m) => m.name)
        .join(", ");
      hint.textContent = `Partial OK — waiting on ${missing}. Stays Cooked until both rate 1–10.`;
    } else {
      hint.textContent =
        "Submit Rated when both have 1–10. Partial save keeps Cooked without claiming a loop.";
    }
    updateDebug();
  }

  function renderLoopSummary() {
    const ul = document.getElementById("loopSummary");
    ul.innerHTML = [
      "Presented → Selected",
      "Cooked",
      ...state.members.map((m) => `${m.name} rated ${state.ratings[m.id].score}/10`),
    ]
      .map((t) => `<li><span class="ok">✓</span> ${t}</li>`)
      .join("");
    document.getElementById("loopAttr").textContent = `attribution_last_touch: ${state.lastTouch}`;
  }

  function selectMeal(id) {
    state.selectedMealId = id;
    state.lifecycle = "Selected";
    track("selection_recorded", {
      plan_id: PLAN_ID,
      meal_option_id: id,
      source: "app",
    });
  }

  // —— Navigation ——
  app.addEventListener("click", (e) => {
    const spark = e.target.closest("[data-spark]");
    if (spark) {
      const id = spark.dataset.spark;
      const i = state.sparks.indexOf(id);
      if (i >= 0) state.sparks.splice(i, 1);
      else if (state.sparks.length < 3) state.sparks.push(id);
      else toast("Max 3 sparks — deselect one first");
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

  screenNav.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) show(go.dataset.go);
  });

  document.getElementById("btnCreateHh").addEventListener("click", () => {
    state.householdName = document.getElementById("hhName").value.trim() || "Household";
    track("household_created", { household_name: state.householdName });
    show("members");
  });

  document.getElementById("btnAddMember").addEventListener("click", () => {
    const input = document.getElementById("newMemberName");
    const name = input.value.trim();
    if (!name) return;
    if (state.members.length >= 4) {
      toast("Household unit max 4");
      return;
    }
    state.members.push({
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      initial: name[0].toUpperCase(),
      status: "Invited",
    });
    state.ratings[state.members[state.members.length - 1].id] = { score: null, note: "" };
    input.value = "";
    renderMembers();
    syncAvatars();
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
      `invite_code=${state.inviteCode} · channel=${state.inviteChannel} · utm_source=share`;
  });

  document.getElementById("btnSendInvite").addEventListener("click", () => {
    track("invite_sent", {
      household_id: "HH-demo",
      inviter_id: state.members[0]?.id,
      channel: state.inviteChannel,
      invite_code: state.inviteCode,
      utm_source: "share",
      utm_medium: state.inviteChannel === "sms" ? "sms" : "referral",
      utm_campaign: "alpha_warm",
    });
    state.lastTouch = state.inviteCode;
    const partner = state.members.find((m) => m.status === "Invited");
    if (partner) toast(`Invite sent · ${partner.name} is Invited`);
    else toast("Invite sent · HE-INV");
    show("choices");
  });

  document.getElementById("btnSkipInvite").addEventListener("click", () => {
    show("choices");
  });

  document.getElementById("btnAcceptInvite").addEventListener("click", () => {
    const code = document.getElementById("joinCode").value.trim() || INVITE_CODE;
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
    toast("You’re Active · own locks saved");
    show("choices");
  });

  document.getElementById("btnShareChoices").addEventListener("click", () => {
    track("share_choice_created", {
      plan_id: PLAN_ID,
      share_object_id: state.shareObjectId,
      member_id: state.members[0]?.id,
      utm_source: "share",
      utm_medium: "referral",
      utm_campaign: "alpha_warm",
    });
    state.lastTouch = state.shareObjectId;
    toast("Link ready · HE-SHARE (one plan’s A/B/C)");
    show("shareGuest");
  });

  document.getElementById("btnGuestSelect").addEventListener("click", () => {
    if (!state.guestPick) {
      toast("Pick A, B, or C first");
      return;
    }
    track("share_choice_acted", {
      share_object_id: state.shareObjectId,
      action: "select",
      meal_option_id: state.guestPick,
    });
    toast("Saved preference · join Active to cook & rate");
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
    if (confirm("Exit cook without finishing? Meal stays Selected (not Cooked).")) {
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
      track("rating_submitted", {
        person_id: id,
        score,
        scale: "1-10",
        meal_option_id: state.selectedMealId || MEAL_A,
        partial: !bothRated(),
      });
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
        ? "Partial saved · Cooked (not Rated until both 1–10)"
        : "Pick at least one diner’s 1–10"
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

  // Expose for QA
  window.__HE_ANALYTICS__ = analyticsLog;
  window.__HE_STATE__ = state;

  show("welcome");
})();
