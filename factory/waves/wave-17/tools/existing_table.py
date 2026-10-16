#!/usr/bin/env python3
"""Write notes/existing-200.tsv: every live meal in harbor-eats-app/catalog (minus legacy-24), both package schemas."""
import collections, json
from pathlib import Path
CAT = Path("/workspace/harbor-eats-app/catalog"); W = Path("/workspace/harbor-eats-app/factory/waves")
OUT = Path(__file__).resolve().parent.parent / "notes" / "existing-200.tsv"
memb = {}
for w in ("wave-14", "wave-15", "wave-16"):
    c = W / w / "candidates"
    for d in (c.iterdir() if c.is_dir() else []):
        if d.is_dir():
            memb[d.name] = w.replace("wave-", "w")


def flags(doc):
    v = doc["recipe_version"]
    e = v.get("dietary_eligibility")
    if e:
        return ({k: bool(e.get(f"contains_{k}")) for k in ("meat", "poultry", "finfish", "shellfish", "dairy")},
                bool(e.get("plant_based_compatible")), bool(v.get("hh001_eligible", e.get("hh001_eligible"))), v.get("allergens", []))
    tags = set(v.get("dietary_tags") or doc["dish"].get("tags") or [])
    al = (doc.get("projection") or {}).get("allergens", [])
    f = {"meat": "meat" in tags, "poultry": "poultry" in tags, "finfish": "fish" in tags or "finfish" in al,
         "shellfish": "shellfish" in tags, "dairy": "dairy" in tags}
    labels = (doc.get("projection") or {}).get("dietary_labels", [])
    hh = (doc.get("projection") or {}).get("hh001_eligible", v.get("hh001_eligible", False))
    return f, "plant_based" in labels or "vegan" in labels, bool(hh), al


rows = []
for d in sorted(CAT.iterdir()):
    if not d.is_dir() or d.name == "legacy-24":
        continue
    f = d / "v2.json" if (d / "v2.json").exists() else d / "v1.json"
    doc = json.loads(f.read_text()); v = doc["recipe_version"]; dish = doc["dish"]
    fl, pb, hh, al = flags(doc)
    prim = (dish.get("primary_ingredient") or "").lower()
    t = dish["title"].lower()
    if fl["poultry"] and any(k in prim + " " + t for k in ("chicken", "turkey", "duck")): pc = "poultry"
    elif fl["meat"]: pc = "meat"
    elif fl["poultry"]: pc = "poultry"
    elif fl["shellfish"]: pc = "shellfish"
    elif fl["finfish"]: pc = "fish"
    else: pc = "veg"
    rows.append([memb.get(d.name, "base"), d.name, dish.get("cuisine") or "", dish.get("meal_format") or "", prim, pc,
                 str(v.get("total_minutes")), v.get("effort_level") or "", v.get("ingredient_complexity") or "", str(hh),
                 ",".join(al), "vegan" if pc == "veg" and pb else "", dish["title"]])
OUT.write_text("src\tslug\tcuisine\tformat\tprimary\tprotein\ttotal\teffort\tcomplexity\thh001\tallergens\tvegan\ttitle\n" + "\n".join("\t".join(r) for r in rows) + "\n")
print(len(rows), dict(collections.Counter(r[0] for r in rows)))
