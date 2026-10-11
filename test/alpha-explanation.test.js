import { describe, expect, it } from "vitest";
import { createFakeProvider, createGenerationService, createMemoryStore } from "../src/ai/index.js";
import {
  buildExplanationPacket,
  explanationColdTemplate,
  postValidateExplanation,
} from "../src/lib/explanation-packet.js";

describe("recommendation explanations", () => {
  it("weak evidence skips provider input strength", () => {
    const packet = buildExplanationPacket({ row: { effort_level: "easy" }, intent: {} });
    expect(packet.strength).toBe("weak");
    expect(packet.template).toBeTruthy();
  });

  it("cold basis template has no learned voice", () => {
    const packet = buildExplanationPacket({ row: {} });
    expect(packet.basis).toBe("cold");
    expect(explanationColdTemplate()).toMatch(/something different/i);
  });

  it("post_validate rejects mushroom without fact", () => {
    const packet = buildExplanationPacket({
      row: { primary_reason: "taste_like", taste_hits: [{ display_name: "ginger" }] },
    });
    const bad = postValidateExplanation(
      { text: "You love mushrooms.", used_fact_ids: ["taste_like"] },
      packet
    );
    expect(bad.ok).toBe(false);
  });

  it("fingerprint change is stable per facts", () => {
    const a = buildExplanationPacket({ row: { effort_level: "easy" }, intent: { keep_it_easy: true } });
    const b = buildExplanationPacket({ row: { effort_level: "easy" }, intent: { keep_it_easy: true } });
    expect(a.evidence_fingerprint).toBe(b.evidence_fingerprint);
    const c = buildExplanationPacket({ row: { effort_level: "involved" }, intent: {} });
    expect(c.evidence_fingerprint).not.toBe(a.evidence_fingerprint);
  });

  it("fake provider verbalizes with used_fact_ids subset", async () => {
    const provider = createFakeProvider({
      script: [{ json: { text: "Keeps tonight easy.", used_fact_ids: ["legacy_0"] } }],
    });
    const service = createGenerationService({
      provider,
      store: createMemoryStore(),
      env: { AI_GATEWAY_ENABLED: "1", AI_TASKS_ENABLED: "explanation", AI_DAILY_BUDGET_USD: "5" },
    });
    const r = await service.run(
      "explanation",
      { meal: "Pasta", reasons: ["easy weeknight"], cache_bust: null },
      { householdId: "hh", fallback: null }
    );
    expect(r.ok).toBe(true);
    expect(r.output.used_fact_ids).toEqual(["legacy_0"]);
  });
});
