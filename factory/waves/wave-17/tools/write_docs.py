#!/usr/bin/env python3
"""Wave-17 wave-level docs generator. Adapted from wave-16/tools/write_docs.py.

Reads the 50 candidate packages, notes/existing-200.tsv, notes/coverage-stats.json (run tools/coverage_stats.py
first), and each candidate's STRUCTURAL_PREFLIGHT.json / FREEZE_INTEGRITY.json, and writes:
  WAVE.json, README.md, coverage.md, notes/curator-notes.md, notes/wave17-roster.tsv
selection-rationale.md and rejected.md are curator-authored text and are not rewritten here.
Never touches candidate packages or image files. Never certifies, imports, or deploys.

  cd wave-17 && python3 tools/coverage_stats.py && python3 tools/write_docs.py
"""
import collections, csv, datetime, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import common  # noqa: E402

WAVE = HERE.parent
CAND = WAVE / "candidates"
NOW = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
IMAGE_ONLY = {"image_exists_master", "image_exists_card", "provenance_generation_date", "no_denial_strings"}


def protein(al):
    s = set(al)
    return "meat" if "meat" in s else "poultry" if "poultry" in s else "shellfish" if "shellfish" in s else "fish" if "finfish" in s else "veg"


rows = []
for d in sorted(p for p in CAND.iterdir() if (p / "v1.json").exists()):
    doc = json.loads((d / "v1.json").read_text())
    v, dish = doc["recipe_version"], doc["dish"]
    f = json.loads((d / "FREEZE_INTEGRITY.json").read_text()) if (d / "FREEZE_INTEGRITY.json").exists() else {}
    s = json.loads((d / "STRUCTURAL_PREFLIGHT.json").read_text()) if (d / "STRUCTURAL_PREFLIGHT.json").exists() else {}
    fails = sorted(c["id"] for c in f.get("checks", []) if c["result"] != "PASS")
    rows.append({
        "slug": dish["slug"], "title": dish["title"], "description": dish["description"], "cuisine": dish["cuisine"],
        "format": dish["meal_format"], "primary": dish["primary_ingredient"], "protein": protein(v.get("allergens", [])),
        "hh001": bool(v.get("hh001_eligible")), "labels": v.get("dietary_labels", []),
        "effort": v["effort_level"], "complexity": v["ingredient_complexity"],
        "prep": v["prep_minutes"], "cook": v["cook_minutes"], "total": v["total_minutes"],
        "batch": doc["creator_batch"], "allergens": v.get("allergens", []),
        "enum_gaps": sorted((v.get("runtime_enum_gaps") or {}).keys()),
        "revision": doc["package_revision"], "state": doc["structural_qa_state"],
        "structural": s.get("STRUCTURAL_PREFLIGHT", "MISSING"), "freeze": f.get("FREEZE_INTEGRITY", "MISSING"),
        "freeze_checks": f"{sum(c['result'] == 'PASS' for c in f.get('checks', []))}/{len(f.get('checks', []))}",
        "freeze_fails": fails, "freeze_image_only": set(fails) <= IMAGE_ONLY,
        "asset_generated": bool((doc.get("image") or {}).get("asset_generated")),
    })
N = len(rows)
assert N == 50, f"expected 50 candidates, found {N}"
assert sorted(r["slug"] for r in rows) == sorted(common.PLANNED)
order = {s: i for i, s in enumerate(common.PLANNED)}
rows.sort(key=lambda r: order[r["slug"]])

S = json.loads((WAVE / "notes" / "coverage-stats.json").read_text())
BASE = S["base_n"]
base_rows = list(csv.DictReader(open(WAVE / "notes" / "existing-200.tsv"), delimiter="\t"))
assert len(base_rows) == BASE == 200, (len(base_rows), BASE)
bp = collections.Counter(r["protein"] for r in base_rows)
np_ = collections.Counter(r["protein"] for r in rows)
base_cuis = {r["cuisine"] for r in base_rows}
new_cuis = sorted({r["cuisine"] for r in rows} - base_cuis)
hh = sum(r["hh001"] for r in rows)
base_hh = sum(r["hh001"] == "True" for r in base_rows)
all_sp = all(r["structural"] == "PASS" for r in rows)
all_img_only = all(r["freeze_image_only"] for r in rows)
images = sum(r["asset_generated"] for r in rows)
times = sorted(r["total"] for r in rows)
REV = "/".join(sorted({r["revision"] for r in rows}))
STATES = "/".join(sorted({r["state"] for r in rows}))
plant = sum("plant_based" in r["labels"] for r in rows)
vegetarian = sum("vegetarian" in r["labels"] for r in rows)
peanut_base = sum("peanut" in r["allergens"] for r in base_rows)
peanut_new = sum("peanut" in r["allergens"] for r in rows)


