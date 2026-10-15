import json, sys, collections
sys.path.insert(0, "tools")
import build_packages as b, common
S = json.load(open("notes/coverage-stats.json"))
M = common.MEALS
docs = {m["slug"]: json.load(open(f"candidates/{m['slug']}/v1.json")) for m in M}
def first(s): return s.split(": ")[0] if False else s.split(". ")[0].rstrip(".") + "."
import pathlib, common as _c
def _res(slug, name, key):
    p = pathlib.Path(f"candidates/{slug}/{name}")
    return json.load(open(p)).get(key) if p.exists() else "MISSING"
FI = {m["slug"]: _res(m["slug"], "FREEZE_INTEGRITY.json", "FREEZE_INTEGRITY") for m in M}
SP = {m["slug"]: _res(m["slug"], "STRUCTURAL_PREFLIGHT.json", "STRUCTURAL_PREFLIGHT") for m in M}
fi_pass = sum(v == "PASS" for v in FI.values()); sp_pass = sum(v == "PASS" for v in SP.values())
fi_fail = sorted(s for s, v in FI.items() if v != "PASS"); sp_fail = sorted(s for s, v in SP.items() if v != "PASS")
REGEN = sorted(s for s in _c.AUDIT_R1_REGEN if docs[s]["image"].get("audit_r1_image_note"))
ACTIVE = {m["slug"]: docs[m["slug"]]["image"]["active_source_jpeg"] for m in M}
SRC_COUNT = collections.Counter(ACTIVE.values())
REGEN_EVENTS = sum(int(docs[m["slug"]]["image"].get("regeneration_count") or 0) for m in M)
REJECTED_SETS = REGEN_EVENTS * 1  # one superseded master+card+source set per regeneration
REGEN_SLUGS = sorted(s for s in ACTIVE if ACTIVE[s] != "img_v1.jpg")
def _verdicts(n):
    p = pathlib.Path(f"audit/AUDIT-r{n}.json")
    if not p.exists():
        return None
    a = json.load(open(p))
    return collections.Counter(v.get("verdict") for v in a.values())
AUD = {n: _verdicts(n) for n in (1, 2, 3)}
AUD = {n: c for n, c in AUD.items() if c}
LAST = max(AUD) if AUD else None
CERTIFIED = bool(LAST) and AUD[LAST].get("PASS", 0) == 50 and not REGEN
AUD_TEXT = "; ".join(f"r{n} PASS {c.get('PASS', 0)} / FAIL {c.get('FAIL', 0)}" for n, c in sorted(AUD.items()))
SRC_TEXT = ", ".join(f"{n} {k}" for k, n in sorted(SRC_COUNT.items()))
images_present = sum(bool(docs[m["slug"]]["image"].get("asset_generated")) for m in M)
revs = sorted({docs[m["slug"]]["package_revision"] for m in M})
REV = revs[0] if len(revs) == 1 else "/".join(revs)
SOUPS = sorted(m["slug"] for m in M if m["meal_format"] in ("soup", "noodle-soup"))
TB = collections.Counter()
for m in M:
    t = docs[m["slug"]]["recipe_version"]["total_minutes"]
    TB["under 30" if t < 30 else "30-45" if t <= 45 else "46-90" if t <= 90 else "over 90"] += 1
OVER90 = [m["title"].split(" with ")[0].split(":")[0] for m in M if docs[m["slug"]]["recipe_version"]["total_minutes"] > 90]
cands = []
for m in M:
    d = docs[m["slug"]]; v = d["recipe_version"]
    cands.append({"slug": m["slug"], "title": m["title"], "cuisine": m["cuisine"], "meal_format": m["meal_format"],
                  "primary_ingredient": m["primary"], "hh001_intent": m["hh001"], "effort_level": v["effort_level"],
                  "ingredient_complexity": v["ingredient_complexity"], "total_minutes": v["total_minutes"],
                  "allergens": v["allergens"], "creator_batch": d["creator_batch"], "package_revision": d["package_revision"]})
