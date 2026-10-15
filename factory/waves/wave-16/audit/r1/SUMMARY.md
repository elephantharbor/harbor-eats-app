# Wave-16 audit r1 — SUMMARY

Independent auditor, 2026-10-15 CT. 15 candidates (catalog 185 → 200), frozen at `author-r2`. Gates A–O per flavorweave-catalog-certification SKILL.md. Packages not edited; nothing imported; D1 and the repo untouched. Every hero master viewed at full size (yum nua also in crops).

**Counts:** 12 certified (2 PASS, 10 PASS WITH NOTES), 3 FAIL. Image regenerations required: 0.

Integrity: freeze integrity re-run on copies 15/15 PASS (26/26 each, both tool versions); structural preflight re-run 15/15 PASS (HH001 = 6). Hashes match file_hashes, image-state.json and image-gen-map.txt. D-03 sidecars recompute.

| Slug | Verdict | Failed gates |
|---|---|---|
| `austrian-pork-schnitzel-potato-salad` | PASS WITH NOTES | — |
| `cambodian-fish-amok` | FAIL | B |
| `cuban-picadillo-rice` | PASS WITH NOTES | — |
| `goan-shrimp-ambot-tik` | PASS | — |
| `hawaiian-ahi-poke-bowl` | PASS WITH NOTES | — |
| `indonesian-gado-gado-tempeh` | PASS WITH NOTES | — |
| `jamaican-escovitch-snapper` | FAIL | B, C |
| `korean-japchae-vegetables` | PASS | — |
| `persian-sabzi-polo-salmon` | PASS WITH NOTES | — |
| `russian-mushroom-stroganoff` | PASS WITH NOTES | — |
| `sichuan-mapo-tofu-shiitake` | PASS WITH NOTES | — |
| `sicilian-pasta-alla-norma` | PASS WITH NOTES | — |
| `southern-shrimp-and-grits` | PASS WITH NOTES | — |
| `thai-yum-nua-beef-salad` | PASS WITH NOTES | — |
| `turkish-mucver-zucchini-fritters` | FAIL | B |

## Failures and required fixes

### cambodian-fish-amok
- [B] Pick one consistent setup and make equipment, steps 3-4, the time clock and scaling match it: (a) six 10-oz ramekins, or four 16-oz (2-cup) wide shallow heatproof bowls, so they are ≤~85% full with the topping; and (b) a steamer that holds them all at once: a two-tier 12-inch bamboo steamer over a 12- to 14-inch wok or wide pot, or a wide 7- to 8-quart pot with a flat rack. Or keep the 6-quart pot and steam in two batches, adding ~22 minutes to the clock and rice overlap. As an alternative to (a), cut the fish to 1 1/4 lb and recompute the scaling lines. Re-hash after the edits.

### jamaican-escovitch-snapper
- [B] Either change the oil ingredient line (and shopping list) to 1 1/4 cups neutral oil, or change the do-not-scale note (and any heat/food-safety text) to 'a thin layer, about 1/8 inch (1/2 cup in a 12-inch skillet)'. Re-hash after the edit.
- [C] Follows the B fix: once the depth and quantity agree, state the oil for the 10-inch skillet in the 1-2 serving line (≈3/4 cup at 1/4 inch, or ≈1/3 cup at 1/8 inch).

### turkish-mucver-zucchini-fritters
- [B] Either change the oil to 2/3 cup per batch (1 1/4 cups total; update the neutral-oil ingredient line, step 5 text and shopping list), or change the HEAT and food-safety text to 'a thin film of oil, about 1/16 inch (1/4 cup per batch)'. Re-hash after the edit.

## Focus items

- **Yum nua lettuce / plate:** on close crops the leaves are elongated with pale central ribs and read as romaine (heavier crinkle than ideal, no napa/savoy cues). Round plate vs the brief's oval platter is vessel shape only. K PASS with notes; no regen.
- **Mücver yogurt:** visible green herb flecks in a yogurt the recipe makes with garlic and salt only. The herbs are in-recipe (scattered over the plate), so this is non-blocking per the Wave-14 paprikash precedent. Recommended: add 'stir 1 tbsp of the dill into the yogurt' when making the B oil fix. (Mücver fails on B, not K.)
- **1.25x upscaled masters:** all 15 masters re-derive as LANCZOS 1.25x of the centre 960x720 crop, disclosed in method_detail, same pipeline as Waves 14–15; no objectionable softness. Note only.
- **Raw tuna / medium-rare:** poke copy is good (sold for raw consumption, keep cold, same day, vulnerable-group warning); 'previously frozen for parasite control' is unnecessary for tuna but harmless. Yum nua 130 F diner's-choice copy cites USDA 145 F + 3-min rest. Both PASS.
- **Mustard / coconut:** no importer tokens. Dijon disclosed in allergen notes for schnitzel and stroganoff; coconut disclosed for amok. Consistent with Wave-15 handling. PASS.
- **Store-bought label assumptions:** all compound items carry hard contracts. Notes: schnitzel breadcrumbs 'wheat flour, yeast, salt only' are hard to find in US stores (add a homemade-crumb fallback); norma ricotta salata microbial-rennet rule is hard to verify; picadillo tomato-sauce/olive rules live only in allergen notes. Fish sauce (amok, yum nua), doubanjiang, sweet-potato noodles, feta and broth contracts are plausible.

## Duplicates

No slug collisions with the 185 existing (135 live + 50 Wave-15) or within the wave. No true duplicates; closest pairs (mapo vs soft-tofu stew, poke vs ceviche/niçoise, picadillo vs ropa vieja, escovitch vs veracruzana, shrimp & grits vs shrimp boil, yum nua vs larb, gado-gado vs niçoise, stroganoff vs paprikash) are distinct dishes. Clusters noted: two shrimp meals in the wave; gado-gado is the catalog's third peanut-sauce meal.

Per-meal records: `<slug>.md`. Machine-readable: `AUDIT-r1.json`.
