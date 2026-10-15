#!/usr/bin/env python3
"""After freeze_integrity.py and structural_preflight.mjs have both passed on a package, record it:
structural_qa_state -> <rev>_preflight_pass_awaiting_vale (wave-12 freeze-rN precedent) on the top level
and recipe_version. Packages that did not pass both are left at <rev>_images_present_awaiting_preflight.
Touches only v1.json text fields; never touches image files. Re-run both preflights afterwards.

  python3 tools/mark_preflight.py            # all candidates
"""
import json
import sys
from pathlib import Path

CAND = Path(__file__).resolve().parent.parent / "candidates"


def status(d, name, key):
    p = d / name
    return json.loads(p.read_text()).get(key) if p.exists() else None


def main():
    marked, left = [], []
    for d in sorted(p for p in CAND.iterdir() if (p / "v1.json").exists()):
        doc = json.loads((d / "v1.json").read_text())
        rev = doc["package_revision"].replace("-", "_")
        if not doc.get("image", {}).get("asset_generated"):
            left.append(d.name); continue
        ok = (status(d, "FREEZE_INTEGRITY.json", "FREEZE_INTEGRITY") == "PASS"
              and status(d, "STRUCTURAL_PREFLIGHT.json", "STRUCTURAL_PREFLIGHT") == "PASS"
              and (d / "STRUCTURAL_PREFLIGHT.json").stat().st_mtime >= (d / "v1.json").stat().st_mtime)
        state = f"{rev}_preflight_pass_awaiting_vale" if ok else f"{rev}_images_present_awaiting_preflight"
        doc["structural_qa_state"] = doc["recipe_version"]["structural_qa_state"] = state
        (d / "v1.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
        (marked if ok else left).append(d.name)
    print(f"preflight_pass_awaiting_vale {len(marked)}; not marked {len(left)} {left}")


if __name__ == "__main__":
    sys.exit(main())
