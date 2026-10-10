/* global window, fetch, performance */
/**
 * FlavorWeave "Weave" conversational UI (D-06). Shared across Plan and Find.
 */
(function weaveUi(global) {
  const REDUCED = global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  function create(adapter) {
    let state = "idle";
    let turnIndex = 0;
    const listeners = new Set();
    const notify = () => listeners.forEach((fn) => fn(state));

    return {
      adapter,
      onState(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      get turn() {
        return turnIndex;
      },
      async submit(text, deps) {
        turnIndex += 1;
        state = "working";
        notify();
        deps?.track?.("weave_submitted", { task: adapter.task, surface: adapter.surface, turn_index: turnIndex });
        const t0 = performance.now();
        try {
          const res = await fetch(adapter.interpretPath, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              schema_version: 1,
              text,
              state: adapter.getState(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              ...(adapter.extraBody || {}),
            }),
          });
          const data = await res.json();
          const total = Math.round(performance.now() - t0);
          deps?.track?.("weave_result", {
            task: adapter.task,
            source: data.source,
            fallback_code: data.fallback_code || undefined,
            provider_latency_ms: data.provider_latency_ms,
            deterministic_latency_ms: data.deterministic_latency_ms,
            total_latency_ms: total,
            conflict: data.conflicts?.length ? "1" : "0",
            cue_count: data.state?.intent_cues?.length || 0,
          });
          if (!data.ok) throw new Error(data.error || "failed");
          adapter.applyResponse(data, { reducedMotion: REDUCED });
          state = "settled";
          notify();
          return data;
        } catch (e) {
          state = "composing";
          notify();
          throw e;
        }
      },
      removeChip(chipId, deps) {
        deps?.track?.("weave_chip_edited", { task: adapter.task, chip_id: chipId, op: "remove" });
        adapter.removeChip(chipId);
        state = "settled";
        notify();
      },
      open(deps) {
        deps?.track?.("weave_composer_opened", { task: adapter.task, surface: adapter.surface });
      },
    };
  }

  global.FlavorWeaveWeave = { create, REDUCED_MOTION: REDUCED };
})(window);
