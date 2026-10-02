/**
 * FlavorWeave appearance themes — token swaps only (see styles.css theme blocks).
 * Loaded synchronously in <head> so the saved theme applies before first paint.
 *
 * Persistence: per-browser default + per-member override in localStorage.
 * `setStorageAdapter` is the seam for syncing preferences to the server later.
 */
(function () {
  var THEMES = [
    { id: "signature", name: "Signature", note: "Clean, warm and appetizing", canvas: "#FFFDF8", scheme: "light" },
    { id: "citrus-berry", name: "Citrus Berry", note: "Bright and energetic", canvas: "#FFF9F4", scheme: "light" },
    { id: "fresh-herb", name: "Fresh Herb", note: "Fresh and natural", canvas: "#FFFDF6", scheme: "light" },
    { id: "cobalt-coral", name: "Cobalt Coral", note: "Modern and bold", canvas: "#FBFCFF", scheme: "light" },
    { id: "dark", name: "Dark Mode", note: "Elegant for low light", canvas: "#101819", scheme: "dark" },
  ];
  var DEFAULT_THEME = "signature";
  var KEY = "fw_theme";
  var MEMBER_KEY_PREFIX = "fw_theme:";
  var LEGACY_MEMBER_KEY = "he_member_id";

  function byId(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return null;
  }

  function resolve(id) {
    return byId(id) ? id : DEFAULT_THEME;
  }

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  }
  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); } catch (_) { /* private mode */ }
  }

  var localAdapter = {
    read: function (memberId) {
      return (memberId && safeGet(MEMBER_KEY_PREFIX + memberId)) || safeGet(KEY);
    },
    write: function (themeId, memberId) {
      safeSet(KEY, themeId);
      if (memberId) safeSet(MEMBER_KEY_PREFIX + memberId, themeId);
    },
  };

  var adapter = localAdapter;
  var memberId = safeGet(LEGACY_MEMBER_KEY);
  var listeners = [];
  var current = null;

  function apply(id) {
    var themeId = resolve(id);
    var theme = byId(themeId);
    var root = document.documentElement;
    root.setAttribute("data-theme", themeId);
    root.style.colorScheme = theme.scheme;
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute("content", theme.canvas);
    var changed = current !== themeId;
    current = themeId;
    if (changed) {
      for (var j = 0; j < listeners.length; j++) {
        try { listeners[j](themeId); } catch (_) { /* listener errors never block theming */ }
      }
    }
    return themeId;
  }

  window.FlavorWeaveTheme = {
    themes: THEMES.slice(),
    defaultTheme: DEFAULT_THEME,
    resolve: resolve,
    current: function () { return current; },
    set: function (id) {
      var themeId = apply(id);
      adapter.write(themeId, memberId);
      return themeId;
    },
    /** Called when the signed-in member is known; applies their saved preference if any. */
    useMember: function (id) {
      memberId = id || null;
      var saved = adapter.read(memberId);
      if (saved) apply(saved);
      return current;
    },
    onChange: function (fn) {
      if (typeof fn === "function") listeners.push(fn);
    },
    setStorageAdapter: function (next) {
      adapter = next && next.read && next.write ? next : localAdapter;
    },
  };

  apply(adapter.read(memberId));
})();
