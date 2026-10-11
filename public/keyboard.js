/* global window, document */
(function (global) {
  const vv = global.visualViewport;
  const root = document.documentElement;
  const listeners = new Set();
  const OPEN = 150;
  const CLOSE = 80;
  const EDITABLE =
    'textarea, input:not([type=checkbox],[type=radio],[type=button],[type=submit],[type=range],[type=file],[type=color])';

  let base = 0;
  let width = 0;
  let open = false;
  let timer = null;

  function measure() {
    if (!vv || vv.scale > 1.01) return;
    if (vv.width !== width) {
      width = vv.width;
      base = vv.height;
    }
    base = Math.max(base, vv.height);
    const lost = base - vv.height;
    const el = document.activeElement;
    const focused = !!el?.matches?.(EDITABLE);
    const next = focused && (open ? lost > CLOSE : lost > OPEN);
    const owner = next ? (el.closest(".weave-strip") ? "weave" : "other") : "";
    root.dataset.keyboardOwner = owner;
    root.style.setProperty("--kb-inset", next ? lost + "px" : "0px");
    if (next === open) return;
    open = next;
    root.dataset.keyboard = open ? "open" : "";
    listeners.forEach((fn) => fn(open));
  }

  if (vv) {
    vv.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(measure, 50);
    });
  }
  document.addEventListener("focusin", measure);
  document.addEventListener("focusout", () => setTimeout(measure, 350));

  if (!vv && global.matchMedia?.("(pointer: coarse)")?.matches) {
    document.addEventListener("focusin", (e) => {
      if (e.target?.closest?.(".weave-composer__field")) {
        open = true;
        root.dataset.keyboard = "open";
        root.dataset.keyboardOwner = "weave";
        listeners.forEach((fn) => fn(true));
      }
    });
    document.addEventListener("focusout", (e) => {
      if (!e.target?.closest?.(".weave-composer__field")) return;
      setTimeout(() => {
        open = false;
        root.dataset.keyboard = "";
        root.dataset.keyboardOwner = "";
        root.style.setProperty("--kb-inset", "0px");
        listeners.forEach((fn) => fn(false));
      }, 350);
    });
  }

  global.FlavorWeaveKeyboard = {
    isOpen() {
      return open;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    measure,
  };
})(window);
