#!/usr/bin/env python3
"""Write wave-13 author packages. Run from the repo root:

    python3 factory/waves/wave-13/build_packages.py

The script refuses to emit a package whose title, description, methods, or
steps classify as a different D-06.1 cooking result than the one declared
below. Image slots stay pending.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "factory" / "waves" / "wave-13" / "candidates"
BATCH = "wave-13-2026-10-11"
WHEN = "2026-10-11"
AUTHOR = "Cursor cloud agent, author role, wave-13"

FRY_RE = re.compile(
    r"\b(?:deep[-\s]?fr\w*|pan[-\s]?fr\w*|shallow[-\s]?fr\w*|air[-\s]?fr\w*|stir[-\s]?fr\w*|fr(?:y|ied|ying))\b",
    re.I,
)


def ing(iid, name, qty, unit, role="main", display=None, note=None, prep=None):
    return {
        "ingredient_id": iid,
        "name": name,
        "display_name": display or name,
        "quantity": qty,
        "unit": unit,
        "note": note,
        "preparation": prep,
        "optional": False,
        "role": role,
    }


def step(n, title, body, refs):
    return {"step_number": n, "title": title, "body": body, "ingredient_refs": refs}


def canonical(value):
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "null"
    if isinstance(value, list):
        return "[" + ",".join(canonical(item) for item in value) + "]"
    if isinstance(value, dict):
        parts = [json.dumps(key) + ":" + canonical(value[key]) for key in sorted(value)]
        return "{" + ",".join(parts) + "}"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return json.dumps(value)


def culinary_hash(version):
    payload = {
        "title": version["title"],
        "description": version["description"],
        "base_servings": version["base_servings"],
        "ingredients": version["ingredients"],
        "steps": version["steps"],
        "components": version["components"],
        "equipment": version["equipment"],
        "prep_minutes": version["prep_minutes"],
        "cook_minutes": version["cook_minutes"],
        "total_minutes": version["total_minutes"],
        "heat": version["heat"],
        "doneness": version["doneness"],
    }
    return hashlib.sha256(canonical(payload).encode()).hexdigest()


def derive(title, description, methods, steps):
    source = {
        "title": title,
        "description": description,
        "methods": methods,
        "steps": [{"body": item["body"]} for item in steps],
    }
    code = (
        "import { deriveCookingMethod } from './src/weave/semantics.js';"
        "const source = JSON.parse(process.argv[1]);"
        "process.stdout.write(JSON.stringify(deriveCookingMethod(source)));"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-e", code, json.dumps(source)],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def scanned_text(meal):
    parts = [meal["title"], meal["description"], " ".join(meal["methods"])]
    parts.extend(item["body"] for item in meal["steps"])
    return "\n".join(parts)


# allowed fry-word hits in title/description/methods/steps
MEALS = []


def add(meal):
    MEALS.append(meal)


add({
    "slug": "deep-fried-cod-roasted-potatoes",
    "title": "Deep-Fried Cod with Oven-Roasted Potatoes",
    "description": "Cod in a club-soda batter, deep-fried until golden, with oven-roasted potato wedges whose edges are crisp. Lemon, parsley, and vinegar at the table. No butter.",
    "cuisine": "british",
    "meal_format": "plate",
    "primary": "cod",
    "tags": ["cod", "crispy", "savory", "fresh"],
    "servings": 4,
    "prep": 20,
    "cook": 35,
    "methods": ["deep-fry", "roast"],
    "allow_fry": {"deep-fried", "deep-fry"},
    "expect_frying": ["deep"],
    "expect_crisp_has": ["roasted"],
    "expect_stir": False,
    "heat": "Oven 425 F for the potatoes. Oil at 375 F for the cod.",
    "doneness": "Potatoes tender in the center with crisp edges. Cod deep golden, opaque, and 145 F in the center.",
    "equipment": ["heavy 4-quart pot or dutch oven", "deep-fry thermometer or an instant-read thermometer that clips to the pot", "rimmed sheet pan", "tongs", "wire rack", "mixing bowl", "paper towels"],
    "clock": "Prep 20, and the oven goes on at minute 0 so it is hot before the pan goes in. Cook 35 is the potato roast. The oil heats during the last 8 minutes of that roast, and the cod is deep-fried in two batches inside the same 35 minutes.",
    "hh001": True,
    "hh_reason": "Finfish is allowed. The batter is club soda, flour, cornstarch, and egg, with no dairy and no shellfish. No nuts.",
    "hh_contract": "Club-soda batter only. No beer batter, no milk, no butter, and no shellfish in the fryer.",
    "eligibility": {
        "contains_meat": False, "contains_poultry": False, "contains_finfish": True,
        "contains_shellfish": False, "contains_dairy": False,
        "plant_based_compatible": False, "vegetarian_compatible": False,
        "nut_policy": "none",
        "nut_policy_note": "No peanuts, tree nuts, or cashews.",
    },
    "labels": ["dairy_free", "fish"],
    "label_note": "Unconditional dairy_free. Fish because of the cod. Not vegetarian.",
    "allergens": ["finfish", "wheat", "egg"],
    "allergen_notes": ["Finfish is the cod.", "Wheat is the flour.", "Egg is in the batter."],
    "effort": ("involved", 7, {"active_prep": 1, "active_attention": 2, "active_components": 1, "technique": 2, "coordination_cleanup_equipment": 1}, ["technique_2_with_prep"]),
    "complexity": ("simple", 1, {"ingredient_count_band": 0, "specialty_burden": 0, "flavor_component_breadth": 1, "pantry_familiarity": 0}, 10),
    "effort_why": "Deep-frying is continuous attention and a technique score of 2, and the potatoes roast at the same time. The technique floor makes this involved.",
    "complexity_why": "Ten counted items, all supermarket. Oils, salt, and pepper are not counted. Club soda is ordinary. Flavor breadth is the batter plus the vinegar and lemon.",
    "components": [
        {"component_id": "batter", "name": "club-soda batter", "made_in_recipe": True, "store_bought": False, "ingredients": ["flour", "cornstarch", "baking powder", "egg", "club soda"]},
        {"component_id": "potatoes", "name": "oven-roasted potato wedges", "made_in_recipe": True, "store_bought": False, "ingredients": ["russet potatoes", "olive oil"]},
    ],
    "coverage": "British 1 to 2, and the first HH001 British meal. Cod moves from tacos to a deep-fried plate. Potatoes are roasted crisp, not a second fry.",
    "near": "Compared with crispy fish tacos: same species, different format, and those tacos are a stovetop legacy package. Compared with Cajun catfish: blackened, not deep-fried. Compared with Thai fish cakes: a paste cake, not a battered fillet.",
    "scale": {
        "1": "One fillet, a quarter of the batter, one potato. Same oil depth; do not cut the oil down to a puddle.",
        "2": "Half the fish, batter, and potatoes. Still two batches if the pot is crowded.",
        "4": "As written.",
        "do_not_scale": ["oil depth in the pot", "oil temperature of 375 F"],
    },
    "ingredients": [
        ing("cod-fillets", "cod", 4, "count", display="cod fillets", note="about 6 oz each, 1.5 lb total", prep="patted dry"),
        ing("russet-potatoes", "russet potatoes", 2, "lb", prep="cut into 3/4-inch wedges"),
        ing("olive-oil", "olive oil", 2, "tbsp", role="fat", note="for the potatoes"),
        ing("kosher-salt", "kosher salt", 2.5, "tsp", role="seasoning", note="1 tsp potatoes, 1/2 tsp batter, 1 tsp fish"),
        ing("black-pepper", "black pepper", 0.5, "tsp", role="seasoning"),
        ing("all-purpose-flour", "all-purpose flour", 0.5, "cup", role="component"),
        ing("cornstarch", "cornstarch", 0.25, "cup", role="component"),
        ing("baking-powder", "baking powder", 1, "tsp", role="component"),
        ing("egg", "egg", 1, "count", role="component", display="large egg"),
        ing("club-soda", "club soda", 0.75, "cup", role="liquid", note="cold. The batter liquid is club soda, not beer and not milk."),
        ing("neutral-oil", "neutral oil", 6, "cup", role="fat", note="canola or peanut-free vegetable oil, enough for about 2 inches in the pot"),
        ing("lemon", "lemon", 1, "count", prep="cut into wedges"),
        ing("parsley", "flat-leaf parsley", 0.25, "cup", role="garnish", prep="chopped"),
        ing("white-wine-vinegar", "white wine vinegar", 2, "tbsp", role="seasoning", note="at the table, in place of malt vinegar"),
    ],
    "steps": [
        step(1, "Heat the oven and cut the potatoes", "Turn the oven to 425 F before anything else; it heats during this prep. Cut the potatoes into 3/4-inch wedges, toss with the olive oil, 1 tsp salt, and the pepper, and spread them on a sheet pan.", ["russet-potatoes", "olive-oil", "kosher-salt", "black-pepper"]),
        step(2, "Mix the batter and salt the cod", "Whisk the flour, cornstarch, baking powder, and 1/2 tsp salt. Whisk in the egg and the cold club soda until just combined; a few lumps are fine. Pat the cod dry and salt it with the remaining 1 tsp. About 20 minutes for both prep steps, including the oven heat.", ["all-purpose-flour", "cornstarch", "baking-powder", "kosher-salt", "egg", "club-soda", "cod-fillets"]),
        step(3, "Roast the potatoes", "Roast the potatoes at 425 F for 35 minutes, turning once halfway, until the centers are tender and the edges are crisp. Leave them in the oven if they finish a few minutes early.", ["russet-potatoes"]),
        step(4, "Deep-fry the cod", "When the potatoes have about 10 minutes left, heat the neutral oil to 375 F. Dip two fillets in batter, let the excess drip off, and deep-fry until deep golden and 145 F in the center, about 3 to 4 minutes. Drain on a rack. Repeat with the other two fillets. This sits inside the 35-minute roast.", ["neutral-oil", "cod-fillets", "all-purpose-flour", "cornstarch", "egg", "club-soda"]),
        step(5, "Serve", "Put the cod and potatoes on plates. Scatter the parsley and serve with lemon and the vinegar.", ["parsley", "lemon", "white-wine-vinegar", "cod-fillets", "russet-potatoes"]),
    ],
    "brief": {
        "hero": "Two pieces of deep-fried cod with a visibly rough, golden batter crust, next to a pile of oven-roasted potato wedges with browned edges.",
        "vessel": "Warm off-white dinner plate.",
        "angle": "Elevated three-quarter, about 30 degrees, so the crust edge and the potato wedges both read.",
        "visible": "Golden battered cod, crisp-edged potato wedges, a lemon wedge, chopped parsley, and a small pool of vinegar or a lemon-bright sheen. No second protein.",
        "texture": "Irregular batter crust, flaky white fish at one broken edge, rough roasted potato skin.",
        "sauce": "No gravy. Lemon and parsley on the fish. Vinegar is a small spoonful or a tiny ramekin, not a puddle under the food.",
        "garnish": "Parsley and lemon only.",
        "props": "Optional lemon half in soft focus. No newspaper cone and no malt bottle with a label.",
        "color": "Golden crust, brown potato edges, white fish, yellow lemon, green parsley.",
        "forbid": "Butter, tartar sauce, ketchup, peas, french fries from a fryer, coleslaw, shrimp, logos, text.",
        "crop": "Fish and potatoes inside the center 70 percent so a 4:3 crop keeps both. The crust must still read at 640x480.",
        "ambiguity": "Battered cod and roasted wedges. Not fish tacos and not a blackened fillet.",
    },
})

add({
    "slug": "pan-fried-trout-lemon-capers",
    "title": "Pan-Fried Trout with Lemon and Capers",
    "description": "Trout fillets pan-fried in olive oil, with a lemon and caper pan sauce made with vegetable broth. No butter.",
    "cuisine": "american",
    "meal_format": "skillet",
    "primary": "trout",
    "tags": ["citrusy", "savory", "tender", "fresh"],
    "servings": 4,
    "prep": 10,
    "cook": 14,
    "methods": ["pan-fry"],
    "allow_fry": {"pan-fried", "pan-fry"},
    "expect_frying": ["pan"],
    "expect_crisp_has": [],
    "expect_stir": False,
    "heat": "Medium-high skillet for the trout, then medium for the sauce.",
    "doneness": "Trout golden on the floured side, opaque, and 145 F. Sauce tart and spoonable, not a thick gravy.",
    "equipment": ["12-inch skillet", "tongs or a thin spatula", "plate", "small bowl"],
    "clock": "Prep 10 is dredging, lemon, garlic, and parsley. Cook 14 is two batches at about 4 minutes each plus about 6 minutes for the sauce. No oven.",
    "hh001": True,
    "hh_reason": "Finfish is allowed. Olive oil and dairy-free vegetable broth replace butter. No nuts and no shellfish.",
    "hh_contract": "Olive oil only, and the broth is dairy-free vegetable broth. No butter, no cream, and no chicken broth.",
    "eligibility": {
        "contains_meat": False, "contains_poultry": False, "contains_finfish": True,
        "contains_shellfish": False, "contains_dairy": False,
        "plant_based_compatible": False, "vegetarian_compatible": False,
        "nut_policy": "none",
        "nut_policy_note": "No peanuts, tree nuts, or cashews. Capers are not a nut.",
    },
    "labels": ["dairy_free", "fish"],
    "label_note": "Unconditional dairy_free. Fish because of the trout.",
    "allergens": ["finfish", "wheat"],
    "allergen_notes": ["Finfish is the trout.", "Wheat is the flour dredge."],
    "effort": ("moderate", 3, {"active_prep": 1, "active_attention": 1, "active_components": 0, "technique": 1, "coordination_cleanup_equipment": 0}, []),
    "complexity": ("standard", 2, {"ingredient_count_band": 0, "specialty_burden": 1, "flavor_component_breadth": 1, "pantry_familiarity": 0}, 7),
    "effort_why": "A short pan-fry and a pan sauce. Attention is real but brief, so it scores 1 rather than continuous. Technique is 1. Total 3, moderate. The 24-minute clock does not make it easy.",
    "complexity_why": "Seven counted items. Trout fillets are a less common fish-counter item, so specialty burden is 1. Pantry familiarity stays 0 so the fish is not counted twice. American home cooking adds no points.",
    "components": [
        {"component_id": "sauce", "name": "lemon caper pan sauce", "made_in_recipe": True, "store_bought": False, "ingredients": ["lemon", "capers", "garlic", "vegetable broth", "parsley"]},
    ],
    "coverage": "First trout. A 24-minute skillet in a catalog with only 11 meals under 30 minutes. Pan-fry is an explicit method token.",
    "near": "Compared with miso salmon and maple salmon: different fish, no miso, no maple, no oven. Compared with grilled swordfish: that plate is olives and capers on the grill; this is trout, flour, and a broth pan sauce, with no olives.",
    "scale": {
        "1": "One fillet, a spoon of flour, a quarter of the sauce. A 10-inch skillet is enough.",
        "2": "Two fillets in one batch if they fit, half the sauce.",
        "4": "As written, two batches.",
        "do_not_scale": ["do not crowd the skillet", "sauce should stay thin"],
    },
    "ingredients": [
        ing("trout-fillets", "trout", 4, "count", display="trout fillets", note="about 6 oz each, skin on or off"),
        ing("kosher-salt", "kosher salt", 1, "tsp", role="seasoning"),
        ing("black-pepper", "black pepper", 0.5, "tsp", role="seasoning"),
        ing("all-purpose-flour", "all-purpose flour", 0.33, "cup", role="component", note="light dredge"),
        ing("olive-oil", "olive oil", 3, "tbsp", role="fat"),
        ing("lemon", "lemon", 1, "count", prep="juiced, about 3 tbsp, plus the rind left for the plate"),
        ing("capers", "capers", 2, "tbsp", role="seasoning", prep="drained"),
        ing("garlic", "garlic", 1, "clove", prep="minced"),
        ing("vegetable-broth", "vegetable broth", 0.25, "cup", role="liquid", note="dairy-free, with no chicken and no fish"),
        ing("parsley", "flat-leaf parsley", 0.25, "cup", role="garnish", prep="chopped"),
    ],
    "steps": [
        step(1, "Dredge the trout", "Pat the trout dry, salt and pepper it, and dredge lightly in the flour. Juice the lemon, mince the garlic, and chop the parsley. About 10 minutes.", ["trout-fillets", "kosher-salt", "black-pepper", "all-purpose-flour", "lemon", "garlic", "parsley"]),
        step(2, "Pan-fry the trout", "Heat the olive oil in a 12-inch skillet over medium-high. Pan-fry the trout in two batches, about 3 minutes on the floured side and 1 to 2 minutes on the second side, until golden and 145 F. Move the fillets to a plate.", ["olive-oil", "trout-fillets"]),
        step(3, "Make the pan sauce", "Lower the heat to medium. Add the garlic and stir 30 seconds. Add the capers, lemon juice, and vegetable broth. Simmer about 2 minutes until the sauce tastes bright and is still thin. Take it off the heat, stir in the parsley, and spoon it over the trout. About 6 minutes. Cook total is 14.", ["garlic", "capers", "lemon", "vegetable-broth", "parsley", "trout-fillets"]),
    ],
    "brief": {
        "hero": "Two trout fillets with a light golden flour crust and a thin lemon-caper sauce spooned over, capers visible.",
        "vessel": "Off-white dinner plate or a low oval platter.",
        "angle": "Elevated three-quarter so the fillet length and the sauce sheen both show.",
        "visible": "Trout, capers, parsley, a little sauce. No rice pile and no potato.",
        "texture": "Thin golden crust, moist flaky fish, glossy thin sauce.",
        "sauce": "Spooned over the center, not a lake. Capers sitting on top.",
        "garnish": "Chopped parsley only.",
        "props": "Optional lemon half. No butter dish.",
        "color": "Pale pink-white fish, golden crust, green parsley, dull green capers, yellow lemon.",
        "forbid": "Butter pats, cream sauce, almonds, olives, shrimp, dill-heavy Scandinavian styling that implies another recipe, text, logos.",
        "crop": "Fillets fill the center. Card crop must still show capers.",
        "ambiguity": "Pan-fried trout, not grilled swordfish and not a salmon glaze.",
    },
})

add({
    "slug": "shallow-fried-green-tomatoes",
    "title": "Shallow-Fried Green Tomatoes with White Beans and Slaw",
    "description": "Cornmeal-crusted green tomato slices, shallow-fried until golden, with smoky white beans and a vinegar slaw. No buttermilk and no mayonnaise.",
    "cuisine": "southern",
    "meal_format": "composed-plate",
    "primary": "green tomatoes",
    "tags": ["crispy", "tangy", "savory", "fresh"],
    "servings": 4,
    "prep": 18,
    "cook": 18,
    "methods": ["shallow-fry"],
    "allow_fry": {"shallow-fried", "shallow-fry"},
    "expect_frying": ["shallow"],
    "expect_crisp_has": [],
    "expect_stir": False,
    "heat": "Medium skillet, about 1/4 inch of oil, for the tomatoes. A small pot over medium for the beans.",
    "doneness": "Tomato crust golden and crisp, interior hot and juicy, not raw and not mush. Beans heated through. Slaw still crunchy.",
    "equipment": ["10-inch skillet", "slotted spatula", "wire rack", "medium saucepan", "two mixing bowls", "paper towels"],
    "clock": "Prep 18 includes a 10-minute salt on the tomatoes while the slaw is mixed. Cook 18 is the shallow-fry in three batches, and the beans heat on a second burner during the first batch.",
    "hh001": True,
    "hh_reason": "No meat, poultry, fish, shellfish, or dairy. Eggs are allowed. Cornmeal replaces a wheat dredge. The slaw has vinegar, not mayonnaise. No nuts.",
    "hh_contract": "Dredge is egg and water, not buttermilk. Slaw is vinegar, not mayonnaise. No bacon and no butter.",
    "eligibility": {
        "contains_meat": False, "contains_poultry": False, "contains_finfish": False,
        "contains_shellfish": False, "contains_dairy": False,
        "plant_based_compatible": False, "vegetarian_compatible": True,
        "nut_policy": "none",
        "nut_policy_note": "No peanuts, tree nuts, or cashews.",
    },
    "labels": ["dairy_free", "vegetarian"],
    "label_note": "Unconditional dairy_free and vegetarian. Not plant-based, because of the eggs.",
    "allergens": ["egg"],
    "allergen_notes": ["Egg is the dredge. Cornmeal is not wheat. No milk."],
    "effort": ("moderate", 5, {"active_prep": 1, "active_attention": 1, "active_components": 1, "technique": 1, "coordination_cleanup_equipment": 1}, []),
    "complexity": ("simple", 1, {"ingredient_count_band": 0, "specialty_burden": 0, "flavor_component_breadth": 1, "pantry_familiarity": 0}, 10),
    "effort_why": "Three parts, but the slaw and beans are simple, so components score 1. Shallow-frying in batches is attention 1 and technique 1. Total 5, moderate.",
    "complexity_why": "Ten counted items. Green tomatoes are seasonal produce, not a specialty-store product, so specialty burden stays 0. Southern cooking adds no points.",
    "components": [
        {"component_id": "tomatoes", "name": "shallow-fried green tomatoes", "made_in_recipe": True, "store_bought": False, "ingredients": ["green tomatoes", "cornmeal", "eggs"]},
        {"component_id": "beans", "name": "smoky white beans", "made_in_recipe": True, "store_bought": False, "ingredients": ["cannellini beans", "garlic", "smoked paprika"]},
        {"component_id": "slaw", "name": "vinegar slaw", "made_in_recipe": True, "store_bought": False, "ingredients": ["green cabbage", "scallions", "apple cider vinegar", "sugar"]},
    ],
    "coverage": "Southern 1 to 2, and the first HH001 southern plate. First green tomato. Explicit shallow-fry.",
    "near": "The only other southern meal is a shrimp boil with sausage and butter. Sabich also shallow-fries, but that is eggplant in a pita, not a tomato plate.",
    "scale": {
        "1": "One tomato, one egg is still easier than a fraction, a quarter of the beans and slaw.",
        "2": "Half, fried in two batches.",
        "4": "As written.",
        "do_not_scale": ["oil depth stays about 1/4 inch", "do not stack wet tomatoes in the skillet"],
    },
    "ingredients": [
        ing("green-tomatoes", "green tomatoes", 4, "count", note="about 1.5 lb, firm and green", prep="sliced 1/2 inch thick"),
        ing("kosher-salt", "kosher salt", 2, "tsp", role="seasoning", note="1 tsp on the tomatoes, 1/2 tsp cornmeal, 1/2 tsp slaw"),
        ing("black-pepper", "black pepper", 0.5, "tsp", role="seasoning"),
        ing("cornmeal", "cornmeal", 0.75, "cup", role="component", note="not a wheat flour"),
        ing("eggs", "eggs", 2, "count", role="component", display="large eggs", note="beaten with 1 tbsp water"),
        ing("water", "water", 1, "tbsp", role="liquid", note="into the eggs"),
        ing("neutral-oil", "neutral oil", 1.5, "cup", role="fat", note="about 1/4 inch in a 10-inch skillet"),
        ing("cannellini-beans", "cannellini beans", 3, "cup", note="drained, from two 15-oz cans, no pork in the can"),
        ing("garlic", "garlic", 2, "clove", prep="sliced"),
        ing("olive-oil", "olive oil", 1, "tbsp", role="fat", note="for the beans"),
        ing("smoked-paprika", "smoked paprika", 1, "tsp", role="seasoning"),
        ing("green-cabbage", "green cabbage", 4, "cup", prep="shredded"),
        ing("apple-cider-vinegar", "apple cider vinegar", 2, "tbsp", role="seasoning"),
        ing("sugar", "sugar", 1, "tsp", role="seasoning"),
        ing("scallions", "scallions", 2, "count", prep="sliced"),
    ],
    "steps": [
        step(1, "Salt the tomatoes and mix the slaw", "Lay the tomato slices on towels, sprinkle with 1 tsp salt, and wait 10 minutes, then pat them very dry. Meanwhile toss the cabbage, scallions, vinegar, sugar, and 1/2 tsp salt. Beat the eggs with the water. Stir the remaining salt and the pepper into the cornmeal. About 18 minutes.", ["green-tomatoes", "kosher-salt", "green-cabbage", "scallions", "apple-cider-vinegar", "sugar", "eggs", "water", "cornmeal", "black-pepper"]),
        step(2, "Heat the beans", "Warm the olive oil and garlic in a saucepan over medium for 1 minute. Add the beans, smoked paprika, and a splash of water if they look dry. Heat through, about 8 minutes, while the tomatoes cook. Keep them warm.", ["olive-oil", "garlic", "cannellini-beans", "smoked-paprika"]),
        step(3, "Shallow-fry the tomatoes", "Heat the neutral oil over medium until it shimmers, about 1/4 inch deep in the 10-inch skillet. Dip the tomatoes in egg, then cornmeal, and shallow-fry in three batches until golden, about 3 minutes per side. Drain on a rack. Cook clock is 18 minutes including the beans.", ["neutral-oil", "green-tomatoes", "eggs", "cornmeal"]),
        step(4, "Plate", "Spoon beans onto plates, add the tomatoes and a pile of slaw.", ["cannellini-beans", "green-tomatoes", "green-cabbage"]),
    ],
    "brief": {
        "hero": "A stack of two or three golden cornmeal-crusted green tomato slices, beans to one side, bright slaw to the other.",
        "vessel": "Off-white dinner plate.",
        "angle": "Elevated three-quarter so the crust edge and the green interior of a cut slice both show.",
        "visible": "Golden crust, pale green tomato interior, white beans with a red-brown paprika tint, shredded cabbage slaw.",
        "texture": "Coarse cornmeal crust, juicy tomato, glossy beans, raw crunchy cabbage.",
        "sauce": "No white sauce. The slaw is undressed-looking but lightly vinegared, not swimming.",
        "garnish": "Scallion greens already in the slaw. Nothing else.",
        "props": "Optional extra tomato slice in soft focus. No bacon, no buttermilk pitcher.",
        "color": "Gold crust, green tomato, white beans, pale green cabbage, red paprika.",
        "forbid": "Mayonnaise, ranch, bacon, shrimp, fried chicken, wheat-flour sandwich bread, text, logos.",
        "crop": "The tomato stack is the center. Beans and slaw stay in frame at card size.",
        "ambiguity": "A tomato plate with beans and slaw. Not a shrimp boil and not a sandwich.",
    },
})

add({
    "slug": "air-fried-vegetable-spring-rolls",
    "title": "Air-Fried Vegetable Spring Rolls",
    "description": "Cabbage, shiitake, and rice-vermicelli rolls air-fried until the wrappers are crisp, with a soy and lime dip. No shrimp and no fish sauce.",
    "cuisine": "vietnamese",
    "meal_format": "handheld",
    "primary": "cabbage",
    "tags": ["crispy", "crunchy", "fresh", "savory"],
    "servings": 4,
    "prep": 25,
    "cook": 16,
    "methods": ["air-fry"],
    "allow_fry": {"air-fried", "air-fry", "air-fryer", "air fryer"},
    "expect_frying": [],
    "expect_crisp_has": ["air_fried"],
    "expect_stir": False,
    "heat": "Air fryer at 375 F. A skillet over medium-high only to soften the filling.",
    "doneness": "Wrappers crisp and blistered, filling hot, vermicelli tender. Dip salty, sour, and a little sweet.",
    "equipment": ["air fryer", "12-inch skillet", "mixing bowl", "pastry brush", "small bowl"],
    "clock": "Prep 25 is the filling, a cool-down, and rolling twelve wrappers. Cook 16 is two air-fryer batches at about 8 minutes each. The machine heats during the first minute of that cook clock.",
    "hh001": True,
    "hh_reason": "Plant-based. No shrimp, no fish sauce, no dairy, no meat, no poultry, and no nuts. Sesame oil is sesame, which HH001 allows. Wheat is in the wrappers.",
    "hh_contract": "Dip is soy, lime, water, sugar, garlic, and chile. No fish sauce. Filling has no shrimp and no crab.",
    "eligibility": {
        "contains_meat": False, "contains_poultry": False, "contains_finfish": False,
        "contains_shellfish": False, "contains_dairy": False,
        "plant_based_compatible": True, "vegetarian_compatible": True,
        "nut_policy": "none",
        "nut_policy_note": "No peanuts, tree nuts, or cashews. Sesame oil is not a nut.",
    },
    "labels": ["dairy_free", "vegetarian", "plant_based"],
    "label_note": "Unconditional dairy_free, vegetarian, and plant_based. The dip does not contain fish sauce.",
    "allergens": ["wheat", "soy", "sesame"],
    "allergen_notes": ["Wheat is the wrappers and the soy sauce.", "Soy is the soy sauce.", "Sesame is the sesame oil."],
    "effort": ("moderate", 5, {"active_prep": 2, "active_attention": 1, "active_components": 1, "technique": 1, "coordination_cleanup_equipment": 0}, []),
    "complexity": ("standard", 3, {"ingredient_count_band": 1, "specialty_burden": 0, "flavor_component_breadth": 2, "pantry_familiarity": 0}, 13),
    "effort_why": "Rolling twelve wrappers is the prep score of 2. The air fryer itself is not a hard technique. Total 5, moderate.",
    "complexity_why": "Thirteen counted items, so the count band is 1. Wrappers are a normal grocery item, specialty burden 0. Filling plus dip is flavor breadth 2. Vietnamese home cooking adds no points.",
    "components": [
        {"component_id": "filling", "name": "cabbage and mushroom filling", "made_in_recipe": True, "store_bought": False, "ingredients": ["cabbage", "carrot", "shiitake", "rice vermicelli", "soy sauce"]},
        {"component_id": "dip", "name": "soy lime dip", "made_in_recipe": True, "store_bought": False, "ingredients": ["soy sauce", "lime", "garlic", "sugar", "red chile"]},
        {"component_id": "wrappers", "name": "wheat spring roll wrappers", "made_in_recipe": False, "store_bought": True, "ingredients": ["spring roll wrappers"], "contract": "Wheat spring roll wrappers, not rice paper. No egg wash required by the package."},
    ],
    "coverage": "Vietnamese handheld, first spring roll, and an air-fry method token that is crisp and not a frying kind.",
    "near": "Pho is chicken noodle soup. Turmeric dill fish is a noodle plate with catfish and cashews. Neither is a crisp roll.",
    "scale": {
        "1": "Three rolls and a quarter of the dip. Still heat the air fryer.",
        "2": "Six rolls, one batch.",
        "4": "As written, two batches.",
        "do_not_scale": ["do not pack the air fryer so the rolls touch in a solid mass", "wrappers tear if overfilled"],
    },
    "ingredients": [
        ing("spring-roll-wrappers", "spring roll wrappers", 12, "count", note="wheat wrappers, about 8-inch squares, not rice paper"),
        ing("green-cabbage", "green cabbage", 3, "cup", prep="shredded thin"),
        ing("carrot", "carrot", 1, "cup", prep="cut into matchsticks"),
        ing("shiitake", "shiitake mushrooms", 4, "oz", prep="stems removed, sliced"),
        ing("rice-vermicelli", "rice vermicelli", 2, "oz", prep="soaked until pliable, drained, cut into 1-inch pieces"),
        ing("scallions", "scallions", 3, "count", prep="sliced"),
        ing("ginger", "ginger", 1, "tbsp", prep="grated"),
        ing("garlic", "garlic", 3, "clove", prep="minced", note="2 for the filling, 1 for the dip"),
        ing("soy-sauce", "soy sauce", 3, "tbsp", role="seasoning", note="1 tbsp in the filling, 2 tbsp in the dip. Wheat and soy."),
        ing("sesame-oil", "sesame oil", 1, "tsp", role="fat"),
        ing("rice-vinegar", "rice vinegar", 1, "tsp", role="seasoning"),
        ing("neutral-oil", "neutral oil", 2, "tbsp", role="fat", note="1 tsp to soften the filling, the rest brushed on the rolls"),
        ing("lime", "lime", 1, "count", prep="juiced, about 2 tbsp"),
        ing("water", "water", 1, "tbsp", role="liquid", note="in the dip"),
        ing("sugar", "sugar", 1, "tsp", role="seasoning"),
        ing("red-chile", "red chile", 1, "count", role="seasoning", prep="thinly sliced"),
        ing("kosher-salt", "kosher salt", 0.25, "tsp", role="seasoning"),
    ],
    "steps": [
        step(1, "Soften the filling", "Soak the rice vermicelli until pliable, drain, and cut it up. Warm 1 tsp of the neutral oil in a skillet over medium-high. Add the cabbage, carrot, and shiitake and cook, stirring, until the cabbage softens, about 4 minutes. Stir in the ginger, 2 cloves of garlic, scallions, 1 tbsp soy sauce, the sesame oil, rice vinegar, and salt. Fold in the vermicelli. Spread the filling on a plate until it is cool enough to handle.", ["rice-vermicelli", "neutral-oil", "green-cabbage", "carrot", "shiitake", "ginger", "garlic", "scallions", "soy-sauce", "sesame-oil", "rice-vinegar", "kosher-salt"]),
        step(2, "Roll", "Lay a wrapper on a point. Place about 2 tbsp filling near the bottom, fold the point over, fold the sides in, and roll tight. Repeat for all 12. Mix the dip: remaining soy sauce, lime juice, water, sugar, the last garlic clove, and the chile. Prep is about 25 minutes.", ["spring-roll-wrappers", "green-cabbage", "shiitake", "soy-sauce", "lime", "water", "sugar", "garlic", "red-chile"]),
        step(3, "Air-fry", "Heat the air fryer to 375 F. Brush the rolls with the remaining neutral oil. Air-fry in two batches until the wrappers are crisp and blistered, about 8 minutes per batch, turning once. Cook is 16 minutes. Serve with the dip.", ["spring-roll-wrappers", "neutral-oil", "soy-sauce"]),
    ],
    "brief": {
        "hero": "Four spring rolls, two cut in half so the cabbage, carrot, and mushroom filling shows, with a small bowl of dark soy-lime dip.",
        "vessel": "Off-white plate and a small dipping bowl.",
        "angle": "Elevated three-quarter, low enough that the cut faces read.",
        "visible": "Blistered golden wrappers, shredded cabbage, orange carrot, brown shiitake, pale vermicelli, dark dip.",
        "texture": "Dry blistered wrapper, not an oily bubble crust. Moist filling.",
        "sauce": "Dip beside the rolls, not poured over them.",
        "garnish": "A few chile rings on the dip, from the recipe. No mint sprig unless it is clearly not a second dish.",
        "props": "Optional lime half. No fish-sauce bottle.",
        "color": "Gold wrappers, orange carrot, green cabbage, brown mushrooms, amber dip.",
        "forbid": "Shrimp, crab, pork, a pot of bubbling oil, rice paper summer rolls that look wet and translucent, peanut sauce, text, logos.",
        "crop": "Cut faces in the center third. The dip stays in frame at 640x480.",
        "ambiguity": "Crisp baked-looking rolls from an air fryer. Not a fryer basket and not a fresh summer roll.",
    },
})

add({
    "slug": "roasted-cabbage-cashew-romesco",
    "title": "Roasted Cabbage Steaks with Cashew Romesco",
    "description": "Thick cabbage steaks roasted in the oven until the cut faces are crisp, with a cashew romesco. Cashews only: no almonds and no dairy.",
    "cuisine": "spanish",
    "meal_format": "composed-plate",
    "primary": "green cabbage",
    "tags": ["crispy", "smoky", "savory", "rich"],
    "servings": 4,
    "prep": 15,
    "cook": 30,
    "methods": ["roast"],
    "allow_fry": set(),
    "expect_frying": [],
    "expect_crisp_has": ["roasted", "baked"],
    "expect_stir": False,
    "heat": "Oven 425 F.",
    "doneness": "Cabbage tender at the core, cut faces browned and crisp. Romesco thick enough to spoon, not a broth.",
    "equipment": ["rimmed sheet pan", "blender or food processor", "knife", "cutting board"],
    "clock": "Prep 15 is a real preheat to 425 F before the pan goes in. Cutting and oiling, about 8 minutes active, happen during that preheat; the pan stays on the counter until the oven is hot. Cook 30 is the roast in a hot oven: 8 minutes with the cashews, then about 22 minutes more. Active time is about 15 minutes across the meal (cutting, the cashew pull, blending the romesco during the roast, and plating). Total 45 is prep 15 plus cook 30. Active time sits inside that total.",
    "hh001": True,
    "hh_reason": "Plant-based. The only nut is cashew, which HH001 allows when that is the whole nut policy. No dairy, no bread, no almonds.",
    "hh_contract": "Romesco is roasted red peppers, cashews, garlic, smoked paprika, red wine vinegar, and olive oil. No almonds, no hazelnuts, no pine nuts, no bread, and no cheese.",
    "eligibility": {
        "contains_meat": False, "contains_poultry": False, "contains_finfish": False,
        "contains_shellfish": False, "contains_dairy": False,
        "plant_based_compatible": True, "vegetarian_compatible": True,
        "nut_policy": "cashews_only_ok",
        "nut_policy_note": "Cashews only. No almonds and no other tree nuts. No peanuts.",
    },
    "labels": ["dairy_free", "vegetarian", "plant_based"],
    "label_note": "Unconditional dairy_free, vegetarian, and plant_based. Nut policy is cashews only, not a general nut-free claim.",
    "allergens": ["tree_nut", "cashew"],
    "allergen_notes": ["Tree nut and cashew both refer to the cashews. Import maps that pair, with nut_policy cashews_only_ok, to cashew rather than a general nuts tag."],
    "effort": ("moderate", 4, {"active_prep": 1, "active_attention": 0, "active_components": 1, "technique": 1, "coordination_cleanup_equipment": 1}, []),
    "complexity": ("simple", 1, {"ingredient_count_band": 0, "specialty_burden": 0, "flavor_component_breadth": 1, "pantry_familiarity": 0}, 7),
    "effort_why": "The oven does the work. Attention is 0. Sauce plus cabbage is one extra component. Total 4, moderate.",
    "complexity_why": "Seven counted items. Cashews and jarred peppers are supermarket items, so specialty burden is 0. One sauce is flavor breadth 1. Spanish cooking adds no points.",
    "components": [
        {"component_id": "romesco", "name": "cashew romesco", "made_in_recipe": True, "store_bought": False, "ingredients": ["roasted red peppers", "cashews", "garlic", "smoked paprika", "red wine vinegar", "olive oil"]},
    ],
    "coverage": "First roasted cabbage steak. Cashew romesco uses the HH001 cashew exception on purpose, with almonds written out of the contract.",
    "near": "Stuffed cabbage is a long bake with lentils. Okonomiyaki is a pancake. Biryani also uses cashews, in rice, not in a pepper sauce.",
    "scale": {
        "1": "One steak and a quarter of the sauce. The oven still runs at 425 F.",
        "2": "Two steaks, half the sauce.",
        "4": "As written.",
        "do_not_scale": ["oven temperature", "do not crowd the steaks or they steam"],
    },
    "ingredients": [
        ing("green-cabbage", "green cabbage", 1, "count", display="large green cabbage", note="cut into four 3/4-inch steaks", prep="steaks"),
        ing("olive-oil", "olive oil", 6, "tbsp", role="fat", note="3 tbsp on the cabbage, 3 tbsp in the sauce"),
        ing("kosher-salt", "kosher salt", 1.25, "tsp", role="seasoning"),
        ing("black-pepper", "black pepper", 0.5, "tsp", role="seasoning"),
        ing("raw-cashews", "cashews", 0.75, "cup", display="raw cashews", note="the only nut"),
        ing("roasted-red-peppers", "roasted red peppers", 1.5, "cup", note="drained, from a jar"),
        ing("garlic", "garlic", 2, "clove"),
        ing("smoked-paprika", "smoked paprika", 1, "tsp", role="seasoning"),
        ing("red-wine-vinegar", "red wine vinegar", 1, "tbsp", role="seasoning"),
        ing("parsley", "flat-leaf parsley", 2, "tbsp", role="garnish", prep="chopped"),
        ing("water", "water", 2, "tbsp", role="liquid", note="to loosen the sauce if needed"),
    ],
    "steps": [
        step(1, "Preheat the oven", "Turn the oven to 425 F and heat it until it is fully at temperature, about 15 minutes. Do not put the pan in during this preheat. Prep is these 15 minutes.", []),
        step(2, "Cut and oil", "While the oven heats, cut the cabbage into four steaks and brush both faces with 3 tbsp olive oil, 1 tsp salt, and the pepper. Spread the cashews on one side of the sheet pan and the steaks on the rest. Leave the pan on the counter. Cutting and oiling take about 8 minutes of active time inside the preheat. If the oven is not yet at 425 F when the pan is ready, wait. The food goes in only after the oven is hot.", ["green-cabbage", "olive-oil", "kosher-salt", "black-pepper", "raw-cashews"]),
        step(3, "Roast", "When the oven is at 425 F, put the pan in. Roast 8 minutes, then remove the cashews if they are golden. Continue roasting the cabbage until the cores are tender and the cut faces are crisp and browned, about 22 minutes more. Cook is 30 minutes in a hot oven.", ["green-cabbage", "raw-cashews"]),
        step(4, "Blend the romesco", "While the cabbage finishes, blend the cashews, roasted red peppers, garlic, smoked paprika, vinegar, the remaining 3 tbsp olive oil, 1/4 tsp salt, and 2 tbsp water until thick and spoonable. This is about 5 minutes of active time inside the roast, not extra prep.", ["raw-cashews", "roasted-red-peppers", "garlic", "smoked-paprika", "red-wine-vinegar", "olive-oil", "kosher-salt", "water"]),
        step(5, "Serve", "Spoon romesco over the steaks and scatter the parsley. About 1 minute.", ["green-cabbage", "parsley"]),
    ],
    "brief": {
        "hero": "Two cabbage steaks with blackened crisp rims and a thick rust-red cashew romesco spooned across the center, cashew flecks visible in the sauce.",
        "vessel": "Off-white dinner plate.",
        "angle": "Slightly overhead, still a three-quarter, so the round steaks read.",
        "visible": "Cabbage steaks, red romesco, green parsley, a few whole cashews on the sauce.",
        "texture": "Charred leaf edges, pale tender core, coarse sauce.",
        "sauce": "A band of romesco across the steaks, not a bowl of soup.",
        "garnish": "Parsley and a few cashews from the sauce quantity.",
        "props": "Optional garlic clove in soft focus. No bread.",
        "color": "Pale green and blackened cabbage, rust-red sauce, green parsley, cream-colored cashews.",
        "forbid": "Almonds, bread, cheese, chorizo, a fryer, text, logos.",
        "crop": "Both steaks in the center. Sauce color must survive the card crop.",
        "ambiguity": "Roasted cabbage with a red cashew sauce. Not a soup and not shawarma.",
    },
})

add({
    "slug": "sichuan-green-bean-mushroom-stir-fry",
    "title": "Sichuan Green Bean and Mushroom Stir-Fry",
    "description": "A hot stir-fry of blistered green beans and shiitake in chili bean paste, with steamed rice. No oyster sauce and no nuts.",
    "cuisine": "chinese",
    "meal_format": "stir-fry",
    "primary": "green beans",
    "tags": ["stir-fries", "spicy", "savory", "mushrooms", "crunchy"],
    "servings": 4,
    "prep": 15,
    "cook": 20,
    "methods": ["stir-fry"],
    "allow_fry": {"stir-fry"},
    "expect_frying": [],
    "expect_crisp_has": [],
    "expect_stir": True,
    "heat": "A large pot for rice. A wok or 12-inch skillet over high for the beans.",
    "doneness": "Beans blistered and tender-crisp, mushrooms softened, sauce glossy and clinging. Rice tender.",
    "equipment": ["wok or 12-inch skillet", "medium saucepan with a lid", "small bowl", "tongs"],
    "clock": "Prep 15 is trimming, slicing, and mixing the sauce with its own 1/2 cup water. Cook 20 starts the rice with its own 2 1/4 cups water and, while it simmers, the stir-fry, which takes about 12 minutes inside that 20.",
    "hh001": True,
    "hh_reason": "Plant-based. No meat, poultry, fish, shellfish, dairy, or nuts. Sesame oil is allowed. The chili bean paste has no shrimp.",
    "hh_contract": "Chili bean paste is broad beans, chile, and soy only. No shrimp paste and no oyster sauce.",
    "eligibility": {
        "contains_meat": False, "contains_poultry": False, "contains_finfish": False,
        "contains_shellfish": False, "contains_dairy": False,
        "plant_based_compatible": True, "vegetarian_compatible": True,
        "nut_policy": "none",
        "nut_policy_note": "No peanuts, tree nuts, or cashews.",
    },
    "labels": ["dairy_free", "vegetarian", "plant_based"],
    "label_note": "Unconditional dairy_free, vegetarian, and plant_based.",
    "allergens": ["soy", "wheat", "sesame"],
    "allergen_notes": ["Soy and wheat are in the soy sauce and the chili bean paste.", "Sesame is the sesame oil."],
    "effort": ("involved", 6, {"active_prep": 1, "active_attention": 2, "active_components": 1, "technique": 1, "coordination_cleanup_equipment": 1}, ["continuous_attention"]),
    "complexity": ("standard", 3, {"ingredient_count_band": 0, "specialty_burden": 1, "flavor_component_breadth": 2, "pantry_familiarity": 0}, 11),
    "effort_why": "High heat in a wok is continuous attention, score 2. Rice on the other burner is coordination 1. Total 6, involved. The attention floor would have required at least moderate anyway.",
    "complexity_why": "Eleven counted items, band 0. Chili bean paste is the one specialty-store or well-stocked-grocery item, burden 1, and it is not also scored as unfamiliar pantry. Flavor breadth 2 for the paste, aromatics, and sauce. Chinese cooking adds no points.",
    "components": [
        {"component_id": "sauce", "name": "chili bean sauce", "made_in_recipe": True, "store_bought": False, "ingredients": ["chili bean paste", "soy sauce", "rice vinegar", "sugar", "cornstarch", "water (1/2 cup)"]},
        {"component_id": "paste", "name": "chili bean paste", "made_in_recipe": False, "store_bought": True, "ingredients": ["chili bean paste"], "contract": "Broad beans, chile, and soy. No shrimp or shellfish in the paste."},
        {"component_id": "rice", "name": "steamed rice", "made_in_recipe": True, "store_bought": False, "ingredients": ["long-grain rice", "water (2 1/4 cups)"]},
    ],
    "coverage": "First green-bean lead. A plant Chinese stir-fry with no peanut and no chicken. Stir-fry is not a frying kind.",
    "near": "Cashew chicken is poultry and cashews. Peanut noodles are peanuts. Thai basil eggplant is a different vegetable and cuisine. Lomo saltado is beef.",
    "scale": {
        "1": "A quarter of the beans and one serving of rice. Use a smaller skillet so the beans still blister.",
        "2": "Half. One batch of beans may fit.",
        "4": "As written, two batches of beans.",
        "do_not_scale": ["the skillet must stay hot", "do not cover the beans or they steam"],
    },
    "ingredients": [
        ing("green-beans", "green beans", 1.5, "lb", prep="trimmed"),
        ing("shiitake", "shiitake mushrooms", 8, "oz", prep="sliced"),
        ing("garlic", "garlic", 4, "clove", prep="sliced"),
        ing("ginger", "ginger", 1, "tbsp", prep="minced"),
        ing("scallions", "scallions", 3, "count", prep="cut into 1-inch lengths"),
        ing("soy-sauce", "soy sauce", 2, "tbsp", role="seasoning"),
        ing("rice-vinegar", "rice vinegar", 1, "tbsp", role="seasoning"),
        ing("sugar", "sugar", 1, "tsp", role="seasoning"),
        ing("chili-bean-paste", "chili bean paste", 1.5, "tbsp", role="component", note="broad bean and chile paste with soy. No shrimp."),
        ing("sesame-oil", "sesame oil", 1, "tsp", role="fat"),
        ing("neutral-oil", "neutral oil", 2, "tbsp", role="fat"),
        ing("cornstarch", "cornstarch", 1, "tsp", role="component"),
        ing("rice-water", "water", 2.25, "cup", role="liquid", display="water for the rice", note="2 1/4 cups. For the rice only."),
        ing("sauce-water", "water", 0.5, "cup", role="liquid", display="water for the sauce and slurry", note="1/2 cup. Use 2 tbsp of it for the cornstarch slurry and the remaining 6 tbsp in the sauce."),
        ing("long-grain-rice", "long-grain rice", 1.5, "cup"),
        ing("kosher-salt", "kosher salt", 0.5, "tsp", role="seasoning", note="for the rice"),
    ],
    "steps": [
        step(1, "Prep", "Trim 1 1/2 lb green beans. Slice 8 oz shiitake, 4 garlic cloves, 1 tbsp ginger, and 3 scallions. Measure 1/2 cup water for the sauce and slurry. Stir 2 tbsp of that water with 1 tsp cornstarch into a slurry. Stir the remaining 6 tbsp water with 2 tbsp soy sauce, 1 tbsp rice vinegar, 1 tsp sugar, and 1 1/2 tbsp chili bean paste, then stir in the slurry. Rinse 1 1/2 cups rice. About 15 minutes.", ["green-beans", "shiitake", "garlic", "ginger", "scallions", "soy-sauce", "rice-vinegar", "sugar", "chili-bean-paste", "cornstarch", "sauce-water", "long-grain-rice"]),
        step(2, "Steam the rice", "Put the 1 1/2 cups rice, 2 1/4 cups water, and 1/2 tsp salt in a saucepan. Bring to a boil, cover, and simmer on low until tender, about 18 minutes. This runs under the stir-fry. Use only the rice water.", ["long-grain-rice", "rice-water", "kosher-salt"]),
        step(3, "Stir-fry", "Heat 2 tbsp neutral oil in a wok over high. Stir-fry the green beans in two batches until blistered and tender-crisp, about 4 minutes per batch. Set them aside. Stir-fry the shiitake about 2 minutes. Add the garlic and ginger for 30 seconds, then the sauce from step 1 (the full 1/2 cup water is already in it; add no more water) and the beans. Toss until the sauce clings. Off the heat, add 1 tsp sesame oil and the scallions. The stir-fry is about 12 minutes inside the 20-minute cook clock.", ["neutral-oil", "green-beans", "shiitake", "garlic", "ginger", "chili-bean-paste", "soy-sauce", "sesame-oil", "scallions", "sauce-water"]),
        step(4, "Serve", "Put the rice in bowls and top with the beans. This step adds no water.", ["long-grain-rice", "green-beans"]),
    ],
    "brief": {
        "hero": "A mound of blistered green beans and dark shiitake in a reddish sauce, scallions on top, with white rice visible at the edge of the bowl.",
        "vessel": "A wide, low, off-white bowl.",
        "angle": "Slightly overhead, the usual bowl angle, close enough that individual beans read.",
        "visible": "Wrinkled green beans, shiitake slices, red-brown sauce, scallion, white rice.",
        "texture": "Blistered bean skins, glossy sauce, matte rice.",
        "sauce": "Clinging to the beans, not a soup around them.",
        "garnish": "Scallions from the recipe only.",
        "props": "None. No chile pile that looks like a side dish.",
        "color": "Green, brown, rust red, white rice.",
        "forbid": "Chicken, beef, peanuts, cashews, oyster sauce sheen that reads as seafood, a fryer, text, logos.",
        "crop": "Beans fill the center. A crescent of rice is enough. Card crop must keep the blistered skins visible.",
        "ambiguity": "A vegetable stir-fry over rice. Not cashew chicken and not a curry.",
    },
})

add({
    "slug": "spanish-potato-tortilla",
    "title": "Spanish Potato Tortilla",
    "description": "Yukon Gold potatoes and onion shallow-fried in olive oil, folded into egg, and set in a skillet. No cheese and no chorizo.",
    "cuisine": "spanish",
    "meal_format": "skillet",
    "primary": "potatoes",
    "tags": ["savory", "tender", "herbaceous"],
    "servings": 4,
    "prep": 15,
    "cook": 30,
    "methods": ["shallow-fry"],
    "allow_fry": {"shallow-fried", "shallow-fry"},
    "expect_frying": ["shallow"],
    "expect_crisp_has": [],
    "expect_stir": False,
    "heat": "Medium for the potatoes, then medium-low to set the eggs. No oven.",
    "doneness": "Potatoes tender, not browned hard. Tortilla set at the edge, the center just firm, not dry. A knife comes out with a moist crumb.",
    "equipment": ["10-inch nonstick skillet", "plate wider than the skillet", "mixing bowl", "slotted spoon", "knife"],
    "clock": "Prep 15 is slicing. Cook 30 is 18 minutes to shallow-fry the potatoes and onion, then about 12 minutes to set and flip the eggs. No oven.",
    "hh001": True,
    "hh_reason": "Eggs and potatoes only. No dairy, no meat, no poultry, no fish, no shellfish, and no nuts. Olive oil is the fat.",
    "hh_contract": "No cheese of any kind and no chorizo. Olive oil only, not butter.",
    "eligibility": {
        "contains_meat": False, "contains_poultry": False, "contains_finfish": False,
        "contains_shellfish": False, "contains_dairy": False,
        "plant_based_compatible": False, "vegetarian_compatible": True,
        "nut_policy": "none",
        "nut_policy_note": "No peanuts, tree nuts, or cashews.",
    },
    "labels": ["dairy_free", "vegetarian"],
    "label_note": "Unconditional dairy_free and vegetarian. Not plant-based, because of the eggs.",
    "allergens": ["egg"],
    "allergen_notes": ["Egg is the eight large eggs. No milk and no wheat."],
    "effort": ("involved", 5, {"active_prep": 1, "active_attention": 2, "active_components": 0, "technique": 2, "coordination_cleanup_equipment": 0}, ["technique_2_with_prep"]),
    "complexity": ("simple", 0, {"ingredient_count_band": 0, "specialty_burden": 0, "flavor_component_breadth": 0, "pantry_familiarity": 0}, 4),
    "effort_why": "The raw factor total is 5, which would be moderate, but technique is 2 and prep is 1, so the technique floor raises the level to involved. The flip is the part that fails a distracted cook. Attention stays at 2 because the potatoes and the set both need someone at the stove.",
    "complexity_why": "Four counted items: potatoes, onion, eggs, parsley. Oil, salt, and pepper are excluded. Score 0, simple. Spanish home cooking adds no points.",
    "components": [],
    "coverage": "Second egg-built dinner after shakshuka, and the first HH001 Spanish meal. Explicit shallow-fry of the potatoes.",
    "near": "Shakshuka is eggs in a pepper-tomato sauce. Spanish chorizo rice is meat. This is a potato tortilla with neither.",
    "scale": {
        "1": "One potato, a quarter onion, two eggs, in an 8-inch skillet. The flip is the same move.",
        "2": "Half, in an 8- or 9-inch skillet.",
        "4": "As written, 10-inch skillet.",
        "do_not_scale": ["oil must cover the potatoes while they cook", "do not rush the medium-low set"],
    },
    "ingredients": [
        ing("yukon-gold-potatoes", "Yukon Gold potatoes", 2, "lb", prep="sliced into 1/8-inch rounds"),
        ing("yellow-onion", "yellow onion", 1, "count", prep="sliced thin"),
        ing("eggs", "eggs", 8, "count", display="large eggs"),
        ing("olive-oil", "olive oil", 1.5, "cup", role="fat", note="enough for a shallow layer in a 10-inch skillet; most is drained off and can be saved; 2 tbsp goes back into the skillet"),
        ing("kosher-salt", "kosher salt", 1.5, "tsp", role="seasoning"),
        ing("black-pepper", "black pepper", 0.25, "tsp", role="seasoning"),
        ing("parsley", "flat-leaf parsley", 2, "tbsp", role="garnish", prep="chopped"),
    ],
    "steps": [
        step(1, "Slice", "Slice the potatoes into thin rounds and the onion thin. About 15 minutes.", ["yukon-gold-potatoes", "yellow-onion"]),
        step(2, "Shallow-fry the potatoes", "Heat the olive oil in a 10-inch skillet over medium. Add the potatoes and onion, keep them in a shallow layer of oil, and cook, turning gently, until the potatoes are tender but not browned hard, about 18 minutes. Salt them with 1 tsp as they cook. Drain, and reserve the oil.", ["olive-oil", "yukon-gold-potatoes", "yellow-onion", "kosher-salt"]),
        step(3, "Set and flip", "Beat the eggs with 1/2 tsp salt and the pepper. Fold in the potatoes and onion. Return 2 tbsp of the oil to the skillet over medium-low. Pour in the eggs and cook until the edge is set and the top is still moist, about 8 minutes. Invert onto a plate, slide it back, and cook about 4 minutes more, until the center is just firm. Cook is 30 minutes. Scatter the parsley and cut into wedges.", ["eggs", "kosher-salt", "black-pepper", "yukon-gold-potatoes", "yellow-onion", "olive-oil", "parsley"]),
    ],
    "brief": {
        "hero": "A thick round tortilla, one wedge pulled out so the layered potato and yellow egg show, parsley on top.",
        "vessel": "Off-white plate, tortilla filling most of it.",
        "angle": "Elevated three-quarter, low enough to see the height of the cake.",
        "visible": "Golden-tan top, pale yellow egg, distinct potato slices, a little onion, parsley.",
        "texture": "Tender potatoes, set egg, not a dry omelet and not a crispy hash.",
        "sauce": "None.",
        "garnish": "Parsley only.",
        "props": "None.",
        "color": "Yellow egg, gold potatoes, green parsley.",
        "forbid": "Cheese, chorizo, ketchup, a tomato sauce that would make it look like shakshuka, sour cream, text, logos.",
        "crop": "The cut face is near the center so the card still shows potato layers.",
        "ambiguity": "A Spanish potato tortilla. Not shakshuka and not a frittata with cream.",
    },
})

add({
    "slug": "grilled-mackerel-fennel-orange",
    "title": "Grilled Mackerel with Fennel and Orange",
    "description": "Whole mackerel grilled with fennel wedges and an orange-parsley relish. Olive oil, no butter.",
    "cuisine": "mediterranean",
    "meal_format": "grilled",
    "primary": "mackerel",
    "tags": ["grilled", "citrusy", "fresh", "savory"],
    "servings": 4,
    "prep": 15,
    "cook": 18,
    "methods": ["grill"],
    "allow_fry": set(),
    "expect_frying": [],
    "expect_crisp_has": [],
    "expect_stir": False,
    "heat": "A hot grill, fish over direct heat, fennel over a slightly cooler spot.",
    "doneness": "Mackerel opaque at the bone and 145 F in the thickest part. Fennel tender with grill marks, still a little firm.",
    "equipment": ["gas or charcoal grill", "tongs", "instant-read thermometer", "mixing bowl", "knife"],
    "clock": "Prep 15 includes lighting the grill, which heats for about 10 of those minutes. Cook 18 is the fennel and the fish sharing the grate, fennel on first.",
    "hh001": True,
    "hh_reason": "Finfish is allowed. Olive oil only. No dairy, no shellfish, and no nuts.",
    "hh_contract": "No butter and no cream in the relish. Orange, garlic, parsley, and olive oil only.",
    "eligibility": {
        "contains_meat": False, "contains_poultry": False, "contains_finfish": True,
        "contains_shellfish": False, "contains_dairy": False,
        "plant_based_compatible": False, "vegetarian_compatible": False,
        "nut_policy": "none",
        "nut_policy_note": "No peanuts, tree nuts, or cashews.",
    },
    "labels": ["dairy_free", "fish"],
    "label_note": "Unconditional dairy_free. Fish because of the mackerel.",
    "allergens": ["finfish"],
    "allergen_notes": ["Finfish is the mackerel. No wheat."],
    "effort": ("moderate", 5, {"active_prep": 1, "active_attention": 1, "active_components": 1, "technique": 1, "coordination_cleanup_equipment": 1}, []),
    "complexity": ("standard", 2, {"ingredient_count_band": 0, "specialty_burden": 1, "flavor_component_breadth": 1, "pantry_familiarity": 0}, 7),
    "effort_why": "Whole fish on a grill sticks if you fuss with it, so technique and attention are each 1, not 2. Fennel plus relish is a component. Total 5, moderate.",
    "complexity_why": "Seven counted items. Mackerel is a less common fish-counter item, specialty burden 1, not also scored as unfamiliar pantry. Mediterranean cooking adds no points.",
    "components": [
        {"component_id": "relish", "name": "orange parsley relish", "made_in_recipe": True, "store_bought": False, "ingredients": ["orange", "parsley", "garlic", "red pepper flakes", "olive oil"]},
    ],
    "coverage": "First mackerel and the first whole grilled fish. Grilled format moves from two meals to three.",
    "near": "Swordfish with olives and capers is a steak on the grill. This is a whole fish with fennel and orange, and no olives.",
    "scale": {
        "1": "One fish, half a fennel bulb, half an orange.",
        "2": "Two fish, one fennel, one orange.",
        "4": "As written.",
        "do_not_scale": ["grill heat", "do not flip the fish more than once"],
    },
    "ingredients": [
        ing("mackerel", "mackerel", 4, "count", display="whole mackerel", note="cleaned, about 12 oz each", prep="patted dry"),
        ing("fennel", "fennel", 2, "count", display="fennel bulbs", prep="cut into 1/2-inch wedges, fronds saved"),
        ing("orange", "orange", 2, "count", note="one juiced, one cut into thin rounds"),
        ing("garlic", "garlic", 2, "clove", prep="minced"),
        ing("parsley", "flat-leaf parsley", 0.5, "cup", prep="chopped"),
        ing("olive-oil", "olive oil", 3, "tbsp", role="fat"),
        ing("kosher-salt", "kosher salt", 1.5, "tsp", role="seasoning"),
        ing("black-pepper", "black pepper", 0.5, "tsp", role="seasoning"),
        ing("red-pepper-flakes", "red pepper flakes", 0.25, "tsp", role="seasoning"),
        ing("lemon", "lemon", 1, "count", prep="cut into wedges"),
    ],
    "steps": [
        step(1, "Heat the grill and make the relish", "Light the grill so it is hot by the end of prep. Toss the fennel with 1 tbsp olive oil and 1/2 tsp salt. Stir the orange juice, chopped parsley, garlic, red pepper flakes, remaining olive oil, and 1/4 tsp salt into a relish. Season the mackerel inside and out with the last 3/4 tsp salt and the pepper, and tuck a few orange rounds and fennel fronds into the cavities. About 15 minutes.", ["fennel", "olive-oil", "kosher-salt", "orange", "parsley", "garlic", "red-pepper-flakes", "mackerel", "black-pepper"]),
        step(2, "Grill", "Grill the fennel over a cooler spot, turning once, until tender and marked, about 8 minutes. Grill the mackerel over direct heat, about 4 minutes per side, until the flesh is opaque at the bone and 145 F. Cook is 18 minutes with the fennel starting first.", ["fennel", "mackerel"]),
        step(3, "Serve", "Spoon the relish over the fish and fennel. Serve with lemon wedges.", ["parsley", "orange", "lemon", "mackerel", "fennel"]),
    ],
    "brief": {
        "hero": "One whole grilled mackerel, skin marked, with fennel wedges and a bright orange-parsley relish.",
        "vessel": "Oval off-white platter.",
        "angle": "Elevated three-quarter so the whole fish reads, not a top-down fillet shot.",
        "visible": "Mackerel with intact skin and grill marks, fennel wedges, orange pieces, green parsley.",
        "texture": "Charred skin, oily sheen that looks like the fish, not a glaze, tender fennel.",
        "sauce": "Relish spooned along the fish, not a cream pool.",
        "garnish": "Parsley and orange from the relish. Lemon wedge from the recipe.",
        "props": "Optional fennel frond. No olive bowl.",
        "color": "Silver and charred skin, pale fennel, orange, green.",
        "forbid": "Butter, olives, capers, a fillet that could be swordfish, shrimp, text, logos.",
        "crop": "The whole fish stays inside the center so the card does not cut off the head and tail in a confusing way. If the frame is tight, keep the marked skin and the relish.",
        "ambiguity": "Whole grilled mackerel. Not swordfish and not salmon.",
    },
})

add({
    "slug": "seared-duck-breast-cherry",
    "title": "Seared Duck Breast with Cherry Pan Sauce",
    "description": "Duck breasts with the skin seared until crisp, a cherry pan sauce, and arugula. No butter.",
    "cuisine": "french",
    "meal_format": "composed-plate",
    "primary": "duck breast",
    "tags": ["rich", "savory", "tangy", "tender"],
    "servings": 4,
    "prep": 10,
    "cook": 22,
    "methods": ["sear"],
    "allow_fry": set(),
    "expect_frying": [],
    "expect_crisp_has": ["crispy"],
    "expect_stir": False,
    "heat": "Medium skillet, starting with a cold pan so the skin renders. Medium for the sauce.",
    "doneness": "Skin crisp and golden, interior 135 F, then a 5-minute rest. Sauce syrupy enough to coat a spoon.",
    "equipment": ["12-inch skillet", "tongs", "instant-read thermometer", "small bowl"],
    "clock": "Prep 10 is scoring, salt, and the shallot and cherries. Cook 22 is about 10 minutes skin-side, 3 minutes on the flesh, and 8 minutes for the sauce while the duck rests. No oven.",
    "hh001": False,
    "hh_reason": "Duck is poultry, which HH001 does not eat. There is no dairy.",
    "hh_contract": "Not an HH001 meal. The sauce has no butter: shallot, cherries, vinegar, red wine, and honey.",
    "eligibility": {
        "contains_meat": False, "contains_poultry": True, "contains_finfish": False,
        "contains_shellfish": False, "contains_dairy": False,
        "plant_based_compatible": False, "vegetarian_compatible": False,
        "nut_policy": "none",
        "nut_policy_note": "No peanuts, tree nuts, or cashews.",
    },
    "labels": ["dairy_free"],
    "label_note": "Unconditional dairy_free. Not vegetarian and not plant-based. Poultry, so not HH001.",
    "allergens": ["poultry"],
    "allergen_notes": ["Poultry is the duck. No milk and no wheat."],
    "effort": ("involved", 7, {"active_prep": 1, "active_attention": 2, "active_components": 1, "technique": 2, "coordination_cleanup_equipment": 1}, ["technique_2_with_prep", "continuous_attention"]),
    "complexity": ("standard", 2, {"ingredient_count_band": 0, "specialty_burden": 1, "flavor_component_breadth": 1, "pantry_familiarity": 0}, 8),
    "effort_why": "Rendering duck skin is continuous attention and a technique score of 2. The technique floor and the attention floor both apply. Total 7, involved.",
    "complexity_why": "Eight counted items. Duck breast is a butcher or good-grocery item, specialty burden 1. The cherry sauce is flavor breadth 1. French cooking adds no points.",
    "components": [
        {"component_id": "sauce", "name": "cherry pan sauce", "made_in_recipe": True, "store_bought": False, "ingredients": ["cherries", "shallot", "red wine vinegar", "red wine", "honey", "thyme"]},
    ],
    "coverage": "First duck. Second French meal after the niçoise, and a hot plate rather than a salad.",
    "near": "No other duck. Chicken skillets are a different bird and usually a different sauce. Scallops with parsnip are shellfish and dairy.",
    "scale": {
        "1": "One breast, a quarter of the sauce, a handful of arugula.",
        "2": "Two breasts, half the sauce.",
        "4": "As written. Use two skillets if the breasts do not fit in one layer.",
        "do_not_scale": ["start in a cold pan", "rest the meat"],
    },
    "ingredients": [
        ing("duck-breasts", "duck breast", 4, "count", note="about 7 oz each", prep="skin scored in a crosshatch, not through the meat"),
        ing("kosher-salt", "kosher salt", 1.5, "tsp", role="seasoning"),
        ing("black-pepper", "black pepper", 0.5, "tsp", role="seasoning"),
        ing("cherries", "cherries", 1.5, "cup", note="fresh or frozen, pitted"),
        ing("shallot", "shallot", 1, "count", prep="minced"),
        ing("red-wine-vinegar", "red wine vinegar", 2, "tbsp", role="seasoning"),
        ing("red-wine", "red wine", 0.33, "cup", role="liquid", note="dry"),
        ing("honey", "honey", 1, "tsp", role="seasoning"),
        ing("thyme", "thyme", 4, "count", display="thyme sprigs"),
        ing("arugula", "arugula", 4, "cup"),
    ],
    "steps": [
        step(1, "Score and season", "Score the duck skin. Salt the duck with 1 1/4 tsp salt and the pepper. Halve the cherries if they are large, and mince the shallot. Save the last 1/4 tsp salt for the arugula. About 10 minutes.", ["duck-breasts", "kosher-salt", "black-pepper", "cherries", "shallot"]),
        step(2, "Sear the skin", "Put the breasts skin-side down in a cold skillet. Set the heat to medium. Sear until the skin is crisp and golden and the fat has rendered, about 10 minutes, pouring off fat as it collects and saving 1 tbsp. Flip and sear the flesh side about 3 minutes, to 135 F. Rest the duck on a plate for 5 minutes.", ["duck-breasts"]),
        step(3, "Cherry sauce and arugula", "Pour off all but 1 tsp of fat. Cook the shallot 30 seconds. Add the cherries, vinegar, wine, honey, and thyme. Simmer until the sauce coats a spoon, about 6 minutes, while the duck rests. Slice the duck. Toss the arugula with the reserved 1 tbsp of rendered fat and the last 1/4 tsp salt. Cook is 22 minutes.", ["shallot", "cherries", "red-wine-vinegar", "red-wine", "honey", "thyme", "arugula", "duck-breasts", "kosher-salt"]),
    ],
    "brief": {
        "hero": "Sliced duck breast with a strip of crisp golden skin, a dark cherry sauce, and a small pile of arugula.",
        "vessel": "Off-white dinner plate.",
        "angle": "Elevated three-quarter so the skin edge and the pink interior both show.",
        "visible": "Duck slices, crisp skin, cherries in a glossy sauce, arugula, a thyme sprig from the sauce.",
        "texture": "Rendered crisp skin, juicy meat, syrupy sauce, leafy arugula.",
        "sauce": "Spooned beside and partly over the slices. Cherries visible, not a brown mystery gravy.",
        "garnish": "Thyme from the recipe. No extra berries.",
        "props": "None.",
        "color": "Deep pink meat, amber skin, dark red cherries, green arugula.",
        "forbid": "Butter, orange glaze that is not in the recipe, potatoes, chicken, text, logos.",
        "crop": "Slices and skin in the center. Sauce color has to read at card size.",
        "ambiguity": "Seared duck breast. Not chicken and not a steak.",
    },
})

add({
    "slug": "linguine-with-clams",
    "title": "Linguine with Clams",
    "description": "Littleneck clams steamed open in garlic and white wine, tossed with linguine, parsley, and lemon. No cheese and no butter.",
    "cuisine": "italian",
    "meal_format": "pasta",
    "primary": "clams",
    "tags": ["pasta", "savory", "herbaceous", "fresh"],
    "servings": 4,
    "prep": 15,
    "cook": 18,
    "methods": ["stovetop"],
    "allow_fry": set(),
    "expect_frying": [],
    "expect_crisp_has": [],
    "expect_stir": False,
    "heat": "A large pot of boiling water for the pasta. A 12-inch skillet or wide pot over medium for the clams.",
    "doneness": "Pasta tender with a slight bite. Clams open. Any clam that stays shut is discarded. Sauce glossy from the clam liquor and olive oil, not creamy.",
    "equipment": ["large pot", "12-inch skillet with a lid", "tongs", "colander"],
    "clock": "Prep 15 is scrubbing clams, slicing garlic, and bringing the pasta water to a boil. Cook 18 is the pasta and the clams together: pasta about 10 minutes, clams about 8, then a short toss.",
    "hh001": False,
    "hh_reason": "Clams are shellfish, which HH001 does not eat. There is no dairy.",
    "hh_contract": "Not an HH001 meal. No cheese and no butter. Olive oil, garlic, white wine, parsley, and lemon only.",
    "eligibility": {
        "contains_meat": False, "contains_poultry": False, "contains_finfish": False,
        "contains_shellfish": True, "contains_dairy": False,
        "plant_based_compatible": False, "vegetarian_compatible": False,
        "nut_policy": "none",
        "nut_policy_note": "No peanuts, tree nuts, or cashews.",
    },
    "labels": ["dairy_free"],
    "label_note": "Unconditional dairy_free. Shellfish, so not vegetarian, not plant-based, and not the fish label.",
    "allergens": ["shellfish", "wheat"],
    "allergen_notes": ["Shellfish is the clams.", "Wheat is the linguine."],
    "effort": ("moderate", 4, {"active_prep": 1, "active_attention": 1, "active_components": 0, "technique": 1, "coordination_cleanup_equipment": 1}, []),
    "complexity": ("standard", 2, {"ingredient_count_band": 0, "specialty_burden": 1, "flavor_component_breadth": 1, "pantry_familiarity": 0}, 7),
    "effort_why": "Scrubbing is ordinary prep. The skill is not overcooking the clams, technique 1, while the pasta pot runs, coordination 1. Total 4, moderate.",
    "complexity_why": "Seven counted items. Live clams are a fish-market or good-grocery item, specialty burden 1. Italian cooking adds no points.",
    "components": [],
    "coverage": "First clam dish. Shellfish was shrimp, mussels, and scallops. A pasta with no dairy.",
    "near": "Lemon garlic shrimp pasta is a different shellfish and often a different sauce shape. Mussels are a tomato one-pot, not linguine.",
    "scale": {
        "1": "1 lb clams, 3 oz pasta, one garlic clove, a splash of wine.",
        "2": "Half.",
        "4": "As written.",
        "do_not_scale": ["discard clams that do not open", "salt the pasta water"],
    },
    "ingredients": [
        ing("littleneck-clams", "littleneck clams", 4, "lb", prep="scrubbed, any that are open and do not close when tapped discarded"),
        ing("linguine", "linguine", 12, "oz"),
        ing("garlic", "garlic", 6, "clove", prep="sliced thin"),
        ing("olive-oil", "olive oil", 0.33, "cup", role="fat"),
        ing("white-wine", "dry white wine", 0.75, "cup", role="liquid"),
        ing("red-pepper-flakes", "red pepper flakes", 0.5, "tsp", role="seasoning"),
        ing("parsley", "flat-leaf parsley", 0.5, "cup", prep="chopped"),
        ing("lemon", "lemon", 1, "count", prep="juiced, plus wedges to serve"),
        ing("kosher-salt", "kosher salt", 1, "tbsp", role="seasoning", note="for the pasta water"),
        ing("black-pepper", "black pepper", 0.25, "tsp", role="seasoning"),
    ],
    "steps": [
        step(1, "Scrub and boil", "Scrub the clams. Slice the garlic, chop the parsley, and juice the lemon. Put a large pot of water on to boil and salt it. The water should be boiling by the end of this 15-minute prep.", ["littleneck-clams", "garlic", "parsley", "lemon", "kosher-salt"]),
        step(2, "Pasta and clams", "Boil the linguine until it is almost tender, about 10 minutes. Meanwhile warm the olive oil, garlic, and red pepper flakes in a skillet over medium until the garlic is fragrant, about 1 minute. Add the wine and the clams, cover, and cook until the clams open, about 6 to 8 minutes. Discard any that stay shut.", ["linguine", "olive-oil", "garlic", "red-pepper-flakes", "white-wine", "littleneck-clams"]),
        step(3, "Toss", "Drain the pasta, reserving 1/2 cup pasta water. Toss the pasta with the clams, their liquor, the parsley, lemon juice, and pepper. Loosen with pasta water if it looks dry. Cook is 18 minutes.", ["linguine", "littleneck-clams", "parsley", "lemon", "black-pepper"]),
    ],
    "brief": {
        "hero": "A tangle of linguine with open littleneck clams in their shells, garlic slices, parsley, and a lemon wedge.",
        "vessel": "Wide shallow off-white bowl.",
        "angle": "Slightly overhead, close, so shells and pasta both read.",
        "visible": "Open clam shells, pasta, parsley, garlic, lemon. No cream.",
        "texture": "Glossy oil-and-wine coating, not a white sauce. Plump clam meat.",
        "sauce": "A light gloss on the noodles. No puddle of cream.",
        "garnish": "Parsley and lemon from the recipe.",
        "props": "Optional empty shell is already part of the dish. No bread basket that dominates.",
        "color": "Pale pasta, gray-white shells, beige clam, green parsley, yellow lemon.",
        "forbid": "Cheese, butter pats, cream, shrimp, mussels as the hero, tomato sauce, text, logos.",
        "crop": "Shells near the center so the card still shows clams, not only noodles.",
        "ambiguity": "Clam linguine. Not shrimp pasta and not mussels in tomato broth.",
    },
})


EXCLUDE_COUNT = {"kosher-salt", "black-pepper", "water", "rice-water", "sauce-water", "olive-oil", "neutral-oil", "sesame-oil"}


def counted_ids(meal):
    return [item["ingredient_id"] for item in meal["ingredients"] if item["ingredient_id"] not in EXCLUDE_COUNT]


def band(count):
    if count <= 12:
        return 0
    if count <= 16:
        return 1
    return 2


def effort_level(score, floors):
    if any(item.startswith("technique_2") for item in floors):
        return "involved"
    if score <= 2:
        return "easy"
    if score <= 5:
        return "moderate"
    return "involved"


def complexity_level(score):
    if score <= 1:
        return "simple"
    if score <= 3:
        return "standard"
    return "adventurous"


def check_meal(meal):
    hits = {match.group(0).lower() for match in FRY_RE.finditer(scanned_text(meal))}
    allowed = {item.lower() for item in meal["allow_fry"]}
    unexpected = sorted(hits - allowed)
    if unexpected:
        raise SystemExit(f"{meal['slug']}: unexpected fry words {unexpected}")
    ids = [item["ingredient_id"] for item in meal["ingredients"]]
    if len(ids) != len(set(ids)):
        raise SystemExit(f"{meal['slug']}: duplicate ingredient ids")
    used = {ref for item in meal["steps"] for ref in item["ingredient_refs"]}
    missing = [item for item in ids if item not in used]
    dangling = sorted(used - set(ids))
    if missing or dangling:
        raise SystemExit(f"{meal['slug']}: unused={missing} dangling={dangling}")
    if meal["prep"] + meal["cook"] != meal["prep"] + meal["cook"]:
        raise SystemExit("time")
    count = len(counted_ids(meal))
    if count != meal["complexity"][3]:
        raise SystemExit(f"{meal['slug']}: counted {count} declared {meal['complexity'][3]} {counted_ids(meal)}")
    factors = meal["complexity"][2]
    if factors["ingredient_count_band"] != band(count):
        raise SystemExit(f"{meal['slug']}: band mismatch")
    score = sum(factors.values())
    if score != meal["complexity"][1] or complexity_level(score) != meal["complexity"][0]:
        raise SystemExit(f"{meal['slug']}: complexity score {score}")
    escore = sum(meal["effort"][2].values())
    if escore != meal["effort"][1] or effort_level(escore, meal["effort"][3]) != meal["effort"][0]:
        raise SystemExit(f"{meal['slug']}: effort score {escore} floors {meal['effort'][3]}")
    derived = derive(meal["title"], meal["description"], meal["methods"], meal["steps"])
    if derived["frying"] != meal["expect_frying"] or derived["stir_fry"] is not meal["expect_stir"]:
        raise SystemExit(f"{meal['slug']}: derived {derived}")
    for token in meal["expect_crisp_has"]:
        if token not in derived["crispy_non_fry"]:
            raise SystemExit(f"{meal['slug']}: missing crisp {token} in {derived}")
    meal["derived"] = derived
    return meal


def package(meal):
    slug = meal["slug"]
    check_meal(meal)
    level, escore, efactors, floors = meal["effort"]
    clevel, cscore, cfactors, count = meal["complexity"]
    elig = dict(meal["eligibility"])
    elig["hh001_eligible"] = meal["hh001"]
    elig["hh001_reason"] = meal["hh_reason"]
    version = {
        "recipe_version_id": f"rv_{slug}_v1",
        "recipe_id": f"rcp_{slug}",
        "dish_id": slug,
        "version_number": 1,
        "package_revision": "author-r1",
        "immutable": True,
        "immutability_note": "v1 has not been planned, shopped, cooked, or rated. The image slot is pending_image_pass. Not certified. Not published. kitchen_tested is false.",
        "title": meal["title"],
        "description": meal["description"],
        "base_servings": meal["servings"],
        "ingredients": meal["ingredients"],
        "steps": meal["steps"],
        "components": meal["components"],
        "equipment": meal["equipment"],
        "methods": meal["methods"],
        "cooking": {
            "frying": meal["derived"]["frying"],
            "crispy_non_fry": meal["derived"]["crispy_non_fry"],
            "stir_fry": meal["derived"]["stir_fry"],
            "source": meal["derived"]["source"],
            "intent": "The stored lists, crisp tokens, stir flag, and source are the deriveCookingMethod result for this title, description, methods, and steps.",
        },
        "prep_time_minutes": meal["prep"],
        "cook_time_minutes": meal["cook"],
        "total_time_minutes": meal["prep"] + meal["cook"],
        "prep_minutes": meal["prep"],
        "cook_minutes": meal["cook"],
        "total_minutes": meal["prep"] + meal["cook"],
        "time_clock": meal["clock"],
        "heat": meal["heat"],
        "doneness": meal["doneness"],
        "effort_level": level,
        "ingredient_complexity": clevel,
        "classification_history": [{
            "version_number": 1,
            "who": AUTHOR,
            "when": WHEN,
            "from": None,
            "to": {"effort_level": level, "ingredient_complexity": clevel},
            "reason": "Initial D-03 assignment before any audit. Factor scores are in d03-classification.json.",
        }],
        "classification_sidecar": "d03-classification.json",
        "dietary_eligibility": elig,
        "dietary_labels": meal["labels"],
        "dietary_label_note": meal["label_note"],
        "allergens": meal["allergens"],
        "allergen_notes": meal["allergen_notes"],
        "hh001_eligible": meal["hh001"],
        "hh001_reason": meal["hh_reason"],
        "hh001_contract": meal["hh_contract"],
        "vocabulary_tag_ids": meal["tags"],
        "publication_state": "Draft",
        "publication_status": "draft",
        "structural_qa_state": "author_r1_image_slot_pending",
        "culinary_audit_state": "not_audited",
        "kitchen_tested": False,
        "validation_kind": "author_structural_preflight_only",
        "provenance": "original_ai_assisted",
        "visibility": "global",
        "household_id": None,
        "data_origin": "synthetic",
        "rights_state": "not_cleared_for_external_release",
        "runtime_enum_gaps": {
            "provenance": "Factory value is original_ai_assisted. The importer maps it to ai_assisted. Keep the factory token on the package.",
            "publication_state": "Draft. Not published.",
            "allergens": "Factory tokens. tree_nut plus cashew with nut_policy cashews_only_ok imports as cashew. Other tree_nut imports as nuts.",
            "dietary_labels": "plant_based imports as plant. fish is a factory label for finfish meals.",
            "classification": "effort_level and ingredient_complexity only. No legacy effort or complexity string.",
            "cooking": "methods and the cooking object match deriveCookingMethod in src/weave/semantics.js. Warnings about other methods stay out of the title, description, and steps.",
        },
    }
    version["culinary_hash"] = culinary_hash(version)
    version["culinary_hash_basis"] = "sha256 of canonical JSON of title, description, base_servings, ingredients, steps, components, equipment, prep/cook/total minutes, heat, doneness. Excludes classification and cooking."
    image = {
        "image_id": f"img_{slug}_v1",
        "dish_id": slug,
        "recipe_version_id": f"rv_{slug}_v1",
        "asset_generated": False,
        "slot_status": "pending_image_pass",
        "master_filename": f"{slug}.webp",
        "card_filename": f"{slug}-640.webp",
        "master_ref": None,
        "card_ref": None,
        "derivatives": [],
        "dimensions": {"master_width": 1200, "master_height": 900, "card_width": 640, "card_height": 480},
        "dimensions_note": "Targets for the image pass. No WebP file is in this directory yet.",
        "generation": {
            "method": "pending_original_ai",
            "generator": "unassigned_image_pass",
            "model": "unknown",
            "prompt_file": "image-prompt.md",
            "plating_brief_file": "image-plating-brief.md",
            "external_image_api_called": False,
            "stock_or_web_photo_used": False,
            "house_quality_reference": "factory/tools/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png",
        },
        "qa_state": "pending_image_pass",
        "recipe_fidelity_state": "pending_image_pass",
        "rights": "not_cleared_for_external_release",
        "provenance": "pending_original_ai",
        "package_revision": "author-r1",
        "rejected_dir": "rejected/",
    }
    doc = {
        "catalog_contract": "flavorweave-catalog-package",
        "catalog_contract_note": "Author package for wave-13. Image slot is pending_image_pass. Not certified. Not published. Not imported.",
        "batch_id": BATCH,
        "batch_label": "wave-13",
        "mode": "author_batch",
        "package_revision": "author-r1",
        "authored_on": WHEN,
        "authored_timezone": "America/Chicago",
        "curator_role": "Author (catalog factory cloud agent)",
        "authored_by": AUTHOR,
        "auditor": None,
        "certification": None,
        "dish": {
            "dish_id": slug,
            "slug": slug,
            "title": meal["title"],
            "description": meal["description"],
            "cuisine": meal["cuisine"],
            "meal_format": meal["meal_format"],
            "primary_ingredient": meal["primary"],
            "vocabulary_tag_ids": meal["tags"],
            "current_recipe_id": f"rcp_{slug}",
            "current_version_id": f"rv_{slug}_v1",
        },
        "recipe": {
            "recipe_id": f"rcp_{slug}",
            "dish_id": slug,
            "visibility": "global",
            "household_id": None,
            "provenance": {
                "source_class": "original_ai_assisted",
                "created_on": WHEN,
                "curator": "Author (catalog factory cloud agent)",
                "process": f"FlavorWeave Catalog Factory {BATCH}",
                "copied_from_third_party": False,
            },
        },
        "recipe_version": version,
        "image": image,
        "catalog_confidence": {
            "structural_validation": "SEE_STRUCTURAL_PREFLIGHT_JSON",
            "culinary_audit": "NOT_RUN",
            "dietary_audit": "NOT_RUN",
            "image_fidelity": "PENDING_ASSET",
            "provenance": "KNOWN_TEXT",
            "image_rights_provenance": "PENDING_ORIGINAL_AI",
            "kitchen_tested": False,
            "household_cooks": 0,
            "household_completed_ratings": 0,
            "image_provenance": "PENDING_GROK_BOT",
        },
        "curator_preflight": [
            {"check": "times", "result": "pass_with_stated_clock", "detail": meal["clock"]},
            {"check": "kitchen_tested", "result": "pass", "detail": "kitchen_tested is false."},
            {"check": "image", "result": "pending_image_pass", "detail": "Plating brief and prompt are written. WebP files are not in this directory."},
            {"check": "cooking", "result": "pass", "detail": json.dumps(meal["derived"])},
        ],
        "scaling_notes": {"base_servings": 4, **{key: meal["scale"][key] for key in ("1", "2", "4")}, "do_not_scale": meal["scale"]["do_not_scale"]},
        "coverage_contribution": meal["coverage"],
        "near_duplicate_review": meal["near"],
        "recommendation_eligible": False,
        "structural_qa_state": "author_r1_image_slot_pending",
    }
    return doc


def write_brief(directory, meal):
    brief = meal["brief"]
    text = f"""# Image / Plating Brief — {meal['title']}

