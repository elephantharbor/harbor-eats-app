import { describe, expect, it } from "vitest";
import {
  discoveryWhyLines,
  findPathFromState,
  repairFindBrowserParams,
} from "../src/discovery/client-ui.js";
import { emptyQuery } from "../src/discovery/query.js";

describe("D-07 closure runtime helpers", () => {
  it("replace find URLs carry only mode, dinner_plan_id, and meal_id", () => {
    const path = findPathFromState(emptyQuery(), {
      mode: "replace_plan_meal",
      dinner_plan_id: "dp_1",
      meal_id: "dpm_2",
      position: 3,
      participant_ids: ["mem_a", "mem_b"],
    });
    expect(path).toContain("mode=replace_plan_meal");
    expect(path).toContain("dinner_plan_id=dp_1");
    expect(path).toContain("meal_id=dpm_2");
    expect(path).not.toContain("participant_id");
    expect(path).not.toContain("position=");
  });

  it("standalone find URLs may include participant_id", () => {
    const path = findPathFromState(emptyQuery(), {
      mode: "standalone",
      participant_ids: ["mem_a"],
    });
    expect(path).toContain("participant_id=mem_a");
  });

  it("repairs unsupported diet tokens and replace-mode URL noise", () => {
    const params = repairFindBrowserParams(
      new URLSearchParams(
        "mode=replace_plan_meal&dinner_plan_id=dp_1&meal_id=dpm_2&position=2&participant_id=x&diet=dairy_free,plant"
      )
    );
    expect(params.get("mode")).toBe("replace_plan_meal");
    expect(params.has("position")).toBe(false);
    expect(params.has("participant_id")).toBe(false);
    expect(params.get("diet")).toBe("plant");
  });

  it("builds at most three Why this one lines in priority order", () => {
    const lines = discoveryWhyLines(
      {
        primary_reason: "taste_like",
        taste_hits: [{ display_name: "salmon", viewer_id: "v1", member_id: "v1" }],
        reasons: ["explicit_different"],
        total_minutes: 25,
        effort_level: "easy",
        ingredient_complexity: "simple",
      },
      () => null
    );
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain("salmon");
    expect(lines[1]).toContain("haven’t made");
    expect(lines[2]).toContain("25 minutes");
  });

  it("returns no Why lines when nothing applies", () => {
    expect(discoveryWhyLines({ total_minutes: 45, effort_level: "moderate" }, () => null)).toEqual([]);
  });
});
