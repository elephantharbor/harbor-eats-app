/* global window, document, fetch, location */
/**
 * D-06 Weave adapters for Plan and Find surfaces.
 */
(function (global) {
  const Weave = global.FlavorWeaveWeave;

  function apiPost(path, body, signal) {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ schema_version: 1, ...body }),
      signal,
    }).then((r) => r.json());
  }

  function typo(s) {
    return String(s || "").replace(/'/g, "’");
  }

  /** A plan-count turn that built a plan finishes on plan review; the review strip picks it up here. */
  let planHandoff = null;

  const STARTER_UI = {
    plan_three_easy: { label: "Three easy dinners", fill: "Plan three easy dinners this week." },
    plan_fish_twice: { label: "Fish twice", fill: "Fish twice this week." },
    plan_lighter: { label: "Lighter this week", fill: "Plan three lighter, veggie-forward dinners." },
    plan_weeknight: { label: "Keep weeknights simple", fill: "Keep weeknights simple." },
    plan_weeknight_easy: { label: "Keep weeknights simple", fill: "Keep weeknights simple." },
    find_cozy: { label: "Something cozy", fill: "Something cozy" },
    find_fresh: { label: "Something fresh", fill: "Something fresh" },
    find_lighter: { label: "Lighter, veggie-forward", fill: "Something lighter and veggie-forward" },
    find_fish: { label: "Easy fish dinner", fill: "Easy fish dinner" },
    find_shrimp: { label: "Garlicky shrimp", fill: "Garlicky shrimp" },
    find_tofu: { label: "Spicy, with tofu", fill: "Spicy, with tofu" },
    find_lemony: { label: "Bright and lemony", fill: "Bright and lemony" },
  };

  let weaveStarterRows = null;
  async function prefetchWeaveStarters() {
    if (weaveStarterRows) return weaveStarterRows;
    try {
      const body = await fetch("/api/weave/starters", { credentials: "include" }).then((r) => r.json());
      weaveStarterRows = body.starters || [];
    } catch {
      weaveStarterRows = [];
    }
    return weaveStarterRows;
  }

  function startersFromApi(task) {
    const rows = (weaveStarterRows || []).filter((row) => row.task === task);
    return rows
      .map((row) => STARTER_UI[row.id] || { label: row.text, fill: row.text })
      .slice(0, 4);
  }

  function choiceCopyFromRow(choice, data) {
    if (data?.choice_copy) return data.choice_copy;
    if (!choice) return null;
    if (choice.reason === "ambiguous_day") {
      return { context: "", question: choice.prompt || "Which dinner did you mean?" };
    }
    const ctx = {
      undated: "Your dinners don't have days yet.",
      day_absent: "There's no " + (choice.asked || "that day") + " in this plan.",
      weekend_undated: "Your dinners don't have days yet.",
      weekend_absent: "There's no weekend in this plan.",
      multiple: "Which dinner did you mean?",
    };
    const q = {
      undated: "Which dinner did you mean?",
      day_absent: "Which dinner did you mean?",
      weekend_undated: "Which ones are the weekend?",
      weekend_absent: "Which dinners did you mean?",
      multiple: "Which dinner did you mean?",
    };
    return { context: ctx[choice.reason] || ctx.undated, question: q[choice.reason] || q.undated };
  }

  function classifyLiveSearch(text) {
    const t = String(text || "").trim().toLowerCase();
    if (!t) return false;
    if (t.split(/\s+/).length > 2) return false;
    if (/\b(something|cozy|easy|heavy|fresh|spicy|not|too|but|with|and)\b/.test(t)) return false;
    return true;
  }

  function planMountCount(deps) {
    const host = document.getElementById("planWeaveHost");
    if (!host || !Weave) return null;
    let weaveState = null;
    const adapter = {
      kind: "plan",
      task: "planning_intent",
      surface: "planCount",
      regionLabel: "Your request",
      headingVisible: "Your request",
      fieldLabel: "Describe your dinners",
      placeholder: "What should dinner look like this week?",
      enterkeyhint: "go",
      submitLabel: "Go",
      defaultExpanded: true,
      defaultCollapsed: false,
      composerRole: "search",
      historyKey() {
        return "plan_count";
      },
      getState() {
        return weaveState;
      },
      setState(s) {
        weaveState = s;
      },
      async prefetchStarters() {
        await prefetchWeaveStarters();
      },
      starters() {
        return startersFromApi("planning_intent");
      },
      suggestions() {
        return [];
      },
      conflictCopy(data) {
        const c = data.conflicts?.[0];
        if (!c) return data.acknowledgement;
        if (c.code === "slot_ambiguous") return "Your dinners don’t have days yet. Which one should be easier?";
        return data.acknowledgement;
      },
      liveAnnouncement(ctrl) {
        const n = ctrl.reply || "";
        const count = ctrl.chips.find((c) => c.id === "dinner_count");
        return typo(n) + (count ? " " + count.label + " ready." : "");
      },
      setResultBusy(on) {
        const opts = document.getElementById("planCountOptions");
        if (opts) opts.classList.toggle("weave-dimmed", on);
      },
      onComposerFocus() {
        const btn = document.getElementById("btnPlanCountSubmit");
        if (btn) btn.hidden = true;
      },
      onComposerBlur(text) {
        const btn = document.getElementById("btnPlanCountSubmit");
        if (btn) btn.hidden = !!(text && text.trim());
      },
      scrollToManual() {
        const opts = document.getElementById("planCountOptions");
        opts?.scrollIntoView({ behavior: Weave.REDUCED_MOTION ? "auto" : "smooth", block: "start" });
        opts?.querySelector(".plan-count-option")?.setAttribute("tabindex", "-1");
        opts?.querySelector(".plan-count-option")?.focus({ preventScroll: true });
      },
      async interpret(text, { signal }) {
        return apiPost(
          "/api/plan/interpret",
          {
            text,
            state: weaveState,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            participant_ids: deps.activeMemberIds(),
          },
          signal
        );
      },
      async applyChip(chipId) {
        return apiPost("/api/plan/apply", {
          state: weaveState,
          chip_id: chipId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          participant_ids: deps.activeMemberIds(),
        });
      },
      async applyResult(data, ctrl, opts) {
        weaveState = data.state;
        if (opts?.chipOnly) return;
        if (!data.preview || !data.state?.dinner_count) return;
        const commit = await apiPost("/api/plan/commit", {
          state: data.state,
          preview: data.preview,
          participant_ids: deps.activeMemberIds(),
          entry_point: "plan_dinners",
        });
        if (!commit?.ok) return { failed: true };
        planHandoff = { echo: ctrl.echo, data };
        try {
          deps.applyDinnerPlan(commit.plan, commit.unfilled);
          deps.show("planReview", {
            context: deps.navContextFor("planReview", "planCount", { established: true, mode: "compose", weave: true }),
          });
          deps.mountPlanReview();
        } finally {
          planHandoff = null;
        }
        return { handedOff: true };
      },
    };
    return Weave.mount(host, adapter, deps);
  }

  function planMountReview(deps) {
    const host = document.getElementById("planReviewWeaveHost");
    if (!host || !Weave) return null;
    let weaveState = null;
    const plan = () => deps.getDinnerPlan();
    const adapter = {
      kind: "planRefine",
      task: "planning_intent",
      surface: "planReview",
      regionLabel: "Your request",
      headingVisible: "Your request",
      fieldLabel: "Change your plan",
      placeholder: "Change anything?",
      enterkeyhint: "go",
      submitLabel: "Go",
      defaultExpanded: false,
      defaultCollapsed: true,
      composerRole: "none",
      historyKey() {
        const p = plan();
        return p ? "dinner_plan_id:" + p.dinner_plan_id : "plan_review";
      },
      getState() {
        return weaveState;
      },
      setState(s) {
        weaveState = s;
      },
      async prefetchStarters() {
        await prefetchWeaveStarters();
      },
      starters() {
        return [];
      },
      takeHandoff() {
        return planHandoff;
      },
      choiceCopy(choice, data) {
        return choiceCopyFromRow(choice, data);
      },
      clearPendingSlot() {
        if (weaveState?.pending_slot) {
          const next = { ...weaveState };
          delete next.pending_slot;
          weaveState = next;
        }
      },
      initialNext() {
        return adapter.suggestions({ state: { dinner_count: plan()?.meal_count } });
      },
      suggestions(data) {
        if (Array.isArray(data.suggestions) && data.suggestions.length) return data.suggestions.slice(0, 4);
        const out = [];
        const st = data.state || {};
        const count = st.dinner_count ?? plan()?.meal_count;
        if (count != null && count > 1) out.push("One more adventurous");
        out.push("All under 30 min");
        if (count != null && count < 14) out.push("Add a dinner");
        return out.slice(0, 4);
      },
      onSuggest(text, ctrl) {
        if (text === "Add a dinner") {
          void adapter.onCountStep(1, ctrl);
          return true;
        }
        return false;
      },
      renderUnderstood(chips) {
        const api = deps.planningApi();
        const prefs = plan()?.intent || {};
        const prefHtml = api ? api.chipHtml(prefs, "active") : "";
        const slot = document.getElementById("planReviewPrefs");
        if (slot) {
          slot.innerHTML = "";
          slot.hidden = true;
        }
        const shown = (chips || []).filter((c) => c.id !== "keep_it_easy" && c.id !== "keep_ingredients_simple");
        const p = plan();
        const stepper = p && p.meal_count > 1 ? { stepper: true, stepperCount: p.meal_count } : null;
        return Weave.chipListHtml(shown, prefHtml, stepper);
      },
      setResultBusy(on) {
        const list = document.getElementById("planMealCards");
        if (list) list.classList.toggle("weave-dimmed", on);
      },
      liveAnnouncement(ctrl) {
        const p = plan();
        const ready = ctrl.turn === 0 && p ? " " + p.meal_count + (p.meal_count === 1 ? " dinner" : " dinners") + " ready." : "";
        return typo(ctrl.reply || "") + ready;
      },
      async interpret(text, { signal }) {
        const p = plan();
        const res = await apiPost(
          "/api/plan/interpret",
          {
            text,
            state: weaveState,
            dinner_plan_id: p?.dinner_plan_id,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            participant_ids: deps.activeMemberIds(),
          },
          signal
        );
        return res && typeof res === "object" ? { ...res, echo: text } : res;
      },
      async applyChip(chipId) {
        const p = plan();
        deps?.track?.("weave_chip_edited", { task: "planning_intent", chip_id: chipId, op: "remove", provider_calls: 0 });
        return apiPost("/api/plan/apply", {
          state: weaveState,
          chip_id: chipId,
          dinner_plan_id: p?.dinner_plan_id,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          participant_ids: deps.activeMemberIds(),
        });
      },
      async resolveChoice(positions, ctrl, ui) {
        const p = plan();
        const choice = ctrl.choice;
        if (!choice || !positions.length) return;
        const t0 = performance.now();
        let data = null;
        if (choice.reason === "ambiguous_day") {
          data = await apiPost("/api/plan/interpret", {
            text: ctrl.echo,
            state: weaveState,
            target_position: positions[0],
            dinner_plan_id: p?.dinner_plan_id,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            participant_ids: deps.activeMemberIds(),
          });
        } else {
          data = await apiPost("/api/plan/apply", {
            state: weaveState,
            slot_choice: { positions },
            dinner_plan_id: p?.dinner_plan_id,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            participant_ids: deps.activeMemberIds(),
          });
          deps?.track?.("weave_slot_chosen", {
            reason: choice.reason,
            multi: !!choice.multi,
            positions_count: positions.length,
            provider_calls: 0,
            latency_ms: Math.round(performance.now() - t0),
          });
        }
        if (!data?.ok) return;
        weaveState = data.state;
        ctrl.choice = null;
        ctrl.choiceCopy = null;
        ctrl.choicePicked = [];
        await adapter.applyResult(data, ctrl);
        ui.settleWith({ ...data, echo: ctrl.echo });
      },
      onChoiceChip(btn, ctrl, ui) {
        const pos = Number(btn.getAttribute("data-choice-position"));
        const choice = ctrl.choice;
        if (!choice || !Number.isInteger(pos)) return;
        if (choice.multi) {
          const picked = new Set(ctrl.choicePicked || []);
          if (picked.has(pos)) picked.delete(pos);
          else picked.add(pos);
          ctrl.choicePicked = [...picked];
          ui.render();
          return;
        }
        void adapter.resolveChoice([pos], ctrl, ui);
      },
      onChoiceApply(ctrl, ui) {
        const picked = ctrl.choicePicked || [];
        if (!picked.length) return;
        void adapter.resolveChoice(picked, ctrl, ui);
      },
      onChoiceCancel(ctrl, ui) {
        const snap = ctrl.turnSnapshot;
        if (snap) {
          ctrl.echo = snap.echo || "";
          ctrl.reply = snap.reply || "";
          ctrl.chips = snap.chips || [];
          ctrl.next = snap.next || [];
          ctrl.choice = snap.choice || null;
          ctrl.choiceCopy = snap.choiceCopy || null;
          adapter.setState(snap.stateRef);
        } else {
          ctrl.choice = null;
          ctrl.choiceCopy = null;
        }
        ctrl.choicePicked = [];
        adapter.clearPendingSlot();
        ctrl.state = "settled";
        ui.render();
        ui.persist();
        ui.announce("Okay, nothing changed.");
        const heading = ui.host?.querySelector(".weave-strip__heading");
        heading?.focus({ preventScroll: true });
      },
      onChoiceAddDays() {
        document.getElementById("planDatesSheet")?.querySelector("button")?.click();
      },
      async onCountStep(delta, ctrl) {
        const p = plan();
        if (!p) return;
        const from = p.meal_count;
        const to = from + delta;
        if (to < 1 || to > 14) return;
        const t0 = performance.now();
        const data = await apiPost("/api/plan/count", {
          state: weaveState,
          dinner_count: to,
          dinner_plan_id: p.dinner_plan_id,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          participant_ids: deps.activeMemberIds(),
        });
        deps?.track?.("weave_count_stepped", {
          from,
          to,
          direction: delta > 0 ? "+" : "-",
          provider_calls: 0,
          latency_ms: Math.round(performance.now() - t0),
        });
        if (!data?.ok) return;
        weaveState = data.state;
        if (delta > 0) {
          const slot = (data.preview?.slots || []).find((s) => s.position === to);
          if (slot?.recipe_version_id) {
            await deps.mutateDinnerPlan({ op: "set_count", meal_count: to });
            await deps.mutateDinnerPlan({
              op: "add_meal",
              kind: "recipe",
              recipe_version_id: slot.recipe_version_id,
              participant_ids: deps.activeMemberIds(),
            });
          }
        } else {
          const meals = (p.meals || []).slice().sort((a, b) => b.position - a.position);
          const removable = meals.find((m) => m.state === "planned" && !m.starred);
          if (!removable) return;
          await deps.mutateDinnerPlan({ op: "remove_meal", meal_id: removable.meal_id });
          await deps.mutateDinnerPlan({ op: "set_count", meal_count: to });
        }
        ctrl.chips = data.chips || ctrl.chips;
        ctrl.reply = data.acknowledgement || ctrl.reply;
        ctrl.restoreStatic = true;
        ctrl.state = "settled";
        deps.renderPlanReview();
      },
      async applyResult(data, ctrl, opts) {
        weaveState = data.state;
        const p = plan();
        if (!p || !data.preview) return;
        const changed = data.changed_positions || [];
        if (!opts?.chipOnly && changed.length) {
          for (const pos of changed) {
            const meal = (p.meals || []).find((m) => m.position === pos);
            const slot = (data.preview.slots || []).find((s) => s.position === pos);
            if (!meal || !slot?.recipe_version_id) continue;
            await deps.mutateDinnerPlan({
              op: "swap_meal",
              meal_id: meal.meal_id,
              recipe_version_id: slot.recipe_version_id,
            });
          }
          deps.renderPlanReviewPartial(changed);
          const first = changed[0];
          const meal = (deps.getDinnerPlan()?.meals || []).find((m) => m.position === first);
          if (meal) deps.focusPlanMeal(meal.meal_id);
        } else if (!opts?.chipOnly) {
          deps.renderPlanReview();
        }
      },
    };
    return Weave.mount(host, adapter, deps);
  }

  function findMount(deps) {
    const host = document.getElementById("discWeaveHost");
    if (!host || !Weave) return null;
    let weaveState = null;
    let refine = false;
    const adapter = {
      kind: "find",
      task: "discovery_intent",
      surface: "find",
      regionLabel: "Looking for",
      headingVisible: "Looking for",
      fieldLabel: "Search or describe a dinner",
      placeholder: refine ? "Refine these…" : "What sounds good?",
      enterkeyhint: "search",
      submitLabel: "Search",
      defaultExpanded: true,
      defaultCollapsed: false,
      historyKey() {
        return "find:" + (location.pathname + location.search);
      },
      getState() {
        return weaveState;
      },
      setState(s) {
        weaveState = s;
      },
      async prefetchStarters() {
        await prefetchWeaveStarters();
      },
      starters() {
        if (refine) return [];
        return startersFromApi("discovery_intent");
      },
      suggestions(data) {
        if (Array.isArray(data.suggestions) && data.suggestions.length) return data.suggestions.slice(0, 4);
        const limits = deps.dinerLimits?.() || [];
        const out = ["Make it easier", "Something spicier"];
        if (!limits.includes("no_finfish")) out.unshift("Try fish");
        return out.slice(0, 4);
      },
      onSuggest(text, ctrl) {
        if (text === "Try fish" && (deps.dinerLimits?.() || []).includes("no_finfish")) return true;
        return false;
      },
      setResultBusy(on) {
        const main = document.getElementById("discMain");
        if (main) main.setAttribute("aria-busy", on ? "true" : "false");
      },
      onComposerInput(text) {
        if (classifyLiveSearch(text)) deps.discoveryLiveSearch(text);
      },
      liveAnnouncement(ctrl) {
        const n = typo(ctrl.reply || "");
        const total = deps.discoveryTotal?.() || "";
        return n + (total ? " " + total + (total === "1" ? " dinner." : " dinners.") : "");
      },
      renderUnderstood() {
        return "";
      },
      async interpret(text, { signal }) {
        const bypass = classifyLiveSearch(text);
        if (bypass) {
          const res = await deps.discoveryLiveSearch(text);
          return { ok: true, source: "bypass", chips: [], acknowledgement: null, state: weaveState, ...res };
        }
        refine = !!weaveState;
        return apiPost(
          "/api/discovery/interpret",
          {
            text,
            state: weaveState,
            mode: deps.discoveryMode(),
            context: deps.discoveryContext(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          signal
        );
      },
      async applyChip(chipId) {
        return apiPost("/api/discovery/apply", {
          state: weaveState,
          chip_id: chipId,
          mode: deps.discoveryMode(),
          context: deps.discoveryContext(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      },
      async applyResult(data, ctrl, opts) {
        weaveState = data.state;
        refine = true;
        adapter.defaultCollapsed = true;
        adapter.placeholder = "Refine these…";
        deps.discoveryApplyWeaveResponse(data, { chipOnly: !!opts?.chipOnly });
        deps.discoveryPaintChipsWeave(data.chips || []);
      },
      scrollToManual() {
        document.getElementById("discChips")?.scrollIntoView({ behavior: "smooth" });
      },
    };
    return Weave.mount(host, adapter, deps);
  }

  global.FlavorWeaveWeaveBridge = {
    planMountCount,
    planMountReview,
    findMount,
    classifyLiveSearch,
  };
})(window);
