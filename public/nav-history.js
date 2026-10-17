/* global window, document, history, location, MutationObserver, setTimeout */
/**
 * D-04 navigation frames mirrored in history.state.fw.
 */
(function (root) {
  var TRANSIENT_DIALOGS = [
    "confirmDialog",
    "discRefineSheet",
    "discAddPlanSheet",
    "swapSheet",
    "mealOptionsSheet",
    "participantsSheet",
    "askTableSheet",
    "planDatesSheet",
    "changeCountSheet",
    "cookAdaptSheet",
    "adaptChangesSheet",
    "shopLineSheet",
    "shopHowSheet",
    "newPlanSheet",
  ];

  function topOpenDialog() {
    for (var i = TRANSIENT_DIALOGS.length - 1; i >= 0; i--) {
      var el = document.getElementById(TRANSIENT_DIALOGS[i]);
      if (el && el.open) return el;
    }
    return null;
  }

  function frame(view, origin, restore, extra) {
    return Object.assign({ fw: 1, view: view, origin: origin || null, restore: restore || {} }, extra || {});
  }

  /**
   * @param {object} hooks
   * @param {() => object} hooks.getState
   * @param {(view: string, opts: object) => void} hooks.show
   * @param {object} hooks.Nav
   * @param {() => object|null} [hooks.getFindRestore]
   */
  function createNavHistory(hooks) {
    var popping = false;

    function pushFrame(f, replace, url) {
      var next = url || location.pathname + location.search;
      if (replace) history.replaceState(f, "", next);
      else history.pushState(f, "", next);
    }

    function navigateForward(view, opts) {
      var st = hooks.getState();
      var restore = {};
      if (view === "find" && hooks.getFindRestore) restore = hooks.getFindRestore() || {};
      if (opts && opts.restore) restore = opts.restore;
      var f = frame(view, (opts && opts.origin) || st.view, restore, {
        meal_id: opts && opts.meal_id,
        transient: opts && opts.transient,
      });
      pushFrame(f, opts && opts.replace);
      hooks.show(view, opts || {});
    }

    function restoreTaskParent(current) {
      var target = hooks.Nav.backTarget(current.view, {
        origin: current.origin,
        mode: current.restore && current.restore.mode,
        source: current.restore && current.restore.source,
      });
      var opts = { context: current.restore, force: true, skipHistory: true };
      if (current.view === "detail" && current.origin === "cook") {
        opts.context = Object.assign({}, current.restore, { origin: "cook" });
      }
      hooks.show(target, opts);
      if (current.restore && target === "find" && hooks.getFindRestore) {
        var Discovery = root.Discovery;
        if (Discovery && Discovery.restoreFromHistory) Discovery.restoreFromHistory(current.restore);
      }
    }

    var suppressDialogHistory = false;
    var handlingPop = false;
    var ONBOARDING = {
      welcome: 1,
      create: 1,
      members: 1,
      constraints: 1,
      taste: 1,
      invite: 1,
      join: 1,
    };

    function taskOrigin(st) {
      if (!st || !st.navContext) return null;
      if (st.navContext.detail && st.navContext.detail.origin) return st.navContext.detail.origin;
      var ctx = st.navContext[st.view];
      return ctx && ctx.origin;
    }

    /**
     * One guard entry so Android/browser Back stays in the app and runs the
     * same destination as the on-screen Back. Find owns its own history.
     * Home has no guard: Back from Home leaves.
     */
    function releaseHomeGuard() {
      var st = hooks.getState();
      if (!st || (st.view !== "home" && !ONBOARDING[st.view])) return;
      if (!(history.state && history.state.fwGuard)) return;
      var run = function () {
        if (!(history.state && history.state.fwGuard)) return;
        var current = hooks.getState();
        if (!current || (current.view !== "home" && !ONBOARDING[current.view])) return;
        popping = true;
        history.back();
      };
      if (handlingPop) setTimeout(run, 0);
      else run();
    }

    function armInAppBack() {
      var st = hooks.getState();
      if (!st || !st.view) return;
      if (st.view === "find") return;
      if (history.state && history.state.transient) return;
      if (st.view === "home" || ONBOARDING[st.view]) {
        if (history.state && history.state.find) {
          var dropFind = function () {
            if (!(history.state && history.state.find)) return;
            var current = hooks.getState();
            if (!current || (current.view !== "home" && !ONBOARDING[current.view])) return;
            popping = true;
            history.back();
          };
          if (handlingPop) setTimeout(dropFind, 0);
          else dropFind();
          return;
        }
        releaseHomeGuard();
        return;
      }
      if (history.state && history.state.find) {
        pushFrame(frame(st.view, taskOrigin(st), {}, { fwGuard: 1 }), true, "/");
        return;
      }
      if (history.state && history.state.fw && !history.state.fwGuard && history.state.view === st.view) return;
      if (history.state && history.state.fwGuard && history.state.view === st.view) return;
      var next = frame(st.view, taskOrigin(st), {}, { fwGuard: 1 });
      if (history.state && history.state.fwGuard) pushFrame(next, true);
      else pushFrame(next);
    }

    function logicalBack() {
      var st = hooks.getState();
      if (!st || ONBOARDING[st.view]) return;
      if (st.view === "detail" || st.view === "cook") {
        restoreTaskParent({
          view: st.view,
          origin: taskOrigin(st),
          restore: (history.state && history.state.restore) || {},
        });
        return;
      }
      if (st.view === "find") {
        var findCtx = st.navContext && st.navContext.find;
        if (findCtx && findCtx.mode && findCtx.mode !== "standalone") {
          hooks.show(findCtx.origin || "home", { skipHistory: true, force: true });
          return;
        }
      }
      if (hooks.Nav.isSection && hooks.Nav.isSection(st.view)) {
        if (st.view !== "home") hooks.show("home", { skipHistory: true, force: true });
        return;
      }
      var ctx = st.navContext && st.navContext[st.view];
      var target = hooks.Nav.backTarget(st.view, ctx || {});
      if (target && target !== st.view) {
        hooks.show(target, { skipHistory: true, force: true });
      }
    }

    function handleBack() {
      var dlg = topOpenDialog();
      if (dlg) {
        dlg.close();
        return true;
      }
      var st = hooks.getState();
      if (st.view === "detail" || st.view === "cook") {
        if (history.state && history.state.fw && !history.state.fwGuard) {
          popping = true;
          history.back();
          return true;
        }
        restoreTaskParent({
          view: st.view,
          origin: taskOrigin(st),
          restore: (history.state && history.state.restore) || {},
        });
        return true;
      }
      if (history.state && history.state.fw && history.state.origin && !history.state.fwGuard) {
        restoreTaskParent(history.state);
        popping = true;
        history.back();
        return true;
      }
      if (st.view !== "home" && hooks.Nav.isSection && hooks.Nav.isSection(st.view)) {
        hooks.show("home", { skipHistory: true });
        return true;
      }
      return false;
    }

    function onPopState(event) {
      if (popping) {
        popping = false;
        return;
      }
      handlingPop = true;
      try {
        // The browser already popped the transient entry. Close only the sheet.
        var dlg = topOpenDialog();
        if (dlg) {
          suppressDialogHistory = true;
          dlg.close();
          suppressDialogHistory = false;
          armInAppBack();
          return;
        }
        if (event.state && event.state.fw && !event.state.fwGuard && event.state.view && event.state.view !== "home") {
          var v = event.state.view;
          if (v === "find") {
            hooks.show("find", {
              context: hooks.Nav.contextFor("find", "detail", {
                mode: (event.state.restore && event.state.restore.mode) || "standalone",
                origin: "find",
              }),
              skipHistory: true,
              force: true,
            });
            if (event.state.restore && root.Discovery && root.Discovery.restoreFromHistory) {
              root.Discovery.restoreFromHistory(event.state.restore);
            }
            return;
          }
          hooks.show(v, { context: event.state.restore, skipHistory: true, force: true });
          return;
        }
        var st = hooks.getState();
        if (!st || st.view === "home" || st.view === "welcome" || ONBOARDING[st.view]) return;
        logicalBack();
        armInAppBack();
      } finally {
        handlingPop = false;
      }
    }

    function bindDialog(dialogId) {
      var el = document.getElementById(dialogId);
      if (!el) return;
      el.addEventListener("close", function () {
        if (suppressDialogHistory) return;
        if (history.state && history.state.transient === dialogId) {
          popping = true;
          history.back();
        }
      });
      var observer = new MutationObserver(function () {
        if (el.open && (!history.state || !history.state.transient)) {
          pushFrame(frame(hooks.getState().view, null, {}, { transient: dialogId }));
        }
      });
      observer.observe(el, { attributes: true, attributeFilter: ["open"] });
    }

    function init() {
      window.addEventListener("popstate", onPopState);
      TRANSIENT_DIALOGS.forEach(bindDialog);
      if (!history.state || !history.state.fw) {
        pushFrame(frame("home", null, {}), true);
      }
    }

    return { init, handleBack, navigateForward, pushFrame, topOpenDialog, armInAppBack };
  }

  root.FlavorWeaveNavHistory = { create: createNavHistory, TRANSIENT_DIALOGS };
})(typeof window !== "undefined" ? window : globalThis);