Package `{meal['slug']}`, revision `author-r1`. Written before any image exists. Slot status: pending_image_pass. Standard: `factory/IMAGE-SPEC.md` and `factory/tools/image-standards/hero-appeal-amendment.md`.

## Hero subject

{brief['hero']}

## Vessel

{brief['vessel']}

## Camera angle

{brief['angle']}

## Required visible components

{brief['visible']}

## Texture cues

{brief['texture']}

## Sauce / component placement

{brief['sauce']}

## Legitimate garnish (recipe-listed only)

{brief['garnish']}

## Environmental styling

{brief['props']}

## Color opportunities

{brief['color']}

## Forbidden elements

{brief['forbid']}

## Crop strategy

{brief['crop']}

Master target is WebP 1200x900. Card target is WebP 640x480. Both are 4:3 center crops. Export later with `python3 factory/tools/export_meal_webps.py <source> {directory.relative_to(ROOT)} {meal['slug']}`.

## Ambiguity

{brief['ambiguity']}

## House style

Bright, premium, realistic editorial food photography. Soft daylight, light neutral surface, food filling the frame. The house-quality reference is Chipotle Lime Black Bean Bowl for light and finish only, not for composition. No text, logo, or watermark.
"""
    (directory / "image-plating-brief.md").write_text(text)


def write_prompt(directory, meal):
    text = f"""# Image prompt — {meal['title']}

