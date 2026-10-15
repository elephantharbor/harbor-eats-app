#!/usr/bin/env python3
"""Wave-16 wave-level docs generator.

Reads the 15 candidate packages, notes/existing-185.tsv, notes/coverage-stats.json (run tools/coverage_stats.py
first), and each candidate's STRUCTURAL_PREFLIGHT.json / FREEZE_INTEGRITY.json, and writes:
  WAVE.json, README.md, coverage.md, notes/curator-notes.md, notes/wave16-roster.tsv
selection-rationale.md and rejected.md are curator-authored text and are not rewritten here.
Never touches candidate packages or image files. Never certifies, imports, or deploys.

  cd wave-16 && python3 tools/coverage_stats.py && python3 tools/write_docs.py
"""
import collections
import datetime
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import common  # noqa: E402

WAVE = HERE.parent
CAND = WAVE / "candidates"
NOW = datetime.datetime.now().astimezone().isoformat(timespec="seconds")
IMAGE_ONLY = {"image_exists_master", "image_exists_card", "provenance_generation_date", "no_denial_strings"}

# protein class of each wave-16 meal, same classes as notes/existing-185.tsv
PROTEIN = {
    "sichuan-mapo-tofu-shiitake": "veg", "korean-japchae-vegetables": "veg", "indonesian-gado-gado-tempeh": "veg",
    "russian-mushroom-stroganoff": "veg", "sicilian-pasta-alla-norma": "veg", "turkish-mucver-zucchini-fritters": "veg",
    "southern-shrimp-and-grits": "shellfish", "goan-shrimp-ambot-tik": "shellfish", "cambodian-fish-amok": "fish",
    "persian-sabzi-polo-salmon": "fish", "jamaican-escovitch-snapper": "fish", "hawaiian-ahi-poke-bowl": "fish",
    "austrian-pork-schnitzel-potato-salad": "meat", "cuban-picadillo-rice": "meat", "thai-yum-nua-beef-salad": "meat",
}

