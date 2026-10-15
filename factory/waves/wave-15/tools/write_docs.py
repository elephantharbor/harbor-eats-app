#!/usr/bin/env python3
"""Wave-15 wave-level docs generator (replaces the wave-14 copy, whose text described wave-14).

Reads the 50 candidate packages, notes/coverage-stats.json (run tools/coverage_stats.py first),
and each candidate's STRUCTURAL_PREFLIGHT.json / FREEZE_INTEGRITY.json, and writes:
  WAVE.json, README.md, coverage.md, notes/curator-notes.md, notes/wave15-roster.tsv
selection-rationale.md and rejected.md are curator-authored text and are not rewritten here.
Never touches candidate packages or image files. Never certifies, imports, or deploys.

  cd wave-15 && python3 tools/coverage_stats.py && python3 tools/write_docs.py
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
FISH = {"hake", "haddock", "tilapia", "mackerel", "cod", "sardines", "red snapper", "barramundi"}

rows, fi, sp = [], collections.Counter(), collections.Counter()
fi_checks = collections.Counter()
for d in sorted(p for p in CAND.iterdir() if (p / "v1.json").exists()):
    doc = json.loads((d / "v1.json").read_text())
    v, img, dish = doc["recipe_version"], doc.get("image") or {}, doc["dish"]
    f = json.loads((d / "FREEZE_INTEGRITY.json").read_text()) if (d / "FREEZE_INTEGRITY.json").exists() else {}
    s = json.loads((d / "STRUCTURAL_PREFLIGHT.json").read_text()) if (d / "STRUCTURAL_PREFLIGHT.json").exists() else {}
    fi[f.get("FREEZE_INTEGRITY", "MISSING")] += 1
    sp[s.get("STRUCTURAL_PREFLIGHT", "MISSING")] += 1
    chk = f.get("checks", [])
    fi_checks[(sum(c["result"] == "PASS" for c in chk), len(chk))] += 1
    hh = bool(v.get("hh001_eligible"))
    kind = None if not hh else "fish" if dish.get("primary_ingredient") in FISH else "egg" if "egg" in v.get("allergens", []) else "plant"
    rows.append({
        "slug": dish["slug"], "title": dish.get("title") or doc.get("recipe", {}).get("title"), "cuisine": dish["cuisine"],
        "primary": dish.get("primary_ingredient"), "hh001": hh, "hh001_kind": kind,
        "effort": v.get("effort_level"), "complexity": v.get("ingredient_complexity"), "total_minutes": v.get("total_minutes"),
        "batch": doc.get("creator_batch"), "allergens": v.get("allergens", []),
        "runtime_enum_gaps": sorted((v.get("runtime_enum_gaps") or {}).keys()),
        "package_revision": doc.get("package_revision"), "structural_qa_state": doc.get("structural_qa_state"),
        "active_source": img.get("active_source_jpeg"), "image_id": img.get("image_id"),
        "source_dimensions": img.get("source_dimensions"),
        "regenerated_v2": any(h.get("basis") == "creator_self_review_before_audit" for h in (img.get("regeneration_history") or ([img["regeneration"]] if img.get("regeneration") else []))),
        "regeneration_bases": [h.get("basis") for h in (img.get("regeneration_history") or ([img["regeneration"]] if img.get("regeneration") else []))],
        "audit_r1_regenerated": img.get("regenerated_for_audit") == "audit-r1",
        "rejected_sources": [e.get("moved_to_rejected") for e in img.get("superseded", []) if e.get("moved_to_rejected")],
        "kitchen_tested": v.get("kitchen_tested", doc.get("kitchen_tested", False)),
    })
N = len(rows)
assert N == 50, f"expected 50 candidates, found {N}"
revs = sorted({r["package_revision"] for r in rows})
REV = revs[0] if len(revs) == 1 else "/".join(revs)
REV_COUNTS = dict(collections.Counter(r["package_revision"] for r in rows))
AUD = json.loads((WAVE / "audit" / "r1" / "AUDIT-r1.json").read_text()) if (WAVE / "audit" / "r1" / "AUDIT-r1.json").exists() else None
r1_regen = [r for r in rows if r["audit_r1_regenerated"]]
_map = [l.split() for l in (WAVE / "notes" / "image-gen-map.txt").read_text().splitlines() if l.strip()]
MAP_LINE = (f"{len(_map)} lines ({sum(1 for p in _map if len(p) == 2)} v1, " + ", ".join(f"{sum(1 for p in _map if len(p) > 2 and p[2] == t)} {t}" for t in ("v2", "v3"))
            + "); full hashes equal the sha256 of the saved source files; the egyptian-ful-medames v2 line (self-review rejected) carries an 8-character prefix only")
r3_text = sorted(common.R3_TEXT_FIXES)
hh = sum(r["hh001"] for r in rows)
split = collections.Counter(r["hh001_kind"] for r in rows if r["hh001"])
regen = [r for r in rows if r["regenerated_v2"]]
srcdims = sorted({f"{r['source_dimensions']['width']}x{r['source_dimensions']['height']}" for r in rows if r["source_dimensions"]})
S = json.loads((WAVE / "notes" / "coverage-stats.json").read_text())
BASE = S["base_n"]
fi_line = ", ".join(f"{p}/{t} checks x {n}" for (p, t), n in sorted(fi_checks.items()))
all_fi = fi.get("PASS", 0) == N
all_sp = sp.get("PASS", 0) == N
base_hh = S["hh001"]["base"].get("true", 0)
tb_base, tb_new = S["time"]["base"], S["time"]["new"]
over90 = sorted((r for r in rows if r["total_minutes"] > 90), key=lambda r: -r["total_minutes"])
self_notes = (WAVE / "notes" / "regen-v2-clarifiers.md").read_text().split("Other self-review notes", 1)
other_notes = ("Other self-review notes" + self_notes[1]).strip() if len(self_notes) > 1 else ""

# ---------------- WAVE.json ----------------
wave = {
    "wave": "wave-15", "request": "Thomas 2026-10-15 2:30 PM CT: 'Please do 50 more.'",
    "creator": "Grok Bot (packages); images by Cora via Grok Bot GenerateImage", "docs_written": NOW,
    "package_revision": REV, "package_revision_counts": REV_COUNTS, "candidate_count": N, "catalog_before": BASE, "catalog_after_if_imported": BASE + N,
    "hh001_count": hh, "hh001_split": dict(split),
    "state": ("Audit r1 (independent auditor, 2026-10-15): 31/50 CERTIFIED, 19 FAIL (audit/r1/). The creator fixed the 19 FAILs at author-r3 "
              "(plus one auditor note on korean-galbi-jjim); those 20 packages await audit r2. NOT imported, no PR, not deployed, D1 untouched. "
              "The creator does not self-certify."),
    "audit": {"r1": {"certified": 31, "fail": 19, "records": "audit/r1/ (SUMMARY.md, AUDIT-r1.json, per-slug records)"},
              "r3_changed_packages": sorted(common.R3_SLUGS), "r3_image_regenerations": [r["slug"] for r in r1_regen],
              "r3_text_fixes": {k: common.R3_TEXT_FIXES[k] for k in r3_text},
              "next": "Audit r2 on the 20 author-r3 packages (handoff: notes/AUDITOR_HANDOFF-r2.md)."},
    "structural_preflight": f"{'PASS' if all_sp else 'FAIL'} {sp.get('PASS', 0)}/{N} hh001={hh} (notes/structural-preflight-author-r3.txt)",
    "freeze_integrity": f"{'PASS' if all_fi else 'FAIL'} {fi.get('PASS', 0)}/{N}; {fi_line} (notes/freeze-integrity-author-r3.txt)",
    "structural_qa_state": dict(collections.Counter(r["structural_qa_state"] for r in rows)),
    "images": {
        "generator": "Cora via Grok Bot GenerateImage", "generation_date": "2026-10-15", "finalized": sum(bool(r["active_source"]) for r in rows),
        "source_dimensions": srcdims,
        "export": "finalize_images.py center-crops each source to 4:3 and LANCZOS-resizes to the 1200x900 master and 640x480 card WebPs (export_meal_webps.py).",
        "attachment_map": f"notes/image-gen-map.txt: {MAP_LINE}",
        "regenerated_v2_before_audit": [{"slug": r["slug"], "active_source": r["active_source"], "rejected_v1": r["rejected_sources"]} for r in regen],
        "regeneration_basis": "Creator self-review (Cora) against image-plating-brief.md, before any audit. Details: notes/regen-v2-clarifiers.md and each package's image-prompt.md 'Regeneration v2 prompt addition'.",
        "regenerated_after_audit_r1": [{"slug": r["slug"], "active_source": r["active_source"], "rejected": r["rejected_sources"]} for r in r1_regen],
        "audit_r1_prompts": "notes/r1-regen-prompts.txt (tools/briefs_r1.py); each package's image-prompt.md 'Regeneration (audit r1) prompt'",
        "visual_approval": "Creator self-review only; image fidelity is PENDING_AUDIT.",
    },
    "auditor_handoff": ["notes/AUDITOR_HANDOFF.md (r1)", "notes/AUDITOR_HANDOFF-r2.md (r2)"],
    "next_steps": ["Independent auditor: gates A-O on all 50 (creator must not self-certify).",
                   "Then import / PR / deploy only with Thomas's explicit approval."],
    "candidates": rows,
}
(WAVE / "WAVE.json").write_text(json.dumps(wave, indent=1, ensure_ascii=False) + "\n")

# ---------------- roster ----------------
cols = ["slug", "cuisine", "primary", "hh001", "effort", "complexity", "total_minutes", "batch", "active_source", "regenerated_v2"]
(WAVE / "notes" / "wave15-roster.tsv").write_text("\t".join(cols) + "\n" + "".join("\t".join(str(r[c]) for c in cols) + "\n" for r in rows))


# ---------------- coverage.md ----------------
def table(key, label, order=None):
    b, n = S[key]["base"], S[key]["new"]
    keys = order or sorted(set(b) | set(n), key=lambda k: -(b.get(k, 0) + n.get(k, 0)))
    out = [f"| {label} | Live {BASE} | Wave-15 | After |", "|---|---|---|---|"]
    out += [f"| {k} | {b.get(k, 0)} | {n.get(k, 0)} | {b.get(k, 0) + n.get(k, 0)} |" for k in keys]
    return "\n".join(out)


RELATED = {"cantonese": "chinese"}  # regional label whose parent cuisine is live
def _related(k):
    b = S["cuisine"]["base"]
    hits = [x for x in b if x.startswith(k + "-")] + ([RELATED[k]] if RELATED.get(k) in b else [])
    return hits
new_labels = sorted(k for k in S["cuisine"]["new"] if k not in S["cuisine"]["base"])
new_cuisines = [k for k in new_labels if not _related(k)]
related_note = "; ".join(f"`{k}` (live as {', '.join(_related(k))})" for k in new_labels if _related(k))
cov = f"""# Wave-15 coverage