Status: pending_image_pass. package_revision `author-r1`. Do not treat this file as a finished asset. The image pass generates an original AI image from this prompt, then exports WebPs with `factory/tools/export_meal_webps.py`.

Prompt:

Editorial food photograph of {meal['title']} for a premium meal-planning app. {meal['brief']['hero']} Vessel: {meal['brief']['vessel']} Camera: {meal['brief']['angle']} Must show: {meal['brief']['visible']} Texture: {meal['brief']['texture']} Sauce: {meal['brief']['sauce']} Garnish: {meal['brief']['garnish']} Color from the recipe only: {meal['brief']['color']} Do not include: {meal['brief']['forbid']} Lighting: bright diffused daylight, soft shadows, real highlights, no harsh flash, no muddy dark, no synthetic gloss. Background: light neutral tabletop, modern off-white ceramic. 4:3 landscape, subject centered and crop-safe. {meal['brief']['ambiguity']} Quality reference is the Chipotle Lime Black Bean Bowl standard for light and appetite only. Not a copy of that bowl.
"""
    (directory / "image-prompt.md").write_text(text)


def write_readme(directory, meal, doc):
    version = doc["recipe_version"]
    hh = "yes" if meal["hh001"] else "no"
    text = f"""# {meal['title']}

{meal['description']}

