"""Shared helpers for wave-16 package authoring (Grok Bot, Curator role).

Adapted from the wave-15 tools. Wave-16 has no audit history yet, so the wave-15 audit
regeneration tables are gone; the brief props guard is kept and applies to every package.
"""
from __future__ import annotations


def ing(iid, name, qty, unit, role="main", display=None, note=None, prep=None, optional=False):
    return {
        "ingredient_id": iid,
        "name": name,
        "display_name": display or name,
        "quantity": qty,
        "unit": unit,
        "note": note,
        "preparation": prep,
        "optional": optional,
        "role": role,
    }


def st(title, body, refs, minutes, phase):
    """phase: prep | cook | overlap. overlap minutes run inside another step's clock and add 0."""
    assert phase in ("prep", "cook", "overlap"), phase
    return {"title": title, "body": body, "ingredient_refs": refs, "minutes": minutes, "phase": phase}


MEALS = []


def add(meal):
    MEALS.append(meal)
    return meal


# --- revisions ---
PENDING_REV = "author-r1"  # text frozen, image slot open (Cora generates heroes from image-prompt.md)
REV = "author-r2"          # written by finalize_images.py once an approved hero is exported


R3_REV = "author-r3"
# Text-only revisions after audit r1 (wave-16/audit/r1). Images are unchanged and not regenerated.
# from_culinary_hash is the author-r2 culinary_hash recorded before the edit.
R3 = {
    "cambodian-fish-amok": {
        "trigger": "audit r1 gate B FAIL",
        "from_culinary_hash": "3b53ef3ac394b09adfb722b11bcdc4e688a62682f12a65d50c9b36e8fc0b144d",
        "changes": ["Vessels: 4 (12-ounce) ramekins replaced by 6 (10-ounce) ramekins, each filled about three-quarters (a scant 1 cup of the ~1.3 L mix), so the custard has room to puff with the topping.",
                    "Steamer: 6-quart pot and collapsible basket replaced by a two-tier 12-inch bamboo steamer (3 ramekins per tier) over a 14-inch flat-bottomed wok with 4 cups water; all six steam at once, tiers swapped after 11 minutes.",
                    "Steps 3 and 4 rewritten to match; step 3 clock 4 -> 5 minutes (prep 21 -> 22, total 53 -> 54). Step 4 clock unchanged at 30; rice overlap unchanged.",
                    "Topping: the reserved 1/4 cup coconut cream is divided over six custards (about 2 tsp each); serve step says 1 or 2 ramekins per person and lifts them with tongs.",
                    "Heat, food-safety, effort note, and 1/2/4-serving scaling lines and do-not-scale notes updated for 10-ounce ramekins and the bamboo steamer.",
                    "Garnish wording unchanged: the recipe garnish is slivered makrut lime leaf and sliced chile, as before."]},
    "jamaican-escovitch-snapper": {
        "trigger": "audit r1 gates B and C FAIL",
        "from_culinary_hash": "1c1ee55f033fbc084dc015d478292dcd84f70f7a05f0c1625e966f7b1f4eb04c",
        "changes": ["Oil kept at 1/2 cup (a thin layer for pan-frying dredged fillets); the do-not-scale note changed from 'about 1/4 inch' to 'a thin layer, about 1/8 inch: 1/2 cup in a 12-inch skillet, about 1/3 cup in a 10-inch skillet'.",
                    "Heat line and step 4 now state the 1/2 cup thin layer, about 1/8 inch.",
                    "Scaling: 1 serving states about 1/3 cup oil in the 10-inch skillet; 2 servings state the full 1/2 cup in the 12-inch skillet."]},
    "turkish-mucver-zucchini-fritters": {
        "trigger": "audit r1 gate B FAIL",
        "from_culinary_hash": "1e49f8d41cc7371c5f892cf27c1bf82f34651f4b0502ca13a2c725c115738b60",
        "changes": ["Oil: 1/2 cup total (1/4 cup per batch) -> 1 1/3 cups total, 2/3 cup per batch, which gives the stated ~1/8 inch in a 12-inch skillet; heat, food-safety, and step 5 text agree.",
                    "Step 5 clock 19 -> 21 minutes (3 minutes to heat the first oil, about 1 minute for the second); cook 21 -> 23, total 46 -> 48.",
                    "Garlic yogurt: 1 tbsp of the dill is stirred into the yogurt (matches the hero); dill raised from 1/3 to 1/2 cup (1 tbsp yogurt, 2 tbsp to scatter, the rest in the batter); description and yogurt component updated.",
                    "Scaling: 1 and 2 serving lines state the oil (about 1/2 cup in a 10-inch skillet, 2/3 cup in the 12-inch); a do-not-scale oil-depth note added."]},
    "austrian-pork-schnitzel-potato-salad": {
        "trigger": "audit r1 note (non-blocking, PASS WITH NOTES)",
        "from_culinary_hash": "11b939c0b408f8de5f55b2020ac756324b6fa9f9773e1deea776cb4d335d9910",
        "changes": ["Breadcrumb ingredient note adds a homemade fallback: about 6 oz day-old plain bakery bread whose label lists only wheat flour, water, yeast, and salt, pulsed and dried in a skillet about 8 minutes (adds about 12 minutes before step 1); allergen note updated."]},
    "cuban-picadillo-rice": {
        "trigger": "audit r1 note (non-blocking, PASS WITH NOTES)",
        "from_culinary_hash": "cb4f876ef8525d1289f3ffbabd8a33a97d5f4a09908c04721c40a723d83cc704",
        "changes": ["Tomato-sauce and olive label rules moved onto the ingredient lines ('label lists tomatoes and salt only'; 'label lists olives, pimiento, water, salt, and vinegar only'). Quantities and steps unchanged."]},
}
R3_WHEN = "2026-10-15"


