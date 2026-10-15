# Wave-14 audit r1 (Harbor Eats / FlavorWeave Catalog Factory)

Independent auditor (Vale role), 2026-10-15 (CT). Skills: flavorweave-catalog-certification, -catalog-package, -meal-image-spec, -catalog-factory. Repo `/workspace/harbor-eats-app` main @ 565d736 (85 meals) used read-only for duplicate and schema checks; git status clean. Packages were not edited, nothing imported, committed, or deployed. All 50 hero WebPs were viewed with Read; flagged ones were also cropped from `img_v1.jpg` and inspected.

## Verdict

**PASS 0 · PASS WITH NOTES 0 · FAIL 50.** Certification is binary; notes are listed separately and do not block.

- **35 of 50** fail **only** the systemic M/O metadata defect. That's a metadata-only fix: no culinary or image change. After a scrub and re-freeze, these are expected to PASS on re-audit.
- **15 of 50** also have culinary, safety, or image FAILs (listed below).

Freeze rule: catalog-certification says to refuse audit when metadata denies present assets, and catalog-package forbids README lines that claim images are incomplete. The stored FREEZE_INTEGRITY (PASS 50/50) and my re-run (PASS 50/50) did not catch these phrasings, because the tool's denial-string list is narrower than the skill. I recorded the defect as an M/O FAIL (wave-11 tibs precedent) and still audited A–O in full, so the creator can fix everything in one pass. Certification is refused until the scrub lands.

## Slug × gate table

| Slug | A | B | C | D | E | F | G | H | I | J | K | L1 | L2 | L | M | N | O | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `aloo-paratha-kachumber-chutney` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `bangers-and-mash-onion-gravy` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `brazilian-feijoada` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `burmese-mohinga-fish-noodle-soup` | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `chicken-andouille-gumbo` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `chilean-porotos-granados` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `chiles-rellenos-ranchero` | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `chinese-tomato-egg-stir-fry` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `colombian-ajiaco` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `egyptian-koshari` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `filipino-fish-sinigang` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `french-onion-soup` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `georgian-adjaruli-khachapuri` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `ghanaian-red-red-plantains` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `glazed-turkey-meatloaf` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `greek-gemista-stuffed-vegetables` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `greek-spanakopita` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `grilled-mahi-mahi-mango-salsa` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `hungarian-chicken-paprikash` | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `japanese-gyudon` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `kasespatzle-caramelized-onions` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `lebanese-samke-harra-bulgur` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `malaysian-curry-laksa` | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `moroccan-seven-vegetable-couscous` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `new-england-clam-chowder` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `nigerian-beef-suya-skewers` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `oven-bbq-baby-back-ribs` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `pan-seared-halibut-lemon-butter-corn` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `persian-ghormeh-sabzi` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `peruvian-ceviche-sweet-potato-corn` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `philly-cheesesteaks` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `polish-mushroom-barley-krupnik` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `pork-shogayaki` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `portuguese-piri-piri-chicken` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `roasted-whole-branzino-salmoriglio` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `senegalese-fish-yassa` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `slow-cooker-ropa-vieja` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `south-african-bobotie` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `spanish-sopa-de-ajo-egg` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `steak-au-poivre-smashed-potatoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `swedish-meatballs-lingonberry` | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `swiss-rosti-smoked-trout` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `taiwanese-beef-noodle-soup` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `tomato-goat-cheese-galette` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `turkey-sloppy-joes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `tuscan-panzanella-white-beans` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `ukrainian-beet-borscht` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `venezuelan-black-bean-plantain-arepas` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `vietnamese-bun-cha` | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |
| `xian-cumin-lamb-stir-fry` | ✓ | ✗ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | FAIL |

✓ PASS, ✗ FAIL. L = L1 + L2. K is judged separately from L.

## Systemic FAIL on all 50 (gates M and O)

Denial and stale lines contradict the present WebPs:
- README.md: "The WebP master and card are not, yet. Freeze integrity fails until the image pass adds…"; package_revision `author-r1`.
- image-prompt.md: "Status: pending_image_pass… Not a finished asset".
- v1.json `recipe_version.immutability_note`: "The image slot is pending_image_pass at author-r1".
- `recipe_version.structural_qa_state`: `author_r1_image_slot_pending`. `image.recipe_fidelity_state`: `awaiting_preflight`.
- `recipe_version.package_revision` is `author-r1`, while the top level and image are `freeze-r1`. The image-plating-brief header says "revision author-r1".
- `image.generation.method_detail` says "4:3 landscape". The source is actually 1280×720 (16:9), centre-cropped to 960×720 and upscaled 1.25× to 1200×900. The visible quality is fine, so L1 PASSes; only the metadata is wrong.
- The STRUCTURAL_PREFLIGHT.json files are timestamped 09:50, before the images (09:57). My re-run (`node factory/tools/structural_preflight.mjs` on copies) gave PASS 50/50, hh001=20.

