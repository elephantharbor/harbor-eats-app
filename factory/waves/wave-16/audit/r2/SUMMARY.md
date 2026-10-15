# Wave-16 audit r2 — SUMMARY

Independent auditor, 2026-10-15 CT. Re-audit after the author-r3 text-only revision of 5 packages. Packages not edited; nothing imported; D1 and the repo untouched.

**Combined status: 15/15 certified (2 PASS, 13 PASS WITH NOTES), 0 FAIL.** 5 packages re-judged in full (A–O); 10 carried from r1 on byte identity. No image regeneration required.

## Verification

- **10 unchanged packages:** recursive diff against the author-r2 backup tarball (the frozen state audited in r1; its sha256 matches the 16:49 SHA256SUMS file) and the pre-r3 tarball: identical, every file including the preflight and freeze reports. My own r1 working copies match on all content files. `notes/pre-r3-file-hashes.sha256` also verifies for all 10. r1 verdicts carry over.
- **5 revised packages:** my own field-by-field JSON diff (r2 tarball → current) matches the handoff with no undisclosed changes. Image files are absent from the diff. culinary_hash recomputed and matches the field and revision_history. Step clocks re-summed. Revision `author-r3` everywhere. Freeze integrity 26/26 PASS (both tools) and structural preflight PASS, re-run on copies. certification still null.

| Slug | Revision | r1 | r2 / combined |
|---|---|---|---|
| `austrian-pork-schnitzel-potato-salad` | author-r3 | PASS WITH NOTES | PASS WITH NOTES |
| `cambodian-fish-amok` | author-r3 | FAIL (B) | PASS WITH NOTES |
| `cuban-picadillo-rice` | author-r3 | PASS WITH NOTES | PASS WITH NOTES |
| `goan-shrimp-ambot-tik` | author-r2 | PASS | PASS (carried) |
| `hawaiian-ahi-poke-bowl` | author-r2 | PASS WITH NOTES | PASS WITH NOTES (carried) |
| `indonesian-gado-gado-tempeh` | author-r2 | PASS WITH NOTES | PASS WITH NOTES (carried) |
| `jamaican-escovitch-snapper` | author-r3 | FAIL (B, C) | PASS WITH NOTES |
| `korean-japchae-vegetables` | author-r2 | PASS | PASS (carried) |
| `persian-sabzi-polo-salmon` | author-r2 | PASS WITH NOTES | PASS WITH NOTES (carried) |
| `russian-mushroom-stroganoff` | author-r2 | PASS WITH NOTES | PASS WITH NOTES (carried) |
| `sichuan-mapo-tofu-shiitake` | author-r2 | PASS WITH NOTES | PASS WITH NOTES (carried) |
| `sicilian-pasta-alla-norma` | author-r2 | PASS WITH NOTES | PASS WITH NOTES (carried) |
| `southern-shrimp-and-grits` | author-r2 | PASS WITH NOTES | PASS WITH NOTES (carried) |
| `thai-yum-nua-beef-salad` | author-r2 | PASS WITH NOTES | PASS WITH NOTES (carried) |
| `turkish-mucver-zucchini-fritters` | author-r3 | FAIL (B) | PASS WITH NOTES |

## Decisions on the points raised

- **Escovitch oil (1/2 cup, 'thin layer, about 1/8 inch'):** the arithmetic gives ≈0.09–0.10 in (≈3/32–1/10) over a 12-inch skillet's 9.5–10 in base. **Acceptable.** Quantity, heat, step 4, scaling and do-not-scale now state one consistent figure, 'about' covers a ~20–25% shortfall, and a thin layer suits dredged fillets. r1 failed a 2.5x gap against '1/4 inch'. Optional wording: 'a scant 1/8 inch'.
- **Schnitzel fallback (~12 min, not in the total):** **does not matter for certification.** It is a conditional path, and the extra time is stated at the point of use; the default clock (50 min) is accurate. Unlike the Wave-15 freeze FAILs, this is not a mandatory main-path step dropped from the clock. Notes: optionally show '(about 62 minutes if you make the crumbs)'; add the food processor to equipment as fallback-only; ~6 oz of bread is borderline for 1 1/2 cups of fine crumbs (7 oz gives margin).
- **Amok hero (2 ramekins) vs 6 ramekins, 1–2 per diner:** **consistent.** Two ramekins with rice reads as one diner's serving under '1 or 2 per person'. No regen. Note: 6 for 4 averages 1.5 each, so the plates are unequal; optional wording '1 1/2 per person, or 1 each with two to share'.
- **Amok capacity and fit:** 6 × 10 oz ≈1.77 L for ≈1.35 L of mix plus topping ≈77% full; three 4-in ramekins need ≈8.6 in, within an ≈11 in usable 12-inch bamboo tier; the steamer seats in a 14-inch wok with the water below it. r1 B FAIL resolved. Note: check and top up the water at the tier swap.
- **Mücver:** 2/3 cup per batch ≈0.12–0.14 in, matching the stated 1/8 inch; clock 48 reconciles. The dill now stirred into the yogurt makes the hero's flecked yogurt exact (r1 K note resolved).
- **Picadillo:** label rules are now on the ingredient lines (r1 note closed). New note: 'tomatoes and salt only' and the olive rule are stricter than most US shelf products (citric acid; alginate/guar pimiento paste). Consider loosening to the allergen-relevant rule.

## Remaining notes (non-blocking)