def rev_for(slug):
    return R3_REV if slug in R3 else REV


# Creator self-review regenerations (before any audit). Cora rejected these v1 heroes and generated v2
# from a rewritten prompt. The v2 prompt is recorded verbatim from notes/prompts-v2-selfreview.txt
# (copy of /workspace/wave16-v2-prompts.txt); brief_v2 rebuilds image-plating-brief.md to match it.
# Format: slug -> {"v1_rejection": str, "changes": [str], "brief_v2": {brief key: text}}
QUALITY_SENTENCE = "Quality reference is the Chipotle Lime Black Bean Bowl standard"
SELFREVIEW_V2 = {
    "sichuan-mapo-tofu-shiitake": {
        "v1_rejection": "The tofu looked golden and fried, the sauce read brown, and the shiitake crumbs read as ground meat.",
        "changes": ["Tofu described as pure white, soft, unbrowned silken cubes, never golden or fried.",
                    "Sauce described as translucent glossy red chili-bean sauce with a layer of bright red chili oil.",
                    "Shiitake described as small diced dark pieces, clearly mushroom, not crumbled meat.",
                    "Do not include adds golden, browned, seared, or fried tofu and anything that looks like crumbled ground meat."],
        "brief_v2": {
            "hero": "A generous pool of glossy, vivid brick-red mapo tofu: pure white, soft, unbrowned silken tofu cubes (bright white, never golden or fried) sitting in a translucent glossy red chili-bean sauce with a layer of bright red chili oil, with small diced dark shiitake pieces and a few black fermented beans, beside a mound of jasmine rice.",
            "vessel": "Wide shallow off-white ceramic bowl.",
            "angle": "High three-quarter, about 50 degrees.",
            "visible": "Bright white soft tofu cubes with clean edges; glossy red sauce with red oil beading at the edges; small dark diced shiitake (clearly mushroom pieces, not crumbled meat); a few black fermented beans; Sichuan peppercorn specks; sliced green scallion; white jasmine rice.",
            "texture": "Silky soft tofu, thick glossy sauce, fluffy rice.",
            "sauce": "Mapo on one side, rice on the other, touching in the middle; thick, not soupy.",
            "garnish": "Sliced scallion greens and ground Sichuan peppercorn only.",
            "props": "Only the bowl, chopsticks, and a ceramic spoon on linen.",
            "color": "Vivid red sauce, white tofu, dark brown shiitake, green scallion, white rice.",
            "forbid": "Golden, browned, seared or fried tofu, anything that looks like crumbled ground meat, brown gravy, broccoli, bell peppers, egg, side dishes, drinks, text, logos, hands.",
            "ambiguity": "Mapo tofu: soft white tofu in red Sichuan chili bean sauce. Not General Tso's fried tofu, not a brown stir-fry.",
        },
    },
    "turkish-mucver-zucchini-fritters": {
        "v1_rejection": "Only two fritters were on the plate; the brief and recipe serve three per plate.",
        "changes": ["Hero states exactly three (count them: three) round fritters overlapping in a row.",
                    "Must show adds one fritter broken open to show the set, green-flecked interior.",
                    "Do not include adds two or four fritters.",
                    "The v2 prompt has no separate Sauce or Color line; the sauce and color sections of image-plating-brief.md restate what the v2 hero and must-show lines already say."],
        "brief_v2": {
            "hero": "Exactly three (count them: three) round golden zucchini-feta fritters overlapping in a row on a plate beside a generous swoosh of white garlic yogurt and a bright heap of tomato, cucumber, and red onion salad.",
            "vessel": "Large off-white ceramic plate.",
            "angle": "Elevated three-quarter, about 35 degrees.",
            "visible": "Three round golden-brown fritters with visible green zucchini shreds, herb flecks and a few white feta pieces at the edges; one fritter broken open to show a set, green-flecked interior; thick white yogurt swooshed on the plate; diced red tomato, pale green cucumber, thin purple-red onion.",
            "texture": "Crisp lacy fritter edges, tender interior, thick creamy yogurt, juicy salad.",
            "sauce": "Garlic yogurt swooshed on the plate beside the fritters; the salad heaped alongside. No sauce bowl.",
            "garnish": "Chopped dill and mint scattered over the fritters only.",
            "props": "Only the plate, a fork and knife, and a linen napkin.",
            "color": "Golden-brown fritters with green zucchini and herb flecks, white yogurt and feta, red tomato, pale green cucumber, purple-red onion.",
            "forbid": "Two or four fritters, potato latkes, falafel, pita or bread, rice, meat, lemon wedges, sauce bowls, drinks, text, logos, hands.",
            "ambiguity": "Mücver: Turkish zucchini-feta fritters with garlic yogurt.",
        },
    },
    "thai-yum-nua-beef-salad": {
        "v1_rejection": "The lettuce read as savoy or napa cabbage, not romaine.",
        "changes": ["Romaine described as smooth, elongated, dark green romaine hearts with pale crunchy ribs, clearly romaine, not cabbage.",
                    "Do not include adds napa or savoy cabbage and crinkled cabbage leaves.",
                    "Image-prompt title drops 'and Jasmine Rice'; the rice is served separately and is not in the shot (as in v1). The recipe title is unchanged.",
                    "The v2 prompt has no separate Color line; the color section of image-plating-brief.md keeps the author-r1 colors, which the v2 hero and must-show lines already name."],
        "brief_v2": {
            "hero": "A generous heap of thin rosy slices of seared flank steak tossed with cucumber half-moons, halved cherry tomatoes, shallot rings, scallions, mint, and cilantro on a bed of crisp romaine lettuce leaves (smooth, elongated, dark green romaine hearts with pale crunchy ribs, clearly romaine, not cabbage).",
            "vessel": "Large oval off-white platter.",
            "angle": "Elevated three-quarter, about 40 degrees.",
            "visible": "Thin flank steak slices with a dark seared edge and a rosy pink center; pale green cucumber half-moons; red halved cherry tomatoes; thin purple shallot rings; green scallion pieces; whole mint and cilantro leaves; minced red chile in a light glossy dressing; crisp elongated romaine leaves with visible white ribs underneath.",
            "texture": "Juicy tender steak, crisp vegetables, fresh herbs, thin glossy dressing.",
            "sauce": "Dressing coating the salad, a little pooled on the platter.",
            "garnish": "Mint and cilantro leaves only.",
            "props": "Only the platter, a fork and spoon, and a linen napkin.",
            "color": "Rosy pink steak, red tomatoes, green herbs and romaine, purple shallot.",
            "forbid": "Napa or savoy cabbage, crinkled cabbage leaves, grill marks, rice, toasted rice powder, peanuts, noodles, lime wedges, side bowls, drinks, text, logos, hands.",
            "ambiguity": "Yum nua: Thai seared steak salad on romaine. Not larb, not a steak Caesar.",
        },
    },
}


