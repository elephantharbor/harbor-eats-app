import { describe, expect, it } from "vitest";
import {
  clampChoiceCount,
  mergeSettingsPatch,
  parseHouseholdSettings,
} from "../src/lib/household-settings.js";

describe("household settings", () => {
  it("clamps meal choice count 3–5", () => {
    expect(clampChoiceCount(2)).toBe(3);
    expect(clampChoiceCount(5)).toBe(5);
    expect(clampChoiceCount(99)).toBe(5);
  });

  it("parses defaults", () => {
    const s = parseHouseholdSettings({ display_name: "Test", settings_json: null });
    expect(s.meal_choice_count).toBe(3);
    expect(s.scheduling_cadence).toBe("on_demand");
  });

  it("merges prefs patch", () => {
    const base = parseHouseholdSettings({ display_name: "A", settings_json: "{}" });
    const next = mergeSettingsPatch(base, {
      meal_choice_count: 4,
      prefs: { spice_level: "mild" },
    });
    expect(next.meal_choice_count).toBe(4);
    expect(next.prefs.spice_level).toBe("mild");
  });
});
