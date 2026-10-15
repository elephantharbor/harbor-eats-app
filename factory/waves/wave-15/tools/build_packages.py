#!/usr/bin/env python3
"""Write wave-15 author packages (25 meals). Adapted from factory/waves/wave-13/build_packages.py.

    python3 /workspace/flavorweave-catalog-factory/wave-15/tools/build_packages.py [--force]

Refuses to write a package unless every authoring check passes:
  ingredient refs, D-03 math and floors, vocabulary, allergen, and label tokens,
  D-06.1 cooking agreement (fry words only when the methods say fry),
  gate E (heat-source preheat stated before the first oven, broiler, or grill use),
  gate B (every water use is a measured ingredient line and the step states the amount),
  HH001 hard contract, and the conditional-claim regex.
prep/cook minutes are computed from the step clock (overlap steps add 0).

Images: a package with no finalized image gets a pending slot (finalize_images.py fills it).
A package whose v1.json already carries a finalized image (asset_generated true) keeps that
image block: the WebP and source files and their recorded sha256 are verified and never
written, moved, or deleted here, and all text is written in post-image (frozen) wording at REV.
author-r2 (image pass): finalize_images.py runs build_packages.py --force <slug> to write post-image text.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import common  # noqa: E402
import importlib
for _m in sorted(p.stem for p in HERE.glob("recipes_w15_*.py")):
    importlib.import_module(_m)

REPO = Path("/workspace/harbor-eats-app")
WAVE = HERE.parent
OUT = WAVE / "candidates"
BATCH = "wave-15-2026-10-15"
WHEN = "2026-10-15"
AUTHOR = "Grok Bot (Curator, creator role), wave-15"
CURATOR = "Grok Bot, Curator (creator role)"
REV = common.REV  # "author-r2"
PENDING_REV = "author-r1"  # wording for a package that has no image yet

VOCAB = set("""mexican indian thai mediterranean japanese italian korean chinese middle-eastern north-african american
scandinavian moroccan californian smoky citrusy savory spicy tangy rich fresh umami herbaceous crispy creamy crunchy tender
tacos bowls soups pasta grilled curries sandwiches stews stir-fries mushrooms tofu salmon eggplant swordfish chickpeas shrimp
chicken lentils cod cauliflower soba carrots arctic-char polenta rice-noodles peaches""".split())
CUISINE_TAG = {"chinese": "chinese", "indian": "indian", "mexican": "mexican", "japanese": "japanese", "american": "american",
               "lebanese": "middle-eastern", "persian": "middle-eastern", "greek": "mediterranean", "thai": "thai", "korean": "korean",
               "italian": "italian", "moroccan": "moroccan", "bengali": "indian", "egyptian": "north-african", "cypriot": "mediterranean",
               "turkish": "middle-eastern", "southern": "american", "cajun": "american", "hawaiian": "american"}
ALLERGENS = {"egg", "milk", "soy", "wheat", "sesame", "peanut", "tree_nut", "cashew", "shellfish", "finfish", "poultry", "meat"}
LABELS = {"dairy_free", "vegetarian", "plant_based", "fish"}
EXCLUDE_NAMES = re.compile(r"^(?:kosher salt|salt|flaky salt|black pepper|water|neutral oil|olive oil|extra-virgin olive oil|sesame oil|toasted sesame oil|vegetable oil|canola oil|sunflower or neutral oil|peanut-free neutral oil)$", re.I)
CONDITIONAL = re.compile(r"\b(?:dairy[- ]free if|nut[- ]free if|gluten[- ]free if|if you use|if using a)\b", re.I)
FRY_RE = re.compile(r"\b(?:deep[-\s]?fr\w*|pan[-\s]?fr\w*|shallow[-\s]?fr\w*|air[-\s]?fr\w*|stir[-\s]?fr\w*|fr(?:y|ied|ying))\b", re.I)
METHOD_FRY = {"pan-fry": "pan", "shallow-fry": "shallow", "deep-fry": "deep"}
HEAT_SOURCE = re.compile(r"\b(?:oven|broil\w*|grill\w*|bake[ds]?|baking|roast\w*)\b", re.I)
PREHEAT = re.compile(r"\b(?:preheat\w*|turn (?:the )?(?:oven|broiler|grill) on|turn (?:the )?(?:broiler|grill|oven) to|heat (?:the )?(?:oven|broiler|grill)|let it heat|light (?:the )?grill)\b", re.I)
WATER_AMOUNT = re.compile(r"(?:\d+(?:\s+\d/\d|/\d)?|\d*\s*\d/\d|one|two|three|four)\s*(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|quarts?|qt)\b[^.;]{0,30}?\bwater\b", re.I)
PAN_LIQUID_OK = re.compile(r"\b(?:cold-water|watercress)\b", re.I)


STORE_BOUGHT = re.compile(r"\b(?:sausages?|bratwurst|kielbasa|chorizo|andouille|linguica|bacon|ham|pancetta|corned beef|pastrami|bread|buns?|rolls?|pita|pitas|tortillas?|baguette|hoagie|crackers?|wrappers?|sauerkraut|kimchi|curry paste|panko|breadcrumbs|egg noodles|naan|lavash|pide|puff pastry)\b", re.I)
CHEESE = re.compile(r"\b(?:cheese|parmesan|pecorino|mozzarella|cheddar|gruy[eè]re|halloumi|queso|raclette|feta|provolone|manchego|ricotta|paneer|fontina|emmental|swiss)\b", re.I)
GLUTEN_GRAIN = re.compile(r"\b(?:barley|rye|spelt|farro|freekeh)\b", re.I)
LIVE_SLUGS = {p.name for p in Path("/workspace/harbor-eats-app/catalog").iterdir() if p.is_dir()}
WHEAT_FREE = re.compile(r"\b(?:rice flour|rice noodles|rice vermicelli|corn tortillas?|chickpea flour|corn ?flour|cornmeal|masa|cassava flour|tapioca flour|potato flour|gluten-free)\b", re.I)
WHEAT_ITEM = re.compile(r"\b(?:flour|bulgur|couscous|semolina|panko|breadcrumbs|bread|buns?|rolls?|pita|baguette|naan|orzo|pasta|spaghetti|noodles|udon|wheat)\b", re.I)
BIG_POT = re.compile(r"\b(?:[6-9]|1[0-6])-(?:to-\d+-)?quart\b|stockpot", re.I)
DURATION = re.compile(r"\b(?:about |another |for |over )?(\d+)(?:\s*(?:to|-)\s*(\d+))?\s*minutes?\b", re.I)
_UNIT_CUPS = {"cup": 1, "cups": 1, "quart": 4, "quarts": 4, "qt": 4, "tbsp": 1 / 16, "tsp": 1 / 48}


def _cups(i):
    return i["quantity"] * _UNIT_CUPS.get(i["unit"], 0)


def canonical(value):
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "null"
    if isinstance(value, list):
        return "[" + ",".join(canonical(item) for item in value) + "]"
    if isinstance(value, dict):
        return "{" + ",".join(json.dumps(k) + ":" + canonical(value[k]) for k in sorted(value)) + "}"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return json.dumps(value)


def culinary_hash(v):
    keys = ["title", "description", "base_servings", "ingredients", "steps", "components", "equipment",
            "prep_minutes", "cook_minutes", "total_minutes", "heat", "doneness"]
    return hashlib.sha256(canonical({k: v[k] for k in keys}).encode()).hexdigest()


def derive(title, description, methods, steps):
    source = {"title": title, "description": description, "methods": methods, "steps": [{"body": s["body"]} for s in steps]}
    code = ("import { deriveCookingMethod } from './src/weave/semantics.js';"
            "const source = JSON.parse(process.argv[1]);"
            "process.stdout.write(JSON.stringify(deriveCookingMethod(source)));")
    out = subprocess.run(["node", "--input-type=module", "-e", code, json.dumps(source)], cwd=REPO, check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


def is_water(item):
    return item["name"].strip().lower() == "water"


def counted(meal):
    return [i["ingredient_id"] for i in meal["ingredients"] if not EXCLUDE_NAMES.match(i["name"].strip())]


def band(n):
    return 0 if n <= 12 else (1 if n <= 16 else 2)


def effort_level(f):
    score = sum(f.values())
    floors = []
    level = "easy" if score <= 2 else ("moderate" if score <= 5 else "involved")
    others = {k: v for k, v in f.items() if k != "active_attention"}
    if f["active_attention"] == 2 and any(v >= 1 for v in others.values()) and level == "easy":
        level = "moderate"
        floors.append("attention_2_floor_moderate")
    elif f["active_attention"] == 2 and any(v >= 1 for v in others.values()):
        floors.append("attention_2_floor_moderate (already met)")
    if f["technique"] == 2 and (f["active_prep"] >= 1 or f["active_components"] >= 1):
        if level != "involved":
            floors.append("technique_2_floor_involved")
        else:
            floors.append("technique_2_floor_involved (already met)")
        level = "involved"
    return level, score, floors


def complexity_level(score):
    return "simple" if score <= 1 else ("standard" if score <= 3 else "adventurous")


def fail(slug, msg):
    raise SystemExit(f"{slug}: {msg}")


def check(meal):
    slug = meal["slug"]
    steps = meal["steps"]
    ids = [i["ingredient_id"] for i in meal["ingredients"]]
    if len(ids) != len(set(ids)):
        fail(slug, "duplicate ingredient ids")
    for i in meal["ingredients"]:
        if not isinstance(i["quantity"], (int, float)) or i["quantity"] <= 0 or not i["unit"]:
            fail(slug, f"unmeasured ingredient {i['ingredient_id']}")
    used = {r for s in steps for r in s["ingredient_refs"]}
    unused = [i for i in ids if i not in used]
    dangling = sorted(used - set(ids))
    if unused or dangling:
        fail(slug, f"unused={unused} dangling={dangling}")
    tags = list(meal["tags"])
    extra = [CUISINE_TAG.get(meal["cuisine"]), meal["primary"] if meal["primary"] in VOCAB else None]
    for t in extra:
        if t and t not in tags:
            tags.append(t)
    bad = [t for t in tags if t not in VOCAB]
    if bad:
        fail(slug, f"unknown vocab {bad}")
    meal["_tags"] = tags
    if set(meal["allergens"]) - ALLERGENS:
        fail(slug, f"bad allergen tokens {set(meal['allergens']) - ALLERGENS}")
    if set(meal["labels"]) - LABELS:
        fail(slug, f"bad label tokens {set(meal['labels']) - LABELS}")
    e = meal["elig"]
    if "dairy_free" in meal["labels"] and e["contains_dairy"]:
        fail(slug, "dairy_free with dairy")
    if "milk" in meal["allergens"] and not e["contains_dairy"]:
        fail(slug, "milk allergen without contains_dairy")
    if e["contains_dairy"] and "milk" not in meal["allergens"]:
        fail(slug, "dairy without milk allergen")
    if e["contains_finfish"] != ("finfish" in meal["allergens"]):
        fail(slug, "finfish allergen/eligibility mismatch")
    if e["contains_shellfish"] != ("shellfish" in meal["allergens"]):
        fail(slug, "shellfish allergen/eligibility mismatch")
    if e["contains_meat"] != ("meat" in meal["allergens"]) or e["contains_poultry"] != ("poultry" in meal["allergens"]):
        fail(slug, "meat/poultry token mismatch")
    if ("plant_based" in meal["labels"]) != e["plant_based_compatible"] or ("vegetarian" in meal["labels"]) != e["vegetarian_compatible"]:
        fail(slug, "label/eligibility mismatch")
    if "fish" in meal["labels"] and not e["contains_finfish"]:
        fail(slug, "fish label without finfish")
    if e["contains_finfish"] and "fish" not in meal["labels"] and not meal.get("finfish_seasoning_only"):
        fail(slug, "finfish without fish label (set finfish_seasoning_only for fish sauce in a meat dish)")
    if meal["hh001"]:
        if e["contains_meat"] or e["contains_poultry"] or e["contains_shellfish"] or e["contains_dairy"] or e["nut_policy"] not in ("none", "cashews_only_ok"):
            fail(slug, "HH001 hard contract broken")
    # --- wave-15 guards for the wave-14 audit failure classes ---
    blob_all = json.dumps(meal, ensure_ascii=False)
    for i in meal["ingredients"]:
        disp = (i["display_name"] or "").strip()
        unit = (i["unit"] or "").strip().lower()
        first = disp.split()[0].lower().rstrip(",") if disp else ""
        if unit not in ("count", "") and first.rstrip("s") == unit.rstrip("s"):
            fail(slug, f"plural/unit typo: shopping line would read '{i['quantity']} {unit} {disp}'")
        words = disp.lower().split()
        for a, b in zip(words, words[1:]):
            if a == b:
                fail(slug, f"doubled word in display_name: {disp}")
        both = f"{disp} {i.get('note') or ''}".lower()
        if STORE_BOUGHT.search(i["name"]) and "label lists" not in both:
            fail(slug, f"store-bought processed item without a label contract: {i['ingredient_id']}")
        if e["vegetarian_compatible"] and CHEESE.search(i["name"]) and "rennet" not in both:
            fail(slug, f"vegetarian cheese without a rennet statement: {i['ingredient_id']}")
        if GLUTEN_GRAIN.search(i["name"]) and not any("Contains gluten" in n for n in meal["allergen_notes"]):
            fail(slug, f"barley/rye/spelt/farro without 'Contains gluten' in allergen_notes: {i['ingredient_id']}")
        if GLUTEN_GRAIN.search(i["name"]) and "gluten" not in meal.get("enum_gaps", {}):
            fail(slug, f"barley/rye/spelt/farro without enum_gaps.gluten: {i['ingredient_id']}")
        if WHEAT_ITEM.search(i["name"]) and not WHEAT_FREE.search(i["name"]) and "wheat" not in meal["allergens"]:
            fail(slug, f"wheat item without wheat allergen: {i['ingredient_id']}")
    big_water = sum(_cups(i) for i in meal["ingredients"] if is_water(i))
    if max([_cups(i) for i in meal["ingredients"] if is_water(i)] or [0]) >= 12 and not BIG_POT.search(" ".join(meal["equipment"])):
        fail(slug, f"12+ cups of water in one line ({big_water} cups total) without a 6-quart-or-larger pot in equipment")
    for n, s in enumerate(steps, 1):
        if s["phase"] == "overlap" or "overlap" in s["body"]:
            continue
        stated = 0
        for m in DURATION.finditer(s["body"]):
            if re.search(r"every\s*$", s["body"][max(0, m.start() - 7):m.start()]):
                continue
            stated += int(m.group(2) or m.group(1))
        if stated > s["minutes"] + 2:
            fail(slug, f"step {n} states {stated} minutes of timed work but its clock is {s['minutes']}")
    if re.search(r"\b(?:TODO|TBD|placeholder|lorem)\b", blob_all, re.I):
        fail(slug, "placeholder wording")
    # near-duplicate references must name real slugs (live catalog or this wave)
    for ref in re.findall(r"[Cc]ompared with ([a-z0-9]+(?:-[a-z0-9]+)+)", meal["near"]):
        if ref in LIVE_SLUGS and ref in common.PLANNED:
            fail(slug, f"planned slug {ref} collides with live catalog")
        if ref not in LIVE_SLUGS and ref not in common.PLANNED:
            fail(slug, f"near-duplicate reference to unknown slug {ref}")
    if "if present" in meal["near"] + meal["coverage"] + meal["notdup"]:
        fail(slug, "hedged 'if present' reference")
    # unit word repeated anywhere in the display (e.g. "8 slice ... slices", "1 loaf crusty loaf")
    for i in meal["ingredients"]:
        u = i["unit"]
        if u in ("slice", "loaf", "bunch", "head", "sprig", "piece", "stalk", "rib", "fillet"):
            if re.search(rf"\b{u}(?:e?s)?\b", i["display_name"], re.I):
                fail(slug, f"unit '{u}' repeated in display: {i['quantity']} {u} {i['display_name']}")
    # time clock
    prep = sum(s["minutes"] for s in steps if s["phase"] == "prep")
    cook = sum(s["minutes"] for s in steps if s["phase"] == "cook")
    if steps[0]["phase"] != "prep":
        fail(slug, "first step must be prep")
    for s in steps:
        if s["phase"] == "overlap" and "overlap stated" not in s["body"]:
            fail(slug, f"overlap step without stated overlap: {s['title']}")
        if s["minutes"] <= 0:
            fail(slug, f"step without minutes: {s['title']}")
    meal["_prep"], meal["_cook"] = prep, cook
    # gate E: heat source preheat
    first = None
    for n, s in enumerate(steps, 1):
        if HEAT_SOURCE.search(re.sub(r"dutch oven", " ", s["body"], flags=re.I)):
            first = (n, s)
            break
    if first:
        n, s = first
        if not PREHEAT.search(s["body"]):
            fail(slug, f"gate E: step {n} uses an oven/broiler/grill without stating the preheat")
        meal["_gate_e"] = f"First heat-source step is step {n} ({s['title']}) and it states the preheat. {meal['clock_note']}"
    else:
        meal["_gate_e"] = "No oven, broiler, or grill in this recipe."
    # gate B: water
    water_ids = {i["ingredient_id"] for i in meal["ingredients"] if is_water(i)}
    for n, s in enumerate(steps, 1):
        text = PAN_LIQUID_OK.sub(" ", s["body"])
        mentions = re.findall(r"\bwater\b", text, re.I)
        refs = set(s["ingredient_refs"]) & water_ids
        if mentions and not refs:
            fail(slug, f"gate B: step {n} mentions water without a water ingredient ref")
        if refs and not WATER_AMOUNT.search(text):
            fail(slug, f"gate B: step {n} uses water without stating the amount")
        if mentions and len(WATER_AMOUNT.findall(text)) < len(mentions):
            fail(slug, f"gate B: step {n} has an unmeasured water mention: {s['body'][:120]}")
    for w in water_ids:
        if not any(w in s["ingredient_refs"] for s in steps):
            fail(slug, f"gate B: water line {w} never used")
    # D-03
    level, escore, floors = effort_level(meal["effort"][0])
    n = len(counted(meal))
    cf = {"ingredient_count_band": band(n), **meal["complexity"][0]}
    cscore = sum(cf.values())
    clevel = complexity_level(cscore)
    if meal.get("expect") is None:
        meal["expect"] = (level, clevel)
    if (level, clevel) != tuple(meal["expect"]):
        fail(slug, f"D-03 computed {level}/{clevel} (effort {escore} {floors}, complexity {cscore} count {n}) expected {meal['expect']}")
    if cf["pantry_familiarity"] != 0:
        fail(slug, "pantry_familiarity must stay 0 (cultural-bias guardrail)")
    words = {"0": "zero", "1": "one"}
    _words = {4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight", 9: "Nine", 10: "Ten", 11: "Eleven", 12: "Twelve", 13: "Thirteen", 14: "Fourteen", 15: "Fifteen", 16: "Sixteen", 17: "Seventeen", 18: "Eighteen"}
    if not re.match(r"^\w+ counted items", meal["complexity"][2]):
        meal["complexity"] = (meal["complexity"][0], meal["complexity"][1], f"{_words.get(n, n)} counted items. " + meal["complexity"][2])
    m = re.match(r"^(\w+) counted items", meal["complexity"][2])
    nums = {"Four": 4, "Five": 5, "Six": 6, "Seven": 7, "Eight": 8, "Nine": 9, "Ten": 10, "Eleven": 11, "Twelve": 12, "Thirteen": 13, "Fourteen": 14, "Fifteen": 15, "Sixteen": 16, "Seventeen": 17, "Eighteen": 18}
    if not m or nums.get(m.group(1)) != n:
        fail(slug, f"complexity rationale count text does not match counted {n}: {counted(meal)}")
    meal["_d03"] = (level, escore, floors, clevel, cscore, cf, n)
    # cooking
    text = "\n".join([meal["title"], meal["description"], " ".join(meal["methods"])] + [s["body"] for s in steps])
    hits = {h.group(0).lower() for h in FRY_RE.finditer(text)}
    kinds = {METHOD_FRY[m] for m in meal["methods"] if m in METHOD_FRY}
    allowed = set()
    for m in meal["methods"]:
        if m in METHOD_FRY or m == "stir-fry":
            stem = m.split("-")[0]
            allowed |= {f"{stem}-fry", f"{stem}-fried", f"{stem}-frying", f"{stem} fry", f"{stem} fried", f"{stem}-fries"}
    if "stir-fry" in meal["methods"]:
        allowed |= {"stir-fry", "stir-fries", "stir-fried"}
    unexpected = sorted(h for h in hits if h not in allowed)
    if unexpected:
        fail(slug, f"unexpected fry words {unexpected}")
    d = derive(meal["title"], meal["description"], meal["methods"], steps)
    if sorted(d["frying"]) != sorted(kinds):
        fail(slug, f"derived frying {d['frying']} != methods {sorted(kinds)}")
    if d["stir_fry"] != ("stir-fry" in meal["methods"]):
        fail(slug, f"derived stir {d['stir_fry']}")
    meal["_derived"] = d
    return meal


def numbered(steps):
    out = []
    for n, s in enumerate(steps, 1):
        out.append({"step_number": n, "title": s["title"], "body": s["body"], "ingredient_refs": s["ingredient_refs"],
                    "clock_minutes": s["minutes"], "clock_phase": s["phase"]})
    return out


def sha256_file(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def qa_state(img):
    """structural_qa_state. Post-image values follow the wave-12 freeze-rN precedent."""
    if not img:
        return "author_r1_image_slot_pending"
    return f"{REV.replace('-', '_')}_images_present_awaiting_preflight"


def existing_image(d, slug):
    """Return the finalized image block already in d/v1.json, or None.

    Verifies that the master, card, and active source exist and match their recorded sha256.
    Never writes, moves, or deletes an image file."""
    pkg = d / "v1.json"
    if not pkg.exists():
        return None
    doc = json.loads(pkg.read_text())
    img = doc.get("image") or {}
    if not img.get("asset_generated"):
        return None
    hashes = img.get("file_hashes") or {}
    pairs = [(img.get("master_filename"), hashes.get("master_sha256")), (img.get("card_filename"), hashes.get("card_sha256")),
             (img.get("active_source_jpeg"), hashes.get("source_jpeg_sha256"))]
    for name, want in pairs:
        if not name or not (d / name).is_file():
            fail(slug, f"finalized image block names {name!r} but the file is missing; not regenerating")
        if want and sha256_file(d / name) != want:
            fail(slug, f"{name} sha256 does not match the recorded hash; not regenerating")
    state_path = d / "image-state.json"
    state = json.loads(state_path.read_text()) if state_path.exists() else {}
    return {"image": img, "state": state}


def refresh_image(img, slug):
    """Carry the finalized image block forward at REV with post-image wording. Files are not touched."""
    from PIL import Image
    image = json.loads(json.dumps(img["image"]))
    d = OUT / slug
    src = image.get("active_source_jpeg")
    with Image.open(d / src) as im:
        sw, sh = im.size
    cw, ch = common.crop_43(sw, sh)
    image["source_dimensions"] = {"width": sw, "height": sh}
    image["slot_status"] = "frozen_for_audit"
    image["qa_state"] = "frozen_for_audit"
    image["recipe_fidelity_state"] = "awaiting_audit"
    image["package_revision"] = REV
    image["dimensions_basis"] = (f"Center-crop the {sw}x{sh} GenerateImage source ({src}) to 4:3 ({cw}x{ch}), then LANCZOS-resize "
                                 "to the 1200x900 master and 640x480 card WebPs with export_meal_webps.py.")
    image.pop("dimensions_note", None)
    gen = image.setdefault("generation", {})
    gen["method_detail"] = common.method_detail(sw, sh)
    for der in image.get("derivatives", []):
        der["status"] = "frozen_for_audit"
    image["provenance_note"] = (f"Original AI illustration generated with Grok Bot GenerateImage from this package's recipe and plating brief. "
                                f"Master and card WebPs are present and frozen for audit at {REV}. asset_generated is true.")
    reason = common.AUDIT_R1_REGEN.get(slug)
    if reason and not image.get("regenerated_for_audit") == "audit-r1":
        image["audit_r1_image_note"] = (f"Audit r1 gate K FAIL on the active image ({src}). The plating brief and prompt were revised at {REV} "
                                        f"({reason}) and Cora is regenerating this hero. tools/finalize_images.py will freeze the replacement "
                                        "as the active set and move the current WebPs and source into rejected/.")
    else:
        image.pop("audit_r1_image_note", None)
    return image


def package(meal, img=None):
    slug = meal["slug"]
    rev = REV if img else PENDING_REV
    level, escore, floors, clevel, cscore, cf, n = meal["_d03"]
    prep, cook = meal["_prep"], meal["_cook"]
    elig = dict(meal["elig"])
    elig["hh001_eligible"] = meal["hh001"]
    elig["hh001_reason"] = meal["hh_reason"]
    steps = numbered(meal["steps"])
    clock = f"Prep {prep} + cook {cook} = {prep + cook} minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. {meal['clock_note']}"
    version = {
        "recipe_version_id": f"rv_{slug}_v1", "recipe_id": f"rcp_{slug}", "dish_id": slug, "version_number": 1,
        "package_revision": rev, "immutable": True,
        "immutability_note": (f"v1 has not been planned, shopped, cooked, or rated. Master and card WebPs are present and frozen for preflight/audit at {rev}. asset_generated is true. Not certified. Not published. kitchen_tested is false."
                              if img else "v1 has not been planned, shopped, cooked, or rated. The image slot is pending_image_pass at author-r1. Not certified. Not published. kitchen_tested is false."),
        "title": meal["title"], "description": meal["description"], "base_servings": 4,
        "ingredients": meal["ingredients"], "steps": steps, "components": meal["components"], "equipment": meal["equipment"],
        "methods": meal["methods"],
        "cooking": {"frying": meal["_derived"]["frying"], "crispy_non_fry": meal["_derived"]["crispy_non_fry"],
                    "stir_fry": meal["_derived"]["stir_fry"], "source": meal["_derived"].get("source"),
                    "intent": "The stored lists, crisp tokens, stir flag, and source are the deriveCookingMethod result for this title, description, methods, and steps."},
        "prep_time_minutes": prep, "cook_time_minutes": cook, "total_time_minutes": prep + cook,
        "prep_minutes": prep, "cook_minutes": cook, "total_minutes": prep + cook,
        "time_clock": clock,
        "time_reconstruction": {
            "prep_steps": [s["step_number"] for s in steps if s["clock_phase"] == "prep"],
            "cook_steps": [s["step_number"] for s in steps if s["clock_phase"] == "cook"],
            "overlap_steps": [s["step_number"] for s in steps if s["clock_phase"] == "overlap"],
            "rule": "prep_minutes = sum(clock_minutes of prep steps); cook_minutes = sum(clock_minutes of cook steps); overlap steps are timed inside the step they name.",
            "gate_e_heat_source": meal["_gate_e"],
            "gate_b_water": "Every use of water is its own measured ingredient line and each step that uses it states the amount." if any(is_water(i) for i in meal["ingredients"]) else "No water in this recipe.",
        },
        "heat": meal["heat"], "doneness": meal["doneness"],
        "effort_level": level, "ingredient_complexity": clevel,
        "classification_history": [{"version_number": 1, "who": AUTHOR, "when": WHEN, "from": None,
                                    "to": {"effort_level": level, "ingredient_complexity": clevel},
                                    "reason": "Initial D-03 assignment before any audit. Factor scores are in d03-classification.json."}],
        "classification_sidecar": "d03-classification.json",
        "dietary_eligibility": elig, "dietary_labels": meal["labels"], "dietary_label_note": meal["label_note"],
        "allergens": meal["allergens"], "allergen_notes": meal["allergen_notes"],
        "hh001_eligible": meal["hh001"], "hh001_reason": meal["hh_reason"], "hh001_contract": meal.get("hh_contract"),
        "vocabulary_tag_ids": meal["_tags"],
        "publication_state": "Draft", "publication_status": "draft",
        "structural_qa_state": qa_state(img), "culinary_audit_state": "not_audited",
        "kitchen_tested": False, "validation_kind": "author_structural_preflight_only",
        "provenance": "original_ai_assisted", "visibility": "global", "household_id": None,
        "data_origin": "synthetic", "rights_state": "not_cleared_for_external_release",
        "runtime_enum_gaps": {
            "provenance": "Factory value is original_ai_assisted. The importer maps it to ai_assisted. Keep the factory token on the package.",
            "publication_state": "Draft. Not published.",
            "allergens": "Factory tokens. tree_nut plus cashew with nut_policy cashews_only_ok imports as cashew. Other tree_nut imports as nuts.",
            "dietary_labels": "plant_based imports as plant. fish is a factory label for finfish meals.",
            "classification": "effort_level and ingredient_complexity only. No legacy effort or complexity string.",
            "cooking": "methods and the cooking object match deriveCookingMethod in src/weave/semantics.js.",
            "cuisine": f"dish.cuisine '{meal['cuisine']}' is a factory label; the D-02 vocabulary has no term for it unless listed in vocabulary_tag_ids.",
            **meal.get("enum_gaps", {}),
        },
    }
    if meal.get("food_safety"):
        version["food_safety_note"] = meal["food_safety"]
    if meal.get("alcohol_note"):
        version["alcohol_note"] = meal["alcohol_note"]
    version["culinary_hash"] = culinary_hash(version)
    version["culinary_hash_basis"] = "sha256 of canonical JSON of title, description, base_servings, ingredients, steps, components, equipment, prep/cook/total minutes, heat, doneness. Excludes classification and cooking."
    image = refresh_image(img, slug) if img else {
        "image_id": f"img_{slug}_v1", "dish_id": slug, "recipe_version_id": f"rv_{slug}_v1",
        "asset_generated": False, "slot_status": "pending_image_pass",
        "master_filename": f"{slug}.webp", "card_filename": f"{slug}-640.webp",
        "master_ref": None, "card_ref": None, "derivatives": [],
        "dimensions": {"master_width": 1200, "master_height": 900, "card_width": 640, "card_height": 480},
        "dimensions_note": "Targets for the image pass. No WebP file is in this directory yet.",
        "generation": {"method": "pending_original_ai", "generator": "Grok Bot GenerateImage (pending)", "model": "unknown",
                       "prompt_file": "image-prompt.md", "plating_brief_file": "image-plating-brief.md",
                       "external_image_api_called": False, "stock_or_web_photo_used": False,
                       "house_quality_reference": "image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png"},
        "qa_state": "pending_image_pass", "recipe_fidelity_state": "pending_image_pass",
        "rights": "not_cleared_for_external_release", "provenance": "pending_original_ai",
        "package_revision": rev, "rejected_dir": "rejected/",
    }
    conf_img = ({"image_fidelity": "PENDING_AUDIT", "provenance": "KNOWN_TEXT_AND_IMAGE", "image_rights_provenance": "KNOWN_NOT_CLEARED_FOR_EXTERNAL", "image_provenance": "PRESENT_AI"}
                if img else {"image_fidelity": "PENDING_ASSET", "provenance": "KNOWN_TEXT", "image_rights_provenance": "PENDING_ORIGINAL_AI", "image_provenance": "PENDING_GROK_BOT"})
    image_check = ({"check": "image", "result": "pass", "detail": f"{image['master_filename']} 1200x900 and {image['card_filename']} 640x480 exported from {image.get('active_source_jpeg')} ({image.get('source_dimensions', {}).get('width')}x{image.get('source_dimensions', {}).get('height')}); sha256 verified at {rev}."}
                   if img else {"check": "image", "result": "pending_image_pass", "detail": "Plating brief and prompt are written. WebP files are not in this directory."})
    return {
        "catalog_contract": "flavorweave-catalog-package",
        "catalog_contract_note": (f"Author package for wave-15, frozen at {rev} with an original AI image (Cora via Grok Bot GenerateImage; master and card WebPs present). Not audited. Not certified. Not published. Not imported."
                                  if img else "Author package for wave-15. Image slot is pending_image_pass at author-r1. Not certified. Not published. Not imported."),
        "batch_id": BATCH, "batch_label": "wave-15", "mode": "author_batch", "package_revision": rev,
        "authored_on": WHEN, "authored_timezone": "America/Chicago",
        "curator_role": "Curator (creator role, Grok Bot)", "authored_by": AUTHOR, "auditor": None, "certification": None,
        "dish": {"dish_id": slug, "slug": slug, "title": meal["title"], "description": meal["description"],
                 "cuisine": meal["cuisine"], "meal_format": meal["meal_format"], "primary_ingredient": meal["primary"],
                 "vocabulary_tag_ids": meal["_tags"], "current_recipe_id": f"rcp_{slug}", "current_version_id": f"rv_{slug}_v1"},
        "recipe": {"recipe_id": f"rcp_{slug}", "dish_id": slug, "visibility": "global", "household_id": None,
                   "provenance": {"source_class": "original_ai_assisted", "created_on": WHEN, "curator": CURATOR,
                                  "process": f"FlavorWeave Catalog Factory {BATCH}", "copied_from_third_party": False}},
        "recipe_version": version,
        "image": image,
        "catalog_confidence": {"structural_validation": "SEE_STRUCTURAL_PREFLIGHT_JSON", "culinary_audit": "NOT_RUN",
                               "dietary_audit": "NOT_RUN", "image_fidelity": conf_img["image_fidelity"], "provenance": conf_img["provenance"],
                               "image_rights_provenance": conf_img["image_rights_provenance"], "kitchen_tested": False,
                               "household_cooks": 0, "household_completed_ratings": 0, "image_provenance": conf_img["image_provenance"]},
        "curator_preflight": [
            {"check": "times", "result": "pass_reconstructed_from_steps", "detail": clock},
            {"check": "gate_e_preheat", "result": "pass", "detail": meal["_gate_e"]},
            {"check": "gate_b_water", "result": "pass", "detail": version["time_reconstruction"]["gate_b_water"]},
            {"check": "kitchen_tested", "result": "pass", "detail": "kitchen_tested is false."},
            image_check,
            {"check": "cooking", "result": "pass", "detail": json.dumps(meal["_derived"])},
        ],
        "scaling_notes": {"base_servings": 4, **{k: meal["scale"][k] for k in ("1", "2", "4")}, "do_not_scale": meal["scale"]["do_not_scale"]},
        "coverage_contribution": meal["coverage"],
        "near_duplicate_review": meal["near"],
        "not_duplicate_of": meal.get("notdup"),
        "recommendation_eligible": False,
        "structural_qa_state": qa_state(img),
    }


BRIEF_SECTIONS = [("Hero subject", "hero"), ("Vessel", "vessel"), ("Camera angle", "angle"),
                  ("Required visible components", "visible"), ("Texture cues", "texture"),
                  ("Sauce / component placement", "sauce"), ("Legitimate garnish (recipe-listed only)", "garnish"),
                  ("Environmental styling", "props"), ("Color opportunities", "color"),
                  ("Forbidden elements", "forbid"), ("Crop strategy", "crop"), ("Ambiguity", "ambiguity")]


def image_files_line(slug, image):
    sd = image.get("source_dimensions") or {}
    sw, sh = sd.get("width"), sd.get("height")
    return (f"`{image.get('active_source_jpeg')}` (Grok Bot GenerateImage source {sw}x{sh}), `{image['master_filename']}` (1200x900), "
            f"and `{image['card_filename']}` (640x480); both WebPs are 4:3 center crops of the source")


def regen_pending(slug, image):
    return bool(image and image.get("audit_r1_image_note"))


def _orig_prompts():
    """Author-r1 prompts as used for the first image pass (notes/prompts-author-r1.txt), kept as history."""
    p = OUT.parent / "notes" / "prompts-author-r1.txt"
    t = p.read_text()
    return {m.group(1): m.group(2).strip() for m in re.finditer(r"^## (\S+)\n(.*?)(?=^## |\Z)", t, re.S | re.M)}


def _sup(image, image_id):
    return next((e for e in (image or {}).get("superseded", []) if e.get("image_id") == image_id), {})


def write_brief(d, meal, image=None):
    slug = meal["slug"]
    if image:
        reason = common.AUDIT_R1_REGEN.get(slug)
        revised = (f" Revised at {REV} after audit r1 gate K ({reason}); it now matches the " + (f"'Final prompt (v{common.FINAL_EDITS[slug]['version']})'" if slug in common.FINAL_EDITS else "'Regeneration (audit r1) prompt'") + " in image-prompt.md."
                   if reason else "")
        header = (f"Package `{slug}`, revision `{REV}`. Written before the first image was generated.{revised} "
                  f"Image: master and card WebPs present, frozen at {REV}. Standard: the meal-image-spec skill and `image-standards/hero-appeal-amendment.md`.\n")
    else:
        header = f"Package `{slug}`, revision `{PENDING_REV}`. Written before any image exists. Slot status: pending_image_pass. Standard: the meal-image-spec skill and `image-standards/hero-appeal-amendment.md`.\n"
    parts = [f"# Image / Plating Brief — {meal['title']}\n", header]
    for head, key in BRIEF_SECTIONS:
        parts.append(f"## {head}\n\n{meal['brief'][key]}\n")
        if key == "props" and slug not in common.PROPS_GRANDFATHERED:
            parts.append("Styling props are limited to items in this recipe or neutral tableware (plates, boards, cutlery, linen). No drinks, breads, sides, condiments, or spices that the recipe does not list.\n")
        if key == "crop":
            parts.append(f"Master is WebP 1200x900. Card is WebP 640x480. Both are 4:3 center crops of the GenerateImage source. Export with `python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py <source> <this dir> {slug}` (finalize_images.py does this).\n")
    sr1 = common.SELFREVIEW_R1.get(slug)
    if sr1:
        parts.append(f"## Final-image addendum (v{sr1['version'] + 1})\n\nAfter the v{sr1['version']} attempt was rejected in self-review, the final prompt added: \"{sr1['v3_addendum']}\"\n")
    parts.append("## House style\n\nBright, premium, realistic editorial food photography. Soft daylight, light neutral surface, food filling the frame. The house-quality reference is Chipotle Lime Black Bean Bowl for light and finish only, not for composition. No text, logo, or watermark.\n")
    (d / "image-plating-brief.md").write_text("\n".join(parts))


def write_prompt(d, meal, image=None):
    b = meal["brief"]
    slug = meal["slug"]
    reason = common.AUDIT_R1_REGEN.get(slug)
    gen_date = (image or {}).get("generation", {}).get("generation_date")
    active = (image or {}).get("active_source_jpeg")
    if not image:
        status = f"Status: pending_image_pass. package_revision `{PENDING_REV}`. Not a finished asset. The image pass generates an original AI image from this prompt with Grok Bot GenerateImage, saves it as `img_v1.jpg` (or .png) in this directory, then runs `tools/finalize_images.py`."
    elif regen_pending(slug, image):
        status = (f"Status: package_revision `{REV}`. The active image ({active}) was generated from the original prompt below and failed audit r1 gate K ({reason}). "
                  "Cora is regenerating it from the 'Regeneration (audit r1) prompt' at the end of this file; tools/finalize_images.py freezes the replacement.")
    elif reason:
        src_note = (f"The active image ({active}) was generated with Grok Bot GenerateImage on {gen_date} from the 'Final prompt (v{common.FINAL_EDITS[slug]['version']})' at the end of this file (the audit r1 prompt with the changes listed there). "
                    if slug in common.FINAL_EDITS else
                    f"The active image ({active}) was generated with Grok Bot GenerateImage on {gen_date} from the 'Regeneration (audit r1) prompt' at the end of this file. ")
        status = (f"Status: image pass complete. package_revision `{REV}`. asset_generated is true; files: {image_files_line(slug, image)}. " + src_note +
                  "The 'Prompt' section is the original author-r1 prompt, kept unchanged as history; earlier heroes are in rejected/ and recorded under image.superseded.")
    elif slug in common.SELFREVIEW_V2:
        rj = _sup(image, f"img_{slug}_v1")
        status = (f"Status: image pass complete. package_revision `{REV}`. asset_generated is true; files: {image_files_line(slug, image)}. "
                  f"The active image ({active}) is a v2 regeneration generated with Grok Bot GenerateImage on {gen_date}. "
                  f"The prompt below is the v1 prompt, unchanged; the v1 hero generated from it was rejected in creator self-review and is kept at `{rj.get('moved_to_rejected')}`. "
                  "The v2 prompt addition is recorded in the section at the end of this file.")
    else:
        status = (f"Status: image pass complete. package_revision `{REV}`. asset_generated is true. The active image was generated from this prompt with Grok Bot GenerateImage "
                  f"on {gen_date}; files: {image_files_line(slug, image)}.")
    frame = "4:3 landscape, subject centered and crop-safe."
    text = f"""# Image prompt — {meal['title']}