for _r in SELFREVIEW_V2.values():
    _r["changes"].append("The v2 prompt shortens the lighting line and drops the Chipotle Lime Black Bean Bowl quality-reference sentence; it keeps the no text, logos, watermarks, or hands line.")


def _prompts_file(path):
    from pathlib import Path
    out, cur = {}, None
    for line in Path(path).read_text().splitlines():
        if line.startswith("## "):
            cur = line[3:].strip()
        elif cur and line.strip():
            assert cur not in out, f"{cur}: more than one prompt line"
            out[cur] = line
    return out


def v1_prompts():
    """The author-r1 prompts exactly as handed to Cora (notes/prompts-author-r1.txt)."""
    from pathlib import Path
    return _prompts_file(Path(__file__).resolve().parent.parent / "notes" / "prompts-author-r1.txt")


def v2_prompt(slug):
    """The v2 prompt verbatim, as Cora used it (notes/prompts-v2-selfreview.txt)."""
    from pathlib import Path
    return _prompts_file(Path(__file__).resolve().parent.parent / "notes" / "prompts-v2-selfreview.txt")[slug]


def gen_map():
    """slug -> {"v1": hash, ...} from notes/image-gen-map.txt (GenerateImage attachment hash == file sha256)."""
    from pathlib import Path
    out = {}
    f = Path(__file__).resolve().parent.parent / "notes" / "image-gen-map.txt"
    if not f.exists():
        return out
    for line in f.read_text().splitlines():
        parts = line.split()
        if len(parts) >= 2:
            out.setdefault(parts[0], {})[parts[2] if len(parts) > 2 else "v1"] = parts[1]
    return out


