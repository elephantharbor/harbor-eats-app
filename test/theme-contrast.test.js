import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "public/styles.css"), "utf8");
const THEMES = ["signature", "citrus-berry", "fresh-herb", "cobalt-coral", "dark"];

function themeTokens(id) {
  const re = new RegExp(`\\[data-theme="${id}"\\]\\s*\\{([^}]*)\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`theme block missing: ${id}`);
  const tokens = {};
  for (const [, name, value] of m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[name] = value.trim();
  return tokens;
}

function luminance(hex) {
  const h = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const BODY = 4.5;
// Primary button labels are bold ≥19px ("large text"), so 3:1 is the WCAG AA floor.
const LARGE = 3;

const PAIRS = [
  ["--color-text", "--color-bg", BODY],
  ["--color-text", "--color-surface", BODY],
  ["--color-text", "--color-surface-quiet", BODY],
  ["--color-text-secondary", "--color-bg", BODY],
  ["--color-text-secondary", "--color-surface", BODY],
  ["--color-text-tertiary", "--color-surface", BODY],
  ["--color-on-primary", "--color-primary", LARGE],
  ["--color-on-primary", "--color-primary-pressed", LARGE],
  ["--color-on-structure", "--color-structure", BODY],
  ["--color-primary-text", "--color-bg", BODY],
  ["--color-primary-text", "--color-primary-soft", BODY],
  ["--color-accent-text", "--color-accent-soft", BODY],
  ["--color-natural-text", "--color-natural-soft", BODY],
  ["--badge-fit-text", "--badge-fit-bg", BODY],
  ["--badge-match-text", "--badge-match-bg", BODY],
  ["--badge-neutral-text", "--badge-neutral-bg", BODY],
  ["--color-success-text", "--color-success-soft", BODY],
  ["--color-warning-text", "--color-warning-soft", BODY],
  ["--color-error-text", "--color-error-soft", BODY],
  ["--color-inverse-text", "--color-inverse-bg", BODY],
  ["--color-focus", "--color-bg", LARGE],
  ["--color-focus", "--color-surface", LARGE],
];

describe("FlavorWeave theme tokens", () => {
  const signature = themeTokens("signature");

  it("every theme defines the same semantic token set", () => {
    const keys = Object.keys(signature).sort();
    for (const id of THEMES) expect(Object.keys(themeTokens(id)).sort(), id).toEqual(keys);
  });

  it("Signature matches the v2 guide palette", () => {
    expect(signature["--color-bg"]).toBe("#FFFDF8");
    expect(signature["--color-text"]).toBe("#17393A");
    expect(signature["--color-primary"]).toBe("#F15D3C");
    expect(signature["--color-primary-pressed"]).toBe("#D9472D");
    expect(signature["--color-structure"]).toBe("#0F5D5B");
    expect(signature["--color-natural"]).toBe("#A9BA9B");
    expect(signature["--color-accent"]).toBe("#D6A13A");
    expect(signature["--color-surface-quiet"]).toBe("#F7F2EC");
    expect(signature["--color-primary-soft"]).toBe("#FBE6DB");
    expect(signature["--color-border"]).toBe("#E5DED7");
  });

  it.each([
    ["citrus-berry", "#FFF9F4", ["#FF6A2A", "#D51F63", "#7B45D8"]],
    ["fresh-herb", "#FFFDF6", ["#2F6F3E", "#E98B5D", "#D3A633"]],
    ["cobalt-coral", "#FBFCFF", ["#3D5AF1", "#FF604D", "#9A7CF7"]],
    ["dark", "#101819", ["#FF6A50", "#E9F2EF", "#385E5C"]],
  ])("%s uses its guide palette", (id, bg, colors) => {
    const block = css.match(new RegExp(`\\[data-theme="${id}"\\]\\s*\\{([^}]*)\\}`))[1].toUpperCase();
    expect(themeTokens(id)["--color-bg"]).toBe(bg);
    for (const c of colors) expect(block, `${id} ${c}`).toContain(c);
  });

  for (const id of THEMES) {
    it.each(PAIRS)(`${id}: %s on %s meets %s:1`, (fg, bg, min) => {
      const t = themeTokens(id);
      expect(t[fg], fg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t[bg], bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(min);
    });
  }

  it("primary button labels are sized as large text", () => {
    const size = css.match(/--text-button:\s*([\d.]+)rem/);
    expect(Number(size[1]) * 16).toBeGreaterThanOrEqual(18.66);
  });
});