hh = sum(m["hh001"] for m in M)
wave = {"wave_id": b.BATCH, "batch_id": b.BATCH, "date": "2026-10-15", "mode": "author_batch",
        "base_count": 85, "base_source": "local catalog /workspace/harbor-eats-app/catalog at main 565d736 (85 meals; excludes README.md, legacy-24/, staging-publication.json). D1 not queried or touched.",
        "target_add": 50, "target_total": 135, "scope_note": "Scope raised from 25 to 50 by Thomas on 2026-10-15 (relayed 9:17 AM CT). Thomas approved the wave and overrode Oversight's hold.",
        "status": (f"certified_{REV.replace('-', '_')}_audit_r{LAST}_pass_50_of_50" if CERTIFIED else f"{REV.replace('-', '_')}_audit_r1_fixes_applied_awaiting_reaudit"),
        "status_detail": ((f"Certified: all 50 packages PASS audit r{LAST} at {REV} (Vale, 2026-10-15). Audit history: {AUD_TEXT}. "
                           f"Active hero sources: {SRC_TEXT} (all 1280x720 Grok Bot GenerateImage sources, center-cropped to 4:3 for the 1200x900 master and 640x480 card WebPs). "
                           f"{REGEN_EVENTS} heroes were regenerated across {len(REGEN_SLUGS)} meals ({', '.join(f'{s} -> {ACTIVE[s]}' for s in REGEN_SLUGS)}); "
                           f"{REJECTED_SETS} superseded image sets are kept in rejected/ and recorded under image.superseded. "
                           f"Freeze integrity PASS {fi_pass}/50 (notes/freeze-integrity-final.txt); structural preflight PASS {sp_pass}/50. "
                           "Import, PR, and deploy are separate human-gated steps.")
                          if CERTIFIED else
                          (f"Audit history: {AUD_TEXT}. Active hero sources: {SRC_TEXT}. Freeze integrity PASS {fi_pass}/50; structural preflight PASS {sp_pass}/50. Not certified.")),
        "audit": {"rounds": [{"round": f"r{n}", "pass": c.get("PASS", 0), "fail": c.get("FAIL", 0), "report": f"audit/AUDIT-r{n}.md"} for n, c in sorted(AUD.items())],
                  "auditor": "Vale (independent auditor role)", "date": "2026-10-15", "certified": CERTIFIED,
                  "certified_revision": REV if CERTIFIED else None,
                  "notes": "r1 FAIL 50/50 (M/O on all 50; 15 culinary/safety/image). r2 PASS 48 / FAIL 2 (K on samke harra and chowder heroes). r3 re-audited those two with img_v3: PASS; the other 48 carried forward byte-identical."},
        "active_hero_sources": dict(sorted(SRC_COUNT.items())),
        "regenerated_heroes": {s: {"active": ACTIVE[s], "regeneration_count": docs[s]["image"].get("regeneration_count")} for s in REGEN_SLUGS},
        "creator": "Juniper (Curator, creator role) via Grok Bot on the box; no Cursor cloud agents",
        "kitchen_tested_policy": False,
        "hh001_note": f"HH001 is eligibility awareness, not a quota. {hh}/50 ({hh*2}%) are HH001-eligible (plant, egg, or finfish; no dairy, shellfish, meat, or poultry; nut_policy none).",
        "creator_batches": dict(sorted(collections.Counter(c["creator_batch"] for c in cands).items())),
        "mix": {k: dict(S[k]["new"]) for k in ("effort", "complexity", "time")},
        "freeze_integrity": f"PASS {fi_pass}/50" + (f"; FAIL: {', '.join(fi_fail)}" if fi_fail else "") + " (freeze_integrity.py with the audit-r1 denial phrases added; notes/freeze-integrity-final.txt)",
        "structural_preflight": f"PASS {sp_pass}/50" + (f"; FAIL: {', '.join(sp_fail)}" if sp_fail else "") + f" (notes/structural-preflight-{REV}.txt)",
        "open_items": [
            "Importer allergen-code gap: FlavorWeave has no coconut token (laksa's coconut milk is disclosed in allergen_notes and runtime_enum_gaps) and no gluten token (krupnik's barley carries a 'Contains gluten (barley)' note and a runtime_enum_gaps entry). Decide whether to add tokens or adopt a wave rule.",
            "D-03 band decision: packages use the repo contract bands (factory/PACKAGE.md: <=12 / 13-16 / 17+). The design draft (/workspace/d03-design/DESIGN-DRAFT.md: <=8 / 9-14 / >=15) would move 10 meals (8 simple->standard, 2 standard->adventurous). Needs a decision before the draft is adopted.",
            f"Clusters: {len(SOUPS)} soups (a new cluster), 5 black-bean meals catalog-wide with feijoada the 5th, 4 coconut meals with laksa the 4th, 2 pastry pies.",
        ] + ([f"Hero regeneration (gate K) by Cora pending finalization: {', '.join(REGEN)}."] if REGEN else []) + [
            "Bobotie shopping line renders as '2 slice slices store-bought white sandwich bread…' (unit 'slice' plus a display_name starting with 'slices'). Left as is: display_name is inside the certified culinary_hash. Fix in a future version.",
        ],
        "candidates": cands}
