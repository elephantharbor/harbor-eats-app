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
      recipe: { vocabulary_tag_ids: ["japanese"], recipe_slug: "miso-ginger-salmon" },
      tastes: [
        {
          member_id: "a",
          vocabulary_slug: "japanese",
          rank: "love",
          stance: "explicit",
          data_origin: "household",
        },
      ],
    });
    const bad = postValidateExplanation(
      { text: "You love mushrooms.", used_fact_ids: ["taste_like"] },
      packet
    );
    expect(bad.ok).toBe(false);
  });

  it("never yields smoky wording unless a fact says smoky", () => {
    const forged = buildExplanationPacket({
      row: {
        taste_hits: [
          { agreement: true, display_name: "Smoky" },
          { agreement: true, display_name: "Savory" },
        ],
        primary_reason: "taste_love",
        effort_level: "easy",
      },
    });
    expect(JSON.stringify(forged.facts)).not.toMatch(/smoky/i);
    const packet = buildExplanationPacket({
      recipe: { effort_level: "easy", vocabulary_tag_ids: ["japanese"], recipe_slug: "miso-ginger-salmon" },
      tastes: [
        {
          member_id: "a",
          vocabulary_slug: "japanese",
          rank: "like",
          stance: "explicit",
          data_origin: "household",
        },
      ],
    });
    expect(packet.facts.some((fact) => /smoky/i.test(fact.phrase))).toBe(false);
    const bad = postValidateExplanation(
      { text: "Smoky, savory dinners fit tonight.", used_fact_ids: packet.facts.map((fact) => fact.id) },
      packet
    );
    expect(bad.ok).toBe(false);
    expect(bad.reason).toBe("unsupported_term");
    const grounded = buildExplanationPacket({
      recipe: { vocabulary_tag_ids: ["smoky"], recipe_slug: "test" },
      tastes: [
        { member_id: "a", vocabulary_slug: "smoky", rank: "love", stance: "explicit", data_origin: "household" },
        { member_id: "b", vocabulary_slug: "smoky", rank: "like", stance: "explicit", data_origin: "household" },
      ],
    });
    expect(grounded.facts.some((fact) => /smoky/i.test(fact.phrase))).toBe(true);
    const ok = postValidateExplanation(
      { text: "Smoky is the flavor showing up here.", used_fact_ids: ["taste_agreement"] },
      grounded
    );
    expect(ok.ok).toBe(true);
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
