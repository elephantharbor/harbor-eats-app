import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { presentTasteProfile, searchTastes, tasteCatalog } from "../src/lib/taste-profile.js";

function loadClient(file, globalName) {
  const code = readFileSync(new URL(`../public/${file}`, import.meta.url), "utf8");
  const sandbox = { window: {}, Object, JSON, String };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window[globalName];
}

const T = loadClient("taste-ui.js", "FlavorWeaveTaste");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const appJs = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const catalog = tasteCatalog();
const plain = (v) => JSON.parse(JSON.stringify(v));

function viewSection(name) {
  const start = html.indexOf(`data-view="${name}"`);
  return html.slice(start, html.indexOf("</section>\n\n", start));
}

describe("onboarding picks", () => {
  it("toggles without a cap", () => {
    let picks = [];
    for (const t of catalog.starters) picks = T.togglePick(picks, t.slug);
    expect(picks).toHaveLength(catalog.starters.length);
    expect(picks.length).toBeGreaterThan(3);
    picks = T.togglePick(picks, "tacos");
    expect(picks).not.toContain("tacos");
  });

  it("encourages a few, allows skip, and never counts down to three", () => {
    expect(T.encouragement(0)).toMatch(/skip/i);
    for (const n of [0, 1, 2, 3, 7, 20]) expect(T.encouragement(n)).not.toMatch(/of 3|up to 3|\d/);
    expect(T.encouragement(9)).toMatch(/as many as you like/);
  });

  it("saves new picks as Love and un-picks as remove, nothing more", () => {
    expect(plain(T.onboardingChanges(["tacos", "smoky"], []))).toEqual([
      { vocabulary_slug: "tacos", rank: "love" },
      { vocabulary_slug: "smoky", rank: "love" },
    ]);
    expect(plain(T.onboardingChanges(["smoky"], ["tacos", "smoky"]))).toEqual([{ vocabulary_slug: "tacos", rank: "remove" }]);
    expect(plain(T.onboardingChanges([], []))).toEqual([]);
  });

  it("renders chips as pressable buttons and escapes names", () => {
    const chip = T.pickChipHtml({ slug: "x", name: "<b>Tacos</b>" }, true);
    expect(chip).toMatch(/^<button type="button"/);
    expect(chip).toContain('aria-pressed="true"');
    expect(chip).toContain('data-taste-pick="x"');
    expect(chip).toContain("&lt;b&gt;Tacos&lt;/b&gt;");
    expect(T.chipGridHtml(catalog.starters, ["tacos"]).match(/aria-pressed="true"/g)).toHaveLength(1);
  });
});

describe("browse more", () => {
  it("groups terms under labelled headings, zero-match terms included", () => {
    const out = T.browseHtml(catalog.groups, { mode: "pick", picked: [], idPrefix: "b" });
    for (const [i, g] of catalog.groups.entries()) {
      expect(out).toContain(`<h3 class="taste-browse__title" id="b-group-${i}">${g.title}</h3>`);
      expect(out).toContain(`role="group" aria-labelledby="b-group-${i}"`);
    }
    for (const slug of ["japanese", "korean", "swordfish", "spicy"]) expect(out).toContain(`data-taste-pick="${slug}"`);
    expect(out).not.toMatch(/data-taste-pick="fish"/);
  });

  it("in the profile, chips add as Like and say so to screen readers", () => {
    const out = T.browseHtml(catalog.groups, { mode: "add", ranksBySlug: { tacos: "love" }, ranks: catalog.ranks, idPrefix: "p" });
    expect(out).toContain('aria-label="Add Curries as Like"');
    expect(out).toContain('aria-label="Tacos: Love. Change it in your list."');
  });
});

describe("search results", () => {
  it("a resolved term shows one pick chip during onboarding", () => {
    const out = T.searchResultHtml(plain(searchTastes("bbq")), { mode: "pick", picked: [] });
    expect(out).toContain('data-taste-pick="smoky"');
    expect(out).toContain("Smoky");
  });

  it("in the profile a resolved term offers Love, Like, Less often", () => {
    const out = T.searchResultHtml(plain(searchTastes("tofu")), { mode: "add", ranksBySlug: {}, ranks: catalog.ranks });
    for (const label of ["Love", "Like", "Less often"]) expect(out).toContain(`aria-label="${label} Tofu"`);
    const again = T.searchResultHtml(plain(searchTastes("tofu")), { mode: "add", ranksBySlug: { tofu: "like" }, ranks: catalog.ranks });
    expect(again).toContain("Already in your tastes as Like.");
  });

  it("is quiet while typing an unknown word, plain about it on submit", () => {
    const miss = plain(searchTastes("tac"));
    expect(T.searchResultHtml(miss, { mode: "pick", explicit: false })).toBe("");
    expect(T.searchResultHtml(miss, { mode: "pick", explicit: true })).toMatch(/don’t have “tac”/);
  });

  it("fish points at diet limits, not a chip", () => {
    const out = T.searchResultHtml(plain(searchTastes("fish")), { mode: "pick", explicit: false });
    expect(out).toMatch(/diet limit/);
    expect(out).not.toContain("data-taste-pick");
  });

  it("a term with no dinners says so plainly", () => {
    const fake = { status: "resolved", query: "x", message: null, match: { slug: "korean", name: "Korean", group: "Cuisines", on_menu: false } };
    expect(T.searchResultHtml(fake, { mode: "pick", picked: [] })).toContain(T.MENU_NOTE);
    const onMenu = { ...fake, match: { ...fake.match, on_menu: true } };
    expect(T.searchResultHtml(onMenu, { mode: "pick", picked: [] })).not.toContain(T.MENU_NOTE);
  });
});