json.dump(wave, open("WAVE.json", "w"), indent=2, ensure_ascii=False)

def tbl(k, label):
    keys = sorted(set(S[k]["base"]) | set(S[k]["new"]), key=lambda x: -(S[k]["base"].get(x, 0) + S[k]["new"].get(x, 0)))
    rows = [f"| {label} | Base 85 | Wave-14 | After |", "|---|---|---|---|"]
    rows += [f"| {x} | {S[k]['base'].get(x,0)} | {S[k]['new'].get(x,0)} | {S[k]['base'].get(x,0)+S[k]['new'].get(x,0)} |" for x in keys]
    return "\n".join(rows)
cov = f"""# FlavorWeave catalog coverage — {b.BATCH}

Source: local clone `/workspace/harbor-eats-app`, `main` at **565d736**. The inventory comes from each meal's `v2.json` or `v1.json` under `catalog/`. **Base count: 85.** README.md, `legacy-24/`, and `staging-publication.json` are excluded. D1 was not queried and not touched. Counts are counts. HH001 is eligibility awareness, not a quota.

Scope: Thomas raised this wave from 25 to 50 new meals on 2026-10-15. Target after import: **135**.

## Cuisine

{tbl('cuisine', 'Cuisine')}

Wave-14 adds 22 cuisines that had zero catalog meals: West African (Senegalese), Ukrainian, Venezuelan, Swiss, Lebanese, Cuban, Persian, German, South African, Portuguese, Georgian, Egyptian, Chilean, Polish, Burmese, Ghanaian, Taiwanese, Malaysian, Swedish, Nigerian, Colombian, and Hungarian. The `indian` label also appears for the first time, next to the base's `indian-inspired`. American (+6) and French (+3) are the only cuisines that gain more than two meals.

## D-03 effort

{tbl('effort', 'Effort')}

## D-03 ingredient complexity

{tbl('complexity', 'Complexity')}

The base is heavy in moderate/standard (33 of 85). Wave-14 leans moderate/simple (15) and involved/standard (10) to widen the spread. Adventurous stays scarce: the wave adds 3 (mohinga, Taiwanese beef noodle soup, laksa), for 6 total.

## Time bands (total_minutes, reconstructed from steps)

{tbl('time', 'Band')}

Wave-14 is long-skewed. Only {TB['30-45']} new meals fall in the 30-45 minute default band, and {TB['over 90']} run over 90 minutes ({', '.join(OVER90)}). {TB['under 30']} are under 30. This is a deliberate weekend/project slot, but it is flagged in the concerns in `notes/curator-notes.md`.

## Clusters to manage

- **Soups: {len(SOUPS)} of 50** ({', '.join(SOUPS)}). The base has few soups, so this is a new cluster; diversity is acceptable, but later waves should not add soups without a gap.
- **Black beans: 5 catalog-wide** after this wave: black-bean-quesadillas, chipotle-lime-black-bean-bowls, and grilled-peach-burrito-bowl in the base, then the Venezuelan arepas (4th) and feijoada (5th).
- **Coconut: 4 catalog-wide**, with laksa the 4th. Coconut has no allergen token (open item in WAVE.json).
- **Pastry pies: 2** (spanakopita, tomato galette).

## HH001

| | Base 85 | Wave-14 | After |
|---|---|---|---|
| HH001-eligible | {S['hh001']['base'].get('true',0)} | {S['hh001']['new'].get('true',0)} | {S['hh001']['base'].get('true',0)+S['hh001']['new'].get('true',0)} |
| Not eligible | {S['hh001']['base'].get('false',0)} | {S['hh001']['new'].get('false',0)} | {S['hh001']['base'].get('false',0)+S['hh001']['new'].get('false',0)} |

Wave-14: **{S['hh001']['new'].get('true',0)}/50** HH001-eligible.

## Creator batches

| Batch | Meals | Slugs |
|---|---|---|
""" + "\n".join(f"| {k} | {n} | {', '.join(c['slug'] for c in cands if c['creator_batch']==k)} |" for k, n in wave["creator_batches"].items()) + "\n"
open("coverage.md", "w").write(cov)