**Fix (one place).** Patch the generators (`tools/write_docs.py`, `tools/finalize_images.py`) to emit post-image wording, set every revision field to `freeze-r1`, and correct method_detail. Then regenerate all 50 packages and re-run FREEZE_INTEGRITY and the structural preflight. Optionally, add the missing denial phrasings ("not, yet", "pending_image_pass", "Not a finished asset", "image_slot_pending") to the freeze tool.

## Culinary / safety / image FAILs (15 meals)

### `brazilian-feijoada` — F, G
- **F:** Linguiça carries only 'check the sausage label for fillers', a conditional instruction, not a hard contract.  
  **Fix:** Replace with a hard contract on the ingredient: 'smoked linguiça whose label lists no wheat, milk, or soy'.
- **G:** Allergen absence for wheat/milk/soy rests on a conditional note (no conditional claims allowed).  
  **Fix:** Adopt the F contract and remove the conditional note, or tokenize wheat/milk/soy as possible sausage allergens.

### `burmese-mohinga-fish-noodle-soup` — B
- **B:** Equipment/quantity reconciliation fails: 16 cups of noodle water but the only pot listed is 4-quart. A 4-quart pot cannot hold 4 quarts of water at a boil (plus the food) without boiling over.  
  **Fix:** Change equipment to a 6- to 8-quart pot, or cut the water to 12 cups (3 qt) and update the water ingredient line and the step text to match.

### `chiles-rellenos-ranchero` — E, K
- **E:** Clock does not reconstruct. The 10-minute steam after broiling is not counted (step 4 is an overlap of 0 against it), the 12-minute 'serve' step pads the cook clock, and the fry step (2 cups oil to 350 F in a 12-inch skillet plus 2 batches of 2-3 min per side) is underestimated.  
  **Fix:** Step 2 clock 20 (broil + 10-min steam), step 6 fry clock 16 (oil heat ~6 + two batches), step 7 serve clock 5; restate prep 20 / cook 41 / total 61 and update time_clock/time_reconstruction.
- **K:** Recipe and description: 'cloud-light whipped egg batter... golden and puffed' (capeado). The image shows a dense, fine-crumb, uniformly sandy coating that reads as breaded (crumb) or corn-dog batter; no puffed, lacy egg-batter blisters. The brief forbids a breaded crumb coating.  
  **Fix:** Regenerate: puffed, airy, irregular pale-to-deep-golden whipped-egg batter with soft blistered billows and thin spots where the dark-green poblano shows through; no crumb texture. Keep sauce, rice, crema drizzle.

### `greek-spanakopita` — K
- **K:** Side salad shows prominent red-onion slivers. The recipe salad is cucumber, tomatoes, vinegar, oregano, olive oil and salt (no onion). Invented visible ingredient.  
  **Fix:** Either regenerate the salad without red onion, or (text fix, no regen) add '1/4 red onion, thinly sliced' to the salad ingredients and step 6 and re-hash; re-audit K either way.

### `hungarian-chicken-paprikash` — B
- **B:** Equipment/quantity reconciliation fails: step 1 puts 16 cups (4 quarts) of noodle water on to boil; the listed noodle pot is 4-quart. A 4-quart pot cannot hold 4 quarts of water at a boil (plus the food) without boiling over.  
  **Fix:** Change equipment to a 6- to 8-quart pot, or cut the water to 12 cups (3 qt) and update the water ingredient line and the step text to match.

### `japanese-gyudon` — J, K
- **J:** Consumer promise mismatch: description says "A 20-minute Japanese comfort bowl" but the clock is 8 + 15 = 23, and the rice-rest in step 4 (4 min) is tight against a 15-min covered cook started in step 1.  
  **Fix:** Change description (dish + recipe_version) to "A 25-minute..."; step 4 clock 7 (rest 4 + portion); restate cook 17 / total 25; recompute culinary_hash.
- **K:** Creator-flagged and confirmed: the beef reads as crumbled/ground meat in clumps, not thin shaved slices. Brief requires 'tender, soy-glazed beef slices'.  
  **Fix:** Regenerate with wide, paper-thin shaved beef ribbons/sheets with visible folds and fat streaks draped over the rice with translucent onion; no crumbles.

