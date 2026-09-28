/**
 * Harbor Eats vertical-slice prototype
 * Sample meal: HE-2026-09-23-P01-A Crispy Chipotle Tofu Tacos (real HH001 selection)
 * Ratings: prototype in-memory only — never invents ops metrics.
 */
(function () {
  const app = document.getElementById("app");
  const topbar = document.getElementById("topbar");
  const tabbar = document.getElementById("tabbar");
  const debug = document.getElementById("debug");
  const screenNav = document.getElementById("screenNav");

  /** N named members — design for N; HH001 shows 2 */
  const members = [
    { id: "tom", name: "Tom", initial: "T" },
    { id: "renata", name: "Renata", initial: "R" },
  ];

  const state = {
    view: "detail",
    lifecycle: "Selected", // Selected → Cooked → Rated
    cookStep: 0,
    ratings: Object.fromEntries(members.map((m) => [m.id, { score: null, note: "" }])),
  };

  /** Steps from recipes/crispy-chipotle-tofu-tacos/v1.md */
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

  function show(name) {
    state.view = name;
    app.querySelectorAll(".view").forEach((v) => {
      v.classList.toggle("is-active", v.dataset.view === name);
    });
    const hideChrome = name === "cook";
    topbar.classList.toggle("hidden", hideChrome);
    tabbar.classList.toggle("hidden", hideChrome || name === "finished" || name === "loop");

    const tabMap = { home: "home", choices: "choices", detail: "detail", cook: "detail", finished: "rate", rate: "rate", loop: "home" };
    tabbar.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("is-on", t.dataset.go === (tabMap[name] || name));
    });
    screenNav.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("is-on", b.dataset.go === name);
    });

    const active = app.querySelector(".view.is-active .scroll");
    if (active) active.scrollTop = 0;

    if (name === "cook") renderCook();
    if (name === "rate") renderRaters();
    if (name === "loop") renderLoopSummary();
    updateDebug();
  }

  function updateDebug() {
    const scores = members
      .map((m) => `${m.initial}:${state.ratings[m.id].score ?? "—"}`)
      .join(" ");
    debug.hidden = false;
    debug.textContent = `${state.lifecycle} · ${scores}`;
  }

  function renderCook() {
    const i = state.cookStep;
    const step = steps[i];
    const n = steps.length;
    document.getElementById("cookStepMeta").textContent = `${i + 1} / ${n}`;
    document.getElementById("cookStepLabel").textContent = `Step ${i + 1}`;
    document.getElementById("cookStepTitle").textContent = step.title;
    document.getElementById("cookStepBody").textContent = step.body;

    const list = document.getElementById("cookIngList");
    list.innerHTML = step.ings.map((x) => `<li>${x}</li>`).join("");

    const prog = document.getElementById("cookProgress");
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
    show("finished");
  }

  function renderRaters() {
    const root = document.getElementById("raterList");
    root.innerHTML = members
      .map((m) => {
        const r = state.ratings[m.id];
        const status = r.score
          ? `<span class="rater-status done">Rated ${r.score}</span>`
          : `<span class="rater-status">Not rated</span>`;
        const scores = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
          .map(
            (n) =>
              `<button type="button" class="score${r.score === n ? " is-picked" : ""}" data-person="${m.id}" data-score="${n}" aria-label="${m.name} score ${n}">${n}</button>`
          )
          .join("");
        return `
          <div class="rater-card" data-person="${m.id}">
            <div class="rater-head">
              <span class="avatar active">${m.initial}</span>
              <div>
                <div class="rater-name">${m.name}</div>
                ${status}
              </div>
            </div>
            <div class="score-row" role="group" aria-label="${m.name} rating 1 to 10">${scores}</div>
            <div class="anchors"><span>1 bad</span><span>5 fine</span><span>10 excellent</span></div>
            <label class="field">
              <span>Note (optional)</span>
              <input type="text" data-note="${m.id}" placeholder="too spicy, make again…" value="${r.note ? escapeAttr(r.note) : ""}" />
            </label>
          </div>`;
      })
      .join("");

    syncRateButtons();
  }

  function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function bothRated() {
    return members.every((m) => state.ratings[m.id].score != null);
  }

  function anyRated() {
    return members.some((m) => state.ratings[m.id].score != null);
  }

  function syncRateButtons() {
    const submit = document.getElementById("btnSubmitRated");
    const hint = document.getElementById("rateHint");
    submit.disabled = !bothRated();
    if (bothRated()) {
      hint.textContent = "Both diners rated — submit to close the Completed Meal Loop.";
    } else if (anyRated()) {
      const missing = members
        .filter((m) => state.ratings[m.id].score == null)
        .map((m) => m.name)
        .join(", ");
      hint.textContent = `Partial OK — still waiting on ${missing}. Lifecycle stays Cooked until both rate.`;
    } else {
      hint.textContent =
        "Submit Rated when both have scores. Partial save keeps Cooked without claiming a loop.";
    }
    updateDebug();
  }

  function renderLoopSummary() {
    const ul = document.getElementById("loopSummary");
    ul.innerHTML = [
      "Presented → Selected",
      "Cooked",
      ...members.map((m) => {
        const s = state.ratings[m.id].score;
        return `${m.name} rated ${s}/10`;
      }),
    ]
      .map((t) => `<li><span class="ok">✓</span> ${t}</li>`)
      .join("");
  }

  // —— Navigation ——
  app.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go && !go.disabled) {
      e.preventDefault();
      show(go.dataset.go);
      return;
    }
  });

  screenNav.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) show(go.dataset.go);
  });

  document.getElementById("btnPrevStep").addEventListener("click", () => {
    if (state.cookStep > 0) {
      state.cookStep -= 1;
      renderCook();
    }
  });

  document.getElementById("btnNextStep").addEventListener("click", (e) => {
    const action = e.currentTarget.dataset.action;
    if (action === "finish") {
      finishCook();
      return;
    }
    if (state.cookStep < steps.length - 1) {
      state.cookStep += 1;
      renderCook();
    }
  });

  document.getElementById("btnExitCook").addEventListener("click", () => {
    if (confirm("Exit cook without finishing? Meal will stay Selected (not Cooked).")) {
      show("detail");
    }
  });

  document.getElementById("btnStartCook").addEventListener("click", () => {
    state.cookStep = 0;
  });

  app.addEventListener("click", (e) => {
    const scoreBtn = e.target.closest(".score[data-person]");
    if (scoreBtn) {
      const id = scoreBtn.dataset.person;
      const score = Number(scoreBtn.dataset.score);
      state.ratings[id].score = score;
      renderRaters();
      return;
    }
  });

  app.addEventListener("input", (e) => {
    const note = e.target.closest("[data-note]");
    if (note) {
      state.ratings[note.dataset.note].note = note.value;
    }
  });

  document.getElementById("btnSavePartial").addEventListener("click", () => {
    if (state.lifecycle === "Selected") state.lifecycle = "Cooked";
    // Partial: stay Cooked even if 0–1 ratings
    if (bothRated()) {
      state.lifecycle = "Rated";
      show("loop");
      return;
    }
    updateDebug();
    alert(
      anyRated()
        ? "Partial ratings saved. Lifecycle: Cooked (not Rated until both diners score)."
        : "Nothing to save yet — pick at least one diner’s 1–10, or rate later from Home."
    );
    if (anyRated()) show("home");
  });

  document.getElementById("btnSubmitRated").addEventListener("click", () => {
    if (!bothRated()) return;
    state.lifecycle = "Rated";
    show("loop");
  });

  // Constraint chip toggle (stub)
  document.getElementById("constraints")?.addEventListener("change", (e) => {
    const label = e.target.closest("label");
    if (label) label.classList.toggle("is-on", e.target.checked);
  });

  // Boot on Recipe Detail (P0 entry for selected meal)
  show("detail");
})();
