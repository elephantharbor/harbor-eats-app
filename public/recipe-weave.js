/* global window, document, fetch */
/**
 * Recipe adaptation Weave adapters (detail + kitchen sheet).
 */
(function (global) {
  const Weave = global.FlavorWeaveWeave;
  const Overlay = global.FlavorWeaveMealRecipe;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function typo(s) {
    return String(s || "").replace(/'/g, "’");
  }

  function apiPost(path, body, signal) {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
      signal,
    }).then((r) => r.json());
  }

  function recipeStarters(recipe, meal) {
    const out = [];
    const ingredients = (recipe && recipe.ingredients) || (meal && meal.pinned_ingredients) || [];
    const steps = (recipe && recipe.steps) || (meal && meal.pinned_steps) || [];
    const tags = (recipe && recipe.dietary_tags) || [];
    const methods = (recipe && recipe.methods) || [];
    const hasHeat = tags.some((t) => /spicy|heat|chili/i.test(t)) || ingredients.some((i) => /chili|pepper|hot/i.test(i.name));
    if (hasHeat) out.push({ label: "Less spicy", fill: "Make this less spicy." });
    const herb = ingredients.find((i) => /cilantro|parsley|basil|mint/i.test(i.name));
    if (herb) out.push({ label: "No " + herb.name, fill: "I don't have " + herb.name + "." });
    if (steps.length > 8 || ingredients.length > 12) out.push({ label: "Make it simpler", fill: "Make this simpler." });
    if (methods.some((m) => /air fryer/i.test(m)) || tags.some((t) => /air fryer/i.test(t))) {
      out.push({ label: "Use the air fryer", fill: "Can I use the air fryer?" });
    }
    out.push({ label: "Prep ahead?", fill: "What can I prep ahead?" });
    return out.slice(0, 4);
  }

  function applyScopeLabel(meal, deps) {
    if (!meal || !meal.dinner_plan) return null;
    const raw = deps.planMealById(meal.id || meal.meal_id);
    if (!raw) return "tonight's dinner";
    if (raw.scheduled_date) {
      try {
        const d = new Date(raw.scheduled_date + "T12:00:00");
        return d.toLocaleDateString(undefined, { weekday: "short" });
      } catch (_) {
        /* ignore */
      }
    }
    return "Dinner " + raw.position;
  }

  function noticeForResponse(data, deps, meal) {
    if (data.support === "rejected_safety") {
      const blocked = data.blocked && data.blocked[0];
      const name = blocked && (blocked.display_name || blocked.ingredient_id) || "That ingredient";
      return {
        kind: "status",
        style: "info",
        text: typo(name + " don't work for everyone eating " + (applyScopeLabel(meal, deps) || "this dinner") + ", so we'd leave that out."),
        actions: "",
      };
    }
    if (data.support === "unsupported" || data.kind === "unsupported" || data.equipment_supported === false) {
      return {
        kind: "status",
        style: "info",
        text: typo(
          data.acknowledgement ||
            "That pressure cooker is doing most of the work here. We'd stick with the original method for this one."
        ),
        actions: "",
      };
    }
    if (/double|for \d|amount|serving|people/i.test(data._requestText || "")) {
      const n = deps.dinerCountForMeal(meal);
      return {
        kind: "status",
        style: "info",
        text: "Amounts follow who's eating.",
        actions:
          '<button type="button" class="btn btn-quiet btn-sm weave-diner-inline" data-meal-id="' +
          esc(meal.id || meal.meal_id) +
          '">Cooking for ' +
          n +
          " · Change</button>",
      };
    }
    if (data.kind === "prep" || (data.step_notes && data.step_notes.length && !(data.ingredient_ops || []).length)) {
      return null;
    }
    return null;
  }

  function previewIngredientLine(data, meal, recipe, deps) {
    const op = (data.ingredient_ops || [])[0];
    if (!op) return null;
    const pin = Overlay.resolvedPin(depsRawMeal(meal, deps)) || { ingredients: (recipe && recipe.ingredients) || [] };
    const from = op.from_id
      ? pin.ingredients.find((i) => i.ingredient_id === op.from_id)
      : null;
    let newName = op.to_name;
    if (op.op === "remove") newName = null;
    const qty = from && from.quantity ? from.quantity + " " : "";
    return {
      newLine: newName ? qty + newName : "",
      oldLine: from ? from.name : "",
      stepNotes: (data.step_notes || []).map((n) => ({
        step: n.step_number,
        text: n.note,
      })),
      expect: data.expect_line || data.flavor_expect || null,
    };
  }

  function depsRawMeal(meal, deps) {
    if (!meal || !meal.dinner_plan) return meal;
    return deps.planMealById(meal.id || meal.meal_id) || meal;
  }

  function changeCardHtml(ctrl, deps, meal, recipe) {
    const data = ctrl.pendingAdaptation;
    if (!data || data._dismissed) return "";
    if (data._tipsOnly) {
      let tips = (data.step_notes || [])
        .slice(0, 3)
        .map(function (n) {
          return "<li>Step " + n.step_number + ": " + esc(typo(n.note)) + "</li>";
        })
        .join("");
      return (
        '<div class="weave-change weave-change--tips" role="group" aria-label="Tips">' +
        "<ul>" +
        tips +
        '</ul><div class="weave-change__actions"><button type="button" class="btn btn-primary btn-sm weave-adapt-gotit">Got it</button></div></div>'
      );
    }
    const preview = data._preview || previewIngredientLine(data, meal, recipe, deps);
    if (!preview && !(data.ingredient_ops || []).length) return "";
    const scope = applyScopeLabel(meal, deps);
    const inPlan = meal && meal.dinner_plan && deps.getDinnerPlan();
    let actions = "";
    if (inPlan && scope && preview && preview.newLine) {
      actions =
        '<button type="button" class="btn btn-primary btn-sm weave-adapt-apply">Apply to ' +
        esc(scope) +
        '</button><button type="button" class="btn btn-quiet btn-sm weave-adapt-dismiss">Not now</button>';
    } else if (preview && preview.newLine) {
      actions =
        '<p class="meta weave-change__note">Add it to your plan to keep this change.</p>' +
        '<button type="button" class="btn btn-primary btn-sm weave-adapt-gotit">Got it</button>';
    }
    const steps = (preview.stepNotes || [])
      .map(function (s) {
        return "<p class=\"weave-change__step\">Step " + s.step + " · " + esc(typo(s.text)) + "</p>";
      })
      .join("");
    const expect = preview.expect
      ? '<p class="weave-change__expect">Expect: ' + esc(typo(preview.expect)) + "</p>"
      : data.flavor_impact && data.flavor_impact !== "unknown"
        ? '<p class="weave-change__expect">Expect: ' + esc(typo(String(data.flavor_impact))) + ".</p>"
        : "";
    return (
      '<div class="weave-change" role="group" aria-label="Suggested change">' +
      '<p class="weave-change__title">Suggested change</p>' +
      (preview.newLine ? '<p class="weave-change__new">' + esc(preview.newLine) + "</p>" : "") +
      (preview.oldLine ? '<p class="weave-change__old">instead of ' + esc(preview.oldLine) + "</p>" : "") +
      steps +
      expect +
      '<div class="weave-change__actions">' +
      actions +
      "</div></div>"
    );
  }

  function createAdapter(surface, deps) {
    let weaveState = null;
    const adapter = {
      kind: surface === "recipeCook" ? "recipeCook" : "recipe",
      task: "recipe_adaptation",
      surface,
      regionLabel: "Change this recipe",
      headingVisible: surface === "recipe" ? "" : "Change this recipe",
      fieldLabel: "Change this recipe",
      placeholder: "What would you change?",
      enterkeyhint: "go",
      submitLabel: "Go",
      defaultExpanded: surface !== "recipe",
      defaultCollapsed: surface === "recipe",
      composerRole: "search",
      historyKey() {
        const meal = deps.currentMeal();
        return meal ? "recipe:" + (meal.id || meal.meal_id) : "recipe:anon";
      },
      getState() {
        return weaveState;
      },
      setState(s) {
        weaveState = s;
      },
      starters() {
        const meal = deps.currentMeal();
        const recipe = deps.currentRecipe();
        return recipeStarters(recipe, depsRawMeal(meal, deps));
      },
      serializeExtra(ctrl) {
        return { pending: ctrl.pendingAdaptation || null };
      },
      deserializeExtra(ctrl, extra) {
        if (extra && extra.pending) ctrl.pendingAdaptation = extra.pending;
      },
      setResultBusy(on) {
        const recipeEl = document.querySelector(".view.is-active[data-view='detail'] .recipe");
        if (recipeEl) recipeEl.classList.toggle("is-adapt-dim", !!on);
      },
      onComposerFocus() {
        const meal = deps.currentMeal();
        const count = deps.adaptationChangeCount(depsRawMeal(meal, deps));
        if (count > 0) adapter.placeholder = "Change anything else?";
      },
      renderAfterReply(ctrl) {
        const meal = deps.currentMeal();
        const recipe = deps.currentRecipe();
        return changeCardHtml(ctrl, deps, meal, recipe);
      },
      liveAnnouncement(ctrl) {
        const data = ctrl.pendingAdaptation;
        if (!data || !data._preview) return typo(ctrl.reply);
        const p = data._preview;
        return typo(ctrl.reply) + " Suggested change: " + (p.newLine || "") + (p.oldLine ? " instead of " + p.oldLine : "") + ".";
      },
      async interpret(text, { signal }) {
        const meal = deps.currentMeal();
        const recipe = deps.currentRecipe();
        if (!recipe) return { ok: false, error: "no_recipe" };
        const raw = depsRawMeal(meal, deps);
        const body = {
          text,
          recipe_slug: recipe.recipe_slug || raw.recipe_slug,
          recipe_version_id: recipe.recipe_version_id,
          dinner_plan_id: deps.getDinnerPlan() && deps.getDinnerPlan().dinner_plan_id,
          meal_id: raw && raw.meal_id,
          participant_ids: (raw && raw.participant_ids) || deps.activeMemberIds(),
        };
        deps.track("adaptation_requested", {
          recipe_slug: body.recipe_slug,
          kind: null,
          support: "advice",
        });
        const data = await apiPost("/api/recipes/adapt", body, signal);
        if (!data || !data.ok) return data || { ok: false };
        data._requestText = text;
        return {
          ok: true,
          acknowledgement: typo(data.acknowledgement || ""),
          source: "provider",
          state: weaveState,
          chips: [],
          _adaptRaw: data,
        };
      },
      async applyResult(data, ctrl) {
        const meal = deps.currentMeal();
        const recipe = deps.currentRecipe();
        const raw = data._adaptRaw || data;
        ctrl.pendingAdaptation = null;
        if (!raw || !raw.ok) return {};
        const notice = noticeForResponse(raw, deps, meal);
        if (notice) {
          ctrl.notice = notice;
          ctrl.pendingAdaptation = null;
          return {};
        }
        const tipsOnly =
          raw.kind === "prep" ||
          ((raw.step_notes || []).length && !(raw.ingredient_ops || []).filter(Boolean).length);
        raw._preview = previewIngredientLine(raw, meal, recipe, deps);
        raw._tipsOnly = tipsOnly;
        raw._dismissed = false;
        ctrl.pendingAdaptation = raw;
        deps.track("adaptation_requested", {
          recipe_slug: recipe && recipe.recipe_slug,
          kind: raw.kind,
          support: raw.support,
        });
        return {};
      },
      placeholderAfterApply() {
        adapter.placeholder = "Change anything else?";
      },
    };
    return adapter;
  }

  function mountDetail(deps) {
    const host = document.getElementById("detailWeaveHost");
    if (!host || !Weave) return null;
    const adapter = createAdapter("recipe", deps);
    const api = Weave.mount(host, adapter, deps);
    global.FlavorWeaveRecipeDetail = api;
    return api;
  }

  function mountCookSheet(deps) {
    const host = document.getElementById("cookWeaveHost");
    if (!host || !Weave) return null;
    const adapter = createAdapter("recipeCook", deps);
    const api = Weave.mount(host, adapter, deps);
    global.FlavorWeaveRecipeCook = api;
    return api;
  }

  function bindWeaveActions(deps) {
    document.addEventListener("click", function (e) {
      const apply = e.target.closest(".weave-adapt-apply");
      if (apply) {
        const host = apply.closest(".weave-strip");
        const meal = deps.currentMeal();
        const raw = depsRawMeal(meal, deps);
        const ctrl = host && host._weaveCtrl;
        const pending = ctrl && ctrl.pendingAdaptation;
        if (!raw || !pending) return;
        void deps.applyAdaptationFromAdvice(raw, pending, applyScopeLabel(meal, deps));
        return;
      }
      const dismiss = e.target.closest(".weave-adapt-dismiss");
      if (dismiss) {
        const host = dismiss.closest(".weave-strip");
        if (host && host._weaveCtrl) {
          host._weaveCtrl.pendingAdaptation = { _dismissed: true };
          const ui = global.FlavorWeaveRecipeDetail || global.FlavorWeaveRecipeCook;
          if (ui && ui.render) ui.render();
        }
      }
      const got = e.target.closest(".weave-adapt-gotit");
      if (got) {
        const host = got.closest(".weave-strip");
        if (host && host._weaveCtrl) {
          host._weaveCtrl.pendingAdaptation = null;
          const ui = global.FlavorWeaveRecipeDetail || global.FlavorWeaveRecipeCook;
          if (ui && ui.render) ui.render();
        }
      }
      const diner = e.target.closest(".weave-diner-inline");
      if (diner && deps.openParticipants) {
        deps.openParticipants(diner.dataset.mealId);
      }
    });
  }

  global.FlavorWeaveRecipeAdapt = {
    mountDetail,
    mountCookSheet,
    bindWeaveActions,
    applyScopeLabel,
    changeCardHtml,
  };
})(window);
