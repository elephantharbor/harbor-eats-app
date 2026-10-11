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
  let scrollBeforeFocus = 0;
  let lastAuto = 0;
  let revealedForOpen = false;

  function headerBottom() {
    const header = document.querySelector(".app-header");
    if (!header) return 0;
    return header.getBoundingClientRect().bottom;
  }

  function reveal(form) {
    if (!form) return;
    if (!vv) {
      form.scrollIntoView({ block: "nearest" });
      return;
    }
    const r = form.getBoundingClientRect();
    const top = Math.max(vv.offsetTop, headerBottom()) + 12;
    const bottom = vv.offsetTop + vv.height - 12;
    const starters = form.parentElement?.querySelector(".weave-starters");
    const want = Math.min(r.bottom + (starters ? 44 : 0), r.top + (bottom - top));
    let dy = 0;
    if (r.top < top) dy = r.top - top;
    else if (want > bottom) dy = want - bottom;
    if (Math.abs(dy) > 2) {
      global.scrollBy({ top: dy, behavior: "auto" });
      lastAuto = global.scrollY;
    }
  }

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
    if (next && owner === "weave" && !revealedForOpen) {
      const form = el.closest?.(".weave-composer");
      if (form) reveal(form);
      revealedForOpen = true;
    }
    if (!next) revealedForOpen = false;
    if (next === open) return;
    const wasOpen = open;
    open = next;
    root.dataset.keyboard = open ? "open" : "";
    listeners.forEach((fn) => fn(open));
    if (wasOpen && !open) {
      if (Math.abs(global.scrollY - lastAuto) <= 2) {
        global.scrollTo(global.scrollX, scrollBeforeFocus);
      }
      setTimeout(() => {
        if (vv && vv.offsetTop > 0) global.scrollTo(global.scrollX, global.scrollY);
      }, 150);
    }
  }

  if (vv) {
    vv.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(measure, 50);
    });
  }
  document.addEventListener("focusin", (e) => {
    if (e.target?.matches?.(EDITABLE) && e.target.closest?.(".weave-composer__field")) {
      scrollBeforeFocus = global.scrollY;
    }
    measure();
  });
  document.addEventListener("focusout", () => setTimeout(measure, 350));

  if (!vv && global.matchMedia?.("(pointer: coarse)")?.matches) {
    document.addEventListener("focusin", (e) => {
      if (e.target?.closest?.(".weave-composer__field")) {
        scrollBeforeFocus = global.scrollY;
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
    reveal,
    afterSubmit(strip) {
      const done = () => {
        if (!strip) return;
        const r = strip.getBoundingClientRect();
        const viewBottom = vv ? vv.offsetTop + vv.height : global.innerHeight;
        if (r.top < (vv ? vv.offsetTop : 0) || r.top > viewBottom - 40) {
          strip.scrollIntoView({ block: "start" });
        }
      };
      if (open) {
        const unsub = global.FlavorWeaveKeyboard.onChange((isOpen) => {
          if (!isOpen) {
            unsub();
            done();
          }
        });
        setTimeout(() => {
          unsub();
          done();
        }, 400);
      } else {
        setTimeout(done, 50);
      }
    },
    collapseWhenClosed(field, form) {
      if (!field || !form || field.value.trim()) return;
      const wait = () => {
        if (global.FlavorWeaveKeyboard.isOpen()) {
          global.FlavorWeaveKeyboard.onChange((open) => {
            if (!open) form.classList.add("weave-composer--collapsed");
          });
        } else {
          form.classList.add("weave-composer--collapsed");
        }
      };
      wait();
    },
  };
})(window);
