"""Authoring aid: for each overlap step, compare its minutes with the clock it can run inside.

Window = the nearest earlier non-overlap step plus every later non-overlap step. An overlap step longer
than that window cannot finish inside the stated total time; those are printed as TOO LONG.
"""
import sys
sys.path.insert(0, ".")
import importlib
from pathlib import Path
import common
for m in sorted(p.stem for p in Path(".").glob("recipes_w17_*.py")):
    importlib.import_module(m)
bad = 0
for meal in common.MEALS:
    steps = meal["steps"]
    for k, s in enumerate(steps):
        if s["phase"] != "overlap":
            continue
        prev = next((steps[j]["minutes"] for j in range(k - 1, -1, -1) if steps[j]["phase"] != "overlap"), 0)
        later = sum(t["minutes"] for t in steps[k + 1:] if t["phase"] != "overlap")
        window = prev + later
        flag = "TOO LONG" if s["minutes"] > window else "ok"
        bad += flag != "ok"
        if flag != "ok" or "-v" in sys.argv:
            print(f"{flag:8} {meal['slug']}: step {k + 1} {s['title']!r} {s['minutes']} min, window {window} (prev {prev} + later {later})")
print(f"{bad} overlap steps too long")
