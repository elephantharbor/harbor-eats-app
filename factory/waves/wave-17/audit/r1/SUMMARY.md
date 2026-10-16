# Wave-17 independent audit, round 1 (2026-10-15 CT)

Scope: 50 frozen packages (`author-r2`), catalog 200 → 250. Followed the flavorweave-catalog-certification standard: binary PASS/FAIL gates A–O, with K, L1, L2 and L reported separately, eligibility and allergens reported separately, and D-03 under A and J. I viewed every hero at full size and cropped where needed. Packages were not edited; D1 and the app repo were read-only; no import, PR, deploy or cloud agent.

## Counts
- **PASS 42 / FAIL 8** of 50.
- Failing gates: B ×4, K ×4, H ×1 (pupusas fail both B and K).
- Image work needed: pupusas, ca kho, chivito (regenerate); ema datshi (regenerate, or change the recipe to match the image).

## FAILs and fixes
| Meal | Gate | Defect | Fix |
|---|---|---|---|
| argentine-beef-empanadas | B | ~4 cups filling vs 16 × "about 2 tbsp" (~2 cups) | "about 3 tbsp each" and trim to 3/4 lb beef + 1 onion, or make 24 and re-time |
| polish-potato-cheese-pierogi | B | ~4–4.5 cups filling vs 36 × heaping tsp (~1.5 cups); 3 cups flour at 1/16 in ≈ 60 rounds, not 36 | Halve the filling, use a level tbsp, roll 1/8 in; or make ~60 at 1/16 in in 5 batches and re-time |
| salvadoran-bean-cheese-pupusas | B, K | ~3 cups mix vs 8 × 3 tbsp (~1.5 cups); bean type not named. Hero filling dark and chunky (reads as meat/chicharrón); curtido looks like creamy slaw | 1 cup beans + 4 oz mozzarella (or 16 pupusas and re-time); name the bean; regenerate with smooth bean purée and translucent vinegar curtido |
| swedish-pytt-i-panna | B | 2 lb of 1/2-in dice (~100 sq in) "in one layer, never crowd" in a 12-in skillet (~71–78 sq in floor) | 1 1/2 lb potatoes, or brown in 2 batches (+~10 min) / two skillets |
| vietnamese-ca-kho-catfish | K | Hero: ~7 thick skin-on cross-cut steaks; recipe: ~14 skinless fillet pieces (2 × 2 1/2 in) | Regenerate with skinless rectangular fillet pieces; or rewrite the recipe for skin-on steaks |
| bhutanese-ema-datshi | K | Hero: whole halved chiles with stems; recipe stems them and cuts 1/2-in strips | Change the recipe to halved chiles with stems on (description, step 1); or regenerate stemless strips that clearly read as chiles |
| uruguayan-chivito-sandwiches | K | Hero steak ~1/2–3/4 in, rosy medium-rare; recipe 1/4 in to 145 F | Regenerate with a thin steak cooked to medium (faint blush at most); put olives inside the sandwich |
| yucatecan-tikin-xic-fish | H | "smoky" tag; foil-baked, nothing smoked or charred | Remove "smoky" (metadata only; hash unaffected); or add a real char step |

## Handoff items: my rulings
- **Ca kho, skin-on steaks vs skinless fillets:** K FAIL.
- **Ema datshi, halved chiles with stems vs strips:** K FAIL.
- **Pupusas, bean type and texture:** K FAIL (texture reads as meat); B FAIL on quantity; the bean type should also be named in the text.
- **Chivito, thickness and pinkness:** K FAIL.
- **Lu rou fan, mince vs dice:** PASS. The pork is a mix of chunks and finer bits, which is consistent with 1/2-in diced belly after a 50-minute braise.
- **1.25x upscaled masters:** L1 PASS for all 50. Each master re-derives as a LANCZOS 1.25x upscale of the centre 960×720 crop (mean diff 1.4–2.3), it is disclosed in method_detail, and there is no objectionable softness at master or card size.

## Mechanical checks (all 50 clean)
- Freeze integrity 26/26 and structural preflight both pass when re-run on copies.
- Image SHA-256 values match. Masters are 1200×900, cards 640×480, sources 1280×720.
- The superseded and regeneration records are consistent.
- culinary_hash recomputes. Step clocks sum. D-03 sums, floors and bands recompute.
- Every ingredient is used. No allergen appears only in the notes. No conditional dietary claim.
- HH001 contracts check out: 17 true.

## Duplicate check: PASS (no duplicates)
- Each meal was compared with the other 49 and with all 200 live meals (notes/existing-200.tsv; harbor-eats-app main 077bd14, read-only).
- Methods: slug collisions (none), title-token similarity (maximum 0.36), shared dish-name keywords, and primary protein/format, plus a recipe-level review of flagged pairs.
- Every flagged pair is distinct. The full pair list is in AUDIT-r1.json under `duplicate_check`. Pairs reviewed:
  - In-wave: pupusas/rajas, avgolemono/dumplings, keema/cevapi/arayes, saganaki/cioppino, ca kho/lu rou fan.
  - Against live meals: bourguignon/stroganoff, tinga/enchiladas verdes, chicken tagine/chermoula fish tagine, dan dan/peanut-noodle-stir-fry, chivito/philly cheesesteaks, and others.

## Files
- `audit/r1/<slug>.md` ×50: per-gate evidence, fixes, notes.
- `audit/r1/AUDIT-r1.json`: verdicts, failed gates, fixes, notes, counts, duplicate check.
- No raw image-prompt text is reproduced.