### `lebanese-samke-harra-bulgur` — K
- **K:** Creator-flagged and confirmed: the bulgur reads as fine round couscous, which the brief forbids.  
  **Fix:** Regenerate with coarse #3/#4 cracked-wheat bulgur: irregular, angular, larger, slightly darker tan grains with visible texture; no fine round pearls.

### `malaysian-curry-laksa` — B
- **B:** Equipment/quantity reconciliation fails: 16 cups (4 qt) of noodle water in a 4-quart pot. A 4-quart pot cannot hold 4 quarts of water at a boil (plus the food) without boiling over.  
  **Fix:** Change equipment to a 6- to 8-quart pot, or cut the water to 12 cups (3 qt) and update the water ingredient line and the step text to match.

### `new-england-clam-chowder` — K
- **K:** No identifiable clam pieces. Surface shows potato cubes, bacon and chives only; it reads as loaded potato soup, which the brief's ambiguity line rules out. Clams are a required visible element.  
  **Fix:** Regenerate with clearly visible chopped clam pieces (small tan-grey, ruffled, chewy-looking bits) scattered on and in the chowder among the potatoes; keep bacon, chives, oyster crackers; no shells.

### `peruvian-ceviche-sweet-potato-corn` — K
- **K:** Creator-flagged and confirmed: bright red cube-like diced pieces read as tomato or red bell pepper; the recipe has minced red chile only and no tomato. A lime half also sits on the plate, while the brief allows cilantro sprigs only.  
  **Fix:** Regenerate with only tiny, sparse minced red-chile flecks (no cubes), translucent-white cured fish, red onion slivers, sweet potato, choclo/corn, cilantro sprigs; remove the lime half.

### `philly-cheesesteaks` — F, G
- **F:** Hoagie rolls are a store-bought component without a hard contract. US commercial hoagie rolls commonly contain soy (lecithin/flour), and some contain milk or egg.  
  **Fix:** Add a hard contract to the roll line: 'hoagie rolls whose label lists no soy, milk, or egg', or tokenize instead (see G).
- **G:** allergen_notes claim 'No egg, soy...' but the roll is uncontracted. A wrong 'safe for X' claim is a FAIL (wave-12 smash-burger bun precedent).  
  **Fix:** Either add 'soy' (and 'egg') to allergens and delete 'No egg, soy' from the notes, or keep the claim and add the hard roll contract from F.

### `south-african-bobotie` — F, G
- **F:** White sandwich bread (soaked into the beef layer) is a store-bought component but is not listed as one and has no contract; US white sandwich bread typically contains soy.  
  **Fix:** List the bread under components as store-bought and add a hard contract ('white sandwich bread whose label lists no soy'), or tokenize.
- **G:** Soy from the bread is not tokenized while notes imply no soy.  
  **Fix:** Add 'soy' to allergens with note 'Soy commonly in sandwich bread', or contract a soy-free bread (F).

### `swedish-meatballs-lingonberry` — B
- **B:** Equipment/quantity reconciliation fails: 12 cups of water plus 2 lb potatoes in a 4-quart pot. A 4-quart pot cannot hold 4 quarts of water at a boil (plus the food) without boiling over.  
  **Fix:** Change equipment to a 6- to 8-quart pot, or cut the water to 12 cups (3 qt) and update the water ingredient line and the step text to match.

### `vietnamese-bun-cha` — B, K
- **B:** Equipment/quantity reconciliation fails: 16 cups (4 qt) of noodle water in the listed 4-quart pot. A 4-quart pot cannot hold 4 quarts of water at a boil (plus the food) without boiling over.  
  **Fix:** Change equipment to a 6- to 8-quart pot, or cut the water to 12 cups (3 qt) and update the water ingredient line and the step text to match.
- **K:** Creator-flagged and confirmed: two large flat patties read as steak/burger. Bún chả needs several small grilled pork patties.  
  **Fix:** Regenerate with 4-6 small round charred patties (~2 in across, 1/2 in thick) per bowl plus pork-belly slices, half-submerged in the nuoc cham, with vermicelli and herbs on the side.

### `xian-cumin-lamb-stir-fry` — B, E
- **B:** Ingredient prep note says the lamb is 'partly frozen 15 minutes' for slicing, but no step performs it.  
  **Fix:** Either add the freeze to step 1 ('Freeze the lamb 15 minutes, then slice 1/8 inch...') or change the ingredient to 'thin-sliced lamb (store-bought hot-pot slices) or lamb shoulder sliced 1/8 inch' and drop the freeze.