def pct(n, d):
    return f"{100 * n / d:.0f}%"


def band(t):
    t = int(t)
    return "30 or less" if t <= 30 else "31-45" if t <= 45 else "46-60" if t <= 60 else "61-90" if t <= 90 else "over 90"


def counter_line(c, total):
    return ", ".join(f"{k} {v} ({pct(v, total)})" for k, v in c.most_common())


WAVE_JSON = {
    "wave": "wave-17", "batch_id": "wave-17-2026-10-15", "generated_at": NOW,
    "purpose": f"{N} new FlavorWeave dinner meals taking the live catalog from {BASE} to {BASE + N}.",
    "creator": "Grok Bot (Curator, creator role)", "package_revision": REV, "candidates": N, "base_meals": BASE, "catalog_after": BASE + N,
    "base_source": "harbor-eats-app main at 077bd14 (85 base + wave-14 + wave-15 + wave-16)",
    "batches": dict(collections.Counter(r["batch"] for r in rows)),
    "hh001_eligible": hh, "protein_mix": dict(np_), "plant_based": plant, "vegetarian_not_plant_based": vegetarian,
    "structural_preflight": f"{sum(r['structural'] == 'PASS' for r in rows)}/{N} PASS",
    "freeze_integrity": (f"{sum(r['freeze'] == 'PASS' for r in rows)}/{N} PASS" if images == N else
                         f"image-only fails on all {N} packages (image_exists_master, image_exists_card, provenance_generation_date, and the pending slot token in v1.json)"
                         if all_img_only else f"{sum(r['freeze'] == 'PASS' for r in rows)}/{N} PASS"),
    "heroes_generated": images, "prompts_file": "/workspace/wave17-prompts.txt (copy: notes/prompts-author-r1.txt)",
    "regen_prompts_file": "/workspace/wave17-v2-prompts.txt (copy: notes/prompts-regen-selfreview.txt)",
    "selfreview_regenerations": {k: {"accepted": f"v{v['final']}", "rejected": {f"v{n}": why for n, why in v["rejected"].items()},
                                     **({"audit_rejected": {f"v{n}": {"round": rnd, "reason": why} for n, (rnd, why) in common.audit_rej(v).items()}} if v.get("audit_rejected") else {})}
                                 for k, v in common.SELFREVIEW.items()},
    "audit_r1": {"result": "42 PASS / 8 FAIL", "findings": "audit/r1/", "fixed_at": common.R3_REV if common.R3 else None,
                 "author_r3_revised": {k: {"trigger": v["trigger"], "scope": v["scope"]} for k, v in common.R3.items()},
                 "untouched_passing_packages": N - len(common.R3)},
    "audit_r2": {"result": "48 PASS / 2 FAIL (both gate K, hero image only)", "findings": "audit/r2/", "fixed_at": common.R4_REV if common.R4 else None,
                 "author_r4_revised": {k: {"trigger": v["trigger"], "scope": v["scope"]} for k, v in common.R4.items()},
                 "untouched_packages": N - len(common.R4)},
    "audit_r3": {"result": "49 PASS / 1 FAIL (pupusas gate K, hero image only)", "findings": "audit/r3/", "fixed_at": common.R5_REV if common.R5 else None,
                 "author_r5_revised": {k: {"trigger": v["trigger"], "scope": v["scope"]} for k, v in common.R5.items()},
                 "untouched_packages": N - len(common.R5)},
    "image_gen_map": "notes/image-gen-map.txt",
    "certified": False, "imported": False, "published": False, "d1_touched": False, "deployed": False, "pull_request": None,
    "meals": [{k: r[k] for k in ("slug", "title", "cuisine", "protein", "batch", "total", "effort", "complexity", "hh001", "state")} for r in rows],
}
(WAVE / "WAVE.json").write_text(json.dumps(WAVE_JSON, indent=2, ensure_ascii=False) + "\n")

roster = ["slug\ttitle\tbatch\tcuisine\tprotein\tprimary\tprep\tcook\ttotal\teffort\tcomplexity\thh001\tallergens\tenum_gaps\tstate\tstructural\tfreeze_checks\tfreeze_fails"]
for r in rows:
    roster.append("\t".join(map(str, [r["slug"], r["title"], r["batch"], r["cuisine"], r["protein"], r["primary"], r["prep"], r["cook"], r["total"],
                                      r["effort"], r["complexity"], r["hh001"], ",".join(r["allergens"]), ",".join(r["enum_gaps"]) or "-",
                                      r["state"], r["structural"], r["freeze_checks"], ",".join(r["freeze_fails"]) or "-"])))
