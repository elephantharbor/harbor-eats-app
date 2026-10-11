/* global window, navigator, performance, sessionStorage, history, setTimeout, clearTimeout, AbortController */
/**
 * D-06 Weave strip — shared Plan / Find conversational UI.
 */
(function weaveUi(global) {
  const REDUCED = global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const STORAGE_TTL_MS = 30 * 60 * 1000;
  const REVEAL_STEP_MS = 45;
  const REVEAL_MAX_MS = 900;
  const WORD_FADE_MS = 80;
  const STILL_WEAVING_MS = 3000;
  const SLOW_MS = 8000;
  const GIVE_UP_MS = 20000;
  const COUNTER_FROM = 240;
  const MAX_CHARS = 280;
  const MAX_LINES = 4;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  /** Server copy uses straight apostrophes; the page shows typographic ones. */
  function typo(s) {
    return String(s || "").replace(/'/g, "’");
  }

  function chipListHtml(chips, extraHtml) {
    let html = '<div class="weave-understood-row"><ul class="weave-understood" aria-label="What we understood">';
    (chips || []).forEach((c) => {
      html +=
        '<li class="weave-chip"><span class="weave-chip__label">' +
        esc(c.label) +
        '</span><button type="button" class="weave-chip__remove" data-chip-id="' +
        esc(c.id) +
        '" aria-label="Remove ' +
        esc(c.label) +
        '"><svg class="icon" aria-hidden="true"><use href="#i-x" /></svg></button></li>';
    });
    html += "</ul>" + (extraHtml || "") + "</div>";
    return html;
  }

  function coarsePointer() {
    return !!global.matchMedia?.("(pointer: coarse)")?.matches;
  }

  function mount(host, adapter, deps) {
    if (!host) return null;
    const ctrl = {
      adapter,
      deps,
      state: "idle",
      echo: "",
      reply: "",
      chips: [],
      next: [],
      notice: null,
      fallback: false,
      abort: null,
      timers: [],
      restoreStatic: false,
      turn: 0,
      failures: 0,
      draft: "",
      listeners: new Set(),
    };

    host.className = "weave-strip weave-accent";
    host.setAttribute("aria-label", adapter.regionLabel || "Your request");
    host.innerHTML =
      '<p class="weave-strip__heading">' +
      esc(adapter.headingVisible || adapter.regionLabel) +
      '</p><div class="weave-live sr-only" role="status" aria-live="polite" aria-atomic="true"></div>' +
      '<div class="weave-body"></div>';
    const body = host.querySelector(".weave-body");
    const live = host.querySelector(".weave-live");

    function notify() {
      ctrl.listeners.forEach((fn) => fn(ctrl.state));
      adapter.onStateChange?.(ctrl);
    }

    function setBusy(on) {
      host.setAttribute("aria-busy", on ? "true" : "false");
      host.classList.toggle("is-working", !!on);
      adapter.setResultBusy?.(on);
    }

    function clearTimers() {
      ctrl.timers.forEach((t) => clearTimeout(t));
      ctrl.timers = [];
    }

    function persist() {
      const key = adapter.historyKey?.();
      if (!key) return;
      const payload = {
        adapter: adapter.kind,
        echo: ctrl.echo,
        reply: ctrl.reply,
        chips: ctrl.chips,
        next: ctrl.next,
        notice: ctrl.notice && ctrl.notice.kind === "status" ? { kind: "status", style: ctrl.notice.style, text: ctrl.notice.text } : null,
        stateRef: adapter.getState(),
        at: Date.now(),
      };
      try {
        sessionStorage.setItem("fw_weave:" + key, JSON.stringify(payload));
      } catch {
        /* ignore */
      }
      const st = history.state || {};
      history.replaceState({ ...st, weave: payload }, "");
    }

    function restoreFromCache() {
      const key = adapter.historyKey?.();
      if (!key) return false;
      let raw = null;
      try {
        raw = sessionStorage.getItem("fw_weave:" + key);
      } catch {
        return false;
      }
      if (!raw) return false;
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        return false;
      }
      if (!data.at || Date.now() - data.at > STORAGE_TTL_MS) return false;
      ctrl.restoreStatic = true;
      ctrl.echo = data.echo || "";
      ctrl.reply = data.reply || "";
      ctrl.chips = data.chips || [];
      ctrl.next = data.next || [];
      ctrl.notice = data.notice || null;
      adapter.setState?.(data.stateRef);
      ctrl.state = "settled";
      render();
      return true;
    }

    function clearCache() {
      const key = adapter.historyKey?.();
      if (!key) return;
      try {
        sessionStorage.removeItem("fw_weave:" + key);
      } catch {
        /* ignore */
      }
    }

    function settle() {
      if (ctrl.state === "settled") return;
      ctrl.state = "settled";
      const el = body.querySelector(".weave-reply");
      if (el) el.classList.add("is-done");
      notify();
    }

    function startReveal() {
      announce();
      persist();
      const words = ctrl.reply ? ctrl.reply.split(/\s+/) : [];
      if (!ctrl.reply || ctrl.restoreStatic || words.length <= 1) {
        ctrl.state = "settled";
        render();
        notify();
        return;
      }
      ctrl.state = "revealing";
      render();
      const step = Math.min(REVEAL_STEP_MS, Math.floor((REVEAL_MAX_MS - WORD_FADE_MS) / Math.max(1, words.length - 1)));
      const total = REDUCED ? 120 : step * (words.length - 1) + WORD_FADE_MS;
      const done = setTimeout(settle, total);
      ctrl.timers.push(done);
      const skip = (e) => {
        if (e?.target?.closest?.(".weave-composer")) return;
        clearTimeout(done);
        settle();
      };
      host.addEventListener("pointerdown", skip, { once: true });
      host.addEventListener("keydown", skip, { once: true });
    }

    function replyHtml() {
      const text = typo(ctrl.reply);
      if (ctrl.state !== "revealing" || REDUCED) {
        return '<p class="weave-reply' + (ctrl.state === "revealing" ? " is-fading" : " is-done") + '" aria-hidden="true">' + esc(text) + "</p>";
      }
      const words = text.split(/\s+/);
      const step = Math.min(REVEAL_STEP_MS, Math.floor((REVEAL_MAX_MS - WORD_FADE_MS) / Math.max(1, words.length - 1)));
      return (
        '<p class="weave-reply is-revealing" aria-hidden="true">' +
        words.map((w, i) => '<span class="weave-word" style="animation-delay:' + i * step + 'ms">' + esc(w) + "</span>").join(" ") +
        "</p>"
      );
    }

    function announce(text) {
      if (!live) return;
      live.textContent = "";
      const msg = text || adapter.liveAnnouncement?.(ctrl) || typo(ctrl.reply) || "";
      setTimeout(() => {
        live.textContent = msg;
      }, 30);
    }

    function render() {
      if (ctrl.fallback) {
        body.innerHTML = adapter.fallbackHtml?.() || "";
        return;
      }
      const working = ctrl.state === "working";
      const shown = ctrl.state === "settled" || ctrl.state === "revealing";
      let html = "";
      if (ctrl.echo && ctrl.state !== "composing") {
        html +=
          '<p class="weave-echo"><span class="weave-echo__text">“' +
          esc(ctrl.echo) +
          "”</span>" +
          (working ? "" : '<button type="button" class="btn btn-quiet btn-sm weave-echo__edit">Edit</button>') +
          "</p>";
      }
      if (ctrl.reply && shown) html += replyHtml();
      if (ctrl.notice) {
        const role = ctrl.notice.kind === "alert" ? "alert" : "status";
        html +=
          '<div class="weave-notice weave-notice--' +
          esc(ctrl.notice.style || "info") +
          '" role="' +
          role +
          '" tabindex="-1"><p class="weave-notice__text">' +
          esc(typo(ctrl.notice.text)) +
          "</p>" +
          (ctrl.notice.actions ? '<div class="weave-notice__actions">' + ctrl.notice.actions + "</div>" : "") +
          "</div>";
      }
      if (working) {
        html +=
          '<div class="weave-working"><div class="weave-mark weave-mark--working" aria-hidden="true"><span></span><span></span><span></span></div>' +
          '<div class="weave-working__copy"><p class="weave-working__label">Weaving that together…</p>' +
          '<p class="weave-working__slow" hidden>Taking longer than usual.</p></div>' +
          '<button type="button" class="btn btn-quiet btn-sm weave-cancel">Cancel</button></div>' +
          '<div class="weave-thread-line" aria-hidden="true"><span></span></div>';
      } else {
        const collapsed = adapter.defaultCollapsed && shown && !ctrl.draft;
        html += renderComposer(collapsed, ctrl.draft);
      }
      if (shown && adapter.renderUnderstood) {
        html += adapter.renderUnderstood(ctrl.chips, ctrl);
      } else if (shown && ctrl.chips.length) {
        html += chipListHtml(ctrl.chips);
      }
      if (shown && ctrl.next.length) {
        html += '<div class="weave-next" role="group" aria-label="Try next"' + (ctrl.draft ? " hidden" : "") + ">";
        ctrl.next.forEach((s) => {
          html += '<button type="button" class="chip-tog weave-next__btn" data-weave-suggest="' + esc(s) + '">' + esc(s) + "</button>";
        });
        html += "</div>";
      }
      if ((ctrl.state === "idle" || ctrl.state === "composing") && !ctrl.notice && adapter.starters?.().length) {
        html += '<div class="weave-starters" role="group" aria-label="Ideas">';
        adapter.starters().forEach((s) => {
          html += '<button type="button" class="chip-tog weave-starter" data-weave-starter="' + esc(s.fill) + '">' + esc(s.label) + "</button>";
        });
        html += "</div>";
      }
      body.innerHTML = html;
      bindInner();
    }

    function renderComposer(collapsed, value) {
      const role = adapter.composerRole || "search";
      const text = value || "";
      return (
        '<form class="weave-composer' +
        (collapsed ? " weave-composer--collapsed" : "") +
        '"' +
        (role === "none" ? "" : ' role="' + role + '"') +
        ">" +
        '<label class="sr-only" for="weaveField-' +
        esc(adapter.kind) +
        '">' +
        esc(adapter.fieldLabel) +
        '</label><div class="weave-mark" aria-hidden="true"><span></span><span></span><span></span></div>' +
        '<textarea id="weaveField-' +
        esc(adapter.kind) +
        '" class="weave-composer__field" rows="1" maxlength="' +
        MAX_CHARS +
        '" enterkeyhint="' +
        esc(adapter.enterkeyhint || "go") +
        '" placeholder="' +
        esc(adapter.placeholder) +
        '" autocapitalize="sentences" spellcheck="true" autocomplete="off">' +
        esc(text) +
        '</textarea><span class="weave-composer__count" aria-live="polite"' +
        (text.length >= COUNTER_FROM ? "" : " hidden") +
        ">" +
        (MAX_CHARS - text.length) +
        ' left</span><button type="submit" class="weave-composer__submit' +
        (text.trim() ? "" : " is-empty") +
        '" aria-label="' +
        esc(adapter.submitLabel || "Go") +
        '"><svg class="icon" aria-hidden="true"><use href="#i-arrow-right" /></svg></button></form>'
      );
    }

    function fieldEl() {
      return body.querySelector(".weave-composer__field");
    }

    function autogrow(field) {
      field.style.height = "auto";
      const line = parseFloat(global.getComputedStyle(field).lineHeight) || 24;
      const pad = field.offsetHeight - field.clientHeight;
      field.style.height = Math.min(field.scrollHeight + pad, line * MAX_LINES + 16) + "px";
    }

    function syncComposerChrome(field) {
      const form = field.closest(".weave-composer");
      const count = form?.querySelector(".weave-composer__count");
      const submitBtn = form?.querySelector(".weave-composer__submit");
      const len = field.value.length;
      if (count) {
        count.hidden = len < COUNTER_FROM;
        count.textContent = MAX_CHARS - len + " left";
      }
      submitBtn?.classList.toggle("is-empty", !field.value.trim());
      const next = body.querySelector(".weave-next");
      if (next) next.hidden = !!field.value.trim();
    }

    function focusField(caretEnd) {
      const f = fieldEl();
      if (!f) return;
      f.focus();
      if (caretEnd) f.setSelectionRange(f.value.length, f.value.length);
    }

    function expand() {
      ctrl.state = "composing";
      render();
      focusField(true);
    }

    function bindInner() {
      const form = body.querySelector(".weave-composer");
      const field = fieldEl();
      if (field) {
        autogrow(field);
        field.addEventListener("focus", () => {
          if (ctrl.state === "idle") {
            ctrl.state = "composing";
            notify();
          }
          adapter.onComposerFocus?.();
        });
        field.addEventListener("blur", () => {
          adapter.onComposerBlur?.(field.value);
        });
        field.addEventListener("input", () => {
          ctrl.draft = field.value;
          autogrow(field);
          syncComposerChrome(field);
          adapter.onComposerInput?.(ctrl.draft);
        });
        field.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            form?.requestSubmit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            if (field.value) {
              field.value = "";
              ctrl.draft = "";
              autogrow(field);
              syncComposerChrome(field);
              adapter.onComposerInput?.("");
            } else {
              field.blur();
              if (adapter.defaultCollapsed) {
                ctrl.state = "settled";
                render();
              }
            }
          }
        });
      }
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = (fieldEl()?.value || "").trim();
        if (!text) {
          focusField();
          return;
        }
        void submit(text);
      });
      body.querySelector(".weave-echo__edit")?.addEventListener("click", () => {
        ctrl.state = "composing";
        ctrl.draft = ctrl.echo;
        ctrl.restoreStatic = false;
        render();
        focusField(true);
      });
      body.querySelector(".weave-cancel")?.addEventListener("click", cancel);
      body.querySelectorAll("[data-weave-starter]").forEach((btn) => {
        btn.addEventListener("click", () => {
          ctrl.draft = btn.getAttribute("data-weave-starter") || "";
          ctrl.state = "composing";
          render();
          focusField(true);
          adapter.onComposerInput?.(ctrl.draft);
        });
      });
      body.querySelectorAll("[data-weave-suggest]").forEach((btn) => {
        btn.addEventListener("click", () => {
          void submit(btn.getAttribute("data-weave-suggest") || "");
        });
      });
      body.querySelectorAll("[data-chip-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          void removeChip(btn.getAttribute("data-chip-id"));
        });
      });
      body.querySelector(".weave-composer--collapsed")?.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        expand();
      });
      body.querySelector(".weave-notice-edit")?.addEventListener("click", () => {
        ctrl.notice = null;
        render();
        focusField(true);
      });
      body.querySelector(".weave-retry")?.addEventListener("click", () => {
        const text = ctrl.draft || ctrl.echo;
        ctrl.notice = null;
        if (text) void submit(text);
      });
      body.querySelector(".weave-manual")?.addEventListener("click", () => adapter.scrollToManual?.());
    }

    function cancel() {
      clearTimers();
      ctrl.abort?.abort();
      ctrl.state = "composing";
      ctrl.draft = ctrl.echo;
      ctrl.echo = "";
      setBusy(false);
      render();
      focusField(true);
      notify();
    }

    host.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && ctrl.state === "working") {
        e.preventDefault();
        cancel();
      }
    });

    function showNotice(notice, text) {
      clearTimers();
      ctrl.notice = notice;
      ctrl.state = "composing";
      ctrl.draft = text;
      setBusy(false);
      render();
      const el = body.querySelector(".weave-notice");
      if (notice.kind === "alert" && coarsePointer()) el?.focus();
      else if (notice.kind === "alert") focusField(true);
      notify();
    }

    function errorNotice() {
      if (navigator.onLine === false) {
        return {
          kind: "alert",
          style: "error",
          text: "You’re offline. Your words are saved here — try again when you’re back.",
          actions: '<button type="button" class="btn btn-quiet btn-sm weave-retry">Try again</button>',
        };
      }
      if (ctrl.failures >= 2) {
        return {
          kind: "alert",
          style: "error",
          text: "That’s not working right now. The options below still work.",
          actions: adapter.scrollToManual ? '<button type="button" class="btn btn-quiet btn-sm weave-manual">Use the options below</button>' : "",
        };
      }
      return {
        kind: "alert",
        style: "error",
        text: "That took longer than it should.",
        actions:
          '<button type="button" class="btn btn-quiet btn-sm weave-retry">Try again</button>' +
          (adapter.scrollToManual ? '<button type="button" class="btn btn-quiet btn-sm weave-manual">Use the options below</button>' : ""),
      };
    }

    /** Paint a validated response: chips, reply or conflict line, follow-ups, then the reveal. */
    function settleWith(data) {
      ctrl.chips = data.chips || [];
      ctrl.reply = data.acknowledgement || "";
      ctrl.next = adapter.suggestions?.(data) || [];
      ctrl.notice = null;
      if (data.conflicts?.length) {
        const line = adapter.conflictCopy?.(data) || ctrl.reply;
        ctrl.notice = line ? { kind: "status", style: "info", text: line } : null;
        ctrl.reply = "";
      }
      setBusy(false);
      startReveal();
    }

    async function submit(text) {
      clearTimers();
      ctrl.turn += 1;
      ctrl.restoreStatic = false;
      ctrl.notice = null;
      ctrl.echo = text;
      ctrl.draft = "";
      ctrl.state = "working";
      ctrl.abort = new AbortController();
      const signal = ctrl.abort.signal;
      fieldEl()?.blur();
      setBusy(true);
      render();
      notify();
      announce("Weaving that together…");
      ctrl.timers.push(
        setTimeout(() => {
          const label = body.querySelector(".weave-working__label");
          if (label) label.textContent = "Still weaving — nearly there.";
        }, STILL_WEAVING_MS),
        setTimeout(() => {
          const slow = body.querySelector(".weave-working__slow");
          if (slow) slow.hidden = false;
        }, SLOW_MS),
        setTimeout(() => ctrl.abort?.abort("timeout"), GIVE_UP_MS)
      );
      deps?.track?.("weave_submitted", { task: adapter.task, surface: adapter.surface, turn_index: ctrl.turn });
      const t0 = performance.now();
      try {
        const data = await adapter.interpret(text, { signal });
        if (signal.aborted) throw Object.assign(new Error("aborted"), { name: "AbortError" });
        const total = Math.round(performance.now() - t0);
        deps?.track?.("weave_result", {
          task: adapter.task,
          source: data.source,
          fallback_code: data.fallback_code || undefined,
          total_latency_ms: total,
        });
        if (!data.ok) throw new Error(data.error || "failed");
        if (data.fallback_code && !data.preview && !data.results) {
          const gentle = data.fallback_code === "rate_limited" || data.fallback_code === "budget_exceeded" || data.fallback_code === "provider_outage" || data.fallback_code === "provider_config";
          showNotice(
            gentle
              ? { kind: "status", style: "info", text: data.acknowledgement || "Typing a request isn’t available right now. Choose how many below." }
              : {
                  kind: "alert",
                  style: "error",
                  text: "Couldn’t quite make sense of that. Try saying it another way, or use the options below.",
                  actions: '<button type="button" class="btn btn-quiet btn-sm weave-notice-edit">Edit</button>',
                },
            text
          );
          if (gentle) adapter.scrollToManual?.();
          return;
        }
        clearTimers();
        const outcome = await adapter.applyResult(data, ctrl);
        ctrl.failures = 0;
        if (outcome?.handedOff) {
          ctrl.echo = "";
          ctrl.state = "idle";
          setBusy(false);
          clearCache();
          render();
          notify();
          return;
        }
        if (outcome?.failed) throw new Error("apply_failed");
        settleWith(data);
      } catch (e) {
        if (e?.name === "AbortError" && signal.reason !== "timeout") return;
        ctrl.failures += 1;
        ctrl.echo = "";
        showNotice(errorNotice(), text);
      }
    }

    /** Take over a turn that settled on another surface (plan count → plan review). */
    function seed(handoff) {
      if (!handoff?.data) return false;
      ctrl.echo = handoff.echo || "";
      ctrl.restoreStatic = false;
      adapter.setState?.(handoff.data.state);
      settleWith(handoff.data);
      return true;
    }

    async function removeChip(chipId) {
      deps?.track?.("weave_chip_edited", { task: adapter.task, chip_id: chipId, op: "remove" });
      setBusy(true);
      let data = null;
      try {
        data = await adapter.applyChip(chipId);
      } catch {
        data = null;
      }
      setBusy(false);
      if (!data?.ok) return;
      ctrl.chips = data.chips || [];
      ctrl.reply = data.acknowledgement || ctrl.reply;
      ctrl.restoreStatic = true;
      ctrl.state = "settled";
      await adapter.applyResult(data, ctrl, { chipOnly: true });
      ctrl.next = adapter.suggestions?.(data) || [];
      render();
      persist();
      notify();
    }

    render();
    const handoff = adapter.takeHandoff?.();
    if (!seed(handoff) && !restoreFromCache()) {
      ctrl.state = adapter.defaultExpanded ? "idle" : "settled";
      ctrl.next = adapter.initialNext?.() || [];
      render();
    }

    return {
      ctrl,
      submit,
      seed,
      removeChip,
      clearCache,
      restoreFromCache,
      render,
      onState(fn) {
        ctrl.listeners.add(fn);
        return () => ctrl.listeners.delete(fn);
      },
    };
  }

  global.FlavorWeaveWeave = { mount, chipListHtml, REDUCED_MOTION: REDUCED };
})(window);
