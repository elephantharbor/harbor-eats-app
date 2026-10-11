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

  const COUNT_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen"];

  function countWord(n) {
    return COUNT_WORDS[n] || String(n);
  }

  function dinnersLabel(n) {
    return n + (n === 1 ? " dinner" : " dinners");
  }

  function dinnersNow(n) {
    return countWord(n) + (n === 1 ? " dinner now" : " dinners now");
  }

  /** A plan-count turn that built a plan finishes on plan review; the review strip picks it up here. */
  let planHandoff = null;

  const STARTER_UI = {
    plan_three_easy: { label: "Three easy dinners", fill: "Plan three easy dinners this week." },
    plan_fish_twice: { label: "Fish twice", fill: "Fish twice this week." },
    plan_lighter: { label: "Lighter this week", fill: "Plan three lighter, veggie-forward dinners." },
    plan_special: { label: "One special night", fill: "Make one night something special." },
    plan_two_veggie: { label: "Two veggie nights", fill: "Make two of them vegetarian." },
    plan_weeknight: { label: "Keep weeknights simple", fill: "Keep weeknights simple." },
    plan_weeknight_easy: { label: "Keep weeknights simple", fill: "Keep weeknights simple." },
    find_cozy: { label: "Something cozy", fill: "Something cozy" },
    find_summery: { label: "Something summery", fill: "Something summery" },
    find_fresh: { label: "Something fresh", fill: "Something fresh" },
    find_fresh_filling: { label: "Fresh but filling", fill: "Fresh but filling" },
    find_lighter: { label: "Lighter, veggie-forward", fill: "Something lighter and veggie-forward" },
    find_fish: { label: "Easy fish dinner", fill: "Easy fish dinner" },
    find_shrimp: { label: "Garlicky shrimp", fill: "Garlicky shrimp" },
    find_tofu: { label: "Spicy, with tofu", fill: "Spicy, with tofu" },
    find_lemony: { label: "Bright and lemony", fill: "Bright and lemony" },
  };

  /** Refetched on every mount: limits and diners can change between visits. */
  let weaveStarterRows = null;
  let weaveStarterFetch = null;
  function prefetchWeaveStarters() {
    if (weaveStarterFetch) return weaveStarterFetch;
    weaveStarterFetch = fetch("/api/weave/starters", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        weaveStarterRows = body?.ok === false ? [] : body?.starters || [];
      })
      .catch(() => {
        weaveStarterRows = [];
      })
      .then(() => {
        weaveStarterFetch = null;
        return weaveStarterRows;
      });
    return weaveStarterFetch;
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
    if (/\b(no|nothing|without|avoid|less|never)\b/.test(t)) return false;
    if (/\b(light|lighter|healthy|healthier|filling|hearty|comforting|summery|special|indulgent)\b/.test(t)) return false;
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
      onSuggest(text, ctrl, ui) {
        if (text === "Add a dinner") {
          void adapter.onCountStep(1, ctrl, ui);
          return true;
        }
        return false;
      },
      renderUnderstood(chips, ctrl) {
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
        const min = deps.minAllowedMealCount?.() ?? 1;
        const count = ctrl?.stepper?.count ?? p?.meal_count;
        const stepperState =
          p && p.meal_count > 1
            ? {
                count,
                busy: !!ctrl?.stepper?.busy,
                bump: !!ctrl?.stepper?.bump,
                disabledMinus: count <= min,
                disabledPlus: count >= 14,
              }
            : null;
        return Weave.chipListHtml(shown, prefHtml, stepperState ? { stepper: true, stepperState } : null);
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
        if (res?.state) weaveState = res.state;
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
        if (!choice || !positions.length || ctrl.choiceApplying) return;
        ctrl.choiceApplying = true;
        ctrl.choicePicked = positions.slice();
        ui.render?.();
        const threadTimer = setTimeout(() => ui.host?.classList.add("is-thread"), 400);
        const t0 = performance.now();
        let data = null;
        try {
          data = await apiPost("/api/plan/apply", {
            state: weaveState,
            slot_choice: { positions },
            dinner_plan_id: p?.dinner_plan_id,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            participant_ids: deps.activeMemberIds(),
          });
        } catch {
          data = null;
        } finally {
          clearTimeout(threadTimer);
          ui.host?.classList.remove("is-thread");
          ctrl.choiceApplying = false;
        }
        deps?.track?.("weave_slot_chosen", {
          reason: choice.reason,
          multi: !!choice.multi,
          positions_count: positions.length,
          provider_calls: 0,
          latency_ms: Math.round(performance.now() - t0),
        });
        if (!data?.ok) {
          if (!choice.multi) ctrl.choicePicked = [];
          ui.render?.();
          ui.announce?.("Couldn’t change that just now.");
          return;
        }
        weaveState = data.state;
        ctrl.choice = null;
        ctrl.choiceCopy = null;
        ctrl.choicePicked = [];
        await adapter.applyResult(data, ctrl);
        ui.settleWith({ ...data, echo: ctrl.echo });
      },
      choiceStillValid(choice) {
        const p = plan();
        if (!p) return false;
        const ids = new Set((p.meals || []).map((m) => m.meal_id));
        return (choice.candidates || []).every((row) => !row.meal_id || ids.has(row.meal_id));
      },
      onChoiceChip(btn, ctrl, ui) {
        const pos = Number(btn.getAttribute("data-choice-position"));
        const choice = ctrl.choice;
        if (!choice || !Number.isInteger(pos) || ctrl.choiceApplying) return;
        if (choice.multi) {
          const picked = new Set(ctrl.choicePicked || []);
          if (picked.has(pos)) picked.delete(pos);
          else picked.add(pos);
          ctrl.choicePicked = [...picked];
          ui.render();
          ui.host?.querySelector('.weave-choice__chip[data-choice-position="' + pos + '"]')?.focus({ preventScroll: true });
          return;
        }
        void adapter.resolveChoice([pos], ctrl, ui);
      },
      onChoiceApply(ctrl, ui) {
        const picked = ctrl.choicePicked || [];
        if (!picked.length || ctrl.choiceApplying) return;
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
        deps.openPlanDatesSheet?.();
      },
      async reresolveAfterDates(ctrl, ui) {
        if (!ctrl?.choice && !weaveState?.pending_slot) return;
        const p = plan();
        if (!p || !ctrl.echo) return;
        const res = await apiPost("/api/plan/reresolve-slot", {
          state: weaveState,
          text: ctrl.echo,
          dinner_plan_id: p.dinner_plan_id,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          participant_ids: deps.activeMemberIds(),
        });
        if (!res?.ok || res.action === "noop") return;
        if (res.action === "apply" && res.positions?.length) {
          await adapter.resolveChoice(res.positions, ctrl, ui);
          return;
        }
        if (res.action === "choice") {
          weaveState = res.state || weaveState;
          ctrl.choice = res.choice;
          ctrl.choiceCopy = res.choice_copy;
          ctrl.choicePicked = [];
          ctrl.choiceFocused = false;
          ctrl.state = "settled";
          ui.render();
          ui.persist();
        }
      },
      async onStepperUndo(ctrl, ui) {
        const snap = ctrl.stepperUndo;
        if (!snap || ctrl.stepper?.busy) return;
        if (ctrl.stepperUndoTimer) clearTimeout(ctrl.stepperUndoTimer);
        ctrl.stepper = { busy: true, count: snap.from };
        ui.render();
        let restored = false;
        try {
          await deps.mutateDinnerPlan({ op: "set_count", meal_count: snap.from });
          await deps.mutateDinnerPlan({
            op: "add_meal",
            kind: "recipe",
            recipe_version_id: snap.recipe_version_id,
            participant_ids: deps.activeMemberIds(),
          });
          restored = true;
          deps?.track?.("weave_count_stepped", {
            from: snap.to,
            to: snap.from,
            direction: "undo",
            provider_calls: 0,
            latency_ms: 0,
          });
        } catch {
          restored = false;
        } finally {
          ctrl.stepperUndo = null;
          const count = plan()?.meal_count ?? (restored ? snap.from : snap.to);
          ctrl.stepper = { count, bump: true };
          ctrl.chips = (ctrl.chips || []).map((c) => (c.id === "dinner_count" ? { ...c, label: dinnersLabel(count) } : c));
          if (restored) {
            ctrl.notice = null;
            ctrl.reply = typo(`${countWord(snap.from)} dinners again — ${snap.title} is back.`);
            ui.announce(`${snap.from} dinners. ${snap.title} is back.`);
          } else {
            ctrl.notice = { kind: "alert", style: "error", text: "Couldn't change that just now." };
          }
          ctrl.restoreStatic = true;
          ctrl.state = "settled";
          ui.render();
          ui.persist();
          deps.renderPlanReview();
          ui.host?.querySelector('.weave-stepper__btn[data-step="-1"]')?.focus({ preventScroll: true });
        }
      },
      async onCountStep(delta, ctrl, ui) {
        const p = plan();
        if (!p || ctrl.stepper?.busy || !ui) return;
        const from = p.meal_count;
        const to = from + delta;
        const min = deps.minAllowedMealCount?.() ?? 1;
        if (to < min || to > 14) {
          ctrl.notice = {
            kind: "status",
            style: "info",
            text: to > 14 ? "Plans go up to 14 dinners." : "Dinners you've already cooked stay on the plan.",
          };
          ui.render();
          ui.announce(typo(ctrl.notice.text));
          return;
        }
        const pressed = document.activeElement;
        ctrl.stepperUndo = null;
        if (ctrl.stepperUndoTimer) clearTimeout(ctrl.stepperUndoTimer);
        ctrl.stepper = { busy: true, count: to, bump: true };
        ctrl.notice = null;
        ctrl.stepperRetryDelta = delta;
        host.classList.add("is-stepping");
        const threadTimer = setTimeout(() => host.classList.add("is-thread"), 400);
        let removeSkeleton = function () {};
        if (delta > 0) removeSkeleton = deps.insertPlanMealSkeleton?.(to) || removeSkeleton;
        let removedMeal = null;
        if (delta < 0) {
          const meals = (p.meals || []).slice().sort((a, b) => b.position - a.position);
          removedMeal = meals.find((m) => m.state === "planned" && !m.starred);
          if (!removedMeal) {
            ctrl.stepper = { count: from };
            host.classList.remove("is-stepping", "is-thread");
            clearTimeout(threadTimer);
            ui.render();
            return;
          }
          await deps.fadeRemovePlanMealCard?.(removedMeal.meal_id);
        }
        ui.render();

        const t0 = performance.now();
        try {
          const data = await apiPost("/api/plan/count", {
            state: weaveState,
            dinner_count: to,
            dinner_plan_id: p.dinner_plan_id,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            participant_ids: deps.activeMemberIds(),
          });
          if (!data?.ok) throw new Error("count_failed");
          weaveState = data.state;
          if (delta > 0) {
            const slot = (data.preview?.slots || []).find((s) => s.position === to);
            if (!slot?.recipe_version_id) throw new Error("no_slot");
            await deps.mutateDinnerPlan({ op: "set_count", meal_count: to });
            await deps.mutateDinnerPlan({
              op: "add_meal",
              kind: "recipe",
              recipe_version_id: slot.recipe_version_id,
              participant_ids: deps.activeMemberIds(),
            });
            removeSkeleton();
            const title = slot.title || "a new dinner";
            ctrl.reply = typo(`${dinnersNow(to)} — ${title} joins the lineup.`);
            ui.announce(`${to} dinners. Added ${title}.`);
          } else {
            await deps.mutateDinnerPlan({ op: "remove_meal", meal_id: removedMeal.meal_id });
            await deps.mutateDinnerPlan({ op: "set_count", meal_count: to });
            const title = removedMeal.title || "that dinner";
            const line = typo(`${dinnersNow(to)} — ${title} is off the plan.`);
            ctrl.notice = {
              kind: "status",
              style: "reply",
              text: line,
              actions: '<button type="button" class="btn btn-quiet btn-sm weave-undo-step">Undo</button>',
            };
            ctrl.reply = "";
            ctrl.stepperUndo = {
              from,
              to,
              title,
              recipe_version_id: removedMeal.recipe_version_id,
            };
            ctrl.stepperUndoTimer = setTimeout(() => {
              ctrl.stepperUndo = null;
              ctrl.notice = null;
              const typing = ui.host?.ownerDocument.activeElement?.closest?.(".weave-composer");
              if (typing) ui.host.querySelector(".weave-notice")?.remove();
              else ui.render();
              ui.persist();
            }, 6000);
            ui.announce(`${to} dinners. Removed ${title}.`);
          }
          deps?.track?.("weave_count_stepped", {
            from,
            to,
            direction: delta > 0 ? "+" : "-",
            provider_calls: 0,
            latency_ms: Math.round(performance.now() - t0),
          });
          ctrl.chips = data.chips || ctrl.chips;
          ctrl.restoreStatic = true;
          ctrl.state = "settled";
          ctrl.stepperRetryDelta = null;
          deps.renderPlanReviewPartial?.(delta > 0 ? [to] : []);
          if (delta <= 0) deps.renderPlanReview();
        } catch {
          removeSkeleton();
          ctrl.stepper = { count: from };
          ctrl.notice = {
            kind: "alert",
            style: "error",
            text: "Couldn't change that just now.",
            actions: '<button type="button" class="btn btn-quiet btn-sm weave-retry-step">Try again</button>',
          };
          deps.renderPlanReview();
        } finally {
          host.classList.remove("is-stepping", "is-thread");
          clearTimeout(threadTimer);
          ctrl.stepper = { count: plan()?.meal_count ?? to, bump: false };
          ui.render();
          ui.persist();
          const step = pressed?.getAttribute?.("data-step");
          const again = step ? ui.host?.querySelector('.weave-stepper__btn[data-step="' + step + '"]') : null;
          (again || pressed)?.focus?.({ preventScroll: true });
        }
      },
      async applyResult(data, ctrl, opts) {
        weaveState = data.state;
        if (opts?.chipOnly) return;
        const p = plan();
        const changed = data.changed_positions || [];
        const slots = data.preview?.slots || [];
        if (!p || (!changed.length && !slots.length)) return;
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
    const api = Weave.mount(host, adapter, deps);
    if (api) global.FlavorWeavePlanReview = api;
    return api;
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