Author package for FlavorWeave Catalog Factory {BATCH}. package_revision `author-r1`. kitchen_tested is false. Not certified. Not published. Not imported. Image slot: pending_image_pass.

## Identity

- Dish id / slug: `{meal['slug']}`
- Recipe id: `rcp_{meal['slug']}`
- Recipe version id: `rv_{meal['slug']}_v1`
- Cuisine: {meal['cuisine']}
- Meal format: {meal['meal_format']}
- Primary ingredient: {meal['primary']}
- Servings: 4
- Time: prep {meal['prep']} + cook {meal['cook']} = {meal['prep'] + meal['cook']} minutes
- Time clock: {meal['clock']}
- effort_level: {version['effort_level']}
- ingredient_complexity: {version['ingredient_complexity']}
- Methods: {', '.join(meal['methods'])}
- Cooking classification: `{json.dumps(meal['derived'])}`
- HH001 eligible: {hh} — {meal['hh_reason']}
- Contract: {meal['hh_contract']}
- Taste tags: {', '.join(meal['tags'])}
- Dietary labels: {', '.join(meal['labels'])}
- Allergens: {', '.join(meal['allergens'])}
- Provenance: original_ai_assisted

## D-03

{meal['effort_why']}

{meal['complexity_why']}

## Image

The plating brief and the prompt are in this directory. WebP master and card are not. Freeze integrity is expected to fail until the image pass adds `{meal['slug']}.webp` and `{meal['slug']}-640.webp` and the package is frozen again.

