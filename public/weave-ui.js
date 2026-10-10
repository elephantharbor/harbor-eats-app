/* global window, performance, sessionStorage, history, clearInterval, setInterval, AbortController */
/**
 * D-06 Weave strip — shared Plan / Find conversational UI.
 */
(function weaveUi(global) {
  const REDUCED = global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const STORAGE_TTL_MS = 30 * 60 * 1000;

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
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
      revealTimer: null,
      restoreStatic: false,
      turn: 0,
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
      adapter.setResultBusy?.(on);
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

    function finishReveal() {
      if (ctrl.revealTimer) {
        clearInterval(ctrl.revealTimer);
        ctrl.revealTimer = null;
      }
      const el = body.querySelector(".weave-reply");
      if (el) {
        el.textContent = ctrl.reply;
        el.classList.add("is-done");
      }
    }

    function startReveal() {
      finishReveal();
      if (!ctrl.reply || ctrl.restoreStatic) {
        ctrl.state = "settled";
        render();
        announce();
        persist();
        notify();
        return;
      }
      ctrl.state = "revealing";
      render();
      announce();
      const el = body.querySelector(".weave-reply");
      if (!el) {
        ctrl.state = "settled";
        persist();
        notify();
        return;
      }
      const words = ctrl.reply.split(/\s+/);
      if (REDUCED || words.length <= 1) {
        el.textContent = ctrl.reply;
        el.classList.add("is-done");
        ctrl.state = "settled";
        persist();
        notify();
        return;
      }
      const maxMs = 900;
      const step = Math.min(45, Math.max(20, Math.floor(maxMs / words.length)));
      let i = 0;
      el.textContent = "";
      const skip = () => {
        finishReveal();
        ctrl.state = "settled";
        persist();
        notify();
        render();
      };
      host.addEventListener("click", skip, { once: true });
      host.addEventListener("keydown", skip, { once: true });
      ctrl.revealTimer = setInterval(() => {
        el.textContent = (el.textContent ? el.textContent + " " : "") + words[i];
        i += 1;
        if (i >= words.length) {
          finishReveal();
          ctrl.state = "settled";
          persist();
          notify();
        }
      }, step);
    }

    function announce() {
      if (!live) return;
      const msg = adapter.liveAnnouncement?.(ctrl) || ctrl.reply || "";
      live.textContent = msg;
    }

    function render() {
      if (ctrl.fallback) {
        body.innerHTML = adapter.fallbackHtml?.() || "";
        return;
      }
      let html = "";
      if (ctrl.echo && ctrl.state !== "composing") {
        html +=
          '<p class="weave-echo">“' +
          esc(ctrl.echo) +
          '” <button type="button" class="btn btn-quiet btn-sm weave-echo__edit">Edit</button></p>';
      }
      if (ctrl.reply && ctrl.state !== "working" && ctrl.state !== "composing") {
        html += '<p class="weave-reply" aria-hidden="true">' + (ctrl.restoreStatic ? esc(ctrl.reply) : "") + "</p>";
      }
      if (ctrl.notice) {
        const role = ctrl.notice.kind === "alert" ? "alert" : "status";
        html +=
          '<div class="weave-notice weave-notice--' +
          esc(ctrl.notice.style || "info") +
          '" role="' +
          role +
          '" tabindex="-1">' +
          esc(ctrl.notice.text) +
          (ctrl.notice.actions || "") +
          "</div>";
      }
      if (ctrl.state === "working") {
        html +=
          '<div class="weave-working"><div class="weave-mark weave-mark--working" aria-hidden="true"><span></span><span></span><span></span></div>' +
          '<p class="weave-working__label">Weaving that together…</p>' +
          '<button type="button" class="btn btn-quiet btn-sm weave-cancel">Cancel</button></div>' +
          '<div class="weave-thread-line" aria-hidden="true"></div>';
      } else if (!ctrl.fallback && (ctrl.state === "composing" || ctrl.state === "idle" || adapter.defaultExpanded || ctrl.state === "revealing" || ctrl.state === "settled")) {
        const collapsed = adapter.defaultCollapsed && ctrl.state === "settled" && !ctrl.draft;
        html += renderComposer(collapsed, ctrl.draft);
      }
      if ((ctrl.state === "settled" || ctrl.state === "revealing") && ctrl.chips.length && adapter.renderUnderstood) {
        html += adapter.renderUnderstood(ctrl.chips, ctrl);
      } else if ((ctrl.state === "settled" || ctrl.state === "revealing") && ctrl.chips.length) {
        html += '<ul class="weave-understood" aria-label="What we understood">';
        ctrl.chips.forEach((c) => {
          html +=
            '<li><span class="weave-chip">' +
            esc(c.label) +
            '</span><button type="button" class="weave-chip__remove" data-chip-id="' +
            esc(c.id) +
            '" aria-label="Remove ' +
            esc(c.label) +
            '">×</button></li>';
        });
        html += "</ul>";
      }
      if (ctrl.state === "settled" && ctrl.next.length) {
        html += '<div class="weave-next" role="group" aria-label="Try next">';
        ctrl.next.forEach((s) => {
          html +=
            '<button type="button" class="chip-tog weave-next__btn" data-weave-suggest="' +
            esc(s) +
            '">' +
            esc(s) +
            "</button>";
        });
        html += "</div>";
      }
      if ((ctrl.state === "idle" || ctrl.state === "composing") && adapter.starters?.().length) {
        html += '<div class="weave-starters" role="group" aria-label="Ideas">';
        adapter.starters().forEach((s) => {
          html +=
            '<button type="button" class="chip-tog weave-starter" data-weave-starter="' +
            esc(s.fill) +
            '">' +
            esc(s.label) +
            "</button>";
        });
        html += "</div>";
      }
      body.innerHTML = html;
      bindInner();
    }

    function renderComposer(collapsed, value) {
      const role = adapter.composerRole || "search";
      return (
        '<form class="weave-composer' +
        (collapsed ? " weave-composer--collapsed" : "") +
        '" role="' +
        role +
        '">' +
        '<label class="sr-only" for="weaveField">' +
        esc(adapter.fieldLabel) +
        '</label><div class="weave-mark" aria-hidden="true"><span></span><span></span><span></span></div>' +
        '<textarea id="weaveField" class="weave-composer__field" rows="1" maxlength="280" enterkeyhint="' +
        esc(adapter.enterkeyhint || "go") +
        '" placeholder="' +
        esc(adapter.placeholder) +
        '" autocapitalize="sentences" spellcheck="true" autocomplete="off">' +
        esc(value || "") +
        '</textarea><button type="submit" class="weave-composer__submit" aria-label="' +
        esc(adapter.submitLabel || "Go") +
        '"><svg class="icon" aria-hidden="true"><use href="#i-arrow-right" /></svg></button></form>'
      );
    }

    function bindInner() {
      const form = body.querySelector(".weave-composer");
      const field = body.querySelector("#weaveField");
      if (field) {
        field.addEventListener("focus", () => {
          ctrl.state = "composing";
          adapter.onComposerFocus?.();
          notify();
        });
        field.addEventListener("input", () => {
          ctrl.draft = field.value;
          adapter.onComposerInput?.(ctrl.draft);
        });
        field.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            form?.requestSubmit();
          }
        });
      }
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = (field?.value || "").trim();
        if (!text) return;
        void submit(text);
      });
      body.querySelector(".weave-echo__edit")?.addEventListener("click", () => {
        ctrl.state = "composing";
        ctrl.draft = ctrl.echo;
        ctrl.restoreStatic = false;
        render();
        body.querySelector("#weaveField")?.focus();
      });
      body.querySelector(".weave-cancel")?.addEventListener("click", () => {
        ctrl.abort?.abort();
        ctrl.state = "composing";
        ctrl.draft = ctrl.echo;
        setBusy(false);
        render();
      });
      body.querySelectorAll("[data-weave-starter]").forEach((btn) => {
        btn.addEventListener("click", () => {
          ctrl.draft = btn.getAttribute("data-weave-starter") || "";
          ctrl.state = "composing";
          render();
          const f = body.querySelector("#weaveField");
          if (f) {
            f.value = ctrl.draft;
            f.focus();
            f.setSelectionRange(f.value.length, f.value.length);
          }
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
        ctrl.state = "composing";
        render();
        body.querySelector("#weaveField")?.focus();
      });
    }

    async function submit(text) {
      ctrl.turn += 1;
      ctrl.restoreStatic = false;
      ctrl.notice = null;
      ctrl.echo = text;
      ctrl.draft = "";
      ctrl.state = "working";
      ctrl.abort = new AbortController();
      setBusy(true);
      render();
      deps?.track?.("weave_submitted", { task: adapter.task, surface: adapter.surface, turn_index: ctrl.turn });
      const t0 = performance.now();
      try {
        const data = await adapter.interpret(text, { signal: ctrl.abort.signal });
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
          ctrl.notice = gentle
            ? {
                kind: "status",
                style: "info",
                text: data.acknowledgement || "Typing a request isn’t available right now. Choose how many below.",
              }
            : {
                kind: "alert",
                style: "error",
                text: "Couldn’t quite make sense of that. Try saying it another way, or use the options below.",
                actions: ' <button type="button" class="btn btn-quiet btn-sm weave-notice-edit">Edit</button>',
              };
          ctrl.state = "composing";
          ctrl.draft = text;
          setBusy(false);
          render();
          if (gentle) adapter.scrollToManual?.();
          else {
            body.querySelector(".weave-notice-edit")?.addEventListener("click", () => {
              ctrl.notice = null;
              render();
              body.querySelector("#weaveField")?.focus();
            });
          }
          return;
        }
        await adapter.applyResult(data, ctrl);
        ctrl.chips = data.chips || [];
        ctrl.reply = data.acknowledgement || "";
        ctrl.next = adapter.suggestions?.(data) || [];
        if (data.conflicts?.length) {
          ctrl.reply = adapter.conflictCopy?.(data) || ctrl.reply;
          ctrl.notice = { kind: "status", style: "info", text: ctrl.reply };
          ctrl.reply = "";
        }
        setBusy(false);
        startReveal();
      } catch (e) {
        if (e.name === "AbortError") return;
        ctrl.notice = {
          kind: "alert",
          style: "error",
          text: "That took longer than it should.",
          actions:
            ' <button type="button" class="btn btn-quiet btn-sm weave-retry">Try again</button> <button type="button" class="btn btn-quiet btn-sm weave-manual">Use the options below</button>',
        };
        ctrl.state = "composing";
        ctrl.draft = text;
        setBusy(false);
        render();
        body.querySelector(".weave-retry")?.addEventListener("click", () => {
          ctrl.notice = null;
          void submit(text);
        });
        body.querySelector(".weave-manual")?.addEventListener("click", () => adapter.scrollToManual?.());
      }
    }

    async function removeChip(chipId) {
      deps?.track?.("weave_chip_edited", { task: adapter.task, chip_id: chipId, op: "remove" });
      const data = await adapter.applyChip(chipId);
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
    if (!restoreFromCache()) {
      ctrl.state = adapter.defaultExpanded ? "idle" : "settled";
      render();
    }

    return {
      ctrl,
      submit,
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

  global.FlavorWeaveWeave = { mount, REDUCED_MOTION: REDUCED };
})(window);