- **E:** The 15-minute partial freeze is absent from the clock, so total time under-reports by ~15 minutes if the cook follows the ingredient note.  
  **Fix:** If the freeze stays, count it (prep +15; total about 37 min) and update time_clock/time_reconstruction; if store-bought slices are offered, no clock change needed.

## Curator concerns, evaluated

- **Long cook times.** Not a gate failure by itself. Each long meal is labelled with accurate totals (feijoada, ropa vieja, beef noodle soup, ghormeh sabzi, khachapuri rise). E failures are clock-reconstruction errors only: chiles rellenos and Xi'an lamb. Gyudon's issue is the false "20-minute" promise (J).
- **Feijoada as the 4th black-bean dish.** It's actually the **5th**. The live base has 3 (quesadillas, chipotle bowls, grilled-peach burrito bowl), the arepas make 4, and feijoada 5. selection-rationale.md undercounts. Gate I PASSes because it isn't a duplicate (smoked-pork stew with farofa and greens), but it's a wave-level cluster to manage.
- **Spanakopita and galette both pastry.** Gate I PASS for both: phyllo with spinach-feta vs. short-crust with tomato and goat cheese. This is a cluster note only. Spanakopita still FAILs K for the invented red onion.
- **Laksa as the 4th coconut dish.** Gate I PASS. Coconut has no importer token. It's disclosed in the notes, consistent with the accepted moqueca precedent. Recommend an importer token, or a wave rule requiring a coconut note on every coconut meal.
- **Käsespätzle vs. the rejected mac and cheese.** Not a duplicate: egg dumplings, caramelized onions, Alpine cheese, no béchamel. Gate I PASS. It does occupy the same comfort slot, so the curator should accept that knowingly. Also tighten the vegetarian claim by specifying microbial-rennet Gruyère.
- **D-03 band mismatch.** The repo contract (factory/PACKAGE.md: ≤12 / 13–16 / 17+) governs, and all 50 sidecars are consistent with it. Under the design draft (`/workspace/d03-design/DESIGN-DRAFT.md:99`: ≤8 / 9–14 / ≥15), 10 meals would shift. Koshari, French onion soup, khachapuri, gyudon, suya, krupnik, ceviche and Xi'an lamb would go simple→standard. Couscous and Swedish meatballs would go standard→adventurous. Not a gate fail; the bands need a decision before the draft is adopted.
- **Raw fish in the ceviche.** G PASS: there's a hard contract for sashimi-grade, previously frozen fish, plus a pregnancy/immunocompromised note. It FAILs K only.
- **Alcohol (brandy, mirin, sake).** Notes are present on steak au poivre, gyudon and shogayaki. PASS.
- **Peanuts in the suya.** Correct: `peanut` token, nut_policy `peanuts_present`, HH001 false. PASS.
- **Coconut has no allergen code.** This is an importer gap, not a package fail (see laksa above).
- **Barley gluten in the krupnik.** No gluten token exists and no gluten_free label is claimed, so it PASSes. Recommend an explicit "contains gluten (barley)" note and logging the gap at importer level.
- **Allergen/diet safety.** The three wrong "safe" claims are G FAILs: Philly rolls (soy/egg), bobotie bread (soy), and feijoada sausage (conditional note). The other 47 match their ingredients.
- **HH001 (Tom & Renata).** 20/50 claim eligibility, and every claim matches the booleans: no dairy, no shellfish, no meat other than fish, no poultry, nuts none or cashews_only_ok with a contract. None of the 20 is among the G FAILs. coverage.md shows 0 in its HH001 table, which is a bug; the real count is 20.

## Wave-level issues

