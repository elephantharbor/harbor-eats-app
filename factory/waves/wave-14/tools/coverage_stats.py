import json, collections, sys
from pathlib import Path
CAT = Path("/workspace/harbor-eats-app/catalog")
def load(d):
    for n in ("v2.json", "v1.json"):
        if (d / n).exists():
            return json.loads((d / n).read_text())
def row(doc):
    dish = doc.get("dish", {}); v = doc.get("recipe_version", {})
    el = v.get("dietary_eligibility") or {}
    return {"slug": dish.get("slug"), "cuisine": dish.get("cuisine"), "format": dish.get("meal_format"),
            "primary": dish.get("primary_ingredient"), "effort": v.get("effort_level"), "cx": v.get("ingredient_complexity"),
            "total": v.get("total_minutes"), "hh": v.get("hh001_eligible", el.get("hh001_eligible")), "allergens": v.get("allergens", [])}
base = [row(load(d)) for d in sorted(CAT.iterdir()) if d.is_dir() and d.name != "legacy-24" and load(d)]
new = [row(json.loads((d / "v1.json").read_text())) | {"batch": json.loads((d / "v1.json").read_text())["creator_batch"]} for d in sorted(p for p in Path("candidates").iterdir() if p.is_dir())]
def band(t): return "under 30" if t < 30 else "30-45" if t <= 45 else "46-90" if t <= 90 else "over 90"
out = {"base_n": len(base), "new_n": len(new)}
for k, f in (("cuisine", lambda r: r["cuisine"]), ("effort", lambda r: r["effort"]), ("complexity", lambda r: r["cx"]),
             ("time", lambda r: band(r["total"] or 0)), ("hh001", lambda r: bool(r["hh"])), ("pair", lambda r: f"{r['effort']}/{r['cx']}")):
    out[k] = {"base": collections.Counter(map(f, base)), "new": collections.Counter(map(f, new))}
out["batches"] = collections.Counter(r["batch"] for r in new)
json.dump(out, open("notes/coverage-stats.json", "w"), indent=1, default=dict)
for k in ("cuisine", "effort", "complexity", "time", "hh001", "pair"):
    print(k, "BASE", dict(out[k]["base"].most_common()), "\n   NEW", dict(out[k]["new"].most_common()))
print(out["base_n"], out["new_n"], dict(out["batches"]))