- `austrian-pork-schnitzel-potato-salad`: E: optionally append '(about 62 minutes if you make the crumbs)' to time_clock/README so the total shows both paths. Non-blocking.
- `austrian-pork-schnitzel-potato-salad`: B/D: the fallback needs a food processor, which is not in the equipment list. Add 'food processor (only for the homemade-crumb fallback)', or allow a box grater. About 6 oz of day-old bread dries to roughly 1 1/4-1 1/2 cups of fine crumbs, so it's borderline; 'about 7 oz' would give margin. Keep the crumbs pale when drying, since toasted crumbs brown fast in the fry. All non-blocking.
- `austrian-pork-schnitzel-potato-salad`: B (carried): 2 cups oil ≈3/8 inch vs 'about 1/4 inch'; surplus, non-blocking. G: mustard disclosed.
- `cambodian-fish-amok`: C/serving: 6 ramekins for 4 servings averages 1.5 per person, so '1 or 2 ramekins per person' means unequal plates. Optional wording: 'serve 1 1/2 ramekins per person, or 1 each with the extra two to share'. Non-blocking.
- `cambodian-fish-amok`: E: about 29 minutes at a boil with 4 cups of water in the wok is fine, but suggest 'check the water when you swap the tiers and top up with boiling water if needed'. Non-blocking.
- `cambodian-fish-amok`: K (carried from r1): the green garnish reads as thicker green-bean/scallion lengths than slivered lime leaf, and the custard surface is grainy. Identity reads; the text was correctly not changed to match the image.
- `cambodian-fish-amok`: G: coconut disclosed (no importer token); fish-sauce contract unchanged and HH001 still valid.
- `cuban-picadillo-rice`: N/F: as hard rules on the ingredient lines, both are stricter than the allergen boundary needs, and stricter than most US shelf products. Typical canned tomato sauce adds citric acid, spices or natural flavour; most pimiento-stuffed olives use pimiento paste with sodium alginate/guar gum and lactic acid. Consider loosening to the allergen-relevant rule, e.g. 'label lists no wheat, milk, soy, fish or nuts', so shoppers aren't blocked. Non-blocking.
- `cuban-picadillo-rice`: K (carried, not addressed): olives are sliced rings rather than halved; still reads. Acceptable.
- `hawaiian-ahi-poke-bowl`: G/N: the 'previously frozen for parasite control' wording is harmless but not required for tuna (FDA exempts tuna from the parasite-freeze guidance); consider 'sold for raw consumption' alone. E: 5-minute rice rest fine.
- `indonesian-gado-gado-tempeh`: I: third peanut-sauce meal in the catalog (with malian maafe and the peanut noodle bowl); distinct dish. G: peanut token correct; tempeh grain contract present.
- `jamaican-escovitch-snapper`: B: if you want the wording exact, 'a thin layer, a scant 1/8 inch' matches the arithmetic. Optional; non-blocking.
- `jamaican-escovitch-snapper`: K (carried from r1): Scotch bonnet rings read like seeded banana-pepper rings; only a sliver of red skin shows. Non-blocking.
- `persian-sabzi-polo-salmon`: K: rice grains look shorter than long basmati and the plate is round rather than oval; still reads as sabzi polo with crispy-skin salmon. Non-blocking.
- `russian-mushroom-stroganoff`: F: broth contract ('vegetables, salt, herbs only') plausible. G: mustard disclosed.
- `sichuan-mapo-tofu-shiitake`: Brief says 'silken'; the recipe uses soft or medium tofu; the image is consistent with soft tofu. E: rice timing exact (29 vs 29 min). Cosmetic.
- `sicilian-pasta-alla-norma`: E: the rigatoni water boils ~1 minute into step 4 and the pasta finishes ~1 minute into step 6; slight overrun, tolerable. F: ricotta salata 'made with microbial or vegetable rennet' is hard to verify (ricotta salata is whey-based; vegetarian status depends on the source cheese's rennet). Keep the contract but expect few labels to state it.
- `southern-shrimp-and-grits`: B/E: 1 1/2 lb large shrimp in one layer in a 12-inch skillet is tight; tolerable. I: one of two shrimp meals in the wave (with ambot tik); distinct.
- `thai-yum-nua-beef-salad`: K: lettuce reads as romaine on close inspection (ribs, elongated leaves); the heavy crinkle is the only cabbage-like cue. Round plate vs the brief's oval platter is vessel shape only. Both non-blocking; no regen required.
- `thai-yum-nua-beef-salad`: E/B: two 3/4-lb flank halves side by side in a 12-inch skillet (~10 in base) is tight; may need to sear one at a time on a smaller skillet. Tolerable.
- `thai-yum-nua-beef-salad`: G: fish sauce tokenized finfish; no fish label needed beyond the token.
- `turkish-mucver-zucchini-fritters`: B: batch 2 adds a fresh 2/3 cup to whatever oil is left after batch 1, so the second batch runs slightly deeper than 1/8 inch (more oil, not less; safe direction). Non-blocking.
- `turkish-mucver-zucchini-fritters`: K: a few dark specks in the yogurt (pepper-like) remain; trivial. E: six 3.5-inch fritters per batch in a 12-inch skillet is still tight (carried).

Per-meal r2 records for the 5 revised packages: `<slug>.md`. Machine-readable combined status: `AUDIT-r2.json`. r1 records for the other 10: `../r1/`.