(WAVE / "notes" / "wave17-roster.tsv").write_text("\n".join(roster) + "\n")

table = ["| # | Slug | Title | Batch | Cuisine | Protein | Time (prep+cook=total) | Effort / complexity | HH001 |", "|---|---|---|---|---|---|---|---|---|"]
for i, r in enumerate(rows, 1):
    table.append(f"| {i} | `{r['slug']}` | {r['title']} | {r['batch']} | {r['cuisine']} | {r['protein']} | {r['prep']}+{r['cook']}={r['total']} min | {r['effort']} / {r['complexity']} | {'yes' if r['hh001'] else 'no'} |")

if images == N:
    regen = {k: v["final"] for k, v in common.SELFREVIEW.items()}
    REGEN_LINE = ", ".join(f"`{k}` v{v}" for k, v in regen.items())
    STATE = (f"State: all {N} packages frozen with heroes at `{REV}`, `structural_qa_state` `{STATES}`. Cora generated every hero with Grok Bot GenerateImage: "
             f"{N - len(regen)} from the author-r1 prompts (`/workspace/wave17-prompts.txt`) and {len(regen)} as creator self-review regenerations ({REGEN_LINE}). "
             "Each regeneration prompt is the v1 prompt plus one appended correction sentence; every version's prompt and rejection reason is recorded word for word in that "
             "package's image-prompt.md, rejected sources are in `rejected/`, and image-plating-brief.md matches the accepted prompt. Master 1200x900 and card 640x480 WebPs are 4:3 "
             "center crops of the 1280x720 sources. "
             + (f"After independent audit r1 (42 PASS / 8 FAIL) the {len(common.R3)} failing packages were revised as author round 3 (`{common.R3_REV}`; three with new heroes after audit gate K "
                "rejections: pupusas v4, ca kho v3, chivito v5); the 42 passing packages are byte-identical to what audit r1 saw. See the r2 addendum in notes/AUDITOR_HANDOFF.md. "
                if common.R3 else "")
             + (f"After audit r2 (48 PASS / 2 FAIL, gate K on the hero only) pupusas and chivito got new heroes as author round 4 (`{common.R4_REV}`; pupusas v5, chivito v6); "
                "the other 48 packages are byte-identical to what audit r2 saw (r3 addendum in notes/AUDITOR_HANDOFF.md). " if common.R4 else "")
             + (f"After audit r3 (49 PASS / 1 FAIL) pupusas got a new v6 hero as author round 5 (`{common.R5_REV}`); the other 49 are byte-identical to what audit r3 saw (r4 addendum). " if common.R5 else "")
             + "Nothing here is certified, imported, published, or deployed, and D1 was not touched.")
    FREEZE_LINE = (f"- Freeze integrity (`freeze_integrity.py`) with heroes: {sum(r['freeze'] == 'PASS' for r in rows)}/{N} PASS ({rows[0]['freeze_checks']} checks each). "
                   "Image hashes match image.file_hashes and notes/image-gen-map.txt.")
    NEXT = ("1. Independent audit r4 of salvadoran-bean-cheese-pupusas (author-r5, hero image, gate K); see the r4 addendum in notes/AUDITOR_HANDOFF.md. Certification, import, and publication are separate later steps."
            if common.R5 else
            "1. Independent audit r3 of the 2 author-r4 packages (pupusas, chivito; hero image, gate K); see the r3 addendum in notes/AUDITOR_HANDOFF.md. Certification, import, and publication are separate later steps."
            if common.R4 else
            "1. Independent audit r2 of the 8 author-r3 packages (see the r2 addendum in notes/AUDITOR_HANDOFF.md). Certification, import, and publication are separate later steps."
            if common.R3 else "1. Independent audit (see notes/AUDITOR_HANDOFF.md). Certification, import, and publication are separate later steps.")