def _aspect(w, h):
    from math import gcd
    g = gcd(w, h)
    return f"{w // g}:{h // g}"


def crop_43(w, h):
    """The 4:3 center crop that export_meal_webps.py takes from a w x h source."""
    if w / h > 4 / 3:
        return int(h * 4 / 3), h
    return w, int(w * 3 / 4)


def method_detail(w, h):
    cw, ch = crop_43(w, h)
    def scale(target):
        f = target / cw
        return ("upscaled" if f > 1 else "downscaled" if f < 1 else "kept at") + f" {f:.2f}x"
    crop = f"center-cropped to 4:3 ({cw}x{ch})" if (cw, ch) != (w, h) else "already 4:3, not cropped"
    return (f"Source {w}x{h} ({_aspect(w, h)}) from Grok Bot GenerateImage, prompted from image-prompt.md and image-plating-brief.md; "
            f"{crop}, then LANCZOS-{scale(1200)} to the 1200x900 master WebP and {scale(640)} to the 640x480 card WebP with export_meal_webps.py. "
            "House-quality reference used for light and finish only.")


NO_NUTS = "No peanuts, tree nuts, or cashews."


def elig(meat=False, poultry=False, finfish=False, shellfish=False, dairy=False, plant=False, veg=False, nut="none", nut_note=NO_NUTS):
    return {"contains_meat": meat, "contains_poultry": poultry, "contains_finfish": finfish,
            "contains_shellfish": shellfish, "contains_dairy": dairy,
            "plant_based_compatible": plant, "vegetarian_compatible": veg,
            "nut_policy": nut, "nut_policy_note": nut_note}


FISH = elig(finfish=True)
PLANT = elig(plant=True, veg=True)
EGG = elig(veg=True)


def brief(hero, vessel, angle, visible, texture, sauce, garnish, props, color, forbid, crop, ambiguity):
    return {"hero": hero, "vessel": vessel, "angle": angle, "visible": visible, "texture": texture, "sauce": sauce,
            "garnish": garnish, "props": props, "color": color, "forbid": forbid, "crop": crop, "ambiguity": ambiguity}


def comp(cid, name, ingredients, store_bought=False):
    return {"component_id": cid, "name": name, "made_in_recipe": not store_bought, "store_bought": store_bought, "ingredients": ingredients}


# The 15 planned wave-16 slugs, in file order (A: vegetarian, B: seafood, C: other proteins).
PLANNED = """
sichuan-mapo-tofu-shiitake korean-japchae-vegetables indonesian-gado-gado-tempeh russian-mushroom-stroganoff sicilian-pasta-alla-norma
turkish-mucver-zucchini-fritters southern-shrimp-and-grits goan-shrimp-ambot-tik cambodian-fish-amok persian-sabzi-polo-salmon
jamaican-escovitch-snapper hawaiian-ahi-poke-bowl austrian-pork-schnitzel-potato-salad cuban-picadillo-rice thai-yum-nua-beef-salad
""".split()
assert len(PLANNED) == 15 and len(set(PLANNED)) == 15

# Brief props guard: every wave-16 brief is enforced (no grandfathered heroes, no waivers).
PROPS_GRANDFATHERED = set()
PROPS_WAIVER = {}