Generated by `tools/write_docs.py` on {NOW} from the packages and `notes/coverage-stats.json` (`tools/coverage_stats.py`).
Baseline: {BASE} live catalog meals (legacy-24 excluded). Wave-15 adds {N} candidates at `{REV}`, for {BASE + N} if imported.

## HH001

- Live: {base_hh}/{BASE} ({round(100 * base_hh / BASE)}%). Wave-15: {hh}/{N}. After: {base_hh + hh}/{BASE + N} ({round(100 * (base_hh + hh) / (BASE + N))}%).
- Wave-15 split: {split.get('fish', 0)} finfish, {split.get('plant', 0)} plant-based, {split.get('egg', 0)} egg-vegetarian. All have nut_policy none and contain no meat, poultry, shellfish, or dairy.

## Cuisine

Cuisines with no live meal yet ({len(new_cuisines)}): {', '.join(new_cuisines)}. Also new as exact labels, though related live meals exist: {related_note}.
Large live clusters stay small in this wave: American +{S['cuisine']['new'].get('american', 0)}, Italian +{S['cuisine']['new'].get('italian', 0)}, Mexican +{S['cuisine']['new'].get('mexican', 0)}.
On the watch list (all labels counted together): Japanese ({S['cuisine']['base'].get('japanese', 0)} + {S['cuisine']['base'].get('japanese-inspired', 0)} inspired live, +{S['cuisine']['new'].get('japanese', 0)}), Thai ({S['cuisine']['base'].get('thai-inspired', 0)} Thai-inspired live, +{S['cuisine']['new'].get('thai', 0)}), Indian ({S['cuisine']['base'].get('indian', 0)} + {S['cuisine']['base'].get('indian-inspired', 0)} inspired live, +{S['cuisine']['new'].get('indian', 0)}, plus Bengali, Pakistani, and Nepali as separate labels).