rows = []
for d in sorted(p for p in CAND.iterdir() if (p / "v1.json").exists()):
    doc = json.loads((d / "v1.json").read_text())
    v, dish = doc["recipe_version"], doc["dish"]
    f = json.loads((d / "FREEZE_INTEGRITY.json").read_text()) if (d / "FREEZE_INTEGRITY.json").exists() else {}
    s = json.loads((d / "STRUCTURAL_PREFLIGHT.json").read_text()) if (d / "STRUCTURAL_PREFLIGHT.json").exists() else {}
    fails = sorted(c["id"] for c in f.get("checks", []) if c["result"] != "PASS")
    rows.append({
        "slug": dish["slug"], "title": dish["title"], "description": dish["description"], "cuisine": dish["cuisine"],
        "format": dish["meal_format"], "primary": dish["primary_ingredient"], "protein": PROTEIN[dish["slug"]],
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
assert N == 15, f"expected 15 candidates, found {N}"
assert sorted(r["slug"] for r in rows) == sorted(common.PLANNED)
order = {s: i for i, s in enumerate(common.PLANNED)}
rows.sort(key=lambda r: order[r["slug"]])

S = json.loads((WAVE / "notes" / "coverage-stats.json").read_text())
BASE = S["base_n"]
base_rows = [l.split("\t") for l in (WAVE / "notes" / "existing-185.tsv").read_text().splitlines() if l.strip()]
assert len(base_rows) == BASE == 185, (len(base_rows), BASE)
bp = collections.Counter(r[5] for r in base_rows)
np_ = collections.Counter(r["protein"] for r in rows)
chicken = sum("chicken" in r[7].lower() for r in base_rows)
base_cuis = {r[2] for r in base_rows}
new_cuis = sorted({r["cuisine"] for r in rows} - base_cuis)
over90 = sum(int(r[6]) > 90 for r in base_rows)
over60 = sum(int(r[6]) > 60 for r in base_rows)
hh = sum(r["hh001"] for r in rows)
all_sp = all(r["structural"] == "PASS" for r in rows)
all_img_only = all(r["freeze_image_only"] for r in rows)
images = sum(r["asset_generated"] for r in rows)
times = sorted(r["total"] for r in rows)
REV = "/".join(sorted({r["revision"] for r in rows}))


def pct(n, d):
    return f"{100 * n / d:.0f}%"


WAVE_JSON = {
    "wave": "wave-16", "batch_id": "wave-16-2026-10-15", "generated_at": NOW,
    "purpose": "15 new dinner meals taking the catalog from 185 to 200 (approved exception to the Harbor Eats hold; catalog content only, no features, no AI expansion).",
    "creator": "Grok Bot (Curator, creator role)", "image_generator": "Cora via Grok Bot GenerateImage",
    "package_revision": REV, "candidates": N, "base_meals": BASE, "catalog_after": BASE + N,
    "batches": dict(collections.Counter(r["batch"] for r in rows)),
    "hh001_eligible": hh, "protein_mix": dict(np_), "chicken_meals": 0,
    "structural_preflight": f"{sum(r['structural'] == 'PASS' for r in rows)}/{N} PASS",
    "freeze_integrity": (f"{sum(r['freeze'] == 'PASS' for r in rows)}/{N} PASS" if images == N else "image-only fails on all packages (image_exists_master, image_exists_card, provenance_generation_date, and the pending slot token in v1.json)"
                         if all_img_only and not images else f"{sum(r['freeze'] == 'PASS' for r in rows)}/{N} PASS"),
    "heroes_generated": images, "prompts_file": "/workspace/wave16-prompts.txt",
    "v2_prompts_file": "/workspace/wave16-v2-prompts.txt (copy: notes/prompts-v2-selfreview.txt)",
    "selfreview_v2": {s: r["v1_rejection"] for s, r in common.SELFREVIEW_V2.items()},
    "image_gen_map": "notes/image-gen-map.txt",
    "certified": False, "imported": False, "published": False, "d1_touched": False, "deployed": False, "pull_request": None,
    "meals": [{k: r[k] for k in ("slug", "title", "cuisine", "protein", "batch", "total", "effort", "complexity", "hh001", "state")} for r in rows],
}
(WAVE / "WAVE.json").write_text(json.dumps(WAVE_JSON, indent=2, ensure_ascii=False) + "\n")

roster = ["slug\tbatch\tcuisine\tprotein\tprimary\tprep\tcook\ttotal\teffort\tcomplexity\thh001\tallergens\tenum_gaps\tstate\tstructural\tfreeze_checks\tfreeze_fails"]
for r in rows:
    roster.append("\t".join(map(str, [r["slug"], r["batch"], r["cuisine"], r["protein"], r["primary"], r["prep"], r["cook"], r["total"],
                                      r["effort"], r["complexity"], r["hh001"], ",".join(r["allergens"]), ",".join(r["enum_gaps"]) or "-",
                                      r["state"], r["structural"], r["freeze_checks"], ",".join(r["freeze_fails"]) or "-"])))
(WAVE / "notes" / "wave16-roster.tsv").write_text("\n".join(roster) + "\n")

table = ["| # | Slug | Batch | Cuisine | Protein | Time (prep+cook=total) | Effort / complexity | HH001 |", "|---|---|---|---|---|---|---|---|"]
for i, r in enumerate(rows, 1):
    table.append(f"| {i} | `{r['slug']}` | {r['batch']} | {r['cuisine']} | {r['protein']} | {r['prep']}+{r['cook']}={r['total']} min | {r['effort']} / {r['complexity']} | {'yes' if r['hh001'] else 'no'} |")

STATES = "/".join(sorted({r["state"] for r in rows}))
if images == N:
    v2s = ", ".join(f"`{x}`" for x in common.SELFREVIEW_V2)
    REVC = collections.Counter(r["revision"] for r in rows)
    REVLINE = ", ".join(f"{n} at `{k}`" for k, n in sorted(REVC.items())) + (" (author-r3 = text-only revision after audit r1; images unchanged)" if "author-r3" in REVC else "")
    STATE = (f"State: all {N} packages frozen with heroes: {REVLINE}. Cora generated every hero with Grok Bot GenerateImage: {N - len(common.SELFREVIEW_V2)} from the author-r1 prompts "
             f"(`/workspace/wave16-prompts.txt`) and {len(common.SELFREVIEW_V2)} ({v2s}) as v2 regenerations after Cora's creator self-review rejected v1; the v2 prompts are "
             "recorded verbatim in each image-prompt.md (source `/workspace/wave16-v2-prompts.txt`), v1 is kept in `rejected/` and recorded as superseded. "
             "Master 1200x900 and card 640x480 WebPs are 4:3 center crops of the 1280x720 sources. Nothing here is certified, imported, published, or deployed, and D1 was not touched.")
    FREEZE_LINE = f"- Freeze integrity (`freeze_integrity.py`) with heroes: {sum(r['freeze'] == 'PASS' for r in rows)}/{N} PASS ({rows[0]['freeze_checks']} checks each). Image hashes match notes/image-gen-map.txt."
    NEXT = ("1. Independent audit r2 of the author-r3 packages (see notes/AUDITOR_HANDOFF-r2.md)." if "author-r3" in REVC else "1. Independent audit (see notes/AUDITOR_HANDOFF.md).") + " Certification, import, and publication are separate later steps."
else:
    STATE = (f"State: recipe text frozen at `{REV}` for all {N} packages. Hero images are next: Cora generates each one from its `image-prompt.md` (all 15 prompts are also in `/workspace/wave16-prompts.txt`), "
             "then `tools/finalize_images.py` exports the WebPs and re-freezes the package at author-r2. Nothing here is certified, imported, published, or deployed, and D1 was not touched.")
    FREEZE_LINE = "- Freeze integrity: image-only fails until the heroes are finalized."
    NEXT = ("1. Cora generates the heroes and runs `python3 tools/finalize_images.py <slug> --generator \"Cora via Grok Bot GenerateImage\"`.\n"
            "2. Re-run the structural preflight and freeze integrity, then `tools/mark_preflight.py`.\n3. Independent audit.")

readme = f"""# FlavorWeave Catalog Factory: wave-16

Fifteen new dinner meals that take the Harbor Eats catalog from {BASE} to {BASE + N}. This is an approved exception to the Harbor Eats hold: catalog content only, with no product features and no AI expansion. All work ran on Grok Bot.

{STATE}

## Meals

{chr(10).join(table)}

## Checks

- Structural preflight (`node factory/tools/structural_preflight.mjs`): {sum(r['structural'] == 'PASS' for r in rows)}/{N} PASS.
{FREEZE_LINE}
- `tools/mark_preflight.py` set `structural_qa_state` to `{STATES}` on all {N}; both preflights were re-run afterwards.
- Builder guards (`tools/build_packages.py`): near-duplicate guard against the {BASE} existing meals and the legacy set, pot size against water volume, boil-up minutes inside the step clock, no untimed waits, counted equipment named in the 1- and 2-serving scaling notes, description words present in the ingredients, step clocks consistent with stated minutes, and the props guard (styling props limited to recipe items and neutral tableware).

## Files

- `coverage.md`: coverage analysis of the {BASE} existing meals and what wave-16 adds.
- `selection-rationale.md`: why these 15.
- `rejected.md`: ideas considered and dropped.
- `notes/existing-185.tsv`, `notes/coverage-stats.json`, `notes/wave16-roster.tsv`, `notes/curator-notes.md`.
- `notes/structural-r*.log`, `notes/freeze-r*.log`: preflight runs.
- `tools/`: builder, recipes (`recipes_w16_a.py`, `_b.py`, `_c.py`), preflight marker, image finalizer, stats, and this docs generator.

## Next steps (not done here)

{NEXT}

Generated {NOW} by tools/write_docs.py.
"""
(WAVE / "README.md").write_text(readme)

def counter_line(c, total):
    return ", ".join(f"{k} {v} ({pct(v, total)})" for k, v in c.most_common())

coverage = f"""# Wave-16 coverage analysis

Base: the {BASE} existing meals ({S['live_n']} live in harbor-eats-app/catalog before wave-15, plus the {S['wave15_n']} wave-15 meals). The full list with cuisine, format, primary ingredient, protein class, and total time is in `notes/existing-185.tsv`; counts are in `notes/coverage-stats.json`.

## Protein balance

| Protein class | Base ({BASE}) | Wave-16 ({N}) | After ({BASE + N}) |
|---|---|---|---|
""" + "\n".join(f"| {k} | {bp.get(k, 0)} ({pct(bp.get(k, 0), BASE)}) | {np_.get(k, 0)} | {bp.get(k, 0) + np_.get(k, 0)} ({pct(bp.get(k, 0) + np_.get(k, 0), BASE + N)}) |"
                 for k in ("veg", "meat", "fish", "poultry", "shellfish")) + f"""

- Poultry is {bp['poultry']} meals, {chicken} with chicken in the title. Wave-16 adds no chicken and no poultry.
- Shellfish is the thinnest class: {bp['shellfish']} meals (mussels, clams, scallops, calamari, crab cakes), and shrimp leads only a pasta, a sheet-pan boil, and a laksa. Wave-16 adds two shrimp dinners in formats the catalog lacks (shrimp and grits; a Goan shrimp curry).
- Fish: {bp['fish']} meals, but salmon leads only two and raw or steamed fish formats are missing. Wave-16 adds four fish dinners, all HH001: a steamed custard (amok), herbed rice with salmon, a pickled-topping fried snapper, and a no-cook poke bowl.
- Vegetarian: {bp['veg']} meals, but tofu leads only {sum('tofu' in r[7].lower() for r in base_rows)} and tempeh one, and zucchini and eggplant have no pasta or fritter lead. Wave-16 adds six vegetarian dinners, two of them plant-based HH001 (mapo tofu, japchae).
- Other proteins: pork and beef as weeknight formats that are not slow braises (a schnitzel, a 45-minute picadillo, a seared-steak salad).

## Cuisine

- The base is led by american ({S['cuisine']['base'].get('american', 0)}), mexican, japanese, mediterranean, indian, italian, and korean labels.
- New labels in wave-16: {', '.join(new_cuis)}. Sichuan flavor is filed under chinese.
- Wave-16 uses each cuisine once, and only one meal (pasta alla Norma) is in the large Italian cluster.

## Time and effort

- Base time bands: {counter_line(collections.Counter('under 30' if int(r[6]) < 30 else '30-45' if int(r[6]) <= 45 else '46-60' if int(r[6]) <= 60 else '61-90' if int(r[6]) <= 90 else 'over 90' for r in base_rows), BASE)}.
- {over60} base meals run over an hour, {over90} of them over 90 minutes. The catalog does not need more long cooks.
- Wave-16 totals run {times[0]} to {times[-1]} minutes (median {times[len(times) // 2]}); {sum(t <= 45 for t in times)} of {N} are 45 minutes or less, and none needs an oven braise, a marinade, or an overnight step.
- Effort: {counter_line(collections.Counter(r['effort'] for r in rows), N)}. Complexity: {counter_line(collections.Counter(r['complexity'] for r in rows), N)}.

## HH001

Base HH001: {S['hh001']['base'].get('true', S['hh001']['base'].get('True', 0))} of {BASE}. Wave-16: {hh} of {N} (two plant-based, four fish).

## Formats new to the catalog

Steamed fish custard in ramekins, poke bowl (no-cook raw fish), shrimp curry, shrimp and grits, breaded pork cutlet with potato salad, vegetable fritters, sweet potato glass noodles, and a seared-steak main salad.

Generated {NOW} by tools/write_docs.py.
"""
(WAVE / "coverage.md").write_text(coverage)

notes = ["# Wave-16 curator notes", "", f"Creator: Grok Bot (Curator, creator role). Revision `{REV}`. Generated {NOW}.", ""]
for r in rows:
    notes += [f"## {r['slug']}", "", r["description"], "",
              f"- {r['cuisine']}, {r['format']}, primary {r['primary']} ({r['protein']}); batch {r['batch']}",
              f"- prep {r['prep']} + cook {r['cook']} = {r['total']} minutes; {r['effort']} / {r['complexity']}",
              f"- HH001 {'yes' if r['hh001'] else 'no'}; labels {', '.join(r['labels']) or 'none'}; allergens {', '.join(r['allergens'])}"
              + (f"; enum gaps {', '.join(r['enum_gaps'])}" if r["enum_gaps"] else ""),
              f"- structural {r['structural']}; freeze {r['freeze_checks']} (fails: {', '.join(r['freeze_fails']) or 'none'}); state `{r['state']}`", ""]
(WAVE / "notes" / "curator-notes.md").write_text("\n".join(notes))
print(f"wrote WAVE.json, README.md, coverage.md, notes/curator-notes.md, notes/wave16-roster.tsv ({N} meals, structural all PASS={all_sp}, freeze image-only={all_img_only})")
