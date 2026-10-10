/* global window, document, fetch */
/**
 * D-06 Weave adapters for Plan and Find surfaces.
 */
(function (global) {
  const Weave = global.FlavorWeaveWeave;

  function apiPost(path, body) {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ schema_version: 1, ...body }),
    }).then((r) => r.json());
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
      starters() {
        const starters = [
          { label: "Three easy dinners", fill: "Plan three easy dinners this week." },
          { label: "Fish twice", fill: "Fish twice this week." },
          { label: "Keep weeknights simple", fill: "Keep weeknights simple." },
          { label: "Make Friday special", fill: "Make Friday something special." },
        ];
        return starters;
      },
      suggestions(data) {
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
        return n + (count ? " " + count.label + " ready." : "");
      },
      setResultBusy(on) {
        const opts = document.getElementById("planCountOptions");
        if (opts) opts.classList.toggle("weave-dimmed", on);
      },
      onComposerFocus() {
        const btn = document.getElementById("btnPlanCountSubmit");
        if (btn) btn.hidden = true;
      },
      onComposerInput(text) {
        const btn = document.getElementById("btnPlanCountSubmit");
        if (btn) btn.hidden = !!(text && text.trim());
      },
      scrollToManual() {
        document.getElementById("planCountOptions")?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      async interpret(text, { signal }) {
        return apiPost("/api/plan/interpret", {
          text,
          state: weaveState,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          participant_ids: deps.activeMemberIds(),
        });
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
        if (!commit?.ok) return;
        deps.applyDinnerPlan(commit.plan, commit.unfilled);
        deps.show("planReview", {
          context: deps.navContextFor("planReview", "planCount", { established: true, mode: "compose", weave: true }),
        });
        deps.mountPlanReview();
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
      placeholder: plan()?.meal_count === 1 ? "Change anything?" : "Change anything?",
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
      suggestions(data) {
        if (Array.isArray(data.suggestions) && data.suggestions.length) return data.suggestions.slice(0, 4);
        const out = [];
        const st = data.state || {};
        if (st.dinner_count != null && st.dinner_count < 7) out.push("Add another dinner");
        out.push("Keep everything under 30 min");
        out.push("Make one more adventurous");
        return out.slice(0, 4);
      },
      renderUnderstood(chips, ctrl) {
        const api = deps.planningApi();
        const prefs = plan()?.intent || {};
        const prefHtml = api ? api.chipHtml(prefs, "active") : "";
        let html = '<ul class="weave-understood" aria-label="What we understood">';
        chips.forEach((c) => {
          if (c.id === "keep_it_easy" || c.id === "keep_ingredients_simple") return;
          html +=
            '<li><span class="weave-chip">' +
            c.label +
            '</span><button type="button" class="weave-chip__remove" data-chip-id="' +
            c.id +
            '" aria-label="Remove ' +
            c.label +
            '">×</button></li>';
        });
        html += "</ul>";
        const slot = document.getElementById("planReviewPrefs");
        if (slot) {
          slot.innerHTML = prefHtml;
          slot.hidden = false;
        }
        return html;
      },
      setResultBusy(on) {
        const list = document.getElementById("planMealCards");
        if (list) list.classList.toggle("weave-dimmed", on);
      },
      liveAnnouncement(ctrl) {
        return ctrl.reply || "";
      },
      async interpret(text, { signal }) {
        const p = plan();
        return apiPost("/api/plan/interpret", {
          text,
          state: weaveState,
          dinner_plan_id: p?.dinner_plan_id,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          participant_ids: deps.activeMemberIds(),
        });
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
        const n = ctrl.reply || "";
        const total = deps.discoveryTotal?.() || "";
        return n + (total ? " " + total + " dinners." : "");
      },
      async interpret(text, { signal }) {
        const bypass = classifyLiveSearch(text);
        if (bypass) {
          const res = await deps.discoveryLiveSearch(text);
          return { ok: true, source: "bypass", chips: [], acknowledgement: null, state: weaveState, ...res };
        }
        refine = !!weaveState;
        const res = await apiPost("/api/discovery/interpret", {
          text,
          state: weaveState,
          mode: deps.discoveryMode(),
          context: deps.discoveryContext(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        return res;
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