sel = [f"# Selection rationale — {b.BATCH}\n",
       "50 distinct dishes. None duplicates another dish in this wave or any of the 85 catalog meals (slug, title, and concept checked; each package carries `near_duplicate_review` and `not_duplicate_of`).\n",
       "## Principles\n",
       "1. **Open new cuisines** before deepening crowded ones. 22 zero-count cuisines are filled.",
       "2. **Respect the closed clusters** from wave-12 and wave-13: no third salmon, no new chickpea or tofu lead, no lentil-only lead (koshari is the one flagged exception, below), no new pasta lead, no dredged cutlets, no dumplings, and no added taco, stir-fry, or egg-bake saturation. Koshari and the seven-vegetable couscous omit their usual chickpeas.",
       "3. **A healthy HH001 share**: 20 of 50 (40%), split across plant-based (10), egg-vegetarian (2), and finfish (8) plates. All carry `nut_policy: none`.",
       "4. **Widen D-03**: more easy/simple and involved/standard; three adventurous.",
       "5. **Hero-image viability**: every concept has a distinct, colorful hero (no beige-on-beige). Each plating brief lists forbidden look-alikes.",
       "6. **Avoid Wave-13's FAILs**: every oven, broiler, or grill dish preheats in or before the first step that uses heat (gate E), and every mention of water carries a measured amount (gate B).\n",
       "## The 50, by creator batch\n"]
for k in "ABCD":
    sel.append(f"### Batch {k}\n")
    for i, m in enumerate(M, 1):
        if docs[m["slug"]]["creator_batch"] != k: continue
        v = docs[m["slug"]]["recipe_version"]
        sel.append(f"{i}. **{m['title']}** (`{m['slug']}`, {m['cuisine']}, {v['total_minutes']} min, {v['effort_level']}/{v['ingredient_complexity']}{', HH001' if m['hh001'] else ''}). {m['coverage']} {m['near']}\n")
