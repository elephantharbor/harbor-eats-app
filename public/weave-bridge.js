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
      starters() {
        const starters = [
          { label: "Three easy dinners", fill: "Plan three easy dinners this week." },
          { label: "Fish twice", fill: "Fish twice this week." },
          { label: "Keep weeknights simple", fill: "Keep weeknights simple." },
          { label: "Make Friday special", fill: "Make Friday something special." },
        ];
        return starters;
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
      starters() {
        return [];
      },
      takeHandoff() {
        return planHandoff;
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
        if (count != null && count < 7) out.push("Add a dinner");
        return out.slice(0, 4);
      },
      conflictCopy(data) {
        const c = data.conflicts?.[0];
        if (c?.code === "slot_ambiguous") {
          const asked = String(data.echo || "").toLowerCase();
          return /eas(y|ier)/.test(asked)
            ? "Your dinners don’t have days yet. Which one should be easier?"
            : "Your dinners don’t have days yet. Which one did you mean?";
        }
        return data.acknowledgement;
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
        return Weave.chipListHtml(shown, prefHtml);
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
        return apiPost("/api/plan/apply", {
          state: weaveState,
          chip_id: chipId,
          dinner_plan_id: p?.dinner_plan_id,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          participant_ids: deps.activeMemberIds(),
        });
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
      starters() {
        if (refine) return [];
        return [
          { label: "Something cozy", fill: "Something cozy" },
          { label: "Easy fish dinner", fill: "Easy fish dinner" },
          { label: "Fresh but filling", fill: "Fresh but filling" },
          { label: "Spicy, with tofu", fill: "Spicy, with tofu" },
        ];
      },
      suggestions(data) {
        if (Array.isArray(data.suggestions) && data.suggestions.length) return data.suggestions.slice(0, 4);
        const out = ["Make it easier", "Try fish", "Something spicier"];
        return out.slice(0, 4);
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