{status}

Prompt:

{{PROMPT}}
"""
    if reason or slug in common.SELFREVIEW_V2:
        prompt = _orig_prompts()[slug]  # history: the prompt as used for v1
    else:
        prompt = (f"Editorial food photograph of {meal['title']} for a premium meal-planning app. {b['hero']} Vessel: {b['vessel']} Camera: {b['angle']} Must show: {b['visible']} Texture: {b['texture']} Sauce: {b['sauce']} Garnish: {b['garnish']} Styling: {b['props']} Color from the recipe only: {b['color']} Do not include: {b['forbid']} Lighting: bright diffused daylight, soft shadows, real highlights, no harsh flash, no muddy dark, no synthetic gloss. Background: light neutral tabletop. {frame} {b['ambiguity']} Quality reference is the Chipotle Lime Black Bean Bowl standard for light and appetite only. Not a copy of that bowl. No text, logos, watermarks, or hands.")
    text = text.replace("{PROMPT}", prompt)
    if image and slug in common.SELFREVIEW_V2:
        r = common.SELFREVIEW_V2[slug]
        rj = _sup(image, f"img_{slug}_v1")
        v2 = _sup(image, f"img_{slug}_v2")
        if active == "img_v2.jpg":
            v2_line = f"- Active v2 source: `{active}` (sha256 `{image.get('file_hashes', {}).get('source_jpeg_sha256')}`)."
        else:
            v2_src = (v2.get("moved_to_rejected") or {}).get("img_v2.jpg", {})
            v2_line = (f"- The v2 hero was later superseded after audit r1 and is kept at `{v2_src.get('rejected_path')}` (sha256 `{v2_src.get('sha256')}`); "
                       "see the audit r1 section below.")
        sty = ""
        if r.get("styling_change"):
            sty = f"\n- Styling line changed for v2:\n  - v1: `{r['styling_change'][0]}`\n  - v2: `{r['styling_change'][1]}`\n"
        text += f"""
