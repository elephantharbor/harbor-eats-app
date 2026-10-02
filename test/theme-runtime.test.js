import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "public/theme.js"), "utf8");

function boot(initial = {}) {
  const store = new Map(Object.entries(initial));
  const attrs = {};
  const meta = { content: "", setAttribute: (k, v) => (meta[k] = v) };
  const document = {
    documentElement: { style: {}, setAttribute: (k, v) => (attrs[k] = v) },
    querySelectorAll: () => [meta],
  };
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  const window = { localStorage };
  runInNewContext(source, { window, document });
  return { Theme: window.FlavorWeaveTheme, attrs, meta, store, document };
}

describe("FlavorWeave theme runtime", () => {
  it("defaults to Signature", () => {
    const { Theme, attrs, meta } = boot();
    expect(Theme.current()).toBe("signature");
    expect(attrs["data-theme"]).toBe("signature");
    expect(meta.content).toBe("#FFFDF8");
    expect(Theme.themes.map((t) => t.id)).toEqual(["signature", "citrus-berry", "fresh-herb", "cobalt-coral", "dark"]);
  });

  it("falls back to Signature for invalid stored or requested values", () => {
    const { Theme, attrs } = boot({ fw_theme: "neon-glass" });
    expect(attrs["data-theme"]).toBe("signature");
    expect(Theme.set("<script>")).toBe("signature");
  });

  it("switches instantly and persists per browser and member", () => {
    const { Theme, attrs, store, document } = boot({ he_member_id: "m_1" });
    const seen = [];
    Theme.onChange((id) => seen.push(id));
    Theme.set("dark");
    expect(attrs["data-theme"]).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(store.get("fw_theme")).toBe("dark");
    expect(store.get("fw_theme:m_1")).toBe("dark");
    expect(seen).toEqual(["dark"]);
  });

  it("restores a member's saved theme over the browser default", () => {
    const { Theme, attrs } = boot({ fw_theme: "fresh-herb", "fw_theme:m_2": "cobalt-coral" });
    expect(attrs["data-theme"]).toBe("fresh-herb");
    Theme.useMember("m_2");
    expect(attrs["data-theme"]).toBe("cobalt-coral");
  });

  it("survives storage that throws (private mode)", () => {
    const document = {
      documentElement: { style: {}, setAttribute() {} },
      querySelectorAll: () => [],
    };
    const window = {
      localStorage: {
        getItem() { throw new Error("denied"); },
        setItem() { throw new Error("denied"); },
      },
    };
    runInNewContext(source, { window, document });
    expect(window.FlavorWeaveTheme.current()).toBe("signature");
    expect(window.FlavorWeaveTheme.set("citrus-berry")).toBe("citrus-berry");
  });

  it("accepts a storage adapter seam for future sync", () => {
    const { Theme } = boot();
    const writes = [];
    Theme.setStorageAdapter({ read: () => "fresh-herb", write: (id, m) => writes.push([id, m]) });
    Theme.useMember("m_3");
    expect(Theme.current()).toBe("fresh-herb");
    Theme.set("dark");
    expect(writes).toEqual([["dark", "m_3"]]);
  });
});