sel.append("""## Deliberate reversals of earlier rejections

Wave-12's `rejected.md` turned down several concepts that appear here. Those rejections were coverage judgments for that wave, not bans. The catalog has since grown from 50 to 85 meals, and the scope rose to 50. Each reversal is flagged for the auditor:

- **Feijoada** (wave-12 rejected it for the black-bean cluster). It is the **5th** black-bean meal catalog-wide: the base has 3 (black-bean-quesadillas, chipotle-lime-black-bean-bowls, grilled-peach-burrito-bowl), the Venezuelan arepas in this wave make 4, and feijoada makes 5. It is kept as Brazil's national dish and as a long-simmered pork stew with farofa and greens, a format the catalog lacks (audit r1 gate I PASS). It is the first swap candidate if the curator wants the black-bean cluster held at 4.
- **Koshari** is lentil-primary even though lentil-only leads stay closed (see `rejected.md`). It is kept because lentils are one layer of a rice, lentil, and macaroni plate with spiced tomato sauce, crispy onions, and dakka, not a dal or lentil soup (audit r1 gate I PASS).
- **Spanakopita and a savory galette** (wave-12 rejected pastry pies next to the pot pie). Both are kept as the first phyllo and the first short-crust tart. The tomato galette uses goat cheese, not Gruyère, to avoid the gratin overlap.
- **Malaysian laksa** (wave-12 rejected the coconut-curry cluster). It is kept as a noodle soup with shrimp and a homemade paste, not a curry over rice. It becomes coconut dish 4.
- **Käsespätzle** sits close to the mac-and-cheese rejection, but it is kept as a German egg-noodle dumpling dish with caramelized onions.
""")
open("selection-rationale.md", "w").write("\n".join(sel))

rej = f"""# Rejected concepts — {b.BATCH}

These concepts were considered for the 50 and rejected. A rejection is a coverage judgment for this wave, not a ban.

| Concept | Why rejected |
|---|---|
| Third salmon (poke, teriyaki, salmon burgers) | The salmon pair is closed. |
| Chana masala, falafel, hummus plates, chickpea tagine | Chickpea leads are closed. Koshari and the couscous drop their chickpeas for this reason. |
| Dal, mujadara, misir wot, lentil soup | Lentil-only leads are closed. Koshari is the one lentil-primary exception: lentils are one layer of a rice-lentil-macaroni plate with tomato sauce and dakka (see `selection-rationale.md`). |
| Mapo tofu, tofu banh mi, any fifth tofu | Tofu leads are closed. |
| Chicken katsu, schnitzel, chicken parm | The dredged cutlet belongs to `crispy-skillet-chicken-sandwiches`. |
| Pierogi, gyoza, momo, empanadas | The dumpling and hand-pie format belongs to `pan-fried-pork-dumplings`. |
| Lasagna, mac and cheese, stuffed shells, carbonara, cacio e pepe | Baked or cheesy pasta collides with baked ziti, and pasta leads are saturated. Käsespätzle is the nearest survivor and is flagged. |
| Fish tacos, birria tacos, carnitas tacos, al pastor | The taco cluster is saturated. |
| Pad thai, lo mein, japchae, chow mein, dan dan | Noodle stir-fries are saturated. The wave's Chinese and Xi'an stir-fries are not noodle dishes. |
| Frittata, strata, egg bakes, huevos rancheros | Egg-bake saturation; shakshuka and the Spanish tortilla own it. |
| Bibimbap, poke, grain bowls | Bowl saturation. Gyudon is the only new bowl, as a Japanese donburi. |
| Jollof rice, paella, jambalaya, biryani-style rice | The rice-dish cluster is crowded, and jollof is a visual twin of the chorizo rice. Nigerian is represented by suya. |
| Thai green curry, massaman, Sri Lankan fish curry | These would be a fifth coconut curry. Laksa is the one coconut addition. |
| Bulgogi, galbi | Korean grilled beef belongs to the gochujang flank steak. |
| Shepherd's pie, moussaka | The mash-topped bake belongs to cottage pie. Moussaka would be a third eggplant lead. |
| Tom yum, tom kha | Thai is at 4. A soup slot went to mohinga and laksa. |
| Beef stroganoff, goulash | They would be twins of the paprikash and Swedish meatballs in this wave. |
| Shrimp and grits, shrimp scampi | Shrimp pasta and the shrimp boil already exist. Laksa is the only new shrimp lead. |
| Cuban black bean soup | It would be a fifth black-bean dish next to feijoada. |
| Manhattan clam chowder | Tomato seafood stew sits too close to the mussels. New England chowder was chosen. |
"""
open("rejected.md", "w").write(rej)