## Regeneration v2 prompt addition

Added after the v1 image was generated. The v1 prompt above is the prompt as it stood for v1 and is not rewritten.

- Why v1 was rejected (Cora's creator self-review against image-plating-brief.md, before any audit): {r['v1_rejection']}
- Rejected v1 source: `{rj.get('moved_to_rejected')}` (sha256 `{rj.get('sha256')}`).
{v2_line}
- Sentence added, inserted immediately before the quality-reference sentence:

  > Regeneration clarifier: {r['clarifier']}
{sty}
Resulting v2 prompt (v1 prompt + the changes above):

{common.v2_prompt(prompt, slug)}
"""
    if reason:
        import briefs_r1
        sr1 = common.SELFREVIEW_R1.get(slug)
        audited = "img_v2.jpg" if slug in common.SELFREVIEW_V2 else "img_v1.jpg"
        text += f"""
## Regeneration (audit r1) prompt

Added at {REV}. Audit r1 (independent auditor, 2026-10-15) failed gate K on the hero generated from `{audited}`: {reason}. The superseded files are in rejected/ and recorded under image.superseded. The brief (image-plating-brief.md) was revised to match this prompt, and out-of-recipe props were removed.

Exact prompt Cora used for the audit r1 regeneration (from notes/r1-regen-prompts.txt):

{briefs_r1.R1_PROMPTS[slug]}
"""
        if sr1:
            text += f"""
### Superseded attempt (v{sr1['version']}) and final prompt (v{sr1['version'] + 1})

- v{sr1['version']} was generated from the audit r1 prompt above and never finalized. {sr1['reason']} Kept at `{sr1['file']}`.
- The final v{sr1['version'] + 1} prompt is the audit r1 prompt above plus this addendum (Cora did not record where in the prompt it was placed):

  > {sr1['v3_addendum']}
"""
    fe = common.FINAL_EDITS.get(slug)
    if reason and fe:
        import briefs_r1
        v3 = _sup(image, f"img_{slug}_v{fe['version'] - 1}")
        v3_src = (v3.get("moved_to_rejected") or {}).get(f"img_v{fe['version'] - 1}.jpg", {}) if isinstance(v3.get("moved_to_rejected"), dict) else {}
        text += f"""
## Final prompt (v{fe['version']})

Added at {REV}. The v{fe['version'] - 1} hero, generated from the audit r1 prompt above, is superseded: {fe['superseded_reason']} It is kept at `{v3_src.get('rejected_path')}` (sha256 `{v3_src.get('sha256')}`).

Changes from the audit r1 prompt:

- Styling line: `Styling: {fe['props'][0]}` → `Styling: {fe['props'][1]}`
- Added to the start of the Do not include list: `{fe['forbid_prefix'].rstrip(', ')}`

Final v{fe['version']} prompt (the active image `{active}` was generated from this):

{common.final_prompt(slug, briefs_r1.R1_PROMPTS[slug])}
"""
    (d / "image-prompt.md").write_text(text)


def write_readme(d, meal, doc, image=None):
    v = doc["recipe_version"]
    slug = meal["slug"]
    rev = doc["package_revision"]
    level, escore, floors, clevel, cscore, cf, n = meal["_d03"]
    if image:
        status_line = f"Image: master and card WebPs present, frozen at {rev}."
        gen = image.get("generation", {})
        image_section = (f"Master and card WebPs present: {image_files_line(slug, image)}. asset_generated is true. package_revision `{rev}`. "
                         f"Generator: {gen.get('generator')}; generation date {gen.get('generation_date')}. See image-plating-brief.md and image-prompt.md.")
        if image.get("regeneration"):
            image_section += f"\n\n{image['regeneration']['summary']} {image['regeneration']['prompt_change']}"
        if regen_pending(slug, image):
            image_section += f"\n\n{image['audit_r1_image_note']}"
    else:
        status_line = "Image slot: pending_image_pass."
        image_section = f"The plating brief and prompt are in this directory. The WebP master and card are not, yet. Freeze integrity fails until the image pass adds `{slug}.webp` and `{slug}-640.webp` and the package is frozen."
    text = f"""# {meal['title']}

{meal['description']}

Author package for FlavorWeave Catalog Factory {BATCH}. package_revision `{rev}`. kitchen_tested is false. Not certified. Not published. Not imported. {status_line}

## Identity

- Dish id / slug: `{slug}`
- Recipe id: `rcp_{slug}`
- Recipe version id: `rv_{slug}_v1`
- Cuisine: {meal['cuisine']}
- Meal format: {meal['meal_format']}
- Primary ingredient: {meal['primary']}
- Servings: 4
- Time: prep {v['prep_minutes']} + cook {v['cook_minutes']} = {v['total_minutes']} minutes
- Time clock: {v['time_clock']}
- effort_level: {level} (score {escore}{', floors ' + ', '.join(floors) if floors else ''})
- ingredient_complexity: {clevel} (score {cscore}, {n} counted ingredients)
- Methods: {', '.join(meal['methods'])}
- Cooking classification: `{json.dumps(meal['_derived'])}`
- HH001 eligible: {'yes' if meal['hh001'] else 'no'} — {meal['hh_reason']}
- Contract: {meal.get('hh_contract') or 'n/a'}
- Taste tags: {', '.join(meal['_tags'])}
- Dietary labels: {', '.join(meal['labels']) or 'none'}
- Allergens: {', '.join(meal['allergens']) or 'none'}
- Allergen notes: {' '.join(meal['allergen_notes'])}
- Provenance: original_ai_assisted
{('- Food safety: ' + meal['food_safety']) if meal.get('food_safety') else ''}
{('- Alcohol: ' + meal['alcohol_note']) if meal.get('alcohol_note') else ''}

## D-03

{meal['effort'][1]}

{meal['complexity'][2]}

## Image

{image_section}

## Coverage

{meal['coverage']}

{meal['near']}

{meal.get('notdup') or ''}
"""
    (d / "README.md").write_text(text)


def write_sidecar(d, meal, rev):
    level, escore, floors, clevel, cscore, cf, n = meal["_d03"]
    doc = {"slug": meal["slug"], "recipe_version_id": f"rv_{meal['slug']}_v1", "package_revision": rev,
           "assigned_by": AUTHOR, "assigned_on": WHEN, "rubric": "D-03 as stated in factory/PACKAGE.md (count bands <=12 / 13-16 / 17+)",
           "effort_factors": meal["effort"][0], "effort_score": escore, "effort_level": level, "effort_floors_applied": floors,
           "complexity_factors": cf, "complexity_score": cscore, "ingredient_complexity": clevel,
           "ingredient_count": n, "counted_ingredient_ids": counted(meal),
           "excluded_from_count": "salt, black pepper, water, and cooking oils (neutral, olive, sesame)",
           "specialty_items": meal["complexity"][1],
           "rationale": meal["effort"][1] + " " + meal["complexity"][2],
           "cultural_bias": "Cuisine unfamiliarity added no points; pantry_familiarity is 0."}
    (d / "d03-classification.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")


def write_image_state(d, meal, image=None, state=None):
    if image:
        doc = dict(state or {})
        doc.update({"slot_status": "frozen_for_audit", "asset_generated": True, "package_revision": REV,
                    "expected_files": [image["master_filename"], image["card_filename"]],
                    "present_files": [image["master_filename"], image["card_filename"]],
                    "source": image.get("active_source_jpeg"), "source_dimensions": image.get("source_dimensions"),
                    "plating_brief": "image-plating-brief.md", "prompt": "image-prompt.md"})
        if image.get("audit_r1_image_note"):
            doc["audit_r1_image_note"] = image["audit_r1_image_note"]
        else:
            doc.pop("audit_r1_image_note", None)
    else:
        doc = {"slot_status": "pending_image_pass", "asset_generated": False,
               "expected_files": [f"{meal['slug']}.webp", f"{meal['slug']}-640.webp"], "present_files": [],
               "plating_brief": "image-plating-brief.md", "prompt": "image-prompt.md",
               "note": "Generate an original AI image from image-prompt.md with Grok Bot GenerateImage, save it here as img_v1.jpg, then run tools/finalize_images.py <slug> to export both WebPs, update the image block, and re-run freeze integrity."}
    (d / "image-state.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")


def batch_of(slug):
    i = [m["slug"] for m in common.MEALS].index(slug)
    return "ABCDE"[min(i // 10, 4)]


PROP_DRINKS = re.compile(r"\b(wine|beer|stout|ale|coffee|tea|doogh|lassi|juice|soda|cocktail|drink|drinks)\b", re.I)
PROP_TABLEWARE = set("""a an the and or of in on at to with by beside behind near small little large tiny few some one two
optional soft focus edge frame side corner resting leaning lying table tabletop background only nothing else props prop
plate plates platter board boards bowl bowls dish dishes tray parchment napkin linen cloth towel fork forks knife knives
spoon spoons chopsticks servers server tongs skewer skewers pan pans skillet pot lid scraper cutting wooden copper
ceramic white neutral clay cast-iron iron basket baskets ramekin extra more same as for the
whole wedge wedges half halves sliced chopped slice slices bottle jar carving baking tagine mid-pour pour poured
red green yellow brown golden dark pale fresh dried raw""".split())


def props_guard(meal):
    """Environmental styling may name only recipe items or neutral tableware (auditor r1 wave-level issue 1)."""
    slug = meal["slug"]
    if slug in common.PROPS_WAIVER:
        return
    props = meal["brief"]["props"]
    text = re.sub(r"\b(no|not|nothing|without|never)\b[^.;]*", " ", props, flags=re.I)  # drop negated clauses
    if PROP_DRINKS.search(text):
        fail(slug, f"brief props name a drink not in the recipe: {props!r}")
    vocab = " ".join([i["name"] + " " + (i.get("display_name") or "") for i in meal["ingredients"]]
                     + [c["name"] + " " + " ".join(c["ingredients"]) for c in meal["components"]]).lower()
    for w in re.findall(r"[a-zA-Zíáéóúñ-]+", text.lower()):
        if w in PROP_TABLEWARE or len(w) < 3:
            continue
        stem = w[:-1] if w.endswith("s") else w
        if stem not in vocab:
            fail(slug, f"brief props mention {w!r}, which is not a recipe item or neutral tableware: {props!r}")


def main():
    global REV
    force = "--force" in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    meals = common.MEALS
    slugs = [m["slug"] for m in meals]
    if len(set(slugs)) != len(slugs):
        raise SystemExit("duplicate slugs")
    unknown = [s for s in only if s not in slugs]
    if unknown:
        raise SystemExit(f"unknown slugs {unknown}")
    import briefs_r1
    for m in meals:
        if m["slug"] in briefs_r1.R1_BRIEFS:  # audit r1: brief matches Cora's regeneration prompt exactly
            f = briefs_r1.R1_BRIEFS[m["slug"]]
            assert f["title"] == m["title"], m["slug"]
            m["brief"].update({k: v for k, v in f.items() if k != "title"})
            fe = common.FINAL_EDITS.get(m["slug"])
            if fe:  # final-hero prompt revision on top of the audit r1 prompt
                assert m["brief"]["props"] == fe["props"][0], m["slug"]
                m["brief"]["props"] = fe["props"][1]
                m["brief"]["forbid"] = fe["forbid_prefix"] + m["brief"]["forbid"]
    for m in meals:
        check(m)
        if m["slug"] not in common.PROPS_GRANDFATHERED:
            props_guard(m)
    if not only and sorted(slugs) != sorted(common.PLANNED):
        missing = sorted(set(common.PLANNED) - set(slugs)); extra = sorted(set(slugs) - set(common.PLANNED))
        if len(meals) == 50:
            raise SystemExit(f"built slugs differ from PLANNED: missing {missing} extra {extra}")
    if not only and len(meals) != 50:
        raise SystemExit(f"checks passed for {len(meals)} meals; expected 50 before writing")
    hh = 0
    for m in meals:
        if only and m["slug"] not in only:
            continue
        REV = common.rev_for(m["slug"])
        d = OUT / m["slug"]
        img = existing_image(d, m["slug"])
        rev = REV if img else PENDING_REV
        if (d / "v1.json").exists() and not force:
            existing = json.loads((d / "v1.json").read_text())
            if existing.get("package_revision") != rev:
                raise SystemExit(f"{m['slug']}: refusing to overwrite revision {existing.get('package_revision')} with {rev} (use --force)")
        d.mkdir(parents=True, exist_ok=True)
        doc = package(m, img)
        doc["creator_batch"] = batch_of(m["slug"])
        (d / "v1.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
        image = doc["image"] if img else None
        write_sidecar(d, m, rev)
        write_brief(d, m, image)
        write_prompt(d, m, image)
        write_readme(d, m, doc, image)
        write_image_state(d, m, image, img["state"] if img else None)
        hh += m["hh001"]
        v = doc["recipe_version"]
        print(f"wrote {m['slug']} {rev}: {v['prep_minutes']}+{v['cook_minutes']}={v['total_minutes']} {v['effort_level']}/{v['ingredient_complexity']} batch={doc['creator_batch']} hh001={m['hh001']} image={'kept ' + doc['image']['active_source_jpeg'] if img else 'pending'}")
    print(f"hh001 {hh}/{len(meals) if not only else len(only)}")


if __name__ == "__main__":
    main()
