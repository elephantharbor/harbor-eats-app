import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const discoveryUiSource = readFileSync(new URL("../public/discovery-ui.js", import.meta.url), "utf8");

function emptyCriteria() {
  return {
    cuisines: [],
    meal_styles: [],
    flavors: [],
    ingredients: [],
    exclude_ingredients: [],
    effort_levels: [],
    ingredient_complexities: [],
    max_minutes: null,
    methods: [],
    equipment: [],
    quick: false,
    protein_groups: [],
    diet: [],
    textures: [],
    different: false,
  };
}

function loadDiscoveryHarness() {
  const byId = {};
  function makeEl(id, extra = {}) {
    return Object.assign(
      {
        id,
        innerHTML: "",
        hidden: false,
        disabled: false,
        textContent: "",
        value: "",
        dataset: {},
        addEventListener() {},
        setAttribute() {},
        focus() {},
        closest() {
          return null;
        },
      },
      extra
    );
  }

  byId.findRoot = makeEl("findRoot");
  Object.defineProperty(byId.findRoot, "innerHTML", {
    set(html) {
      this._html = html;
      byId.discChips = makeEl("discChips");
      byId.discMain = makeEl("discMain");
      byId.discTableNote = makeEl("discTableNote");
      byId.discSearch = makeEl("discSearch", { value: "" });
      byId.discSearchClear = makeEl("discSearchClear");
      byId.discProgress = makeEl("discProgress");
    },
    get() {
      return this._html || "";
    },
  });

  const document = {
    getElementById(id) {
      return byId[id] || null;
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
  };

  const window = {
    document,
    history: { replaceState() {} },
    scrollTo() {},
    requestAnimationFrame(fn) {
      fn();
    },
    location: { pathname: "/find", search: "", href: "http://localhost/find" },
    fetch() {
      return Promise.reject(new Error("fetch not mocked"));
    },
  };
  window.window = window;

  const sandbox = {
    window,
    document,
    globalThis: window,
    Object,
    JSON,
    String,
    Number,
    Array,
    Boolean,
    Error,
    URLSearchParams,
    Promise,
    Map,
    Set,
    Date,
    Math,
    parseInt,
    RegExp,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(discoveryUiSource, sandbox);
  return { Discovery: sandbox.window.FlavorWeaveDiscovery };
}

describe("discovery-ui time chip wiring", () => {
  it("does not delegate time helpers through deps (avoids init self-recursion)", () => {
    const isOnBody = discoveryUiSource.match(/function timeChipIsOn\(criteria\) \{[\s\S]*?\n  \}/)?.[0];
    const toggleBody = discoveryUiSource.match(/function timeChipTogglePatch\(criteria\) \{[\s\S]*?\n  \}/)?.[0];
    expect(isOnBody).toBeTruthy();
    expect(toggleBody).toBeTruthy();
    expect(isOnBody).not.toMatch(/deps\.timeChipIsOn/);
    expect(toggleBody).not.toMatch(/deps\.timeChipTogglePatch/);
  });

  it("paints time chips after init without stack overflow when deps mirror exported helpers", () => {
    const { Discovery } = loadDiscoveryHarness();
    Discovery.init({
      escapeHtml(s) {
        return String(s ?? "");
      },
      track() {},
      activeMembers() {
        return [];
      },
      memberName() {
        return "";
      },
      relaxRemoveChips() {
        return [];
      },
      applyRelaxChip(query) {
        return query;
      },
      shelfDisplayTitle(shelf) {
        return shelf.title;
      },
      shelfDisplaySubtitle(shelf) {
        return shelf.subtitle;
      },
      emptyStateKind() {
        return null;
      },
    });

    const state = Discovery.getState();
    state.response = {
      query: {
        text: "",
        criteria: Object.assign(emptyCriteria(), { quick: true }),
        soft: { keep_it_easy: false, keep_ingredients_simple: false },
        soft_provided: false,
      },
      total: 0,
      results: [],
      context: { participant_ids: [] },
      excluded_counts: {},
    };

    expect(() => Discovery.onShow()).not.toThrow();
  });
});