{table('cuisine', 'Cuisine')}

## Effort and complexity

{table('effort', 'Effort', ['easy', 'moderate', 'involved'])}

{table('complexity', 'Complexity', ['simple', 'standard', 'adventurous'])}

## Total time

{table('time', 'Band', ['under 30', '30-45', '46-90', 'over 90'])}

The wave is long-skewed by design: {tb_new.get('over 90', 0)} meals run over 90 minutes ({', '.join(f"{r['slug']} {r['total_minutes']}" for r in over90)}), and {tb_new.get('under 30', 0)} is under 30. The live catalog already has {tb_base.get('under 30', 0) + tb_base.get('30-45', 0)} meals at 45 minutes or less, so this wave fills the weekend, braise, and roast gap. The trade-off is that it adds few quick weeknight meals (flagged in `notes/curator-notes.md`).

## Duplicate control

Every "Compared with <slug>" note is machine-checked against the live catalog plus the planned list in `tools/build_packages.py`, and no planned slug collides with a live slug. Rationale is in `selection-rationale.md`; swapped ideas are in `rejected.md`.
"""
(WAVE / "coverage.md").write_text(cov)

# ---------------- README.md ----------------
regen_lines = "\n".join(f"  - `{r['slug']}`: active `{r['active_source']}`; rejected v1 at `{r['rejected_sources'][0] if r['rejected_sources'] else '?'}`" for r in regen)
readme = f"""# FlavorWeave Catalog Factory — Wave-15

