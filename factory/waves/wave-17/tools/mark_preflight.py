#!/usr/bin/env python3
"""Record preflight results on wave-17 packages after freeze_integrity.py and structural_preflight.mjs have run.

With a hero image (image.asset_generated true):
  both PASS -> structural_qa_state <rev>_preflight_pass_awaiting_vale
  else      -> <rev>_images_present_awaiting_preflight
Without a hero image yet (text frozen, Cora still to generate):
  structural PASS and the only freeze fails are the image-only set below -> <rev>_preflight_pass_awaiting_images
  else -> left unchanged and reported.
The image-only set: image_exists_master, image_exists_card, provenance_generation_date, and
no_denial_strings where the only hit is the pending slot token that structural preflight requires in v1.json
(the four text files must be free of every denial snippet).
Touches only v1.json text fields; never touches image files. Re-run both preflights afterwards.

  python3 tools/mark_preflight.py            # all candidates
  python3 tools/mark_preflight.py <slug> ... # only these (author-r3: the 8 revised packages; the 42 passing ones are not rewritten)
"""
import json
import sys
from pathlib import Path

CAND = Path(__file__).resolve().parent.parent / "candidates"
IMAGE_ONLY = {"image_exists_master", "image_exists_card", "provenance_generation_date", "no_denial_strings"}
SLOT_TOKEN = "pending_image_pass"
DENIAL = ["images not generated", "blocked_no_image", "unknown_no_asset", "r0_images_missing", "images missing",
          "not, yet", "freeze integrity fails until", "pending_image_pass", "not a finished asset",
          "image_slot_pending", "webp master and card are not"]
TEXT_FILES = ["README.md", "image-prompt.md", "image-plating-brief.md", "image-state.json"]


def load(d, name):
    p = d / name
    return json.loads(p.read_text()) if p.exists() else {}


def text_clean(d):
    for n in TEXT_FILES:
        p = d / n
        if p.exists():
            t = p.read_text().lower()
            if any(s in t for s in DENIAL):
                return False
    v1 = (d / "v1.json").read_text().lower()
    return not any(s in v1 for s in DENIAL if s != SLOT_TOKEN)


def main():
    marked, left = [], []
    only = [a for a in sys.argv[1:] if not a.startswith("-")]
    bad = [a for a in only if not (CAND / a / "v1.json").exists()]
    if bad:
        raise SystemExit(f"unknown slugs {bad}")
    for d in sorted(p for p in CAND.iterdir() if (p / "v1.json").exists() and (not only or p.name in only)):
        doc = json.loads((d / "v1.json").read_text())
        rev = doc["package_revision"].replace("-", "_")
        fz, sp = load(d, "FREEZE_INTEGRITY.json"), load(d, "STRUCTURAL_PREFLIGHT.json")
        fresh = (d / "STRUCTURAL_PREFLIGHT.json").exists() and (d / "STRUCTURAL_PREFLIGHT.json").stat().st_mtime >= (d / "v1.json").stat().st_mtime
        sp_ok = sp.get("STRUCTURAL_PREFLIGHT") == "PASS" and fresh
        if doc.get("image", {}).get("asset_generated"):
            ok = fz.get("FREEZE_INTEGRITY") == "PASS" and sp_ok
            state = f"{rev}_preflight_pass_awaiting_vale" if ok else f"{rev}_images_present_awaiting_preflight"
        else:
            fails = {c["id"] for c in fz.get("checks", []) if c["result"] != "PASS"}
            denial = [c for c in fz.get("checks", []) if c["id"] == "no_denial_strings" and c["result"] != "PASS"]
            denial_ok = all(c.get("detail", "").strip() == SLOT_TOKEN for c in denial)
            ok = sp_ok and fails <= IMAGE_ONLY and denial_ok and text_clean(d)
            if not ok:
                left.append(f"{d.name} (structural={sp.get('STRUCTURAL_PREFLIGHT')} fresh={fresh} freeze_fails={sorted(fails)})")
                continue
            state = f"{rev}_preflight_pass_awaiting_images"
        doc["structural_qa_state"] = doc["recipe_version"]["structural_qa_state"] = state
        (d / "v1.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
        (marked if ok else left).append(d.name)
    print(f"marked {len(marked)}; not marked {len(left)} {left}")
    return 1 if left else 0


if __name__ == "__main__":
    sys.exit(main())
