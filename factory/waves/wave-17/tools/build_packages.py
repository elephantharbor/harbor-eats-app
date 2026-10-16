#!/usr/bin/env python3
"""Write wave-17 author packages (50 meals). Adapted from wave-16/tools/build_packages.py.

    python3 /workspace/flavorweave-catalog-factory/wave-17/tools/build_packages.py [--force] [<slug> ...]

Refuses to write a package unless every authoring check passes:
  ingredient refs, D-03 math and floors, vocabulary, allergen, and label tokens,
  D-06.1 cooking agreement (fry words only when the methods say fry),
  gate E (heat-source preheat stated before the first oven, broiler, or grill use),
  gate B (every water use is a measured ingredient line and the step states the amount),
  HH001 hard contract, and the conditional-claim regex.
Wave-16 guards (from the wave-15 audit r1 lessons), kept for wave-17:
  pot size must fit the water in the step that uses it (N-quart >= 0.46 x cups: 10 cups needs a 5- or 6-quart pot),
  a step that brings 4+ cups of liquid to a boil must state the minutes to come to a boil,
  no untimed waits (partly frozen, overnight, chill until firm, "at least", "or up to"),
  scaling notes must name each counted equipment item (skewers, ramekins) for 1 and 2 servings,
  every food word in the description must be an ingredient of the recipe,
  the brief props guard (styling names only recipe items or neutral tableware), and
  no slug or "Compared with" reference outside the 200 live meals plus this wave.
Wave-17 guards (from the wave-16 audit r1 failures and the app's title matcher):
  oil quantity must match the stated depth in the stated pan (meal["oil"]: ingredient, pan base diameter, depth, fills),
  every shallow- or deep-fry meal must declare meal["oil"], and every depth stated in its text must equal it,
  vessels that hold a counted number of pieces declare meal["fit"] and the builder checks the layout arithmetic,
  the app's title-word matcher (src/lib/eligibility.js optionTags) may not tag the title with anything the recipe lacks.
prep/cook minutes are computed from the step clock (overlap steps add 0).

Images: a package with no finalized image gets an open image slot (finalize_images.py fills it).
A package whose v1.json already carries a finalized image (asset_generated true) keeps that
image block: the WebP and source files and their recorded sha256 are verified and never
written, moved, or deleted here, and all text is written in post-image wording at REV.
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
for _m in sorted(p.stem for p in HERE.glob("recipes_w17_*.py")):
    importlib.import_module(_m)

REPO = Path("/workspace/harbor-eats-app")
WAVE = HERE.parent
OUT = WAVE / "candidates"
BATCH = "wave-17-2026-10-15"
WHEN = "2026-10-15"
AUTHOR = "Grok Bot (Curator, creator role), wave-17"
CURATOR = "Grok Bot, Curator (creator role)"
REV = common.REV  # "author-r2" once an approved hero is exported
PENDING_REV = common.PENDING_REV  # "author-r1": text frozen, image slot open

VOCAB = set("""mexican indian thai mediterranean japanese italian korean chinese middle-eastern north-african american
scandinavian moroccan californian smoky citrusy savory spicy tangy rich fresh umami herbaceous crispy creamy crunchy tender
tacos bowls soups pasta grilled curries sandwiches stews stir-fries mushrooms tofu salmon eggplant swordfish chickpeas shrimp
chicken lentils cod cauliflower soba carrots arctic-char polenta rice-noodles peaches""".split())
CUISINE_TAG = {"chinese": "chinese", "indian": "indian", "mexican": "mexican", "japanese": "japanese", "american": "american",
               "lebanese": "middle-eastern", "persian": "middle-eastern", "greek": "mediterranean", "thai": "thai", "korean": "korean",
               "italian": "italian", "moroccan": "moroccan", "bengali": "indian", "egyptian": "north-african", "cypriot": "mediterranean",
               "turkish": "middle-eastern", "southern": "american", "cajun": "american", "hawaiian": "american",
               "goan": "indian", "sicilian": "italian", "sichuan": "chinese",
               "south-indian": "indian", "punjabi": "indian", "indo-chinese": "chinese", "tex-mex": "mexican", "yucatecan": "mexican",
               "palestinian": "middle-eastern", "finnish": "scandinavian", "swedish": "scandinavian", "italian-american": "italian"}
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
LIVE_SLUGS = {p.name for p in Path("/workspace/harbor-eats-app/catalog").iterdir() if p.is_dir() and p.name != "legacy-24"}
EXISTING_SLUGS = set(LIVE_SLUGS)  # the 200 live meals at harbor-eats-app 077bd14 that wave-17 must not duplicate
assert len(EXISTING_SLUGS) == 200, f"expected 200 live meals, found {len(EXISTING_SLUGS)}"
LEGACY_SLUGS = {p.name for p in Path("/workspace/harbor-eats-app/catalog/legacy-24").iterdir() if p.is_dir()} if Path("/workspace/harbor-eats-app/catalog/legacy-24").is_dir() else set()
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


# ---------------- wave-16 guards (wave-15 audit r1 lessons) ----------------
QUART = re.compile(r"\b(\d+(?:\.\d+)?)-(?:to-\d+-)?quart\b", re.I)
BOIL = re.compile(r"\b(?:bring|return)\b[^.]*\bto a (?:boil|simmer)\b", re.I)
BOIL_TIME = re.compile(r"\b(?:about |)\d+ minutes to (?:come to a |return to a |reach a |)(?:boil|simmer)\b", re.I)
UNTIMED = re.compile(r"\b(?:partly frozen|partially frozen|semi-frozen|freeze|freezer|overnight|until (?:cold|chilled|firm|set)\b|chill(?:ed|ing)?\b|refrigerat\w* (?:until|overnight|for)|at least \d+ (?:minutes|hours)|or up to|as long as|\d+ hours?\b)", re.I)
UNTIMED_OK = re.compile(r"\b(?:refrigerate leftovers|cold water)\b", re.I)
COUNTED_EQUIP = re.compile(r"^(\d+)\s+(?:\([^)]*\)\s*)?(?:[\w-]+\s+){0,3}?(skewers?|ramekins?|cups?|bowls?|molds?|jars?|plates?)\b", re.I)
FOOD_WORDS = set("""
tofu tempeh shiitake mushrooms mushroom cremini oyster porcini eggs egg noodles noodle pasta rigatoni spaghetti linguine penne
rice basmati jasmine grits polenta cornmeal potatoes potato sweet-potato cabbage carrots carrot spinach kale chard
eggplant eggplants zucchini courgette tomato tomatoes onion onions shallot shallots scallions scallion leek leeks garlic ginger
peppers pepper bell chiles chile chili jalapeno habanero scotch bonnet serrano poblano lemongrass galangal turmeric cumin coriander
cilantro parsley dill mint basil oregano thyme rosemary tarragon chives fenugreek lime lemon orange
tamarind vinegar soy sesame peanut peanuts peanut-butter cashews almonds walnuts pistachios coconut
cream sour-cream yogurt butter cheese cheddar parmesan ricotta feta mozzarella
shrimp prawns salmon tuna ahi snapper cod haddock tilapia catfish fish pork beef steak flank sirloin lamb chicken turkey duck bacon ham
olives capers raisins sugar honey mustard paprika
beans bean sprouts cucumber cucumbers radish radishes avocado seaweed nori furikake edamame mango pineapple
bread breadcrumbs flour cornstarch lettuce greens watercress arugula peas corn
mackerel squid octopus crab clams mussels halibut catfish cauliflower broccoli okra pumpkin chickpeas lentils dal sausage lard sumac
beets plantain cabbage tortillas masa cilantro squash
""".split())


def _pot_quarts(text):
    return [float(m.group(1)) for m in QUART.finditer(text)]


def wave16_guards(meal):
    slug = meal["slug"]
    steps = meal["steps"]
    by_id = {i["ingredient_id"]: i for i in meal["ingredients"]}
    equip = " ".join(meal["equipment"])
    for n, s in enumerate(steps, 1):
        body = s["body"]
        # (1) pot size must fit the water used in this step
        cups = sum(_cups(by_id[r]) for r in s["ingredient_refs"] if r in by_id and is_water(by_id[r]))
        if cups >= 3:
            q = _pot_quarts(body)
            need = round(0.46 * cups, 1)  # water may fill at most ~55% of the pot, leaving room for food and the boil
            if not q:
                fail(slug, f"step {n} uses {cups:g} cups of water without naming the pot size (need >= {need:g}-quart)")
            if max(q) < need:
                fail(slug, f"step {n}: {cups:g} cups of water in a {max(q):g}-quart pot (need >= {need:g}-quart)")
        for qq in _pot_quarts(body):
            if not re.search(rf"\b{qq:g}-(?:to-\d+-)?quart\b", equip):
                fail(slug, f"step {n} names a {qq:g}-quart vessel that is not in equipment")
        # (2) a step that brings 4+ cups of liquid to a boil states the minutes to get there
        liquid = sum(_cups(by_id[r]) for r in s["ingredient_refs"] if r in by_id and by_id[r]["role"] == "liquid")
        if BOIL.search(body) and liquid >= 4 and not BOIL_TIME.search(body):
            fail(slug, f"step {n} brings {liquid:g} cups to a boil without stating the minutes to come to a boil")
        # (3) no untimed waits
        text = UNTIMED_OK.sub(" ", body)
        m = UNTIMED.search(text)
        if m:
            fail(slug, f"step {n} has an untimed or off-clock wait: {m.group(0)!r}")
    # (4) counted equipment must be named in the 1- and 2-serving scaling notes
    for e in meal["equipment"]:
        m = COUNTED_EQUIP.match(e)
        if m:
            word = m.group(2).lower().rstrip("s")
            for k in ("1", "2"):
                if word not in meal["scale"][k].lower():
                    fail(slug, f"scaling note {k} does not say how many {word}s to use (equipment: {e})")
    # (5) every food word in the description is a recipe ingredient
    vocab = " ".join([i["name"] + " " + (i.get("display_name") or "") for i in meal["ingredients"]]).lower()
    for w in re.findall(r"[a-z][a-z-]+", meal["description"].lower()):
        if w in FOOD_WORDS:
            stem = w[:-1] if w.endswith("s") and len(w) > 3 else w
            if stem not in vocab and w not in vocab:
                fail(slug, f"description names {w!r}, which is not an ingredient")
    # (6) stated step minutes must not undershoot the clock badly either (a clock padded with idle time is untimed)
    for n, s in enumerate(steps, 1):
        if s["phase"] == "overlap" or "overlap" in s["body"] or re.search(r"\b(?:batch|batches|per side|each)\b", s["body"]):
            continue
        stated = sum(int(m.group(2) or m.group(1)) for m in DURATION.finditer(s["body"]))
        if stated and s["minutes"] > stated + 8:
            fail(slug, f"step {n} clock {s['minutes']} is far above its stated {stated} minutes")


# ---------------- wave-17 guards (wave-16 audit r1 failures + title matcher) ----------------
DEPTH_WORDS = {"1/16": 1 / 16, "1/8": 1 / 8, "1/4": 1 / 4, "1/3": 1 / 3, "1/2": 1 / 2, "3/4": 3 / 4, "1": 1.0}
DEPTH_RE = re.compile(r"\b(1/16|1/8|1/4|1/3|1/2|3/4|1) inch(?:es)? (?:deep|of oil)|\boil (?:about |roughly )?(1/16|1/8|1/4|1/3|1/2|3/4|1) inch(?:es)? deep|about (1/16|1/8|1/4|1/3|1/2|3/4|1) inch(?:es)? (?:of oil|deep)", re.I)
CUP_IN3 = 14.4375  # cubic inches per US cup


def oil_cups(base_diam_in, depth_in):
    import math
    return math.pi * (base_diam_in / 2) ** 2 * depth_in / CUP_IN3


def wave17_guards(meal):
    slug = meal["slug"]
    fry = [m for m in meal["methods"] if m in ("shallow-fry", "deep-fry")]
    oil = meal.get("oil")
    text = " ".join([meal["heat"], meal.get("food_safety") or "", meal["description"]] + [s["body"] for s in meal["steps"]]
                    + [str(v) for v in meal["scale"].values()] + [(i.get("note") or "") + " " + (i.get("display_name") or "") for i in meal["ingredients"]])
    if fry and not oil:
        fail(slug, f"{fry} without meal['oil'] (ingredient, pan base diameter, depth, fills)")
    if not oil and DEPTH_RE.search(text):
        fail(slug, f"text states an oil depth ({DEPTH_RE.search(text).group(0)!r}) but meal['oil'] is not declared")
    if oil:
        by_id = {i["ingredient_id"]: i for i in meal["ingredients"]}
        i = by_id[oil["ingredient"]]
        have = _cups(i) if i["unit"] in ("cup", "cups", "tbsp", "tsp") else None
        if have is None:
            fail(slug, "oil ingredient must be measured in cups or tbsp")
        need = oil_cups(oil["base_diam_in"], oil["depth_in"]) * oil.get("fills", 1)
        if not (0.8 * need <= have <= 1.25 * need):
            fail(slug, f"oil {have:.2f} cups but {oil['fills'] if 'fills' in oil else 1} fill(s) of {oil['depth_in']:g} inch in a {oil['base_diam_in']:g}-inch base needs {need:.2f} cups")
        for m in DEPTH_RE.finditer(text):
            d = DEPTH_WORDS[next(g for g in m.groups() if g)]
            if abs(d - oil["depth_in"]) > 1e-6:
                fail(slug, f"text states oil depth {m.group(0)!r} but meal['oil'] depth is {oil['depth_in']:g} inch")
        for k, (diam, cups_txt) in (oil.get("scale_check") or {}).items():
            got = oil_cups(diam, oil["depth_in"])
            if not (0.75 * got <= cups_txt <= 1.3 * got):
                fail(slug, f"scaling {k}: {cups_txt:g} cups in a {diam:g}-inch base is not {oil['depth_in']:g} inch ({got:.2f} cups)")
    for f in meal.get("fit", []):
        # f = {"what": str, "count": n, "piece_in": diameter or (w, h), "vessel_in": (w, h) or diameter, "per_layer": n, "layers": n}
        import math
        pw, ph = f["piece_in"] if isinstance(f["piece_in"], (list, tuple)) else (f["piece_in"], f["piece_in"])
        vw, vh = f["vessel_in"] if isinstance(f["vessel_in"], (list, tuple)) else (f["vessel_in"], f["vessel_in"])
        per = int(vw // pw) * int(vh // ph)
        round_vessel = isinstance(f["vessel_in"], (int, float))
        round_piece = isinstance(f["piece_in"], (int, float))
        if round_vessel and round_piece:
            # best known packings of n equal circles in a circle: vessel diameter / piece diameter
            ratio = {1: 1, 2: 2, 3: 2.155, 4: 2.414, 5: 2.701, 6: 3, 7: 3, 8: 3.304, 9: 3.613, 10: 3.813, 11: 3.923, 12: 4.029}
            per = max([n for n, r in ratio.items() if r * pw <= vw] or [0])
        elif round_vessel:
            per = min(per, int(math.pi * (vw / 2) ** 2 // (pw * ph)))  # round vessel: grid count capped by area
        if per < f["per_layer"]:
            fail(slug, f"fit: {f['per_layer']} {f['what']} of {pw:g}x{ph:g} in do not fit one {vw:g}x{vh:g} in layer (max {per})")
        if f["per_layer"] * f.get("layers", 1) < f["count"]:
            fail(slug, f"fit: {f['count']} {f['what']} but only {f['per_layer']} x {f.get('layers', 1)} places")


TITLE_RULE = {"dairy": lambda m: m["elig"]["contains_dairy"], "meat": lambda m: m["elig"]["contains_meat"] or m["elig"]["contains_poultry"],
              "poultry": lambda m: m["elig"]["contains_poultry"], "fish": lambda m: m["elig"]["contains_finfish"],
              "shellfish": lambda m: m["elig"]["contains_shellfish"],
              "nuts": lambda m: bool({"peanut", "tree_nut", "cashew"} & set(m["allergens"]))}
TITLE_WORD_RULE = {"dairy": ["dairy", "milk", "cheese", "butter", "yogurt"],
                   "meat": ["meat", "beef", "pork", "lamb", "bacon", "sausage"], "poultry": ["poultry", "chicken", "turkey", "duck"],
                   "fish": ["fish", "finfish", "salmon", "cod", "tuna", "trout", "halibut", "arctic char", "tilapia", "anchovy", "sardine"],
                   "shellfish": ["shellfish", "shrimp", "crab", "lobster", "scallop", "clam", "mussel", "oyster", "prawn"],
                   "nuts": ["nuts", "peanut", "almond", "walnut", "pecan", "hazelnut", "pistachio", "macadamia", "pine-nut", "cashew"]}


def title_matcher_guard(meals):
    """Run the app's own title matcher (optionTags) on every title; each word it finds must be true of the recipe."""
    titles = [m["title"] for m in meals]
    r = subprocess.run(["node", str(HERE / "title_tags.mjs")], input=json.dumps(titles), capture_output=True, text=True, check=True)
    found = json.loads(r.stdout)
    for m in meals:
        for word in found[m["title"]]:
            rules = [k for k, ws in TITLE_WORD_RULE.items() if word in ws]
            if not rules:
                fail(m["slug"], f"title matcher tag {word!r} maps to no rule")
            for k in rules:
                if not TITLE_RULE[k](m):
                    fail(m["slug"], f"title word {word!r} makes the app tag this meal {k}, but the recipe has no {k}")
        m["_title_tags"] = found[m["title"]]


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
    if slug in EXISTING_SLUGS or slug in LEGACY_SLUGS:
        fail(slug, "planned slug collides with a live catalog slug")
    refs = re.findall(r"[Cc]ompared with ([a-z0-9]+(?:-[a-z0-9]+)+)", meal["near"])
    if len(refs) < 2:
        fail(slug, "near-duplicate review must compare against at least two existing slugs")
    for ref in refs:
        if ref not in EXISTING_SLUGS and ref not in common.PLANNED:
            fail(slug, f"near-duplicate reference to unknown slug {ref}")
    if "if present" in meal["near"] + meal["coverage"] + meal["notdup"]:
        fail(slug, "hedged 'if present' reference")
    # unit word repeated anywhere in the display (e.g. "8 slice ... slices", "1 loaf crusty loaf")
    for i in meal["ingredients"]:
        u = i["unit"]
        if u in ("slice", "loaf", "bunch", "head", "sprig", "piece", "stalk", "rib", "fillet"):
            if re.search(rf"\b{u}(?:e?s)?\b", i["display_name"], re.I):
                fail(slug, f"unit '{u}' repeated in display: {i['quantity']} {u} {i['display_name']}")
    wave16_guards(meal)
    wave17_guards(meal)
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
        if HEAT_SOURCE.search(re.sub(r"dutch oven|oven mitts?|baking (powder|soda)", " ", s["body"], flags=re.I)):
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
        return "author_r1_text_frozen_awaiting_hero"
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
                              if img else f"v1 has not been planned, shopped, cooked, or rated. Recipe text is frozen at {PENDING_REV}; the hero image is generated next from image-prompt.md. Not certified. Not published. kitchen_tested is false."),
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
        "dimensions_note": "Targets for the image pass; finalize_images.py writes both WebPs from the approved hero.",
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
                   if img else {"check": "image", "result": "awaiting_hero", "detail": "Plating brief and prompt are written; the hero is generated next and exported by finalize_images.py."})
    return {
        "catalog_contract": "flavorweave-catalog-package",
        "catalog_contract_note": (f"Author package for wave-17, frozen at {rev} with an original AI image (Cora via Grok Bot GenerateImage; master and card WebPs present). Not audited. Not certified. Not published. Not imported."
                                  if img else f"Author package for wave-17. Recipe text frozen at {PENDING_REV}; hero image generated next from image-prompt.md. Not audited. Not certified. Not published. Not imported."),
        "batch_id": BATCH, "batch_label": "wave-17", "mode": "author_batch", "package_revision": rev,
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


def _sup(image, image_id):
    return next((e for e in (image or {}).get("superseded", []) if e.get("image_id") == image_id), {})


def write_brief(d, meal, image=None):
    slug = meal["slug"]
    sr = common.SELFREVIEW.get(slug)
    if sr:
        n = sr["final"]
        _rounds = sorted({rnd for rnd, _ in common.audit_rej(sr).values()})
        why = (f"after Cora's creator self-review and independent audit {' and '.join(_rounds)} gate K" if _rounds else "after Cora's creator self-review")
        header = (f"Package `{slug}`, revision `{REV if image else PENDING_REV}`. Rebuilt {why} so it matches the accepted v{n} prompt "
                  f"recorded verbatim in image-prompt.md: every section below is the author-r1 text, plus the v{n} correction sentence "
                  f"(earlier versions were rejected; reasons in image-prompt.md). "
                  + (f"Image: master and card WebPs present, frozen at {REV}. " if image else "")
                  + "Standard: the meal-image-spec skill and `image-standards/hero-appeal-amendment.md`.\n")
    elif image:
        header = (f"Package `{slug}`, revision `{REV}`. Written before the first image was generated. "
                  f"Image: master and card WebPs present, frozen at {REV}. Standard: the meal-image-spec skill and `image-standards/hero-appeal-amendment.md`.\n")
    else:
        header = (f"Package `{slug}`, revision `{PENDING_REV}`. Written before any image was generated; Cora generates the hero from image-prompt.md, which is built from this brief. "
                  "Standard: the meal-image-spec skill and `image-standards/hero-appeal-amendment.md`.\n")
    parts = [f"# Image / Plating Brief — {meal['title']}\n", header]
    for head, key in BRIEF_SECTIONS:
        parts.append(f"## {head}\n\n{meal['brief'][key]}\n")
        if key == "props":
            parts.append("Styling props are limited to items in this recipe or neutral tableware (plates, boards, cutlery, linen). No drinks, breads, sides, condiments, sauce bowls, or spices that the recipe does not list.\n")
        if key == "crop":
            parts.append(f"Master is WebP 1200x900. Card is WebP 640x480. Both are 4:3 center crops of the GenerateImage source. Export with `python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py <source> <this dir> {slug}` (finalize_images.py does this).\n")
    if sr:
        parts.append(f"## Correction for the accepted version (v{sr['final']})\n\n{meal['brief']['correction']}\n")
    parts.append("## House style\n\nBright, premium, realistic editorial food photography. Soft daylight, light neutral surface, food filling the frame. The house-quality reference is Chipotle Lime Black Bean Bowl for light and finish only, not for composition. No text, logo, watermark, or hands.\n")
    (d / "image-plating-brief.md").write_text("\n".join(parts))


def prompt_text(meal):
    """The single-paragraph GenerateImage prompt (wave-15 house prompt style)."""
    b = meal.get("brief_v1", meal["brief"])  # the author-r1 (v1) prompt is always built from the author-r1 brief
    frame = "4:3 landscape, subject centered and crop-safe."
    return (f"Editorial food photograph of {meal['title']} for a premium meal-planning app. {b['hero']} Vessel: {b['vessel']} Camera: {b['angle']} "
            f"Must show: {b['visible']} Texture: {b['texture']} Sauce: {b['sauce']} Garnish: {b['garnish']} Styling: {b['props']} "
            f"Color from the recipe only: {b['color']} Do not include: {b['forbid']} Lighting: bright diffused daylight, soft shadows, real highlights, "
            f"no harsh flash, no muddy dark, no synthetic gloss. Background: light neutral tabletop. {frame} {b['ambiguity']} "
            "Quality reference is the Chipotle Lime Black Bean Bowl standard for light and appetite only. Not a copy of that bowl. No text, logos, watermarks, or hands.")


def write_prompt(d, meal, image=None):
    slug = meal["slug"]
    gen_date = (image or {}).get("generation", {}).get("generation_date")
    active = (image or {}).get("active_source_jpeg")
    prompt = prompt_text(meal)
    gm = common.gen_map().get(slug, {})
    if slug in common.SELFREVIEW:
        r = common.SELFREVIEW[slug]
        n = r["final"]
        if image:
            status = (f"Status: image pass complete. package_revision `{REV}`. asset_generated is true; files: {image_files_line(slug, image)}. "
                      f"The active image ({active}) is the v{n} regeneration, generated with Grok Bot GenerateImage on {gen_date} from the v{n} prompt below. "
                      + (f"Versions v1 to v{n - 1} were rejected in Cora's creator self-review against image-plating-brief.md, before any audit, and never finalized."
                         if not r.get("audit_rejected") else
                         "Earlier versions: " + "; ".join(
                             (f"v{v} rejected by independent audit {common.audit_rej(r)[v][0]} gate K after it had been finalized at {common.AUDIT_FINALIZED_AT[common.audit_rej(r)[v][0]]}" if v in r["audit_rejected"]
                              else f"v{v} rejected in Cora's creator self-review before any audit, never finalized") for v in range(1, n)) + "."))
        else:
            status = (f"Status: v{n} hero generated from the v{n} prompt below; run `python3 tools/finalize_images.py {slug} --generator \"Cora via Grok Bot GenerateImage\"` "
                      f"to export the WebPs. package_revision `{PENDING_REV}`.")
        hist = []
        for v in range(1, n + 1):
            vsha = gm.get(f"v{v}")
            if v == 1:
                src_note = "the author-r1 prompt, unchanged; notes/prompts-author-r1.txt and /workspace/wave17-prompts.txt"
                text_v = prompt
            else:
                sec = slug if v == 2 else f"{slug} (v{v})"
                src_note = f"recorded verbatim from notes/prompts-regen-selfreview.txt section `## {sec}`; the v1 prompt plus one appended correction sentence"
                text_v = common.regen_prompt(slug, v)
            if v < n and v in r.get("audit_rejected", {}):
                rj = _sup(image, f"img_{slug}_v{v}")
                moved = rj.get("moved_to_rejected") or {}
                files = "; ".join(f"`{k}` -> `{x['rejected_path']}` (sha256 `{x['sha256']}`)" for k, x in moved.items()) if isinstance(moved, dict) else str(moved)
                _rnd, _why = common.audit_rej(r)[v]
                _fin = common.AUDIT_FINALIZED_AT[_rnd]
                _sup_at = common.NEXT_REV[_fin]
                state = (f"Status: accepted at {_fin} and finalized (active hero for audit {_rnd}), then rejected by independent audit {_rnd} gate K; superseded at {_sup_at}.\n\n"
                         f"- Reason: audit {_rnd} K: {_why}\n"
                         f"- Rejected files: {files or 'see image.superseded in v1.json'}\n"
                         f"- Source sha256 at generation: `{vsha}`")
                head = f"### v{v} (rejected by audit {_rnd})"
            elif v < n:
                rj = _sup(image, f"img_{slug}_v{v}")
                rpath = rj.get("moved_to_rejected") or f"rejected/img_v{v}-selfreview-rejected.jpg"
                state = (f"Status: rejected in creator self-review, never finalized.\n\n- Reason: {r['rejected'][v]}\n"
                         f"- Rejected source: `{rpath}` (sha256 `{vsha}`)")
                head = f"### v{v} (rejected)"
            else:
                state = (f"Status: accepted; this is the active hero.\n\n- Source: `img_v{v}.jpg` (sha256 `{(image or {}).get('file_hashes', {}).get('source_jpeg_sha256') or vsha}`)\n"
                         f"- Correction appended to v1: {r['corrections'][v]}")
                head = f"### v{v} (accepted)"
            hist.append(f"{head}\n\n{state}\n\nPrompt ({src_note}):\n\n{text_v}\n")
        text = f"""# Image prompt — {meal['title']}

{status}

## Active prompt (v{n})

Prompt:

{common.regen_prompt(slug, n)}

image-plating-brief.md was rebuilt to match this prompt (author-r1 sections plus the v{n} correction sentence).

## Version history

Every prompt below is word for word as used with Grok Bot GenerateImage.

""" + "\n".join(hist)
    else:
        if not image:
            status = (f"Status: prompt ready for generation. package_revision `{PENDING_REV}`. Cora generates an original AI image from the prompt below with "
                      f"Grok Bot GenerateImage, saves it in this directory as `img_v1.jpg`, reviews it against image-plating-brief.md, and runs "
                      f"`python3 tools/finalize_images.py {slug} --generator \"Cora via Grok Bot GenerateImage\"` to export the WebPs.")
        else:
            status = (f"Status: image pass complete. package_revision `{REV}`. asset_generated is true. The active image was generated from this prompt with Grok Bot GenerateImage "
                      f"on {gen_date}; files: {image_files_line(slug, image)}.")
        text = f"""# Image prompt — {meal['title']}

{status}

Prompt:

{prompt}
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
    else:
        status_line = "Image: hero generated next from image-prompt.md."
        image_section = (f"image-plating-brief.md and image-prompt.md are written. Cora generates the hero with Grok Bot GenerateImage and "
                         f"`tools/finalize_images.py {slug}` exports `{slug}.webp` (1200x900) and `{slug}-640.webp` (640x480), then the package is re-frozen at author-r2.")
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
    else:
        doc = {"slot_status": "open_for_generation", "asset_generated": False,
               "expected_files": [f"{meal['slug']}.webp", f"{meal['slug']}-640.webp"], "present_files": [],
               "plating_brief": "image-plating-brief.md", "prompt": "image-prompt.md",
               "note": "Generate an original AI image from image-prompt.md with Grok Bot GenerateImage, save it here as img_v1.jpg, then run tools/finalize_images.py <slug> to export both WebPs, update the image block, and re-run freeze integrity."}
    (d / "image-state.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")


def batch_of(slug):
    return "ABCDE"[common.PLANNED.index(slug) // 10]


PROP_DRINKS = re.compile(r"\b(wine|beer|stout|ale|coffee|tea|doogh|lassi|juice|soda|cocktail|drink|drinks)\b", re.I)
PROP_TABLEWARE = set("""a an the and or of in on at to with by beside behind near small little large tiny few some one two
optional soft focus edge frame side corner resting leaning lying table tabletop background only nothing else props prop
plate plates platter board boards bowl bowls dish dishes tray parchment napkin linen cloth towel fork forks knife knives
spoon spoons chopsticks servers server tongs skewer skewers pan pans skillet pot lid scraper cutting wooden copper
ceramic white neutral clay cast-iron iron basket baskets ramekin ramekins extra more same as for the
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


def apply_selfreview(meals):
    """For every self-review regeneration: check each recorded vN prompt is exactly the author-r1 prompt plus one
    'Correction for this version:' sentence, keep the author-r1 brief for the v1 record, and rebuild the brief so it
    matches the accepted prompt (every v1 field plus the accepted correction, verbatim)."""
    by = {m["slug"]: m for m in meals}
    secs = common.regen_sections()
    reasons = common.gen_map_reasons()
    areasons = common.audit_reasons()
    for slug, n in secs:
        r = common.SELFREVIEW.get(slug)
        if not r or not 2 <= n <= r["final"]:
            fail(slug, f"prompts-regen-selfreview.txt has a v{n} section that SELFREVIEW does not account for")
    for slug, r in common.SELFREVIEW.items():
        m = by[slug]
        if "brief_v1" in m:
            continue
        base = prompt_text(m)
        corr = {}
        for n in range(2, r["final"] + 1):
            if (slug, n) not in secs:
                fail(slug, f"no v{n} section in notes/prompts-regen-selfreview.txt")
            t = common.regen_prompt(slug, n)
            lead = base + " " + common.CORRECTION_LEAD
            if not t.startswith(lead) or common.CORRECTION_LEAD in t[len(lead):]:
                fail(slug, f"v{n} prompt is not the author-r1 prompt plus one appended correction sentence")
            corr[n] = t[len(lead):]
        ar = common.audit_rej(r)
        if set(r["rejected"]) & set(ar) or set(r["rejected"]) | set(ar) != set(range(1, r["final"])):
            fail(slug, "SELFREVIEW must list exactly one rejection (self-review or audit) for every version before the accepted one")
        for v, why in r["rejected"].items():
            if reasons.get((slug, f"v{v}")) != why:
                fail(slug, f"v{v} rejection reason differs from notes/image-gen-map.txt")
        for v, why in ar.items():
            if areasons.get((slug, f"v{v}")) != why:
                fail(slug, f"v{v} audit rejection reason differs from notes/image-gen-map.txt")
        r["corrections"] = corr
        m["brief_v1"] = m["brief"]
        m["brief"] = {**m["brief"], "correction": corr[r["final"]]}
    extra = {s for (s, v) in reasons} - set(common.SELFREVIEW)
    extra |= {s for (s, v) in areasons if int(v[1:]) not in common.audit_rej(common.SELFREVIEW.get(s))}
    if extra:
        fail(sorted(extra)[0], "image-gen-map.txt records a self-review rejection that SELFREVIEW does not account for")


def main():
    force = "--force" in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    meals = common.MEALS
    apply_selfreview(meals)
    slugs = [m["slug"] for m in meals]
    if len(set(slugs)) != len(slugs):
        raise SystemExit("duplicate slugs")
    unknown = [s for s in only if s not in slugs]
    if unknown:
        raise SystemExit(f"unknown slugs {unknown}")
    errors = []
    for m in meals:
        try:
            check(m)
            props_guard(m)
        except SystemExit as e:
            errors.append(str(e))
    if errors:
        raise SystemExit("\n".join(errors))
    title_matcher_guard(meals)
    titles = [m["title"].lower() for m in meals]
    if len(set(titles)) != len(titles):
        raise SystemExit("duplicate titles")
    if "--check" in sys.argv:  # authoring aid: run every guard on the meals written so far, write nothing
        for m in meals:
            print(f"ok {m['slug']}: {m['_d03'][0]}/{m['_d03'][3]} count={m['_d03'][6]} title_tags={m['_title_tags']}")
        print(f"checked {len(meals)} of {len(common.PLANNED)} planned; nothing written")
        return
    if sorted(slugs) != sorted(common.PLANNED):
        missing = sorted(set(common.PLANNED) - set(slugs)); extra = sorted(set(slugs) - set(common.PLANNED))
        raise SystemExit(f"built slugs differ from PLANNED: missing {missing} extra {extra}")
    hh = 0
    global REV
    for m in meals:
        if only and m["slug"] not in only:
            continue
        REV = common.rev_for(m["slug"])  # author-r3 only for the slugs revised after audit r1
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
        rounds = [(common.R3, "author-r2", common.R3_REV, common.R3_WHEN, "R3"), (common.R4, common.R3_REV, common.R4_REV, common.R4_WHEN, "R4"),
                  (common.R5, common.R4_REV, common.R5_REV, common.R5_WHEN, "R5")]
        rounds = [x for x in rounds if m["slug"] in x[0]]
        if rounds and img:
            new_hash = doc["recipe_version"]["culinary_hash"]
            hist = []
            for k, (table, frm, to, when, name) in enumerate(rounds):
                rr = table[m["slug"]]
                latest = k == len(rounds) - 1
                # the round's own after-hash: the current hash for the latest round; for an earlier round, the next round's from-hash
                to_hash = new_hash if latest else rounds[k + 1][0][m["slug"]]["from_culinary_hash"]
                if rr["culinary_changed"] and to_hash == rr["from_culinary_hash"]:
                    fail(m["slug"], f"listed in {name} as a recipe change but the culinary text is unchanged")
                if not rr["culinary_changed"] and to_hash != rr["from_culinary_hash"]:
                    fail(m["slug"], f"listed in {name} as image/metadata-only but the culinary hash changed")
                if latest and to != REV:
                    fail(m["slug"], f"latest revision round {name} is {to} but the build revision is {REV}")
                if latest and rr["image_changed"] and img["image"].get("package_revision") != REV:
                    fail(m["slug"], f"listed in {name} with a new image but the image block is not finalized at {REV}; run finalize_images.py")
                hist.append({"from": frm, "to": to, "when": when, "who": AUTHOR,
                             "trigger": rr["trigger"], "scope": rr["scope"],
                             "from_culinary_hash": rr["from_culinary_hash"], "to_culinary_hash": to_hash, "changes": rr["changes"]})
            doc["revision_history"] = hist
        (d / "v1.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
        image = doc["image"] if img else None
        write_sidecar(d, m, rev)
        write_brief(d, m, image)
        write_prompt(d, m, image)
        write_readme(d, m, doc, image)
        write_image_state(d, m, image, img["state"] if img else None)
        hh += m["hh001"]
        v = doc["recipe_version"]
        print(f"wrote {m['slug']} {rev}: {v['prep_minutes']}+{v['cook_minutes']}={v['total_minutes']} {v['effort_level']}/{v['ingredient_complexity']} batch={doc['creator_batch']} hh001={m['hh001']} image={'kept ' + doc['image']['active_source_jpeg'] if img else 'open'}")
    print(f"hh001 {hh}/{len(meals) if not only else len(only)}")


if __name__ == "__main__":
    main()