{N} candidate meal packages at `{REV}`, authored 2026-10-15 for Thomas's request "Please do 50 more." These would take the catalog from {BASE} to {BASE + N} meals.

**State:** audit r1 certified 31/50 and failed 19 (`audit/r1/`). The creator fixed all 19 at `author-r3`, plus one auditor note on korean-galbi-jjim. These {len(common.R3_SLUGS)} packages await audit r2 (`notes/AUDITOR_HANDOFF-r2.md`). Revisions: {", ".join(f"{k} x {v}" for k, v in sorted(REV_COUNTS.items()))}. Nothing is imported, there is no PR, and nothing is deployed. The creator does not self-certify.

## Results at {REV}

- Structural preflight: {'PASS' if all_sp else 'FAIL'} {sp.get('PASS', 0)}/{N}, hh001={hh} (`notes/structural-preflight-author-r3.txt`).
- Freeze integrity: {'PASS' if all_fi else 'FAIL'} {fi.get('PASS', 0)}/{N}, {fi_line} (`notes/freeze-integrity-author-r3.txt`).
- structural_qa_state: {', '.join(f'{k} x {v}' for k, v in wave['structural_qa_state'].items())}.
- HH001: {hh}/{N} ({split.get('fish', 0)} finfish, {split.get('plant', 0)} plant-based, {split.get('egg', 0)} egg-vegetarian).

## Images

- Generator: Cora via Grok Bot GenerateImage, 2026-10-15. Sources are {', '.join(srcdims)}; `tools/finalize_images.py` center-crops each to 4:3 and exports the 1200x900 master and 640x480 card WebPs.
- `notes/image-gen-map.txt` maps each slug to its GenerateImage attachment hash: {MAP_LINE}.
- {len(r1_regen)} heroes were regenerated after audit r1 gate K FAILs ({', '.join(f"{r['slug']} -> {r['active_source']}" for r in r1_regen)}). The previous hero files are in each `rejected/` and recorded under `image.superseded`. Each `image-prompt.md` keeps the earlier prompts and adds a labeled "Regeneration (audit r1) prompt" section with Cora's exact prompt.
- {len(regen)} heroes were regenerated as v2 after creator self-review, before any audit. In each, the never-finalized v1 is kept in `rejected/img_v1-selfreview-rejected.jpg` and recorded under `image.superseded` (`never_finalized: true`) and `image.regeneration`. Each `image-prompt.md` keeps the v1 prompt unchanged and adds a labeled "Regeneration v2 prompt addition" section.
{regen_lines}

## Layout

- `candidates/<slug>/`: v1.json, d03-classification.json, image-plating-brief.md, image-prompt.md, image-state.json, README.md, img_vN.jpg (active source), `<slug>.webp`, `<slug>-640.webp`, STRUCTURAL_PREFLIGHT.json, FREEZE_INTEGRITY.json, and `rejected/` where applicable.
- `coverage.md`, `selection-rationale.md`, `rejected.md`: coverage analysis and rationale.
- `notes/`: curator notes, roster, coverage stats, preflight, freeze and finalize logs, the image map, the v2 clarifiers, and the auditor handoff.
- `tools/`: generators and guards (`build_packages.py`, `recipes_w15_*.py`, `common.py`, `finalize_images.py`, `mark_preflight.py`, `coverage_stats.py`, `write_docs.py`).