else:
    STATE = (f"State: recipe text frozen at `{REV}` for all {N} packages, `structural_qa_state` `{STATES}`. Hero images are next: each is generated from its `image-prompt.md` "
             f"(all {N} prompts are also in `/workspace/wave17-prompts.txt`), then `tools/finalize_images.py` exports the WebPs and re-freezes the package at author-r2. "
             "Nothing here is certified, imported, published, or deployed, and D1 was not touched.")
    FREEZE_LINE = (f"- Freeze integrity (`freeze_integrity.py`): {rows[0]['freeze_checks']} checks pass on every package; the remaining fails are image-only "
                   "(image_exists_master, image_exists_card, provenance_generation_date, no_denial_strings for the pending image slot) until the heroes are finalized.")
    NEXT = ("1. Generate each hero from its image-prompt.md and run `python3 tools/finalize_images.py <slug> --generator \"<generator>\"`.\n"
            "2. Re-run the structural preflight and freeze integrity, then `tools/mark_preflight.py`.\n3. Independent audit.")

readme = f"""# FlavorWeave Catalog Factory: wave-17

{N} new dinner meals that take the live FlavorWeave catalog from {BASE} to {BASE + N}. All work ran on Grok Bot.

{STATE}

## Meals

{chr(10).join(table)}

## Checks

- Structural preflight (`node factory/tools/structural_preflight.mjs`): {sum(r['structural'] == 'PASS' for r in rows)}/{N} PASS.
{FREEZE_LINE}
- `tools/mark_preflight.py` set `structural_qa_state` to `{STATES}` on all {N}; both preflights were re-run afterwards.
- Builder guards (`tools/build_packages.py`): near-duplicate guard against the {BASE} live meals and the other wave-17 meals, pot size against water volume, boil-up minutes inside the step clock, no untimed waits, counted equipment named in the 1- and 2-serving scaling notes, description words present in the ingredients, step clocks consistent with stated minutes, the props guard, and three wave-17 guards: oil depth against oil volume for every shallow-fry or stated depth, pan and sheet-pan fit (grid packing for rectangles, circle-packing for rounds), and the app's own title-word allergen matcher (`src/lib/eligibility.js`, via `tools/title_tags.mjs`).
- `tools/overlap_report.py`: every overlap step fits inside the steps it runs alongside.

## Files

- `coverage.md`: coverage analysis of the {BASE} live meals and what wave-17 adds.
- `selection-rationale.md`: why these {N}.
- `rejected.md`: ideas considered and dropped.
- `notes/existing-200.tsv`, `notes/coverage-stats.json`, `notes/wave17-roster.tsv`, `notes/curator-notes.md`, `notes/PROGRESS.md`.
- `notes/structural-r*.log`, `notes/freeze-r*.log`, `notes/finalize-r1.log`, `notes/*-author-r3.log`: preflight, freeze and finalize runs (r1-r4 are run numbers; `author-r3` logs are the post-audit round). `notes/prompts-author-r1.txt`: frozen author-r1 prompts. `notes/prompts-regen-selfreview.txt`: regeneration prompts. `notes/image-gen-map.txt`: every generated image with its sha256. `notes/AUDITOR_HANDOFF.md`.
- `tools/`: builder, recipes (`recipes_w17_a.py` to `_e.py`), preflight marker, image finalizer, stats, overlap report, title matcher bridge, and this docs generator.

## Next steps (not done here)

{NEXT}

Generated {NOW} by tools/write_docs.py.
"""
(WAVE / "README.md").write_text(readme)

prot_table = "\n".join(f"| {k} | {bp.get(k, 0)} ({pct(bp.get(k, 0), BASE)}) | {np_.get(k, 0)} | {bp.get(k, 0) + np_.get(k, 0)} ({pct(bp.get(k, 0) + np_.get(k, 0), BASE + N)}) |"
                       for k in ("veg", "meat", "fish", "poultry", "shellfish"))
by_p = collections.defaultdict(list)
for r in rows:
    by_p[r["protein"]].append(r["slug"])
