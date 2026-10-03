/**
 * Where a child screen was opened from, and what that means for Back,
 * the active nav section, and app chrome.
 *
 * Contexts are plain JSON so a history-backed Back can store them in
 * history.state later without changing these rules.
 */
(function (root) {
  var SECTIONS = ["home", "choices", "meals", "tasteProfile", "settings"];
  var ONBOARDING_STEPS = ["create", "members", "constraints", "taste"];
  var LABELS = {
    home: "Home",
    choices: "Tonight",
    meals: "History",
    tasteProfile: "Profile",
    settings: "Settings",
    finished: "Back",
    taste: "Back",
  };
  // Screens that always live under Home, however you reached them.
  var HOME_CHILDREN = ["demo", "finished", "rate", "loop"];

  function isSection(view) {
    return SECTIONS.indexOf(view) >= 0;
  }

  function isOnboardingStep(view) {
    return ONBOARDING_STEPS.indexOf(view) >= 0;
  }

  /**
   * @param {string} view target child view
   * @param {string|null} from view the user is leaving
   * @param {{ established?: boolean, parent?: string, current?: object|null, source?: string }} [opts]
   */
  function contextFor(view, from, opts) {
    var o = opts || {};
    if (view === "invite") {
      if (!o.established) return { origin: "taste", mode: "onboarding" };
      if (o.current && o.current.mode === "household" && (from === "invite" || from === null)) return o.current;
      return { origin: isSection(from) ? from : "home", mode: "household" };
    }
    if (view === "detail") {
      // Returning from kitchen mode keeps the context the recipe was opened with.
      if (o.current && (from === "cook" || from === "detail")) return o.current;
      var origin = isSection(from) ? from : o.parent || "home";
      return { origin: origin, source: o.source || (origin === "meals" ? "history" : "round") };
    }
    if (view === "rate") {
      if (from === "finished") return { origin: "finished" };
      return { origin: isSection(from) ? from : "home" };
    }
    return null;
  }

  function backTarget(_view, ctx) {
    return (ctx && ctx.origin) || "home";
  }

  function backLabel(target) {
    return LABELS[target] || "Back";
  }

  /** Which primary nav item is lit. Null means none. */
  function navSection(view, ctx) {
    if (isSection(view)) return view;
    if (view === "detail" || view === "invite" || view === "rate") {
      var origin = ctx && ctx.origin;
      if (isSection(origin)) return origin;
      if (origin === "finished") return "home";
      return view === "invite" ? null : "home";
    }
    if (HOME_CHILDREN.indexOf(view) >= 0) return "home";
    return null;
  }

  /** full: header nav + tabs · focus: header nav only · brand: wordmark only · none: kitchen mode */
  function chrome(view, ctx) {
    if (view === "cook") return "none";
    if (isSection(view) || view === "demo") return "full";
    if (view === "invite") return ctx && ctx.mode === "household" ? "full" : "brand";
    if (view === "detail" || view === "rate") return "focus";
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
    isSection: isSection,
    isOnboardingStep: isOnboardingStep,
    contextFor: contextFor,
    backTarget: backTarget,
    backLabel: backLabel,
    navSection: navSection,
    chrome: chrome,
    guardView: guardView,
  };
})(typeof window !== "undefined" ? window : globalThis);
