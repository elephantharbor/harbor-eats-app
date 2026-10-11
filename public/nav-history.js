/* global window, document, history, location, MutationObserver */
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

    function pushFrame(f, replace) {
      var url = location.pathname + location.search;
      if (replace) history.replaceState(f, "", url);
      else history.pushState(f, "", url);
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

    function handleBack() {
      var dlg = topOpenDialog();
      if (dlg) {
        dlg.close();
        if (history.state && history.state.fw && history.state.transient) {
          popping = true;
          history.back();
        }
        return true;
      }
      var st = hooks.getState();
      if (st.view === "detail" || st.view === "cook") {
        if (history.state && history.state.fw) {
          popping = true;
          history.back();
          return true;
        }
        restoreTaskParent({
          view: st.view,
          origin: (st.navContext && st.navContext.detail && st.navContext.detail.origin) || (st.navContext[st.view] && st.navContext[st.view].origin),
          restore: (history.state && history.state.restore) || {},
        });
        return true;
      }
      if (history.state && history.state.fw && history.state.origin) {
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
      if (event.state && event.state.transient) {
        var el = document.getElementById(event.state.transient);
        if (el && el.open) el.close();
        return;
      }
      if (event.state && event.state.fw) {
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
      }
    }

    function bindDialog(dialogId) {
      var el = document.getElementById(dialogId);
      if (!el) return;
      el.addEventListener("close", function () {
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

    return { init, handleBack, navigateForward, pushFrame, topOpenDialog };
  }

  root.FlavorWeaveNavHistory = { create: createNavHistory, TRANSIENT_DIALOGS };
})(typeof window !== "undefined" ? window : globalThis);
