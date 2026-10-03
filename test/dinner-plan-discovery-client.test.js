import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

function fnBody(name) {
  const start = app.indexOf(`async function ${name}(`);
  if (start < 0) throw new Error(`missing ${name}`);
  const brace = app.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < app.length; i++) {
    const ch = app[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return app.slice(brace + 1, i);
    }
  }
  throw new Error(`unclosed ${name}`);
}

describe("Cycle 3B dinner plan discovery (client)", () => {
  it("loadCurrentDinnerPlan calls /api/dinner-plans/current without requiring a localStorage pointer", () => {
    const body = fnBody("loadCurrentDinnerPlan");
    expect(body).toMatch(/readDinnerPlanPointer\(\)/);
    expect(body).toMatch(/apiGet\("\/api\/dinner-plans\/current"\)/);
    const beforeCurrent = body.split('apiGet("/api/dinner-plans/current")')[0];
    expect(beforeCurrent).not.toMatch(/if\s*\(\s*!id\s*\)\s*return\s*null/);
  });

  it("stale or forbidden pointer ids are cleared", () => {
    expect(app).toMatch(/dinnerPlanFetchDenied/);
    expect(app).toMatch(/forbidden_cross_household/);
    expect(app).toContain('await loadCurrentDinnerPlan();\n        updateHome();');
    expect(app).toContain('await loadCurrentDinnerPlan();\n        if (\n          !hasCurrentDinnerPlan()');
  });
});