cb = collections.Counter(band(r["total"]) for r in base_rows)
cn = collections.Counter(band(r["total"]) for r in rows)
coverage = f"""# Wave-17 coverage analysis

Base: the {BASE} live meals on harbor-eats-app main at 077bd14 (85 base meals plus waves 14, 15, and 16). The full list with cuisine, format, primary ingredient, protein class, total time, effort, complexity, HH001, and allergens is in `notes/existing-200.tsv`; counts are in `notes/coverage-stats.json`.

## Protein balance

| Protein class | Base ({BASE}) | Wave-17 ({N}) | After ({BASE + N}) |
|---|---|---|---|
{prot_table}

- Poultry is the thinnest land protein: {bp['poultry']} meals ({pct(bp['poultry'], BASE)}). Wave-17 adds {np_['poultry']} poultry dinners, all chicken, each in a format the catalog lacks (Japanese fried cutlet with tartar, tostadas, egg-lemon soup, garlic-cream skillet, preserved-lemon tagine, dumplings, sumac flatbread, sealed-pot stew).
- Shellfish is the thinnest class overall: {bp['shellfish']} meals. (One more, the shrimp pasta, is filed as veg in the old-schema base data, so the true count is 8.) Wave-17 adds {np_['shellfish']}: shrimp saganaki, cioppino, crab Louie, spicy squid, and octopus with potatoes.
- Fish: {bp['fish']} meals. Wave-17 adds {np_['fish']} in species and formats the catalog lacks (catfish, smoked salmon, mackerel sandwich, achiote-baked fish, Amritsari fried fish, cod stew, salmon soup, grilled tilapia).
- Vegetarian: {bp['veg']} meals ({pct(bp['veg'], BASE)}) is already the largest class, so wave-17 keeps it near that share: {np_['veg']} vegetarian meals, {plant} of them plant-based.
- Meat: {np_['meat']} dinners, with pork, lamb, and beef in formats new to the catalog (braised pork rice bowl, dan dan noodles, plov, empanadas, keema, fajitas, cevapi, arayes, a loaded steak sandwich, a hash).
- Peanut: the base already has {peanut_base} peanut dishes. Wave-17 adds {peanut_new}; dan dan noodles are made with sesame paste and no peanuts.

## Cuisine

- The base is led by {', '.join(f"{k} ({v})" for k, v in collections.Counter(r['cuisine'] for r in base_rows).most_common(6))}.
- New cuisine labels in wave-17: {', '.join(new_cuis)}.
- No cuisine appears more than three times in wave-17 (Greek three; Mexican, American, Japanese, Korean, and Vietnamese twice each), and the Italian cluster gets two pastas (vodka penne and orecchiette).

## Time and effort

- Base time bands: {counter_line(cb, BASE)}.
- Wave-17 time bands: {counter_line(cn, N)}. Totals run {times[0]} to {times[-1]} minutes (median {times[len(times) // 2]}).
- Long cooks are limited to three over 90 minutes (menudo, lu rou fan, plov at {times[-1]}); the base already has {cb['over 90']} over 90.
- Effort: {counter_line(collections.Counter(r['effort'] for r in rows), N)}. Complexity: {counter_line(collections.Counter(r['complexity'] for r in rows), N)}.

## HH001

Base HH001: {base_hh} of {BASE} ({pct(base_hh, BASE)}). Wave-17: {hh} of {N} ({pct(hh, N)}), giving {base_hh + hh} of {BASE + N} ({pct(base_hh + hh, BASE + N)}) after the wave. The HH001 meals are the dairy-free vegetarian and finfish dinners; no poultry, meat, or shellfish meal qualifies.

## Formats new to the catalog

Stuffed corn pupusas, pierogi, omurice, Indo-Chinese gobi, fish sandwich (balik ekmek), cioppino, crab Louie, octopus a feira, egg-lemon soup, chicken and dumplings, musakhan flatbread, sealed-pot kedjenou, plov, baked empanadas, lamb-stuffed pita, a loaded steak sandwich, and a Swedish hash.

Generated {NOW} by tools/write_docs.py.
"""
(WAVE / "coverage.md").write_text(coverage)

notes = ["# Wave-17 curator notes", "", f"Creator: Grok Bot (Curator, creator role). Revision `{REV}`. Generated {NOW}.", ""]
for r in rows:
    notes += [f"## {r['slug']}", "", f"**{r['title']}**", "", r["description"], "",
              f"- {r['cuisine']}, {r['format']}, primary {r['primary']} ({r['protein']}); batch {r['batch']}",
              f"- prep {r['prep']} + cook {r['cook']} = {r['total']} minutes; {r['effort']} / {r['complexity']}",
              f"- HH001 {'yes' if r['hh001'] else 'no'}; labels {', '.join(r['labels']) or 'none'}; allergens {', '.join(r['allergens'])}"
              + (f"; enum gaps {', '.join(r['enum_gaps'])}" if r["enum_gaps"] else ""),
              f"- structural {r['structural']}; freeze {r['freeze_checks']} (fails: {', '.join(r['freeze_fails']) or 'none'}); state `{r['state']}`", ""]
(WAVE / "notes" / "curator-notes.md").write_text("\n".join(notes))
print(f"wrote WAVE.json, README.md, coverage.md, notes/curator-notes.md, notes/wave17-roster.tsv ({N} meals, structural all PASS={all_sp}, freeze image-only={all_img_only})")