describe("Fine-tune rows", () => {
  const profile = plain(
    presentTasteProfile({
      memberId: "m_a",
      rules: [],
      rows: [
        { member_id: "m_a", vocabulary_slug: "tacos", rank: "like", stance: "explicit" },
        { member_id: "m_a", vocabulary_slug: "crispy", rank: "love", stance: "inferred", confidence: 0.66 },
      ],
    })
  );

  it("explicit rows: You told us, a labelled radio group, and Remove", () => {
    const out = T.profileItemHtml(profile.told[0], catalog.ranks);
    expect(out).toContain("You told us");
    expect(out).toContain('<fieldset class="rank-control">');
    expect(out).toContain('<legend class="sr-only">How do you feel about Tacos?</legend>');
    expect(out.match(/type="radio"/g)).toHaveLength(3);
    expect(out).toMatch(/value="like" data-taste-rank="tacos" checked/);
    for (const label of ["Love", "Like", "Less often"]) expect(out).toContain(`<span>${label}</span>`);
    expect(out).toContain('aria-label="Remove Tacos from your tastes"');
  });

  it("inferred rows: We're learning, nothing pre-confirmed, correctable", () => {
    const out = T.profileItemHtml(profile.learning[0], catalog.ranks);
    expect(out).toContain("We're learning");
    expect(out).not.toMatch(/checked/);
    expect(out).toMatch(/Pick one to confirm, or remove it/);
    expect(out).not.toMatch(/0\.66|confidence|%/);
  });

  it("empty lists invite without nagging", () => {
    expect(T.profileListHtml([], catalog.ranks, "Nothing yet.")).toBe('<li class="taste-empty">Nothing yet.</li>');
  });

  it("choosing a rank confirms an inferred row; remove drops it", () => {
    const crispy = catalog.groups.flatMap((g) => g.terms).find((t) => t.slug === "crispy");
    const confirmed = plain(T.applyLocal(profile, "crispy", "less_often", crispy, catalog.ranks));
    expect(confirmed.learning).toEqual([]);
    expect(confirmed.told.find((i) => i.slug === "crispy")).toMatchObject({ stance: "explicit", rank_label: "Less often", stance_label: "You told us" });
    const removed = plain(T.applyLocal(confirmed, "tacos", "remove", null, catalog.ranks));
    expect(removed.told.map((i) => i.slug)).toEqual(["crispy"]);
  });
});

describe("after-rating extra", () => {
  it("is a small optional chip group, not a survey", () => {
    const out = T.feedbackHtml(catalog.feedback, ["too_spicy"], "m_a");
    expect(out).toContain("Optional");
    expect(out).toContain('role="group" aria-labelledby="taste-fb-m_a"');
    expect(out.match(/data-feedback-code=/g)).toHaveLength(4);
    expect(out).toMatch(/data-feedback-code="too_spicy" aria-pressed="true"/);
    expect(out).not.toMatch(/required|<input|<select/);
    expect(T.feedbackHtml([], [], "m_a")).toBe("");
  });

  it("only renders on the signed-in diner's own rater card", () => {
    expect(appJs).toMatch(/me && me\.id === m\.id && r\.score && state\.selectedMealId\s*\?\s*Taste\.feedbackHtml/);
  });
});

describe("markup and copy", () => {
  it("onboarding centers on What do you love eating? with search, browse, and skip", () => {
    const taste = viewSection("taste");
    expect(taste).toContain(">What do you love eating?</h1>");
    expect(html).not.toContain("A few sparks?");
    expect(taste).toContain('<label class="field__label" for="tasteSearch">');
    expect(taste).toContain('role="search"');
    expect(taste).toContain('aria-controls="tasteBrowse"');
    expect(taste).toContain('id="btnSkipTaste"');
    expect(taste).not.toMatch(/of 3|up to 3/);
  });

  it("profile is Fine-tune your tastes with You told us and We're learning", () => {
    const profile = viewSection("tasteProfile");
    expect(profile).toContain(">Fine-tune your tastes</h1>");
    expect(html).not.toContain("Fix something?");
    expect(profile).toContain(">You told us</h2>");
    expect(profile).toContain(">We’re learning</h2>");
    expect(profile).toContain('<label class="field__label" for="tasteProfileSearch">');
  });

  it("keeps diet limits on their own path, away from Love / Like / Less often", () => {
    const profile = viewSection("tasteProfile");
    const limitsCard = profile.slice(profile.indexOf("profile-card--limits"));
    expect(limitsCard).not.toMatch(/tasteToldList|tasteLearningList|data-taste|rank-control/);
    expect(profile).not.toMatch(/data-cid=|check-grid|constraints/);
    expect(viewSection("constraints")).not.toMatch(/tastePicks|data-taste/);
  });

  it("drops desk words, scores, and the old three-pick cap from the client", () => {
    expect(appJs).not.toMatch(/Pick up to 3|of 3 selected|sparkOptions|tasteCorrectionSpark/);
    const tasteCopy = viewSection("taste") + viewSection("tasteProfile");
    expect(tasteCopy).not.toMatch(/confidence|percent|%|score|database|vocabulary|slug/i);
  });

  it("loads taste-ui.js before app.js", () => {
    expect(html.indexOf('src="/taste-ui.js"')).toBeGreaterThan(0);
    expect(html.indexOf('src="/taste-ui.js"')).toBeLessThan(html.indexOf('src="/app.js"'));
  });
});
