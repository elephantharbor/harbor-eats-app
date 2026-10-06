/**
 * Where a child screen was opened from, and what that means for Back,
 * the active nav section, and app chrome.
 *
 * Contexts are plain JSON so a history-backed Back can store them in
 * history.state later without changing these rules.
 */
(function (root) {
  var SECTIONS = ["home", "choices", "find", "meals", "tasteProfile", "settings"];
  var ONBOARDING_STEPS = ["create", "members", "constraints", "taste"];
  var PLAN_VIEWS = ["planCount", "planReview", "planConfirm", "shopList"];
  var LABELS = {
    home: "Home",
    choices: "Tonight",
    find: "Find",
    meals: "History",
    tasteProfile: "Profile",
    settings: "Settings",
    finished: "Back",
    taste: "Back",
    planReview: "Back",
    planConfirm: "Back",
    planCount: "Back",
    shopList: "Back",
    tonightPlan: "Tonight",
  };
  // Screens that always live under Home, however you reached them.
  var HOME_CHILDREN = ["demo", "finished", "rate", "loop"];

  function isSection(view) {
    return SECTIONS.indexOf(view) >= 0;
  }

  function isPlanView(view) {
    return PLAN_VIEWS.indexOf(view) >= 0;
  }

  function isOnboardingStep(view) {
    return ONBOARDING_STEPS.indexOf(view) >= 0;
  }

  /**
   * @param {string} view target child view
   * @param {string|null} from view the user is leaving
   * @param {{ established?: boolean, parent?: string, current?: object|null, source?: string, origin?: string, mode?: string }} [opts]
   */
  function contextFor(view, from, opts) {
    var o = opts || {};
    if (view === "invite") {
      if (!o.established) return { origin: "taste", mode: "onboarding" };
      if (o.current && o.current.mode === "household" && (from === "invite" || from === null)) return o.current;
      return { origin: isSection(from) ? from : "home", mode: "household" };
    }
    if (view === "find") {
      return {
        mode: o.mode || "standalone",
        origin: o.origin || (isSection(from) ? from : "home"),
      };
    }
    if (view === "detail") {
      // Returning from kitchen mode keeps the context the recipe was opened with.
      if (o.current && (from === "cook" || from === "detail")) return o.current;
      if (o.origin === "find" || from === "find" || o.source === "discovery") {
        return { origin: "find", source: "discovery", mode: o.mode || (o.current && o.current.mode) };
      }
      if (o.origin === "planReview" || from === "planReview") {
        return { origin: "planReview", source: o.source || "dinner_plan" };
      }
      if (o.origin === "tonightPlan" || (from === "choices" && o.source === "tonight_plan")) {
        return { origin: "tonightPlan", source: "dinner_plan" };
      }
      var origin = isSection(from) ? from : o.parent || "home";
      return { origin: origin, source: o.source || (origin === "meals" ? "history" : "round") };
    }
    if (view === "rate") {
      if (from === "finished") return { origin: "finished" };
      if (o.origin === "tonightPlan" || from === "choices") return { origin: from === "choices" ? "tonightPlan" : o.origin || "home" };
      return { origin: isSection(from) ? from : "home" };
    }
    if (view === "planReview") {
      if (o.current && from === "planReview") return o.current;
      return { origin: o.origin || from || "home", mode: o.mode || "compose", star: !!o.star };
    }
    if (view === "planConfirm") {
      return { origin: "planReview", mode: "confirm" };
    }
    if (view === "planCount") {
      return { origin: "home", entry: o.entry || "plan_dinners" };
    }
    if (view === "shopList") {
      return { origin: o.origin || from || "planConfirm", mode: "shop" };
    }
    return null;
  }

  function backTarget(view, ctx) {
    if (view === "planCount") return "home";
    if (view === "planReview") {
      if (ctx && ctx.mode === "edit") return "choices";
      if (ctx && ctx.mode === "readonly") return "choices";
      return "home";
    }
    if (view === "planConfirm") return "planReview";
    if (view === "shopList") return "choices";
    if (view === "find" && ctx && ctx.mode !== "standalone") return ctx.origin || "home";
    if (view === "detail" && ctx && ctx.origin === "find") return "find";
    if (view === "detail" && ctx && ctx.origin === "planReview") return "planReview";
    if (view === "detail" && ctx && ctx.origin === "tonightPlan") return "choices";
    return (ctx && ctx.origin) || "home";
  }

  function backLabel(target) {
    return LABELS[target] || "Back";
  }

  /** Which primary nav item is lit. Null means none. */
  function navSection(view, ctx) {
    if (view === "find") return ctx && ctx.mode === "standalone" ? "find" : null;
    if (isSection(view)) return view;
    if (view === "detail" || view === "invite" || view === "rate") {
      var origin = ctx && ctx.origin;
      if (origin === "find") return ctx.mode === "standalone" ? "find" : null;
      if (origin === "tonightPlan") return "choices";
      if (isSection(origin)) return origin;
      if (origin === "finished" || origin === "planReview") return "home";
      return view === "invite" ? null : "home";
    }
    if (view === "planReview" && ctx && ctx.mode === "edit") return "choices";
    if (view === "shopList") return "choices";
    if (HOME_CHILDREN.indexOf(view) >= 0) return "home";
    return null;
  }

  /** full: header nav + tabs · focus: header nav only · brand: wordmark only · none: kitchen mode */
  function chrome(view, ctx) {
    if (view === "cook") return "none";
    if (view === "find" && ctx && ctx.mode !== "standalone") return "focus";
    if (isSection(view) || view === "demo") return "full";
    if (view === "invite") return ctx && ctx.mode === "household" ? "full" : "brand";
    if (view === "detail" || view === "rate") return "focus";
    if (view === "planCount" || view === "planConfirm") return "focus";
    if (view === "planReview") return ctx && (ctx.mode === "edit" || ctx.mode === "readonly") ? "full" : "focus";
    if (view === "shopList") return "focus";
    return "brand";
  }

  /** An established household never lands on a stale onboarding step. */
  function guardView(view, established) {
    if (established && isOnboardingStep(view)) return "home";
    return view;
  }

  root.FlavorWeaveNav = {
    SECTIONS: SECTIONS,
    ONBOARDING_STEPS: ONBOARDING_STEPS,
    PLAN_VIEWS: PLAN_VIEWS,
    isSection: isSection,
    isPlanView: isPlanView,
    isOnboardingStep: isOnboardingStep,
    contextFor: contextFor,
    backTarget: backTarget,
    backLabel: backLabel,
    navSection: navSection,
    chrome: chrome,
    guardView: guardView,
  };
})(typeof window !== "undefined" ? window : globalThis);
