import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const BADGE = "Preview test — Not a real Instacart connection. Nothing is sent to Instacart.";

function load() {
  const window = {};
  vm.runInNewContext(readFileSync("public/shop-handoff.js", "utf8"), { window, URL, sessionStorage: undefined });
  return window.FlavorWeaveShopHandoff;
}

const review = (mode) => ({
  ok: true,
  mode,
  included: [{ line_id: "l1", display_text: "Carrot", quantity_label: "1 cup" }],
  staying: [],
  transferable_count: 1,
  launch_enabled: false,
  can_prepare: mode === "mock",
  revision: 3,
  fingerprint: "f",
});

describe("S-03 order-online labels", () => {
  const ui = load();

  it("mock mode shows the badge on the first card and replaces the review header", () => {
    const card = { innerHTML: "" };
    ui.renderChoice(card, null, { id: "instacart", mode: "mock" });
    expect(card.innerHTML).toContain(BADGE);
    expect(card.innerHTML).toContain("Instacart (test)");
    expect(card.innerHTML).not.toContain("Continues on Instacart");

    const sheet = { innerHTML: "" };
    ui.renderReview(sheet, review("mock"));
    expect(sheet.innerHTML).toContain(BADGE);
    expect(sheet.innerHTML).not.toContain("Continues on Instacart. They choose the store");
    expect(sheet.innerHTML).toContain("Prepare the test link");
  });

  it("off and live modes show no badge and keep the original copy", () => {
    const off = { innerHTML: "" };
    ui.renderUnavailable(off, null);
    expect(off.innerHTML).not.toContain("Preview test");
    expect(off.innerHTML).toContain("Not connected yet");

    const card = { innerHTML: "" };
    ui.renderChoice(card, null, { id: "instacart", mode: "live" });
    expect(card.innerHTML).not.toContain("Preview test");
    expect(card.innerHTML).not.toContain("(test)");
    expect(card.innerHTML).toContain("Continues on Instacart. They choose the store and the products.");

    const sheet = { innerHTML: "" };
    ui.renderReview(sheet, review("live"));
    expect(sheet.innerHTML).not.toContain("Preview test");
    expect(sheet.innerHTML).toContain("Continues on Instacart. They choose the store and the products.");
  });

  it("the disabled CTA is unmistakably off, with aria-disabled and the reason beside it", () => {
    for (const mode of ["mock", "live"]) {
      const sheet = { innerHTML: "" };
      ui.renderReview(sheet, review(mode));
      const html = sheet.innerHTML;
      expect(html).toMatch(/<button[^>]*class="instacart-cta instacart-cta--off"[^>]*disabled[^>]*aria-describedby="shopCtaOffReason"[^>]*aria-disabled="true"/);
      expect(html).toContain('<span class="instacart-cta__state">Off</span>');
      expect(html).toContain('id="shopCtaOffReason">The official Instacart logo isn’t in this app yet, so the button stays off.');
    }
  });

  it("CSS keeps the documented dark enabled style and a neutral off style", () => {
    const css = readFileSync("public/styles.css", "utf8");
    const enabled = /\.instacart-cta \{[^}]*background: #003d29;[^}]*color: #faf1e5;/s;
    expect(css).toMatch(enabled);
    const off = /\.instacart-cta:disabled,\s*\.instacart-cta--off \{([^}]*)\}/s.exec(css);
    expect(off).not.toBeNull();
    expect(off[1]).not.toMatch(/#003d29/i);
    expect(off[1]).toMatch(/opacity: 1;/);
    expect(off[1]).toMatch(/cursor: not-allowed;/);
  });
});