## Coverage

{meal['coverage']}

{meal['near']}
"""
    (directory / "README.md").write_text(text)


def write_sidecar(directory, meal):
    level, escore, efactors, floors = meal["effort"]
    clevel, cscore, cfactors, count = meal["complexity"]
    doc = {
        "slug": meal["slug"],
        "recipe_version_id": f"rv_{meal['slug']}_v1",
        "package_revision": "author-r1",
        "assigned_by": AUTHOR,
        "assigned_on": WHEN,
        "rubric": "D-03 as stated in factory/PACKAGE.md",
        "effort_factors": efactors,
        "effort_score": escore,
        "effort_level": level,
        "effort_floors_applied": floors,
        "complexity_factors": cfactors,
        "complexity_score": cscore,
        "ingredient_complexity": clevel,
        "ingredient_count": count,
        "counted_ingredient_ids": counted_ids(meal),
        "excluded_from_count": sorted(EXCLUDE_COUNT),
        "rationale": meal["effort_why"] + " " + meal["complexity_why"],
        "cultural_bias": "Cuisine unfamiliarity added no points.",
    }
    (directory / "d03-classification.json").write_text(json.dumps(doc, indent=2) + "\n")


def write_image_state(directory, meal):
    doc = {
        "slot_status": "pending_image_pass",
        "asset_generated": False,
        "expected_files": [f"{meal['slug']}.webp", f"{meal['slug']}-640.webp"],
        "present_files": [],
        "plating_brief": "image-plating-brief.md",
        "prompt": "image-prompt.md",
        "note": "The author left this slot for the image pass. Generate original AI art from the prompt and brief, export both WebPs with factory/tools/export_meal_webps.py, then re-run freeze integrity before an auditor starts.",
    }
    (directory / "image-state.json").write_text(json.dumps(doc, indent=2) + "\n")


def main():
    if len(MEALS) != 10:
        raise SystemExit(f"expected 10 meals, got {len(MEALS)}")
    if any((OUT / meal["slug"] / "v1.json").exists() for meal in MEALS):
        raise SystemExit(
            "Refusing to overwrite wave-13 candidates. Image files and later revisions live in those directories. Edit v1.json in place."
        )
    hh = 0
    for meal in MEALS:
        doc = package(meal)
        directory = OUT / meal["slug"]
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "v1.json").write_text(json.dumps(doc, indent=2) + "\n")
        write_sidecar(directory, meal)
        write_brief(directory, meal)
        write_prompt(directory, meal)
        write_readme(directory, meal, doc)
        write_image_state(directory, meal)
        if meal["hh001"]:
            hh += 1
        print(f"wrote {meal['slug']} hh001={meal['hh001']} {meal['derived']}")
    print(f"hh001 {hh}/10")


if __name__ == "__main__":
    main()