## Reproduce the checks (read-only)

```
cd /workspace/harbor-eats-app && node factory/tools/structural_preflight.mjs /workspace/flavorweave-catalog-factory/wave-15/candidates
cd /workspace/flavorweave-catalog-factory/wave-15/candidates && for d in */; do python3 ../../freeze_integrity.py "$d"; done
```

## Roster

| Slug | Cuisine | HH001 | Effort / complexity | Total min | Image | Revision |
|---|---|---|---|---|---|---|
""" + "\n".join(f"| {r['slug']} | {r['cuisine']} | {'Y' if r['hh001'] else 'N'} | {r['effort']}/{r['complexity']} | {r['total_minutes']} | {r['active_source']}{' (audit r1 regen)' if r['audit_r1_regenerated'] else ' (v2 self-review regen)' if r['regenerated_v2'] else ''} | {r['package_revision']} |" for r in rows) + "\n"
(WAVE / "README.md").write_text(readme)

# ---------------- notes/curator-notes.md ----------------
notes = f"""# Curator notes — wave-15 (Grok Bot, creator role)

## State at {REV} ({NOW})

- {N} packages built by `tools/build_packages.py` (deterministic; every guard must pass before anything is written).
- Images: {wave['images']['finalized']}/{N} finalized from Cora's GenerateImage heroes. Regenerated after audit r1: {len(r1_regen)} ({', '.join(r['slug'] for r in r1_regen)}). Earlier v2 self-review regenerations: {', '.join(r['slug'] for r in rows if 'creator_self_review_before_audit' in r['regeneration_bases'])}.
- Audit r1: 31/50 certified, 19 FAIL. Fixed at author-r3 (20 packages including galbi-jjim); see notes/AUDITOR_HANDOFF-r2.md.
- Structural preflight {sp.get('PASS', 0)}/{N} PASS. Freeze integrity {fi.get('PASS', 0)}/{N} PASS ({fi_line}). `tools/mark_preflight.py` set structural_qa_state on all packages that passed both.
- Not audited, not certified, not imported. kitchen_tested is false on all {N}. The creator does not self-certify.

## Guards added in this wave

- A wheat-free regex (rice flour, corn tortillas, cornmeal), so these aren't flagged as wheat.
- A near-duplicate check: every "Compared with <slug>" must name a live or planned slug, and no planned slug may collide with a live one.
- The built set must equal PLANNED.
- The unit word may not appear anywhere in the display name (catches "8 slice … slices" and "1 loaf crusty loaf").
- `finalize_images.py` refuses a SELFREVIEW_V2 slug whose chosen source is not img_v2. It moves the never-finalized v1 into `rejected/` without overwriting and records it under `image.superseded` and `image.regeneration`.

## Judgment calls left to the auditor

- Mustard (bengali-mustard-fish) has no allergen token in the runtime enum; it is disclosed in allergen notes.
- Coconut (moo ping) and barley/rye gluten (Irish stew with stout, bigos with rye bread) are declared in `runtime_enum_gaps` with notes.
- Fish sauce in moo ping is flagged finfish_seasoning_only.
- Peanut: malian-chicken-maafe. Tree nuts: peruvian-aji-de-gallina (walnut), lebanese-baked-kibbeh (pine nut).
- Alcohol used in cooking (notes in each package): three-cup mushrooms, basque hake, cacciatore, galbi-jjim (mirin), char siu, hambagu, Irish stew.
- Long clocks: {', '.join(f"{r['slug']} {r['total_minutes']}" for r in over90)}.
- Image sources are {', '.join(srcdims)}. The 4:3 center crop is smaller than 1200x900, so the master is an upscale.
"""
(WAVE / "notes" / "curator-notes.md").write_text(notes)
print(f"docs written: WAVE.json README.md coverage.md notes/curator-notes.md notes/wave15-roster.tsv | rev {REV} | preflight {sp.get('PASS', 0)}/{N} | freeze {fi.get('PASS', 0)}/{N} ({fi_line}) | hh001 {hh} {dict(split)} | v2 {len(regen)}")
