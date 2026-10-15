#!/usr/bin/env python3
"""Freeze Integrity Preflight. Deterministic. Not a culinary audit.

Usage, from the repo root:
  python3 factory/tools/freeze_integrity.py factory/waves/<wave>/candidates/<slug>
  python3 factory/tools/freeze_integrity.py catalog/<slug>

Writes FREEZE_INTEGRITY.json in that directory and prints FREEZE_INTEGRITY: PASS|FAIL.
Exit 0 on PASS, 1 on FAIL.

This checks artifact agreement only (identity, required fields, WebP magic and
pixels, active paths not under rejected/, provenance present, no denial
strings). It does not judge culinary quality, diet, image fidelity, or hero
appeal. A pending image slot fails this check until the WebP pair is on disk.

Pixel size uses Pillow: `pip install -r factory/tools/requirements.txt`.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

MASTER = (1200, 900)
CARD = (640, 480)
DENIAL_SNIPPETS = (
    "images not generated",
    "blocked_no_image",
    "unknown_no_asset",
    "r0_images_missing",
    "images missing",
    "images are not generated",
    "image_provenance\": \"missing\"",
    "image_provenance\":\"missing\"",
    # Added 2026-10-15 after wave-14 audit r1: pending/unfinished-image phrasings the
    # catalog-package skill forbids once WebPs exist (README "not, yet", prompt status, etc.).
    "not, yet",
    "freeze integrity fails until",
    "freeze integrity is expected to fail until",
    "pending_image_pass",
    "not a finished asset",
    "image_slot_pending",
    "webp master and card are not",
)
# Package text files scanned for the same denial snippets (not only the package JSON).
DENIAL_TEXT_FILES = ("README.md", "image-prompt.md", "image-plating-brief.md", "image-state.json")

def fail(checks, code, detail):
    checks.append({"id": code, "result": "FAIL", "detail": detail})

def ok(checks, code, detail):
    checks.append({"id": code, "result": "PASS", "detail": detail})

def webp_size(path: Path):
    data = path.read_bytes()
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return None, "not_webp_magic"
    try:
        from PIL import Image
        with Image.open(path) as im:
            if (im.format or "").upper() != "WEBP":
                return None, f"pillow_format_{im.format}"
            return im.size, "webp"
    except Exception as e:
        return None, f"unreadable:{e}"

def load_json(path: Path):
    return json.loads(path.read_text())

def walk_strings(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield str(k)
            yield from walk_strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk_strings(v)
    elif isinstance(obj, str):
        yield obj

def main(argv):
    if len(argv) != 2:
        print("usage: freeze_integrity.py CANDIDATE_DIR", file=sys.stderr)
        return 2
    root = Path(argv[1]).resolve()
    checks = []
    v2_path = root / "v2.json"
    v1_path = root / "v1.json"
    # A directory with v2.json freezes that file. v1 must still exist and parse,
    # but it is not required to carry the current image. v1-only dirs keep v1.
    if v2_path.is_file():
        pkg_path = v2_path
        pkg_label = "v2.json"
        version_suffix = "v2"
        if not v1_path.is_file():
            fail(checks, "v1_retained", "v2.json is the current package but v1.json is missing")
        else:
            try:
                load_json(v1_path)
                ok(checks, "v1_retained", "v1.json exists and parses; current image is not required on v1")
            except Exception as e:
                fail(checks, "v1_retained", f"v1.json does not parse: {e}")
    elif v1_path.is_file():
        pkg_path = v1_path
        pkg_label = "v1.json"
        version_suffix = "v1"
    else:
        fail(checks, "package_file", "v2.json and v1.json missing")
        return emit(root, checks)
    try:
        doc = load_json(pkg_path)
    except Exception as e:
        fail(checks, "package_json", f"{pkg_label} not valid JSON: {e}")
        return emit(root, checks)
    ok(checks, "package_file", f"{pkg_label} parses")

    dish = doc.get("dish") or {}
    recipe = doc.get("recipe") or {}
    rv = doc.get("recipe_version") or {}
    image = doc.get("image") or {}
    slug = dish.get("slug") or doc.get("slug")
    dish_id = dish.get("dish_id") or doc.get("dish_id")
    recipe_id = recipe.get("recipe_id") or doc.get("recipe_id")
    rv_id = rv.get("recipe_version_id") or doc.get("recipe_version_id")
    rev = doc.get("package_revision")
    if not all([slug, dish_id, recipe_id, rv_id, rev]):
        fail(checks, "identity_present", f"missing slug/dish/recipe/version/revision: {slug} {dish_id} {recipe_id} {rv_id} {rev}")
    else:
        ok(checks, "identity_present", f"{slug} {rev}")
    if slug and dish_id and slug != dish_id:
        fail(checks, "identity_agree", f"slug {slug} != dish_id {dish_id}")
    elif slug:
        ok(checks, "identity_agree", "slug matches dish_id")
    if slug and recipe_id and recipe_id != f"rcp_{slug}":
        fail(checks, "recipe_id", f"expected rcp_{slug} got {recipe_id}")
    elif recipe_id:
        ok(checks, "recipe_id", recipe_id)
    expected_rv = f"rv_{slug}_{version_suffix}" if slug else None
    if slug and rv_id and rv_id != expected_rv:
        fail(checks, "version_id", f"expected {expected_rv} got {rv_id}")
    elif rv_id:
        ok(checks, "version_id", rv_id)

    # completeness of implementation-shaped fields (presence only)
    projection = doc.get("projection") if isinstance(doc.get("projection"), dict) else {}
    ingredients = rv.get("ingredients") or doc.get("ingredients")
    steps = rv.get("steps") or rv.get("instructions") or doc.get("steps")
    # dietary_eligibility object, or projection.dietary_labels when that is the only form.
    if "dietary_eligibility" in rv and rv.get("dietary_eligibility") is not None:
        elig = rv.get("dietary_eligibility")
        elig_source = "recipe_version.dietary_eligibility"
    elif "dietary_labels" in projection:
        elig = projection.get("dietary_labels")
        elig_source = "projection.dietary_labels"
    elif "dietary_eligibility" in doc and doc.get("dietary_eligibility") is not None:
        elig = doc.get("dietary_eligibility")
        elig_source = "dietary_eligibility"
    else:
        elig = None
        elig_source = None
    if "allergens" in rv:
        allergens = rv.get("allergens")
        allergen_source = "recipe_version.allergens"
    elif "allergens" in projection:
        allergens = projection.get("allergens")
        allergen_source = "projection.allergens"
    elif "allergens" in doc:
        allergens = doc.get("allergens")
        allergen_source = "allergens"
    else:
        allergens = None
        allergen_source = None
    tags = (
        rv.get("taste_tags")
        or rv.get("vocabulary_tag_ids")
        or dish.get("taste_tags")
        or dish.get("tags")
        or projection.get("vocabulary_tag_ids")
    )
    for name, val in (
        ("ingredients", ingredients),
        ("steps", steps),
        ("taste_tags", tags),
        ("base_servings", rv.get("base_servings") or rv.get("servings")),
    ):
        if val is None or val == "" or val == [] or val == {}:
            fail(checks, f"field_{name}", "missing or empty")
        else:
            ok(checks, f"field_{name}", "present")
    # A dietary_labels list is the eligibility field for this package shape.
    # Record it present even when the list is empty; do not require an object.
    if elig_source == "projection.dietary_labels" and isinstance(elig, list):
        ok(checks, "field_dietary_eligibility", "present as projection.dietary_labels")
    elif elig is None or elig == "" or elig == [] or elig == {}:
        fail(checks, "field_dietary_eligibility", "missing or empty")
    else:
        ok(checks, "field_dietary_eligibility", "present")
    if isinstance(elig, dict):
        ok(checks, "eligibility_object", "dietary_eligibility is an object")
    elif elig_source == "projection.dietary_labels" and isinstance(elig, list):
        ok(checks, "eligibility_object", "projection.dietary_labels list recorded; object not required")
    else:
        fail(checks, "eligibility_object", "dietary_eligibility must be an object, separate from allergens")
    # An explicit list is the allergen field, including an empty list (no tokens to invent).
    if isinstance(allergens, list):
        detail = f"present at {allergen_source}" + ("" if allergens else " (empty list)")
        ok(checks, "field_allergens", detail)
        ok(checks, "allergens_list", f"{len(allergens)} tokens")
    else:
        fail(checks, "field_allergens", "missing or empty")
        fail(checks, "allergens_list", "allergens must be a list")

    blob = json.dumps(doc).lower()
    hits = [s for s in DENIAL_SNIPPETS if s in blob]
    # image_provenance MISSING as a value
    conf = doc.get("catalog_confidence") or {}
    if str(conf.get("image_provenance", "")).upper() == "MISSING":
        hits.append("catalog_confidence.image_provenance=MISSING")
    if str(conf.get("image_fidelity", "")).upper() == "BLOCKED_NO_IMAGE":
        hits.append("image_fidelity=BLOCKED_NO_IMAGE")
    if str(conf.get("image_rights_provenance", "")).upper() == "UNKNOWN_NO_ASSET":
        hits.append("image_rights_provenance=UNKNOWN_NO_ASSET")
    for name in DENIAL_TEXT_FILES:
        p = root / name
        if p.is_file():
            text = p.read_text(errors="replace").lower()
            hits.extend(f"{name}: {s}" for s in DENIAL_SNIPPETS if s in text)
    if hits:
        fail(checks, "no_denial_strings", "; ".join(hits))
    else:
        ok(checks, "no_denial_strings", "no stale missing-image denials")

    gen = image.get("generation") or {}
    for key in ("method", "generation_date", "generator"):
        # allow flat or nested
        val = gen.get(key) or image.get(key) or image.get({"generation_date": "date"}.get(key, key))
        if key == "generation_date":
            val = gen.get("generation_date") or gen.get("date") or image.get("generation_date")
        if not val:
            fail(checks, f"provenance_{key}", "missing")
        else:
            ok(checks, f"provenance_{key}", str(val)[:80])
    model = gen.get("model") if "model" in gen else image.get("model")
    if model is None or model == "":
        fail(checks, "provenance_model", "model key missing (use the string unknown if no slug)")
    else:
        ok(checks, "provenance_model", str(model))

    master_name = image.get("master_filename") or (f"{slug}.webp" if slug else None)
    card_name = image.get("card_filename") or (f"{slug}-640.webp" if slug else None)
    master_ref = str(image.get("master_ref") or image.get("master_path") or master_name or "")
    card_ref = str(image.get("card_ref") or image.get("card_path") or card_name or "")
    if "rejected" in master_ref.lower() or "rejected" in card_ref.lower():
        fail(checks, "active_not_rejected", f"active ref points at rejected: {master_ref} {card_ref}")
    else:
        ok(checks, "active_not_rejected", "active refs do not mention rejected/")

    master_path = root / Path(master_name).name if master_name else None
    card_path = root / Path(card_name).name if card_name else None
    for label, path, expect in (("master", master_path, MASTER), ("card", card_path, CARD)):
        if path is None or not path.is_file():
            fail(checks, f"image_exists_{label}", f"missing {path}")
            continue
        size, kind = webp_size(path)
        if size is None:
            fail(checks, f"image_format_{label}", f"{path.name} {kind}")
            continue
        ok(checks, f"image_format_{label}", f"{path.name} webp")
        if size != expect:
            fail(checks, f"image_dims_{label}", f"actual {size[0]}x{size[1]} expected {expect[0]}x{expect[1]}")
        else:
            ok(checks, f"image_dims_{label}", f"{size[0]}x{size[1]}")

    # declared dims if present must match spec
    declared = image.get("dimensions") or {}
    if declared:
        dm = (declared.get("master_width"), declared.get("master_height"))
        dc = (declared.get("card_width"), declared.get("card_height"))
        if dm != MASTER:
            fail(checks, "declared_master_dims", f"declared {dm}")
        else:
            ok(checks, "declared_master_dims", "declared master matches spec")
        if dc != CARD:
            fail(checks, "declared_card_dims", f"declared {dc}")
        else:
            ok(checks, "declared_card_dims", "declared card matches spec")

    rejected = root / "rejected"
    active_names = set()
    if master_path:
        active_names.add(master_path.name)
    if card_path:
        active_names.add(card_path.name)
    if rejected.is_dir():
        leak = [p.name for p in rejected.iterdir() if p.name in active_names]
        if leak:
            fail(checks, "rejected_not_active_name", f"same filename in rejected and active: {leak}")
        else:
            ok(checks, "rejected_not_active_name", "rejected files do not reuse active filenames")
    else:
        ok(checks, "rejected_not_active_name", "no rejected dir")

    return emit(root, checks)

def emit(root: Path, checks):
    failed = [c for c in checks if c["result"] == "FAIL"]
    status = "FAIL" if failed else "PASS"
    out = {
        "FREEZE_INTEGRITY": status,
        "candidate_dir": str(root),
        "fail_count": len(failed),
        "checks": checks,
    }
    (root / "FREEZE_INTEGRITY.json").write_text(json.dumps(out, indent=2) + "\n")
    print(f"FREEZE_INTEGRITY: {status}")
    for c in failed:
        print(f"  FAIL {c['id']}: {c['detail']}")
    return 1 if failed else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv))