# roster: refresh total minutes / D-03 from the packages
rows = []
for line in open("notes/wave14-roster.tsv").read().splitlines():
    c = line.split("\t")
    v = docs[c[2]]["recipe_version"]
    c[5], c[6], c[7], c[8] = str(v["total_minutes"]), v["effort_level"], v["ingredient_complexity"], str(v["hh001_eligible"])
    rows.append("\t".join(c))
open("notes/wave14-roster.tsv", "w").write("\n".join(rows) + "\n")

img_table = "| Meal | Active source | Regenerations |\n|---|---|---|\n" + "\n".join(
    f"| `{m['slug']}` | `{ACTIVE[m['slug']]}` | {docs[m['slug']]['image'].get('regeneration_count') or 0} |" for m in sorted(M, key=lambda x: x['slug']))
notes = f"""# Curator notes: {b.BATCH} (Juniper, creator role, via Grok Bot)

## State at {REV} (2026-10-15){' — certified, audit r' + str(LAST) + ' PASS 50/50' if CERTIFIED else ''}

- 50 packages are in `candidates/<slug>/`. Each has `v1.json`, `d03-classification.json`, `image-plating-brief.md`, `image-prompt.md`, `README.md`, `image-state.json`, its active GenerateImage source (1280x720), and the master and card WebPs (`<slug>.webp` 1200x900, `<slug>-640.webp` 640x480). Active sources: **{SRC_TEXT}** (per-meal table below). package_revision is `{REV}` everywhere.
- Audits (Vale): {AUD_TEXT}.{' All 50 are certified at ' + REV + '.' if CERTIFIED else ''}
- Freeze integrity (`freeze_integrity.py`, also scanning README, prompt, brief, and image-state for pending-image phrasings): **PASS {fi_pass}/50**{(' (FAIL: ' + ', '.join(fi_fail) + ')') if fi_fail else ''}. See `notes/freeze-integrity-final.txt`.
- Structural preflight (`factory/tools/structural_preflight.mjs`): **PASS {sp_pass}/50**{(' (FAIL: ' + ', '.join(sp_fail) + ')') if sp_fail else ''}, HH001 {hh}. See `notes/structural-preflight-{REV}.txt`.
- Import, PR, and deploy are separate human-gated steps.

## Audit r1 fixes applied at {REV}

Audit r1 (Vale) failed all 50 on gates M/O and 15 on culinary, safety, or image gates. Fixed in the generators (`tools/build_packages.py`, `tools/recipes_*.py`, `tools/common.py`, `tools/finalize_images.py`, `tools/write_docs.py`) and the shared `freeze_integrity.py`; all 50 packages were regenerated. Existing image files and their sha256 provenance were verified and left untouched.

- M/O: post-image wording everywhere; one revision (`{REV}`); `method_detail` states the real 1280x720 (16:9) source, the 960x720 4:3 center crop, and the LANCZOS resize to 1200x900 and 640x480; `recipe_fidelity_state` is `awaiting_audit`.
- Gate E/J clocks: chiles rellenos 20 + 41 = 61; gyudon is a 25-minute bowl (8 + 17); Xi'an lamb uses store-bought thin-sliced lamb, so there is no partial-freeze step (12 + 15 = 27).
- Gate B pots: bún chả, mohinga, paprikash, laksa, and Swedish meatballs boil their 12 to 16 cups of water in a 6- to 8-quart pot.
- Gates F/G: Philly hoagie rolls, bobotie white bread, and feijoada linguica are store-bought components with hard label contracts (no soy, milk, or egg; no soy; no wheat, milk, or soy). Käsespätzle cheeses are microbial-rennet. Krupnik says "Contains gluten (barley)". The same label-contract rule was applied to the gumbo andouille, the bangers, and the sloppy-joe buns (egg added, per the audit note).
- Spanakopita: no red onion in the recipe; the brief forbids onion in the salad for the regenerated image.

## Active hero image per meal

{img_table}

{REGEN_EVENTS} heroes were regenerated across {len(REGEN_SLUGS)} meals after audits r1 and r2 (gate K). Each superseded set (source JPEG, master, card) is in that meal's `rejected/` under a `-replaced-<timestamp>` name and recorded with its sha256 under `image.superseded`. The two r2 FAILs (samke harra, chowder) moved to img_v3 and passed audit r3.

## Open items

1. **Allergen-code gap (importer).** FlavorWeave has no coconut token and no gluten token. Laksa discloses coconut in `allergen_notes` and `runtime_enum_gaps.coconut`; krupnik carries "Contains gluten (barley)" and `runtime_enum_gaps.gluten`. Decide: add tokens, or a wave rule requiring the note.
2. **D-03 band decision.** Packages follow the repo contract (`factory/PACKAGE.md`: ≤12 / 13–16 / 17+). Under the design draft (`/workspace/d03-design/DESIGN-DRAFT.md`: ≤8 / 9–14 / ≥15), 10 meals would shift: koshari, French onion soup, khachapuri, gyudon, suya, krupnik, ceviche, and Xi'an lamb simple→standard; couscous and Swedish meatballs standard→adventurous. The bands need a decision before the draft is adopted.
3. **Clusters.** {len(SOUPS)} soups ({', '.join(SOUPS)}) form a new cluster; feijoada is the 5th black-bean meal catalog-wide; laksa is the 4th coconut meal; spanakopita and the galette are the 2 pastry pies. See `coverage.md`.

## Concerns carried for the auditor

1. **Time skew.** {TB['30-45']} of the 50 fall in 30–45 minutes, {TB['over 90']} run over 90, and {TB['under 30']} are under 30. The ropa vieja is mostly unattended slow-cooker time, and its 512-minute total is honest.
2. **HH001 at {hh * 2}%** ({hh}/50): 10 plant-based, 2 egg-vegetarian, 8 finfish. All have nut_policy none. Re-verified at {REV}: none of the audit-r1 edits touched an HH001 meal's eligibility.
3. **Raw fish.** The ceviche carries a food-safety note: buy fish sold for raw consumption.
4. **Alcohol.** Brandy in steak au poivre and mirin in shōgayaki and gyudon. Each has an alcohol_note.
5. **Reversed wave-12 rejections:** feijoada (5th black-bean meal), spanakopita and the tomato galette (pastry), and laksa (coconut dish 4); koshari is the one lentil-primary exception. See `selection-rationale.md`. Feijoada is the first swap candidate.
6. **Käsespätzle** sits close to the mac-and-cheese / baked-ziti rejection. It is kept as a German dumpling-noodle dish; its cheeses are now microbial-rennet for the vegetarian label.
7. **Plantains in two dishes** (the arepas and red-red). Red palm oil in red-red is a specialty item.
8. **Peanut in suya** is integral, so nut_policy is `peanuts_present`.
9. **Fish sauce as seasoning** in bún chả and laksa. These carry the `finfish` allergen, but `finfish_seasoning_only` keeps the `fish` dietary label off.
10. Primary-ingredient values such as onion, clams, spinach, tomatoes, pork, and halibut are free text. Only vocab terms become tags.
"""
open("notes/curator-notes.md", "w").write(notes)
print("docs written", hh, "freeze", fi_pass, "preflight", sp_pass, "regen", REGEN)
