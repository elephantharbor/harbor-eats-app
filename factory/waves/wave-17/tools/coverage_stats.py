"""Wave-17 coverage stats: base = the 200 live meals (notes/existing-200.tsv, built from harbor-eats-app main at 077bd14); new = wave-17 candidates. Run from wave-17/."""
import json, collections, csv
from pathlib import Path
base = list(csv.DictReader(open("notes/existing-200.tsv"), delimiter="\t"))
def prot(al):
    s = set(al)
    return "meat" if "meat" in s else "poultry" if "poultry" in s else "shellfish" if "shellfish" in s else "fish" if "finfish" in s else "veg"
new = []
for d in sorted(p for p in Path("candidates").iterdir() if p.is_dir()):
    doc = json.loads((d / "v1.json").read_text()); v = doc["recipe_version"]; dish = doc["dish"]
    al = v.get("allergens", [])
    new.append({"slug": dish["slug"], "cuisine": dish.get("cuisine"), "effort": v.get("effort_level"), "complexity": v.get("ingredient_complexity"),
                "total": v.get("total_minutes"), "hh001": str(bool(v.get("hh001_eligible", (v.get("dietary_eligibility") or {}).get("hh001_eligible")))),
                "protein": prot(al), "peanut": "peanut" in al, "vegan": "plant_based" in (v.get("dietary_labels") or []), "batch": doc.get("creator_batch")})
def band(t): t = int(t or 0); return "<=30" if t <= 30 else "31-45" if t <= 45 else "46-60" if t <= 60 else "61-90" if t <= 90 else ">90"
out = {"base_n": len(base), "new_n": len(new)}
for k, f in (("cuisine", lambda r: r["cuisine"]), ("effort", lambda r: r["effort"]), ("complexity", lambda r: r["complexity"]),
             ("time", lambda r: band(r["total"])), ("hh001", lambda r: str(r["hh001"]).lower() in ("true", "1", "yes")),
             ("protein", lambda r: r["protein"])):
    out[k] = {"base": collections.Counter(map(f, base)), "new": collections.Counter(map(f, new)),
              "after": collections.Counter(map(f, base)) + collections.Counter(map(f, new))}
out["new_peanut"] = sum(r["peanut"] for r in new); out["new_vegan"] = sum(r["vegan"] for r in new)
out["batches"] = collections.Counter(r["batch"] for r in new)
json.dump(out, open("notes/coverage-stats.json", "w"), indent=1, default=dict)
for k in ("protein", "effort", "complexity", "time", "hh001", "cuisine"):
    print(k, "\n  BASE ", dict(out[k]["base"].most_common()), "\n  NEW  ", dict(out[k]["new"].most_common()), "\n  AFTER", dict(out[k]["after"].most_common(12)))
print("base", out["base_n"], "new", out["new_n"], "new peanut", out["new_peanut"], "new plant_based", out["new_vegan"], dict(out["batches"]))
