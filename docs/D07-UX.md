# D-07 Catalog Discovery: Find a dinner

UX and product specification for **MealDiscovery**, the one reusable surface for looking around the FlavorWeave menu. A later Composer (or Grok) agent implements this document. This document does not implement anything and does not change production.

**Binding contracts** (draft [PR #24](https://github.com/elephantharbor/harbor-eats-app/pull/24), branch `cursor/d07-discovery-contracts-bb03`):

- `docs/D07-ARCHITECTURE.md` — modes, the eight-stage pipeline, hard vs soft, `selection`, reason codes, the D-06 boundary.
- `docs/D07-QUERY-CONTRACT.md` — `DiscoveryQuery`, query-string names, context rules, response fields, errors.
- `src/discovery/` — constants and normalizers. Import from `src/discovery/index.js`; do not re-declare modes, reason codes, or the Quick constant.

This document only decides **screens, copy, and client behavior** on top of those contracts. It defines no query schema of its own. Where this document and the contracts disagree, the contracts win and Composer reports the gap. Known gaps are listed in §16.

Companion documents:

- `docs/D07-NAV-DECISION.md` — where Find lives in navigation (binding for UI).
- `docs/CYCLE3-UX.md` — plans, swap sheet, Tonight, recipe detail. Still binding except where this document names a change.
- `docs/D03-D01-RELEASE.md` — `effort_level`, `ingredient_complexity`, Keep it easy, Keep ingredients simple.
- `docs/FLAVORWEAVE-BRAND.md` — tokens, themes, imagery, voice, and the “Discovery (D-07)” visual notes.
- `docs/DEEP-LINKS.md` — route table, including `/find`.

Scope: D-07 V1. Catalog stays 50 meals. No LLM, no chat, no generated suggestions. `interpretFreeText` returns `nlp_not_in_d07`; free text is literal token matching until D-06. D-05 and D-06 are not started here.

---

## 0. Rules for Composer

1. **One surface.** Standalone Find a dinner, replacing a plan meal, and choosing for a plan are the same `find` view with a different `mode` (`standalone`, `replace_plan_meal`, `choose_for_plan`). Do not fork it into three screens.
2. **The server decides what fits and in what order.** Render `results` in `rank` order. The client never filters, adds, de-duplicates, or re-orders results, and never sends constraints (`client_constraints_forbidden`).
3. **Search is read-only.** A pick calls the existing dinner-plan mutation named by `selection` (`swap_meal` or `add_meal`) with the chosen result’s `recipe_version_id`. In standalone, `selection.action` is `none` and the client composes the plan ops in §8.
4. **Exact strings.** Strings in “quotes” are final copy. Use the typographic apostrophe `’`. `{braces}` are substitutions. New strings follow the same voice and go in the Composer report.
5. **Existing design system.** Compose existing tokens and components (`.page--wide`, `.card`, `.badge`, `.chip-tog`, `.sheet`, `.sticky-actions`, `.tonight-hero`, `.empty-state`, `mealMediaHtml`). New classes are prefixed `.disc-`, tokens only, no raw hex.
6. **No internal words on screen.** Cycle 3 §0.2 still applies. Add for D-07: query, criteria, filter (as a noun), facet, rank, score, match, tier, relaxed, eligible, eligibility, moderate, involved, standard, adventurous, complexity, effort level, mode, context, catalog.
7. **Never render these response fields:** `rank`, `taste_score`, `match_score`, `preference_tier`, `preference_relaxed`, `exploration`, `trace`, `excluded_counts` values, `catalog_size`, raw `reasons` codes. They drive layout and copy choices only.
8. **Nothing invented.** See §17.

---

## 1. Decisions at a glance

| # | Decision | Answer | Where |
|---|----------|--------|-------|
| 1 | Top-level nav | **Hybrid.** “Find” is a primary nav item (5th tab on phone, top nav on tablet/desktop) for `standalone`. `replace_plan_meal` and `choose_for_plan` open the same view from plan actions, in `focus` chrome, without lighting Find. | `D07-NAV-DECISION.md` |
| 2 | First-open collections | Four shelves, each a saved `DiscoveryQuery`: Good matches (or “Fits your table” with no taste hits), Easy, Under 30 minutes, Simple ingredients. Shown only with ≥ 4 results for the table. No “Something adventurous”. Fish & seafood, Plant-forward, and Something different are deferred until the contract can express them (§16). | §5 |
| 3 | Card hierarchy | Photo, title, one meta row (minutes; “Easy” and “Simple ingredients” only when true), at most one taste reason line, plan status when relevant, mode CTA only in plan modes. Never rank, scores, other bands, dietary lists, emoji, or averages. | §7 |
| 4 | Refinement model | Phone/tablet: search field, one scrolling chip row, a “Refine” bottom sheet. Desktop: same chip row, group chips open anchored popovers. No sidebar anywhere. | §6 |
| 5 | Contextual CTAs | Standalone: “Cook tonight” + “Add to plan” (or “Add to my shopping list” with no plan), on the recipe only. Replace: “Use this” on cards, “Use this for Dinner {p}” on the recipe. Choose: “Add this” on cards, “Add this to Dinner {p}” on the recipe. | §8 |
| 6 | Add to plan | No open slot: one tap adds a night (`set_count`, then `add_meal`). Open slot(s): a small sheet to pick the slot (`swap_meal` on the empty row) or add a night. List effects per Cycle 3 §9. | §8.4 |
| 7 | Routes | `/find?{contract query string}` (the contract’s parameter names, minus paging); `/meal/{slug}?from=find`; `pushState` for recipe open, `replaceState` for refinement. | §9 |
| 8 | Empty states | Three, chosen from `total` and `excluded_counts`: nothing matches the words for this table, too many refinements (one-tap “Remove …”), nothing fits the table. | §11 |
| 9 | Soft D-01 prefs | “Lean toward” switches in Refine plus one summary line, driven by the response’s `soft` and `soft_source`. Visually separate from the hard “Easy” and “Simple ingredients” chips. | §4 |
| 10 | Swap sheet | Stays compact (three alternatives). Adds a quiet “See all options” that opens `replace_plan_meal`. | §10 |

---

## 2. How the screen uses the contract

### 2.1 Modes and what the screen sends

| Mode | Opened from (§3) | Context the client sends | Server fills | Hidden from results | `selection` |
|------|------------------|--------------------------|--------------|---------------------|-------------|
| `standalone` | Find tab, Home, Tonight | `participant_ids` only when “Who’s eating” is a subset (§6.6). Never `dinner_plan_id` or `meal_id`. | Every active member when omitted; `soft` default off | Nothing (the screen sends no `exclude_slugs` in V1) | `none` |
| `replace_plan_meal` | Swap sheet “See all options”, meal “More” → “Find something else” | `dinner_plan_id`, `meal_id` | That meal’s participants; the plan’s chips | That meal’s current recipe only. Other nights’ dinners can appear (§7.1 plan status). | `swap_meal` on `meal_id` |
| `choose_for_plan` (slot) | Empty slot “Pick one yourself” | `dinner_plan_id`, `meal_id` of the empty row, `position` | That row’s participants; the plan’s chips | That slot’s slug, if any | `swap_meal` on that row |
| `choose_for_plan` (new night) | Not opened directly in V1; used by “Add to plan” semantics (§8.4) | `dinner_plan_id` | Client list or every active member | Every slug already on the plan | `add_meal`; `plan_full` when there’s no room |

Leftovers and eating-out rows are not search targets (`D07-ARCHITECTURE.md`). “Plan a dinner here instead” on those rows stays the Cycle 3 §6.4 swap-sheet flow and does not open Discovery in V1.

### 2.2 The query the screen builds

Every request body is `{ schema_version: 1, mode, context, query }`. The screen only ever writes these `DiscoveryQuery` fields:

| UI control | Contract field | Notes |
|------------|----------------|-------|
| Search field | `query.text` | Literal tokens (stage 3). No client parsing. |
| “Easy” chip | `criteria.effort_levels: ["easy"]` | Hard. The UI never sends `moderate` or `involved`. |
| “Simple ingredients” chip | `criteria.ingredient_complexities: ["simple"]` | Hard. Never sends `standard` or `adventurous`. |
| “Under 30 min” | `criteria.quick: true` (and `max_minutes: null`) | Quick is the clock, `total_minutes ≤ 30`, independent of Easy. |
| “Under 45 min”, “Under 60 min” | `criteria.max_minutes: 45` / `60` (and `quick: false`) | |
| Cuisine options | `criteria.cuisines` | §6.4 for which slugs each option sends. |
| “Type of dinner” options | `criteria.meal_styles` | Meal-style vocabulary slugs. |
| “Flavor” options | `criteria.flavors` | Flavor vocabulary slugs. |
| “Main ingredient” options | `criteria.ingredients` | Ingredient vocabulary slugs. |
| “Keep it easy” switch | `soft.keep_it_easy` | Sent only after the person toggles a switch on this search (§4). |
| “Keep ingredients simple” switch | `soft.keep_ingredients_simple` | Same. |
| Paging | `limit`, `offset` | Shelves: `limit: 10`. Results: `limit: 50`, `offset: 0` (the whole published catalog fits one page; no paging UI). |

Not exposed in the V1 UI (the contract supports them; D-06 or later screens may use them): `exclude_ingredients`, `methods`, `equipment`, and the non-easy / non-simple bands.

Use the contract’s normalizer shape in the client too: build the request with the same field names, and treat the response’s canonical `query` as the truth (repair the URL from it, §9.1).

### 2.3 What the screen reads from the response

| Response field | Used for |
|----------------|----------|
| `results[]` in order | Cards (§7) |
| `results[].recipe_slug`, `title`, `total_minutes`, `effort_level`, `ingredient_complexity` | Card content |
| `results[].recipe_version_id` | The id sent to `swap_meal` / `add_meal` |
| `results[].primary_reason`, `taste_hits` | The optional reason line (§7.2) |
| `total` | Result count, shelf gate (≥ 4), Refine button label |
| `soft`, `soft_source` | Lean toward switch state and the summary line (§4) |
| `selection` | Which mutation a pick sends (§8.3) |
| `excluded_counts` | Which empty state to show and which “Remove …” chips to offer (§11) |
| `query` | Canonical query, to repair the URL |
| `context.participant_ids` | Table note names (§6.6) |

---

## 3. Entry points and copy changes

### 3.1 Entry table

| Surface | Control | Opens |
|---------|---------|-------|
| Primary nav | “Find” tab / top-nav link | `/find`, or the last standalone Discovery URL in this tab session (§9.4) |
| Home hero, no plan, or plan closed | Secondary “Find a dinner” | `/find` |
| Tonight, no plan | Secondary “Find a dinner” | `/find` |
| Tonight, with a plan | “Not feeling any of these?” → “See all dinners” | `/find` (standalone; plan CTAs apply, §8) |
| Swap sheet (multi-dinner and single mode) | Quiet “See all options” | `/find?mode=replace_plan_meal&dinner_plan_id={id}&meal_id={meal_id}` |
| Meal “More” sheet, recipe meal in `planned`/`selected` | New first row “Find something else” | same as above |
| Empty slot card on `planReview` (a row with no recipe) | New secondary “Pick one yourself” | `/find?mode=choose_for_plan&dinner_plan_id={id}&meal_id={row_id}&position={p}` |

Not entry points in V1: empty slots whose reason is `no_eligible_meal` or `no_unused_eligible_meal` (Discovery would show the same nothing), leftovers and eating-out rows, the shopping list, History, Profile.

If the plan represents an open slot only as `meal_count − meals.length` (no row), “Pick one yourself” opens `choose_for_plan` without `meal_id`, and the pick is `add_meal` per `selection`. See §16 gap 7.

### 3.2 Copy changes to existing screens

| Screen | Before | After |
|--------|--------|-------|
| Home hero lede, no plan | “Plan a few nights at once, or just find one for tonight.” | “Plan a few nights at once, or look around for tonight.” |
| Home hero secondary, no plan | “Find a dinner” (auto-proposes one) | “Find a dinner” (opens Discovery) |
| Tonight, no plan | Primary “Find a dinner”, secondary “Plan a few dinners” | Primary “Pick one for us” (`data-action="pick-one"`, the existing `startFindDinner("tonight")`), secondary “Find a dinner” (Discovery), quiet “Plan a few dinners” |
| Tonight, with a plan | “Not feeling any of these?” → “Find something else” (Cycle 3 §11.4 auto-proposal) | “Not feeling any of these?” → “See all dinners” (Discovery). Cycle 3 §11.4 is retired; Discovery’s “Cook tonight” performs the same ops. |
| Swap sheet footer | “Keep this one” (+ leftovers/out on multi-dinner) | Adds quiet “See all options” first (§10) |
| Meal options sheet | — | New first row “Find something else” |

The single-mode proposal (“Here’s a good one”) is unchanged and reachable from Tonight (“Pick one for us”) and from Discovery’s header (§12.1).

---

## 4. Hard filters vs soft D-01 preferences

The contract keeps these as different fields. The screen keeps them visually and verbally apart.

| | Soft: “Keep it easy” / “Keep ingredients simple” | Hard: “Easy” / “Simple ingredients” chips | Hard: “Under 30 min” |
|---|---|---|---|
| Contract field | `soft.keep_it_easy` / `soft.keep_ingredients_simple` | `criteria.effort_levels: ["easy"]` / `criteria.ingredient_complexities: ["simple"]` | `criteria.quick: true` |
| Effect | Sorts (stage 5 tiers). Hides nothing. | Drops other bands (stage 4). A 60-minute easy dinner stays. | Drops anything over 30 minutes, or with unknown minutes. A 25-minute moderate dinner stays. |
| Where shown | “Lean toward” section of Refine, plus a summary line | Chip row and Refine | Chip row (time menu) and Refine |
| Default | From the response: off in standalone (`default_off`), the plan’s chips in plan modes (`plan_intent`) | Off | Off |
| Sending rule | Omit `soft` until the person touches a switch on this search. Then always send both flags. | Normal | Normal |
| Writes the plan? | Never. Discovery does not call `set_planning_preferences`. | — | — |

**Summary line** (`.disc-lean`, `--text-sm`, secondary text) under the results header, only when an effective soft flag is on:

| Effective `soft` | Line |
|------------------|------|
| keep_it_easy | “Easier dinners first” |
| keep_ingredients_simple | “Simpler ingredients first” |
| both | “Easier dinners and simpler ingredients first” |

- When `soft_source` is `plan_intent`, append “ · from your plan”.
- Follow with a quiet inline “Change”, which opens Refine scrolled to “Lean toward”.
- If the matching hard chip is on too (Easy with Keep it easy), drop that half; every result already qualifies. If both halves drop, hide the line.

**Copy guardrails** for Quick ≠ Easy and Simple ingredients ≠ pantry:

- The time option is “Under 30 min”, never “Quick”. Easy is never described in minutes. Only 4 of the 11 meals at 30 minutes or less are Easy, so the two chips give different results by design.
- “Simple ingredients” is described as “Familiar ingredients, nothing hard to find.” Never “from your pantry”, “what you have”, or “no shopping”. The contract refuses `pantry` and `already_have` (`pantry_not_a_filter`).

---

## 5. First open: collections

### 5.1 The four shelves

First open never shows a blank search. Each shelf is one `GET /api/discovery/search` with `limit=10`, fired in parallel, in the current mode and context. A shelf renders only if `total ≥ 4`. Order is fixed.

| Order | Title | Sub-line | Query | Catalog size (no limits) |
|-------|-------|----------|-------|--------------------------|
| 1 | “Good matches” | “Picked from what your table likes” | `{}` (taste-ranked by the pipeline) | all eligible |
| 1 (alt) | “Fits your table” | “Every one of these works for everyone eating” | same request | all eligible |
| 2 | “Easy” | “Short on steps, light on fuss” | `criteria.effort_levels: ["easy"]` | 16 |
| 3 | “Under 30 minutes” | “On the table in half an hour” | `criteria.quick: true` | 11 |
| 4 | “Simple ingredients” | “Familiar ingredients, nothing hard to find” | `criteria.ingredient_complexities: ["simple"]` | 22 |

- **Good matches vs Fits your table:** title shelf 1 “Good matches” when at least one of its returned results has `primary_reason` `taste_love` or `taste_like`. Otherwise “Fits your table”. Never claim taste when the pipeline didn’t use any.
- In plan modes, shelves inherit the plan’s chips (omit `soft`). In standalone they run with chips off unless the person has toggled Lean toward in this Discovery session, in which case every shelf request carries that `soft`.
- Shelves are not de-duplicated by the client. A meal may lead two shelves; that is the server’s order and the client keeps it.

**Not offered in V1**, with reasons Composer should not re-open:

| Shelf | Why not |
|-------|---------|
| “Something adventurous” | Only 2 of 50 meals are `adventurous`. A two-card shelf reads as a gap, not a feature. |
| “Quick and easy” | Only 4 meals are both. Use the two chips together. |
| “Fish & seafood” | The catalog supports it (9 meals), but the contract has no protein group. Expressing it as a hand-picked `criteria.ingredients` id list would be a second vocabulary. Deferred, §16 gap 2. |
| “Plant-forward” | The catalog supports it (about 30 meals), but the contract has no dietary criterion. Deferred, §16 gap 1. |
| “Something different” | Needs a “different from recent cooks” selection. The pipeline only uses recency to re-order inside a tier. Deferred, §16 gap 3. |
| Cuisine shelves | Largest cuisine is 10 meals, most are 1–3. Cuisines live in the chip row and Refine. |
| “Popular”, “Trending”, “New” | No honest data. |

### 5.2 “See all”

Each shelf header has a “See all” text button (accessible name “See all {title}”, desktop label “See all {total}”). It applies that shelf’s query (as removable chips) and shows results (§7.4). When the current query equals a shelf’s query exactly, the results header uses the shelf’s title. No extra URL parameter is needed.

---

## 6. Search and refinement

### 6.1 Layout

```
[ Search field ……………………………………… ]            ← sticky under the app header
[Easy] [Under 30 min ▾] [Simple ingredients] [Cuisine ▾] [Type ▾] [Main ▾] [Refine]
```

- Applied chips come first, filled (`.chip-tog.is-on`) with a trailing × and the accessible name “Remove {label}”. Then the remaining quick chips, unfilled. Then group chips. “Refine” is always last.
- When anything is applied, a quiet “Clear all” sits at the end of the results header.
- The row scrolls horizontally on phone and tablet (no visible scrollbar on touch, a soft fade at the right edge). It wraps on desktop.

### 6.2 Quick chips

| Chip | Type | Writes |
|------|------|--------|
| “Easy” | toggle | `effort_levels` |
| “Under 30 min ▾” | single-select menu: “Under 30 min”, “Under 45 min”, “Under 60 min”, “Any time” | `quick` or `max_minutes` (§2.2). The chip label shows the choice. |
| “Simple ingredients” | toggle | `ingredient_complexities` |
| “Cuisine ▾”, “Type ▾”, “Main ▾” | group chip | Opens Refine at that group (phone/tablet) or a popover (desktop). With selections: the value (“Mexican”) for one, “Cuisine · 2” for more. |
| “Refine” | button | All groups. “Refine · {n}” when `{n}` values are applied that aren’t visible in the row (for example a flavor). |

There is no “Under 20” option: the fastest dinner takes 25 minutes.

### 6.3 Text search

- `<input type="search">`, visually hidden label “Search dinners”, placeholder “Try salmon, tacos, or Thai”, a clear button (“Clear search”).
- The client sends the typed text as `query.text`, unchanged except trimming. Matching is the contract’s literal token rule (every token must hit; three or more characters may be a prefix). No stemming, no fuzzy matching, no client rewriting of text into criteria. That is D-06.
- **Vocabulary suggestions.** While typing (2+ characters, 150ms debounce), a listbox may offer up to four vocabulary terms whose display name starts with the typed text, from the same option lists as Refine (§6.4), for example “Mexican · Cuisine”, “Salmon · Main ingredient”, “Tacos · Type of dinner”, then always “Search for “{text}””. Choosing a term adds that chip and clears the text. Enter, or choosing the last row, runs text search. This is an explicit pick from a closed list, not interpretation; nothing is applied unless the person chooses it.
- Results update 250ms after typing stops, and immediately on Enter. URL updates with `replaceState` (§9.2).

### 6.4 Refine sheet (phone and tablet)

A `.sheet` `<dialog>` titled “Refine”. Groups in order, each an `h3` with `.chip-tog` options:

| Group | Options | Semantics |
|-------|---------|-----------|
| “Time” | Any time · Under 30 min · Under 45 min · Under 60 min | radio |
| “Effort” | Easy — helper “Only easy dinners.” | checkbox |
| “Ingredients” | Simple ingredients — helper “Only dinners with familiar ingredients.” | checkbox |
| “Type of dinner” | Vocabulary `meal_style` terms with `on_menu: true` | checkboxes |
| “Main ingredient” | Vocabulary `ingredient` terms with `on_menu: true` | checkboxes |
| “Cuisine” | Vocabulary `cuisine` terms with `on_menu: true` | checkboxes |
| “Flavor” | Vocabulary `flavor` terms with `on_menu: true` | checkboxes |
| “Lean toward” (after a divider; switch rows) | “Keep it easy”, “Keep ingredients simple”, helper “These sort the list. They don’t hide anything.” | switches |

**Where options come from.** One closed list: the taste vocabulary from `/api/tastes/catalog` (already used by Taste Profile), filtered to `on_menu: true`, labels from `display_name`. The client does not keep its own cuisine, style, or ingredient lists. Texture terms (Crispy, Creamy, Crunchy, Tender) are not offered: `criteria.flavors` matches flavor terms only (§16 gap 5).

**What each option sends.** The vocabulary slug. One exception, for cuisines: the original catalog stores cuisines like `italian-inspired` and many of those meals carry no cuisine vocabulary tag, while the contract matches cuisines literally. So a cuisine option sends its slug **plus** `{slug}-inspired` when the vocabulary term lists an “{name} inspired” synonym (Indian, Thai, Japanese, Italian, Chinese, Scandinavian). Example: “Italian” sends `cuisines: ["italian", "italian-inspired"]`. This is derived mechanically from the vocabulary, not a separate alias table. §16 gap 4 asks the contracts owner to fold this into the server.

**Rules:**

- No per-option counts in V1. The contract has no facet counts, and the client must not compute them (§16 gap 6).
- Groups with more than 8 options show 8 (vocabulary order) and “Show all {n}”.
- Each change re-requests in the background (`limit=1`, debounced 200ms) to update the footer. Results behind the sheet update when it closes.
- Sticky footer: quiet “Clear all” left; primary “Show {total} dinners” right (“Show 1 dinner”; at 0, disabled “No dinners match”).
- Escape, “Close” (×), or the scrim applies and closes. Refinement is never destructive, so there is no cancel.

### 6.5 Household limits

The table’s limits always apply and are not controls here. There is no dietary group in V1 (the contract has no dietary criterion, §16 gap 1). The table note (§6.6) states that limits apply. Discovery never names whose limit removed a dinner.

### 6.6 Table note and “Who’s eating”

One line under the page title (`.disc-table`), from `context.participant_ids` in the response:

- Everyone active: “For everyone · Fits everyone’s limits”. If no participant has a limit: “For everyone”.
- A subset: “For {names}” (Cycle 3 name rules: “you”, two names, then “and {n} more”) + “ · Fits their limits” when relevant. One person: “Just you” or “Just {name}”.
- Standalone only: a trailing quiet “Change” (`aria-label` “Change who’s eating”) opens the participants sheet (Cycle 3 §6.3 pattern; at least one checked). Saving sends `participant_ids` (URL `participant_id`, repeated). Choosing everyone again omits it.
- Plan modes: read-only, “For Dinner {p}: {names}” or “For Dinner {p}: everyone”. Who’s eating is edited on the plan.

---

## 7. Cards and results

### 7.1 Card anatomy

```
┌──────────────────────────────────┐
│      [photo 4:3, mealMediaHtml]  │
├──────────────────────────────────┤
│ ON YOUR PLAN · DINNER 4          │ ← plan status, only when relevant
│ Miso-Ginger Salmon               │ ← title, max 2 lines
│ ⏱ 35 min · Easy · Simple ingr.   │ ← meta row
│ You told us you love Japanese    │ ← taste reason, optional
│ [Use this]                       │ ← plan modes only
└──────────────────────────────────┘
```

**Always:**

1. **Photo.** 4:3, `mealMediaHtml` called with `recipe_slug` (and `recipe_version_id`), never by title alone, because the image title map only knows the original 24 meals. `-640` variant in grids and shelves, 1200 for the lead card, `loading="lazy"`, decorative `alt=""`. Unknown image: the quiet placeholder.
2. **Title.** As returned. `h3`. Clamp to 2 lines; full text in the accessible name.
3. **Meta row.** “{total_minutes} min” with the clock icon (omit when null). Then “Easy” only if `effort_level === "easy"`. Then “Simple ingredients” only if `ingredient_complexity === "simple"`. Neutral `.badge--sm` pills, at most three. On phone grids “Simple ingredients” shows as “Simple”, with the full phrase in `aria-label`.

**Sometimes:**

4. **Reason line** (one line max), only from taste:
   - `primary_reason: taste_love` → “You told us you love {terms}”
   - `primary_reason: taste_like` → “You said you like {terms}”
   `{terms}` are up to two display names from `taste_hits`, the existing `tasteHitSentences` wording. Use “{name} loves …” when the hit is another participant’s. Every other `primary_reason` (explicit_*, text_match, soft_*, recent_demoted, diversity_preferred, novelty_tiebreak, eligible_catalog_fit, taste_less_often, soft_pref_relaxed) produces **no line**: the person chose the filter, or the code describes ordering, not a reason to cook. Not shown on phone two-column grids.
5. **Plan status** (eyebrow above the title), computed by the client from the current plan (`/api/dinner-plans/current`), as display only:
   - “On your plan · Dinner {p}” (or the date form “On your plan · Tue, Oct 6”) when that slug is on the plan in `planned` or `selected`.
   - “Tonight’s pick” when it is the selected meal.
   - Nothing for cooked, rated, skipped, or abandoned meals.
   In `replace_plan_meal`, other nights’ dinners can appear in results; they show this status so the person sees they would be repeating a dinner.
6. **Mode CTA** (plan modes only), `btn-secondary btn-sm`: “Use this” (replace) or “Add this” (choose).

**Never on a card:** `rank`, scores, percentages, “match”, “Top pick”, “#1”, moderate / involved / standard / adventurous, cuisine or format raw values, dietary or allergen lists, “Fits your limits”, emoji or the legacy plate glyph, ingredient or step counts, average ratings, servings, calories, price, hearts, bookmarks, “New”, “Popular”, or more than one reason line.

### 7.2 Card interaction

- The card is a real link, `<a href="/meal/{slug}?from=find">` on the title, stretched over the card with `::after`, so long-press and middle-click work. The mode CTA is a separate control above the overlay, not nested in the link.
- CTA accessible names: “Use {title} for Dinner {p}” / “Add {title} to Dinner {p}”.
- Hover (pointer only): photo scales to 1.02, shadow deepens, `--duration-fast`. None under `prefers-reduced-motion`.
- Pressed (touch): `--color-surface-sunken` overlay at 50%.

### 7.3 Variants

| Variant | Used for | Photo | Reason line | CTA |
|---------|----------|-------|-------------|-----|
| `lead` | First card of the first shelf | 1200, large | yes | plan modes |
| `shelf` | Shelves | 640 | yes | plan modes |
| `grid` | Results | 640 | tablet and up | plan modes |

### 7.4 Results view

The `find` view switches from shelves to results when the query has text or any criteria. Clearing everything returns to shelves (same view, no navigation).

- **Results header** (`h2`, the live-region target): “{total} dinners” / “1 dinner”; with text: “{total} dinners for “{text}””; when the query equals a shelf’s: the shelf title, with “{total} dinners” as `.meta`.
- Then the soft summary line (§4) and “Clear all”.
- One request with `limit=50`. All results render; no pagination, no infinite scroll. Images lazy-load.
- While a request is in flight, keep the previous results at 60% opacity with `aria-busy="true"`. After 600ms, a thin progress bar under the chip row. No spinner over content.

---

## 8. Modes, CTAs, and actions

### 8.1 CTA matrix

“Open plan” = the current dinner plan exists and is not closed (Cycle 3 §3.2). “Recipe” = recipe detail opened from Discovery.

| Mode | Plan state | Card | Recipe sticky primary | Recipe sticky secondary |
|------|-----------|------|-----------------------|-------------------------|
| `standalone` | No open plan | — | “Cook tonight” | “Add to my shopping list” |
| `standalone` | Open plan, recipe not on it | — | “Cook tonight” | “Add to plan” |
| `standalone` | Open plan, recipe on it (`planned`) | — | “Cook tonight” (selects that meal) | “On your plan · Dinner {p}” + quiet “See plan” |
| `standalone` | Open plan, it’s Tonight’s pick or cooking | — | Cycle 3 §11.3 actions (“Start cooking” / “Back to the kitchen”) | quiet “See plan” |
| `replace_plan_meal` | — | “Use this” | “Use this for Dinner {p}” (single-dinner plan: “Use this for tonight”) | — |
| `choose_for_plan` | — | “Add this” | “Add this to Dinner {p}” | — |

- Recipe actions use the existing single `.sticky-actions.recipe__actions` bar. No second sticky bar.
- Desktop: the bar sits in the right column under the recipe media, primary above secondary.
- Phone: side by side when both fit at 390px, otherwise stacked, primary on top.

### 8.2 Standalone actions

Standalone `selection.action` is `none`, so the client composes existing dinner-plan ops. Each mutation re-runs eligibility; the client re-renders from the returned `plan`.

**“Cook tonight”, no open plan.**

1. `POST /api/dinner-plans { meal_count: 1, entry_point: "find_dinner", participant_ids }` with no `fill` (creates an empty one-dinner plan).
2. Mutations: `add_meal { recipe_version_id, participant_ids }`, then `finalize`, then `select_meal`.
3. Stay on the recipe. Sticky bar becomes Cycle 3 §11.3 `selected` (“Start cooking”). Toast: “It’s tonight’s pick.”
4. The detail view’s nav context becomes `tonightPlan`; `replaceState` the history entry so Back goes to Tonight.

**“Cook tonight”, open plan, recipe not on it.** `set_count` (+1), `add_meal`, `select_meal`. Same result and toast. At 14 dinners: inline “Your plan is full. Skip or remove a dinner first.” with quiet “See plan”. List effects per Cycle 3 §9.

**“Cook tonight”, recipe already on the plan as `planned`.** `select_meal` on that meal.

**“Add to my shopping list”, no open plan.** Create as above, `add_meal`, `finalize`, open `shopList`.

**“Add to plan”.** §8.4.

Errors: `hard_limit_blocked` → “That one doesn’t work for everyone at this dinner. Pick another.” (possible when the plan’s participants differ from Discovery’s Who’s eating). `plan_full` → “Your plan is full. Add a night first.” Network → “We couldn’t reach the kitchen. Try again.”

### 8.3 Plan-mode actions (`selection`)

A pick sends exactly what `selection` describes: `POST {selection.path}` with `{ op: selection.op, meal_id: selection.meal_id, recipe_version_id: <result's recipe_version_id>, participant_ids: selection.participant_ids }`, nulls omitted. Always pass the result’s `recipe_version_id`; without it `swap_meal` would pick for the person.

| Mode | `selection.op` | On success |
|------|----------------|------------|
| `replace_plan_meal` | `swap_meal` | Toast “Swapped in {title}.” The card on the plan gets “Swapped in” (Cycle 3 §5.3), focus on its title. |
| `choose_for_plan` with an empty row | `swap_meal` on that row | Toast “{title} is on Dinner {p}.” |
| `choose_for_plan` without `meal_id` | `add_meal` | Toast “{title} is on Dinner {p}.” |

After success, return to the plan surface that opened Discovery with `history.go(-n)` to that entry (§9.2), so Discovery and recipe entries don’t stay in the back stack. Shopping-list toasts follow Cycle 3 §5.3 and §9.

Errors (a search hit is not a promise; the plan may have changed):

- `outcome_locked` / `version_locked` / `illegal_transition`: “That dinner’s already cooking or done, so it can’t change now.” with “Back to your plan”.
- `hard_limit_blocked`: inline on the card or sticky bar, Cycle 3 copy; stay and re-request.
- `plan_full` (choose without a row): “Your plan is full. Add a night first.” with “Back to your plan”.

### 8.4 Add to plan (standalone, open plan)

**No open slot** (no empty row and `meals.length === meal_count`): one tap commits `set_count` (+1), then `add_meal` with Discovery’s participants. Toast “Added as Dinner {p}.” with “See plan” (`planReview`, edit mode if finalized). The secondary becomes “On your plan · Dinner {p}” + quiet “See plan”. At 14 dinners the button is disabled with the helper “Your plan is full.”

**Open slot(s)** (an empty row, or room under `meal_count`): tapping opens a small `.sheet`:

- Title: “Add {title} to your plan”
- One row per open slot: “Dinner {p}”, sub-line “Open” (or the date). Commits `swap_meal` on that empty row (or `add_meal` when the room is not a row).
- “Add a night”, sub-line “Your plan becomes {n + 1} dinners.” (hidden at 14). Commits `set_count` + `add_meal`.
- Note by plan state: not finalized, none; finalized and shopping not started, “Your shopping list updates.”; shopping started, “Its ingredients show up on your list as new items.”
- Quiet “Not now”.

There is no “replace a dinner” row. Replacing starts from the plan (swap sheet or More), where the person sees what they’re replacing.

### 8.5 Recipe detail from Discovery

Reuse `detail` and its tabs. Data stays `GET /api/recipes/{slug}` (results don’t carry ingredients), servings = Discovery participant count. The version a pick pins is the result’s `recipe_version_id`.

- Context line under the title:
  - standalone: “Just looking. Nothing changes until you choose.”
  - replace: “Swapping Dinner {p} · Now: {current title}”
  - choose: “For Dinner {p}”
- “Why this one”: only when the card had a taste reason line; show that line. No filler.
- Meta: the same minutes / Easy / Simple ingredients pills.
- Sticky bar: §8.1.
- Back: `history.back()`, restoring Discovery (§9.3). Label “Back”.

---

## 9. Routes, URL, and history

### 9.1 URLs

The browser URL uses the **contract’s query-string parameter names** (`D07-QUERY-CONTRACT.md` “Query string”), so a Discovery URL is the API query string minus paging. Build it with the contract’s `serializeQueryString` order and drop `schema`, `limit`, and `offset`.

| Route | Example |
|-------|---------|
| Standalone, first open | `/find` |
| Standalone, results | `/find?text=bowl&effort=easy` · `/find?cuisine=italian,italian-inspired&quick=1` |
| With a soft override | `/find?keep_it_easy=1&keep_ingredients_simple=0` (present only when the person toggled) |
| Who’s eating subset | `/find?participant_id=mem_a&participant_id=mem_b` |
| Replace | `/find?mode=replace_plan_meal&dinner_plan_id=dp_1&meal_id=dpm_2` |
| Choose a slot | `/find?mode=choose_for_plan&dinner_plan_id=dp_1&meal_id=dpm_3&position=3` |
| Recipe from Discovery | `/meal/{recipe_slug}?from=find` (route already served) |

- Fetch = `GET /api/discovery/search?` + the same string + `&limit=…&offset=0`. One parser for both.
- When the response’s canonical `query` or `context` differs from the URL (dropped or normalized values), `replaceState` the canonical URL.
- A 400 from a hand-edited URL (`*_invalid`, `unknown_field`) drops back to `/find` with no message.
- Plan-mode URLs survive refresh; the server re-reads the plan. `outcome_locked`, `meal_not_found`, `plan_full` → the §8.3 copy with “Back to your plan”. `plan_not_found` / `forbidden_cross_household` → “This plan isn’t in your kitchen.” with “Go home”.
- Signed-out visitors follow the existing recovery flow (`DEEP-LINKS.md`) and return to the same URL.

Server work: add `/find` to the worker `spaPaths` (`src/index.js`) and `public/_routes.json` so refreshes serve `index.html`.

### 9.2 What creates a history entry

| Action | History |
|--------|---------|
| Open Discovery | `pushState` |
| Type, toggle chips, Refine, Clear all, Who’s eating, “See all”, a “Remove …” chip | `replaceState` (typing debounced 250ms). Back leaves Discovery rather than undoing chips one by one. |
| Open a recipe | Save `{ scrollY, focusSlug, shelfX }` into the current entry’s `history.state.find`, then `pushState` `/meal/{slug}?from=find` |
| “Cook tonight” / “Add to my shopping list” | `replaceState` the recipe entry with its new context, or `pushState` `shopList` |
| “Use this” / “Add this” | `history.go(-n)` to the plan entry that opened Discovery |

This is the first in-app use of `pushState`. Composer adds a small, route-table-driven `popstate` handler for `find` and `detail?from=find` only, so D-04 can extend it to other views.

### 9.3 Restore on Back

1. Rebuild state from the URL.
2. Render at once from a `sessionStorage` cache keyed by the canonical URL (5-minute life), then re-request in the background and re-render only if result slugs changed.
3. Restore `scrollY` after first render (`requestAnimationFrame`), and shelf scroll positions best effort.
4. Focus the title link of `focusSlug`; if it’s gone, the results header.

### 9.4 The Find tab remembers

Tapping “Find” opens the last standalone Discovery URL from this tab session (`sessionStorage`). Tapping it while already on Find returns to `/find` and scrolls to top. Plan-mode URLs are never remembered as the tab’s state.

---

## 10. Swap sheet integration

The swap sheet stays as in Cycle 3 §6.1 and `D03-D01-RELEASE.md` (three alternatives, “Use this”, Keep closes without change, Escape closes, a failed swap stays open). One addition:

- Footer, first, quiet: “See all options” (`data-action="swap-see-all"`, accessible name “See all options for Dinner {p}”, single mode “See all options for tonight”).
- Shown when the sheet has at least one alternative.
- Tap: close the sheet (no mutation, no toast), open `replace_plan_meal` for that meal. Focus moves to Discovery’s `h1`.
- Back from Discovery: the origin with the sheet **closed**, focus on that card’s “Swap”.
- The sheet’s three alternatives come from the planner preview; Discovery’s order comes from the discovery pipeline. They may differ. Both enforce the same limits.

Footer order: “See all options” · “Keep {current title}” · (multi-dinner) “Make it leftovers or a night out”. Stacked full width on phone.

---

## 11. Empty, loading, and error states

Empty states are `.empty-state` in the results area. Search and chips stay usable above them. Never show a dinner the server didn’t return, and never suggest a “similar” dish for a missing word. Pick the state from a `200` with `total: 0`:

### 11.1 Nothing matches the words for this table

When `query.text` is set and no `explicit_*` exclusion count is non-zero (the text removed everything that fit).

- Title: “Nothing here matches “{text}” for this table”
- Body: “It may not be on the menu yet, or it may not work with everyone’s limits. Try another word, or look through these.”
- Below: the first-open shelves for this context.
- Button: “Clear search”; standalone also “Change who’s eating”.

The pipeline runs hard eligibility before text, so the screen cannot tell “not on the menu” from “blocked by a limit”, and the copy says both honestly. Do not name the blocking limit or show `ineligible_hard_limit` counts.

### 11.2 Too many refinements

When any `explicit_*` exclusion count is non-zero.

- Title: “No dinners match all of that”
- Body: “Loosen one thing:”
- One `.chip-tog` per applied value whose exclusion code has a non-zero count, at most three, highest count first, ties in criteria order: “Remove Under 30 min”, “Remove Korean”, “Remove Easy”. One tap removes it (`replaceState`). Accessible name “Remove {label}”.
- Map codes to chips: `explicit_quick` / `explicit_max_minutes` → the time chip; `explicit_effort` → Easy; `explicit_complexity` → Simple ingredients; `explicit_cuisine`, `explicit_meal_style`, `explicit_flavor`, `explicit_ingredient` → each applied value in that group (one chip per value if few, or “Remove cuisine” for a group of 3+).
- No “{n} dinners” on these chips: `excluded_counts` counts the first criterion each meal failed, not what removing it would return.
- Quiet “Clear all”. The table’s limits and plan exclusions are never offered.

### 11.3 Nothing fits the table

When the query is empty and `total` is 0 (every meal failed hard eligibility, or plan exclusions removed the rest).

- Standalone: title “Nothing on the menu fits this table yet”, body “Between everyone’s limits, none of our dinners work. Try a different table.”, button “Change who’s eating”. No shelves.
- Plan modes: “That’s every dinner that fits Dinner {p} right now.” with “Back to your plan”.

### 11.4 Short shelf sets

If only one or two shelves pass the gate, show those. No padding shelves, no “More coming soon”.

### 11.5 Loading

- First open: up to four skeleton shelves (title bar + four card skeletons; phone shows 1.3 cards). No weave loader; that is for “Weaving your plan…”.
- Refinement: §7.4.
- Skeletons use `--color-surface-sunken`; no shimmer under `prefers-reduced-motion`.

### 11.6 Errors

- Network, `catalog_unavailable`, `catalog_source_required`: keep the last good render; above it a `.card`: “We couldn’t reach the kitchen. Try again.” with “Try again”.
- `unauthorized`: the existing recovery flow.
- Plan-mode errors: §8.3 and §9.1.

---

## 12. Screens by breakpoint

Breakpoints and chrome follow `FLAVORWEAVE-BRAND.md`. Standalone is `full` chrome; plan modes are `focus`.

### 12.1 Standalone, first open

- Title (`h1.title`): “Find a dinner”
- Lede: “Everything here fits your table. Have a look around.”
- Table note (§6.6).
- Quiet button at the end of the header row: “Pick one for us” (`data-action="pick-one"`, the existing single-mode flow, `entry_point: "find_dinner"`).

**Phone (< 768):**

```
┌────────────────────────────────────┐
│ FlavorWeave                     ⚙︎ │
├────────────────────────────────────┤
│ Find a dinner       Pick one for us│
│ Everything here fits your table.   │
│ For everyone · Fits everyone’s limits  Change
│ ┌────────────────────────────────┐ │ sticky on scroll
│ │ 🔍 Try salmon, tacos, or Thai  │ │
│ └────────────────────────────────┘ │
│ [Easy][Under 30 min▾][Simple ingr…]→│
│                                    │
│ Good matches              See all  │
│ Picked from what your table likes  │
│ ┌────────────────────────────────┐ │
│ │        photo 4:3 (lead)        │ │
│ ├────────────────────────────────┤ │
│ │ Teriyaki Tofu Bowls            │ │
│ │ ⏱ 40 min · Simple              │ │
│ │ You told us you love Japanese  │ │
│ └────────────────────────────────┘ │
│ ┌─────────┐┌─────────┐┌──         │ 280px cards, scroll →
│ │ photo   ││ photo   ││           │
│ │ Title   ││ Title   ││           │
│ └─────────┘└─────────┘└──         │
│ Easy                      See all  │
│ Short on steps, light on fuss      │
│ ┌─────────┐┌─────────┐┌──         │
├────────────────────────────────────┤
│ Home  Tonight  [Find]  History  Profile │
└────────────────────────────────────┘
```

- Shelf cards 280px (about 1.3 visible at 390px), 16px gap, page-padding insets at both ends.
- Only shelf 1 has a lead card; its other cards follow in the row.
- The search field and chip row stick under the app header once the title scrolls away.

**Tablet (≥ 768):** top nav, no tab bar. Lead card uses `.tonight-hero` (copy left, photo right, about 50/50). Shelf cards 300px.

**Desktop (≥ 1024):** `.page--wide`.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ FlavorWeave     Home  Tonight  [Find]  History  Profile                   ⚙︎ │
├──────────────────────────────────────────────────────────────────────────────┤
│ Find a dinner                                              Pick one for us   │
│ Everything here fits your table. Have a look around.                          │
│ For everyone · Fits everyone’s limits  Change                                 │
│ [🔍 Try salmon, tacos, or Thai                    ]  max 640px               │
│ [Easy] [Under 30 min ▾] [Simple ingredients] [Cuisine ▾] [Type ▾] [Main ▾] [Refine]
│ ┌──────────────────────────────┬───────────────────────────────────────────┐ │
│ │ GOOD MATCHES                 │                                           │ │
│ │ Teriyaki Tofu Bowls          │            photo 4:3 (1200)               │ │
│ │ ⏱ 40 min · Simple ingredients│                                           │ │
│ │ You told us you love Japanese│                                           │ │
│ │ [See the recipe]             │                                           │ │
│ └──────────────────────────────┴───────────────────────────────────────────┘ │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            See all Good matches →│
│ Easy · Short on steps, light on fuss                              See all 16 │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                                  │
│ Under 30 minutes · On the table in half an hour                   See all 11 │
│ …                                                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Shelves are rows of 4 cards (5 at ≥ 1440), no horizontal scroll. “See all {total}” right-aligned.
- Lead card: `btn-secondary` “See the recipe” (the whole card is also the link).
- Chip row wraps; group chips open popovers (§12.3).

### 12.2 Plan-mode header (all breakpoints)

`focus` chrome: Back, no tab bar, nothing lit.

| | `replace_plan_meal` | `choose_for_plan` |
|---|---|---|
| Eyebrow | “Swap Dinner {p}” (single plan: “Swap tonight’s dinner”) | “Dinner {p}” (or the date) |
| Title | “Find something else” | “Pick a dinner” |
| Lede | “Now: {current title}” | “Anything here works for this dinner.” |
| Table note | “For Dinner {p}: {names}” (read-only) | same |
| “Pick one for us” | not shown | not shown |

Shelves, search, chips, and results are the same as standalone. Cards carry the mode CTA.

**Phone, replace mode, results:**

```
┌────────────────────────────────────┐
│ ← Back                             │
├────────────────────────────────────┤
│ SWAP DINNER 2                      │
│ Find something else                │
│ Now: Teriyaki Tofu Bowls           │
│ For Dinner 2: everyone             │
│ [🔍 Search dinners             ]   │
│ [Easy ×][Under 30 min▾][Cuisine▾]→ │
│ 7 dinners                Clear all │
│ Easier dinners first · from your plan  Change
│ ┌───────────────┐┌───────────────┐ │
│ │ photo         ││ photo         │ │
│ │ Sesame Soba…  ││ Maple Mustard…│ │
│ │ ⏱25 · Easy ·  ││ ⏱25 · Easy ·  │ │
│ │ Simple        ││ Simple        │ │
│ │ [Use this]    ││ [Use this]    │ │
│ └───────────────┘└───────────────┘ │
└────────────────────────────────────┘
```

### 12.3 Results

| Width | Grid | Card | Refinement UI |
|-------|------|------|---------------|
| < 768 | 2 columns, 12px gap | `grid`, no reason line | Chip row + Refine bottom sheet (max 90vh, inner scroll, sticky footer) |
| ≥ 768 | 3 columns, 16px gap | `grid` + reason line | Chip row + Refine as a centered 560px dialog |
| ≥ 1024 | 4 columns, 24px gap | same | Chip row wraps. Group chips open an anchored popover (320px wide, max 420px tall) with that group and a “Done” button; changes apply live. “Refine” opens a 640px dialog with every group. No sidebar. |
| ≥ 1440 | 5 columns | same | same |

Popovers are modal `<dialog>`s with a transparent scrim (consistent focus handling). Escape or “Done” closes and returns focus to the chip.

### 12.4 Recipe from Discovery (phone, standalone with an open plan)

```
┌────────────────────────────────────┐
│ ← Back                             │
│ [photo 4:3]                        │
│ Miso-Ginger Salmon                 │
│ Just looking. Nothing changes until you choose.
│ ⏱ 35 min · Easy · Simple ingredients
│ [Overview][Ingredients][Steps][Notes]
├────────────────────────────────────┤
│ [ Cook tonight ]  [ Add to plan ]  │ existing .recipe__actions
└────────────────────────────────────┘
```

### 12.5 Add-to-plan sheet (phone)

```
┌────────────────────────────────────┐
│ Add Miso-Ginger Salmon to your plan│
│ │ Dinner 3                 Open  → │
│ │ Add a night                      │
│ │ Your plan becomes 5 dinners.   → │
│ Its ingredients show up on your    │
│ list as new items.                 │
│              [Not now]             │
└────────────────────────────────────┘
```

### 12.6 Too many refinements (phone)

```
│ 0 dinners                Clear all │
│ ┌────────────────────────────────┐ │
│ │ No dinners match all of that   │ │
│ │ Loosen one thing:              │ │
│ │ [Remove Under 30 min] [Remove Korean] [Remove Easy]
│ └────────────────────────────────┘ │
```

---

## 13. Accessibility

- **Headings.** `h1` page title, `h2` per shelf and the results header, `h3` card titles. Focus to `h1` when Discovery opens; to the results header after Refine closes or a “Remove …” chip is used.
- **Landmarks.** Search field + chip row are `role="search"`, labelled “Find dinners”. Each shelf is a `<section aria-labelledby>` with a `<ul role="list">`.
- **Shelves.** Plain lists; no carousel roles, no auto-advance. Tab moves card to card and scrolls the focused card into view (`inline: "nearest"`). No hover-only arrows.
- **Live results.** One polite live region announces “{total} dinners” (or the empty-state title) 500ms after results settle. Not during typing.
- **Suggestions.** ARIA 1.2 combobox: `aria-expanded`, `aria-controls` a `listbox`, arrows move `aria-activedescendant`, Enter chooses, Escape closes the list, a second Escape clears the text.
- **Chips.** Toggles are `<button aria-pressed>`. The time chip is a menu button with `menuitemradio` items. Applied chips’ × is part of the button, named “Remove {label}”. Group chips have `aria-haspopup="dialog"` and a name with the selection (“Cuisine, 2 selected”).
- **Refine.** `<dialog>`, focus trapped and returned to the opener. Groups are `role="group"` with `aria-labelledby`; Time is a radio group; Lean toward rows are `role="switch"` with `aria-checked`.
- **Cards.** One link per card with a stretched hit area; the CTA is a separate button. Link name: “{title}, {m} minutes{, easy}{, simple ingredients}{, on your plan, Dinner p}”.
- **Targets.** Chips and CTAs at least 44×44 (chips 40px tall visually, 44px hit area). Five tabs at 390px are 78px wide.
- **Color.** Applied vs unapplied chips differ by fill and the ×, not color alone. All five themes pass `test/theme-contrast.test.js` for new token pairs.
- **Motion.** Hover scale, sheet transitions, and shimmer off under `prefers-reduced-motion`. `forced-colors`: chips get a border; applied uses `Highlight`.
- **Zoom.** At 200% text on phone, the 2-column grid drops to 1 column (container query, 320px card minimum).

---

## 14. Component inventory (MealDiscovery)

Client modules:

| Module | Responsibility |
|--------|----------------|
| `public/discovery-state.js` | Pure: browser URL ⇄ request (contract parameter names), chip ⇄ `criteria` mapping (§2.2), cuisine `-inspired` expansion (§6.4), “query equals shelf” check, empty-state choice from `excluded_counts`, reducer for chip/refine events. Unit-tested against the contract fixtures (`EXPLICIT_EASY_FIXTURE`, `QUICK_NOT_EASY_FIXTURE`, `EMPTY_QUERY_FIXTURE`). |
| `public/discovery-ui.js` | String-template renderers (like `planning-ui.js`): shelves, cards, chip row, Refine body, empty states, add-to-plan sheet. No fetching. |
| `public/app.js` | The `find` view controller: requests, `popstate`, cache, actions (§8), plan mutations. |
| `public/nav-context.js` | `find` section, chrome, nav lighting, `detail` origin `find` (`D07-NAV-DECISION.md`). |

The browser cannot import `src/discovery/` directly (server modules). `discovery-state.js` mirrors only parameter names and the 30-minute value; a unit test asserts they equal `src/discovery/constants.js` so they cannot drift.

Components:

| Component | Notes |
|-----------|-------|
| `MealDiscovery` | The `find` view; shelves when the query is empty, results otherwise. |
| `DiscoveryHeader` | Mode-aware eyebrow/title/lede (§12.1, §12.2); “Pick one for us” in standalone. |
| `TableNote` + `WhoIsEatingSheet` | §6.6; sheet reuses the Cycle 3 participants pattern. |
| `SearchField` + `SuggestionList` | §6.3. |
| `ChipRow`, `Chip` (`toggle`, `applied`, `menu`, `group`) | §6.1–6.2. |
| `RefineSheet` / `RefineDialog` (desktop) / `RefinePopover` (desktop, one group) | §6.4, §12.3. |
| `FilterGroup` | Heading, options from the vocabulary, “Show all {n}”, radio or checkbox semantics. |
| `LeanToggles` + `LeanSummary` | §4. |
| `CollectionShelf` | Title, sub-line, “See all”, horizontal list (phone/tablet) or 4/5-up row (desktop). |
| `DiscoveryCard` (`lead`, `shelf`, `grid`) + `MetaRow` | §7. |
| `ResultsHeader`, `ResultsGrid` | §7.4. |
| `DiscoveryEmpty` (`text`, `relax`, `nothing_fits`) + `RemoveChips` | §11. |
| `SkeletonShelf`, `SkeletonCard` | §11.5. |
| `AddToPlanSheet` | §8.4. |
| `DetailActions` (existing `.recipe__actions`) | New Discovery variants (§8.1). |
| Swap sheet “See all options”; meal options “Find something else”; empty slot “Pick one yourself” | §10, §3. |

New icon: `#i-search` (magnifier) in the inline sprite, for the Find tab and the search field.

---

## 15. Analytics

Existing `track()` channel.

| Event | Props |
|-------|-------|
| `discovery_opened` | `mode`, `entry` (`nav`, `home_hero`, `tonight`, `swap_see_all`, `meal_more`, `empty_slot`) |
| `discovery_shelf_see_all` | `shelf` (`good_matches`, `easy`, `quick`, `simple`) |
| `discovery_query_changed` | criteria field names only, `text_len`, `total` |
| `discovery_empty` | `kind` (`text`, `relax`, `nothing_fits`) |
| `discovery_remove_chip` | `field` |
| `discovery_recipe_opened` | `mode`, `recipe_slug`, `from` (`shelf:{slug}`, `results`) |
| `discovery_action` | `mode`, `action` (`cook_tonight`, `add_to_plan`, `add_to_list`, `use_this`, `add_this`), `recipe_slug` |
| `discovery_pick_one` | — |

Never log raw search text in V1.

---

## 16. Contract gaps found while designing (for the PR #24 owner)

These are not invented here. The UI works around each one in V1 as stated, and they are candidates for the contracts branch.

| # | Gap | V1 UI behavior | Possible contract change |
|---|-----|----------------|--------------------------|
| 1 | No dietary criterion (vegetarian, no dairy, …) | No dietary chips; no Plant-forward shelf. Household limits still apply. | A `criteria.diet` list evaluated through `assessMealEligibility` as an extra diner. |
| 2 | No protein / ingredient-group criterion | No Fish & seafood shelf; Main ingredient options are individual vocabulary terms. | Server-owned ingredient groups (fish, shellfish, …) or vocabulary parent terms. |
| 3 | No “different from recent cooks” selection | No Something different shelf. | A selection flag that drops `recent_slugs` cuisines/formats (a filter, not only stage-7 order). |
| 4 | Cuisine matching is literal; many original meals store `{x}-inspired` without a cuisine tag | Cuisine options also send `{slug}-inspired` (§6.4). | Map vocabulary synonyms to `dish.cuisine` server-side. |
| 5 | `criteria.flavors` doesn’t match texture terms | Texture terms not offered. | Match texture vocabulary too, or add `criteria.textures`. |
| 6 | No facet counts | Refine shows no per-option counts; “Remove …” chips show no counts. | Optional `facets` on the response. |
| 7 | Empty slot shape: architecture says a row with a null slug; Cycle 3 derives empties from `meal_count − meals.length` | “Pick one yourself” sends `meal_id` when a row exists, otherwise opens `choose_for_plan` without one (`add_meal`). | Confirm one representation. |
| 8 | Leftovers / eating-out rows are not search targets | “Plan a dinner here instead” keeps the Cycle 3 §6.4 swap-sheet flow. | Allow `choose_for_plan` on those rows with a composed selection. |

---

## 17. What Composer must not invent

- No query schema, parameter names, reason enum, mode names, or Quick constant beyond the contracts.
- No client-side eligibility, filtering, de-duplication, or re-ordering of results.
- No favorites, bookmarks, hearts, “save for later”, or recently viewed.
- No LLM, chat, generated text, or client parsing of search text into criteria (D-06).
- No “Something adventurous”, “Popular”, “Trending”, “New”, or cuisine shelves; no deferred shelves (§16) faked with hand-picked lists.
- No rank, scores, match, tier, or “Top pick” in UI, `aria-label`s, or `title`.
- No moderate / involved / standard / adventurous wording.
- No “Quick” label; no pantry language for Simple ingredients.
- No dietary, Vegan, or Plant-based chip in V1.
- No sort control, no filter sidebar, no pagination or infinite scroll.
- No Discovery-specific plan writes: only existing `/api/dinner-plans` ops, as `selection` or §8.2 says.
- No `set_planning_preferences` from Discovery.
- No growth of the `meal-media.js` title map; pass `recipe_slug`.
- No changes to shopping list, Kitchen mode, rating, D-05, or D-06.
- Catalog stays 50. No production deploy as part of D-07 implementation without the usual promote step.

---

## 18. Implementation slices and acceptance checks

Suggested order, each slice shippable to preview. Slice 0 is PR #24.

1. **State and routing.** `discovery-state.js` + tests (contract fixtures round-trip; constants parity); `/find` SPA path and `_routes.json`; nav-context; 5-tab bar; `#i-search`; `popstate` for `find` and `detail?from=find`.
2. **Standalone UI.** Header, table note, search + suggestions, chip row, Refine, shelves, results, cards, empty states, skeletons.
3. **Recipe and standalone actions.** Context line, sticky variants, Cook tonight, Add to my shopping list, Add to plan + sheet.
4. **Plan modes.** Replace and choose via `selection`; swap sheet “See all options”; meal options “Find something else”; empty slot “Pick one yourself”.
5. **Copy changes and e2e.** §3.2; “Pick one for us”; update specs that clicked `find-dinner` expecting a proposal.

Acceptance checks (unit, route, Playwright in QA mode):

1. **Never blank.** First open shows at least one shelf for a typical household.
2. **Shelf gate.** A shelf with `total < 4` doesn’t render. No “Something adventurous”, Fish & seafood, Plant-forward, or Something different shelf exists in V1.
3. **Good matches honesty.** A household with no tastes sees “Fits your table”.
4. **Hard limits win.** A No-dairy table never sees dairy anywhere, including for text “paneer”, which shows §11.1.
5. **Quick ≠ Easy.** Unrestricted table: “Under 30 min” → 11; with “Easy” → 4; “Easy” alone keeps the 60-minute sheet-pan chicken. No card or chip says “Quick”. The request carries `quick: true`, not `effort_levels`.
6. **Soft vs hard.** “Keep it easy” on: `total` unchanged, easy first, request has `soft`. “Easy” on: only easy, request has `criteria.effort_levels: ["easy"]`.
7. **Plan chips inherit.** Replace mode on a plan with `keep_it_easy: true`: request omits `soft`, response `soft_source: "plan_intent"`, line reads “Easier dinners first · from your plan”. Turning it off sends `soft` with both false and leaves `plan.intent` unchanged.
8. **Replace hides only the current meal.** Other nights’ dinners can appear, with “On your plan · Dinner {p}”.
9. **Selection.** “Use this” sends `selection.op` with the result’s `recipe_version_id`; only that meal changes; Back from the plan doesn’t reopen Discovery.
10. **Choose into an empty row** sends `swap_meal` on that row, not `add_meal`.
11. **Add to plan.** Finalized plan with no open slot: adds a night, toast “Added as Dinner {p}.”; after shopping started its ingredients are “Added” rows.
12. **Cook tonight, no plan.** Creates a one-dinner plan, selects the meal, “Start cooking” shows, Back goes to Tonight.
13. **History restore.** Search “bowl”, add Easy, scroll, open the 3rd card, Back: URL, chips, results, scroll, and focus restored.
14. **Deep link.** Cold-load `/find?cuisine=mexican&quick=1`: Mexican at 30 minutes or less; refresh keeps it; signed-out returns here after recovery.
15. **URL = contract.** The browser query string parses with the contract’s `parseQuery` to the same query the screen sent.
16. **Empty states.** A zero-result combination with criteria shows up to three “Remove …” chips without counts.
17. **Forbidden words and fields.** Scan the `find` view and Discovery detail (text and `aria-label`s) for §0.6 words and for any rendered `rank`, score, or tier.
18. **Card hygiene.** At most three meta pills and one reason line per card.
19. **Responsive.** Screenshots at 390, 768, 1280, 1440px, first open and results, Signature and Dark Mode. Desktop: no horizontal shelf scroll, no sidebar.
20. **Tabs.** Five tabs at 390px, each ≥ 44px; Find lit only in standalone.

---

## Appendix A. Catalog facts behind these decisions (50 meals)

| Fact | Count | Used for |
|------|-------|----------|
| `effort_level` easy / moderate / involved | 16 / 29 / 5 | Easy shelf; never name the other two |
| `ingredient_complexity` simple / standard / adventurous | 22 / 26 / 2 | Simple ingredients shelf; no adventurous shelf |
| Easy and simple | 13 | D-01 tier 0 |
| `total_minutes` ≤ 30 / ≤ 45 / ≤ 60 | 11 / 34 / 44 | Time options; fastest is 25, so no “Under 20” |
| ≤ 30 and easy | 4 | Quick ≠ Easy |
| Fish or shellfish main ingredient | 9 | Fish & seafood (deferred, §16 gap 2) |
| No meat, poultry, fish, or shellfish (approximate) | about 30 | Plant-forward (deferred, §16 gap 1) |
| Largest cuisine (American, incl. Cajun) | 10 | No cuisine shelves |

Counts come from `catalog/*/v{latest}.json` and `data/d03-backfill-classifications-r2.json` on `main`. The server computes real counts per table; the shelf gate keeps thin shelves out as the catalog changes.