1. The systemic M/O defect above (generators plus a freeze-tool blind spot).
2. Stale wave docs. WAVE.json still says status `authored_author_r1_images_pending` and freeze_integrity "FAIL 50/50" (the actual result is PASS). curator-notes.md still describes the images as missing. coverage.md's HH001 table is all zeros (should be 20/50).
3. Rationale contradictions. selection-rationale.md calls feijoada "one of 4 black-bean dishes" (it's the 5th). rejected.md says lentil leads are closed, yet koshari is lentil-primary.
4. Clusters. About 10 of the 50 are soups (a new cluster), 5 meals are black-bean, 4 are coconut, and 2 are pastry. Diversity is acceptable, but the curator should note it in coverage.md.
5. Pot sizing. One template error repeats across 5 meals: 4 qt of water specified in a 4-quart pot. Check the authoring template.
6. Importer gaps: no coconut or gluten token. Document both, or add tokens.

## Non-blocking notes (by meal)

- `brazilian-feijoada`: N: 'cassava flour' in US stores may be fine tapioca-style flour, not farinha de mandioca torrada; name the product.
- `burmese-mohinga-fish-noodle-soup`: E: water-boil time tight.
- `chicken-andouille-gumbo`: K: broth a little light for mahogany roux; acceptable.
- `egyptian-koshari`: I: rejected.md says lentil leads are closed but koshari is lentil-primary with a lentils tag; curator should reconcile the rationale (not a duplicate: layered rice-lentil-macaroni with tomato and dakka).
- `filipino-fish-sinigang`: K: broth slightly turbid/orange rather than clear amber; still reads sinigang.
- `georgian-adjaruli-khachapuri`: G: runny-yolk note present. K: only the yolk is visible (recipe bakes a whole egg until the white is just set); acceptable, consider showing set white.
- `greek-gemista-stuffed-vegetables`: K: peppers shown without lids; tomatoes lidded. Not blocking.
- `greek-spanakopita`: I: pastry overlap with the galette is a cluster concern only (phyllo/spinach-feta vs short-crust/tomato-goat cheese).
- `hungarian-chicken-paprikash`: K: a sour-cream dollop is on top (sour cream is in the recipe but only whisked into the sauce; brief lists parsley/paprika only). Not blocking.
- `japanese-gyudon`: G: mirin alcohol note present.
- `kasespatzle-caramelized-onions`: G: vegetarian label sits next to an animal-rennet note for Gruyère; specify 'microbial-rennet Gruyère' as the galette does for Parmesan, or the vegetarian claim is weak. I: not a duplicate of the rejected mac and cheese (egg dumplings, onions, Alpine cheese, no béchamel), but same comfort slot.
- `malaysian-curry-laksa`: G: coconut disclosed in notes only (no token exists); consistent with the accepted moqueca precedent. HH001 not claimed (shellfish).
- `moroccan-seven-vegetable-couscous`: B/J: vessel for boiling the couscous water unstated; methods token 'steam' does not match the pour-over method.
- `nigerian-beef-suya-skewers`: G: peanut token present and nut_policy peanuts_present; correct.
- `oven-bbq-baby-back-ribs`: J: deriveCookingMethod tags crispy_non_fry `baked` from the phrase 'crisp pickles'; suggest 'crunchy pickles' so the cooking metadata is not driven by the side.
- `pan-seared-halibut-lemon-butter-corn`: G/D: doneness 130-135 F is below FDA 145 F for fish; acceptable chef practice but consider adding '145 F for USDA guidance'.
- `peruvian-ceviche-sweet-potato-corn`: G: sashimi-grade, previously frozen fish contract plus pregnancy/immunocompromised raw-fish note; PASS.
- `polish-mushroom-barley-krupnik`: G: barley gluten has no importer token (no gluten token exists); no gluten_free label is claimed, so PASS. Recommend a 'contains gluten (barley)' allergen note and a wave-level importer gap entry.
- `pork-shogayaki`: G: mirin/sake alcohol note present.
- `slow-cooker-ropa-vieja`: K: olive rings shown without pimento; brief asked pimento-stuffed halves. Not blocking.
- `spanish-sopa-de-ajo-egg`: G: runny-yolk note present.
- `steak-au-poivre-smashed-potatoes`: G: brandy alcohol note present. K: three to four smashed potatoes visible vs brief 4-5; acceptable.
- `taiwanese-beef-noodle-soup`: E: water-boil time tight. K: noodles read medium rather than thick; acceptable.
- `tomato-goat-cheese-galette`: G: microbial-rennet Parmesan specified; good.
- `turkey-sloppy-joes`: F/G: bun contract covers milk but not egg; add egg to the contract for completeness.
- `venezuelan-black-bean-plantain-arepas`: E: 5-minute prep is optimistic for mixing/shaping dough; tolerable.

## Files

- `/workspace/flavorweave-catalog-factory/wave-14/audit/AUDIT-r1.md` (this file)
- `/workspace/flavorweave-catalog-factory/wave-14/audit/AUDIT-r1.json`, shaped `{slug: {verdict, gates:{A..O, K/L1/L2/L}, fixes:[...]}}`
- `/workspace/flavorweave-catalog-factory/wave-14/audit/<slug>.md`: 50 per-candidate audits in wave-13 format
