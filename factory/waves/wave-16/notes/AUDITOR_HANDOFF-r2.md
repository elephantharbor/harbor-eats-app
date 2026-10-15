# Wave-16 auditor handoff r2

This handoff is for an independent re-audit after audit r1 (`audit/r1/`). **Nothing in this wave is certified.** Nothing has been imported, published, or deployed, D1 has not been touched, and no pull request exists. Every package still has `certification: null`, `auditor: null`, and `kitchen_tested: false`.

## Scope

- Five packages were revised to `author-r3` as text-only changes. **No image was regenerated**, and every source, master, card and rejected file is byte-identical to r2.
  - Three fixed the audit r1 FAILs: `cambodian-fish-amok`, `jamaican-escovitch-snapper`, `turkish-mucver-zucchini-fritters`.
  - Two applied the optional audit r1 notes: `austrian-pork-schnitzel-potato-salad`, `cuban-picadillo-rice`.
- The other ten packages are unchanged at `author-r2`. Every file in those candidate directories, the preflight reports included, is byte-identical to the pre-r3 snapshot (`notes/pre-r3-file-hashes.sha256`).
- Each revised `v1.json` carries a `revision_history` entry: from/to revision, trigger, the r2 and r3 `culinary_hash`, and the change list.

## Checks after the revision (mechanical only, not an audit)

- Structural preflight: 15/15 PASS (`notes/structural-r6.log`).
- Freeze integrity: 15/15 PASS, 26/26 checks each (`notes/freeze-r6.log`).
- `tools/mark_preflight.py`: 10 at `author_r2_preflight_pass_awaiting_vale`, 5 at `author_r3_preflight_pass_awaiting_vale`. Both preflights were re-run afterwards.
- Image hashes: all 15 active sources, masters and cards, plus the 3 rejected v1 files, match `image.file_hashes` and `notes/image-gen-map.txt`.
- Builder guards (pot size and water, boil-up time, untimed waits, counted equipment in scaling, description words, step clocks, props, near-duplicates) pass. All 15 v1 prompts still rebuild byte-for-byte to the prompts the heroes were made from.
- Backups: `/workspace/wave16-backups/wave-16-pre-r3-20261015-1657.tar.gz` (before the edits) and a post-r3 tarball (see SHA256SUMS files).

## cambodian-fish-amok

Trigger: audit r1 gate B FAIL. `culinary_hash` `3b53ef3ac394b09a…` → `f942451e0ebd1da7…`. Time: 21+32=53 → 22+32=54 min. D-03: moderate/standard → moderate/standard.

Summary:

- Vessels: 4 (12-ounce) ramekins replaced by 6 (10-ounce) ramekins, each filled about three-quarters (a scant 1 cup of the ~1.3 L mix), so the custard has room to puff with the topping.
- Steamer: 6-quart pot and collapsible basket replaced by a two-tier 12-inch bamboo steamer (3 ramekins per tier) over a 14-inch flat-bottomed wok with 4 cups water; all six steam at once, tiers swapped after 11 minutes.
- Steps 3 and 4 rewritten to match; step 3 clock 4 -> 5 minutes (prep 21 -> 22, total 53 -> 54). Step 4 clock unchanged at 30; rice overlap unchanged.
- Topping: the reserved 1/4 cup coconut cream is divided over six custards (about 2 tsp each); serve step says 1 or 2 ramekins per person and lifts them with tongs.
- Heat, food-safety, effort note, and 1/2/4-serving scaling lines and do-not-scale notes updated for 10-ounce ramekins and the bamboo steamer.
- Garnish wording unchanged: the recipe garnish is slivered makrut lime leaf and sliced chile, as before.

Field diff (r2 → r3):

- **heat**
  - r2: 6-quart pot with a steamer basket over high to boil, then medium for a steady steam. 2-quart saucepan covered on low for the rice.
  - r3: 14-inch wok (6-quart) with 4 cups water over high to boil, then medium for a steady steam under a two-tier 12-inch bamboo steamer. 2-quart saucepan covered on low for the rice.
- **food_safety_note**
  - r2: Cook fish to 145 F. Lift the hot ramekins out of the steamer with tongs or a towel.
  - r3: Cook fish to 145 F. Lift the steamer lid away from you, and lift the hot ramekins out with tongs or a towel.
- **equipment**
  - r2: 6-quart pot with lid; collapsible steamer basket; 4 (12-ounce) ramekins; 2-quart saucepan with lid; food processor or mini chopper; mixing bowl
  - r3: two-tier 12-inch bamboo steamer with lid; 14-inch flat-bottomed wok (6-quart) that the steamer sits in; 6 (10-ounce) ramekins, about 4 inches across; 2-quart saucepan with lid; food processor or mini chopper; mixing bowl; tongs
- **step 3 (Mix and fill)**, clock 4 → 5
  - r2: In a mixing bowl whisk the rest of the coconut milk, the eggs, fish sauce, brown sugar, and the kroeung. Fold in the fish. Line 4 ramekins with the spinach and divide the fish mixture among them.
  - r3: In a mixing bowl whisk the rest of the coconut milk, the eggs, fish sauce, brown sugar, and the kroeung. Fold in the fish. Line 6 ramekins with the spinach and divide the fish mixture among them, a scant 1 cup each, so each is about three-quarters full. Set 3 ramekins in each tier of the bamboo steamer.
- **step 4 (Steam the custards)**, clock 30 → 30
  - r2: Put 4 cups water in a 6-quart pot fitted with the steamer basket, cover, and bring to a boil over high, about 6 minutes to come to a boil. While it heats, start the rice: combine the rice, 2 1/4 cups water, and 1/2 tsp salt in a 2-quart saucepan, bring to a boil over high, about 4 minutes, cover, cook on low 15 minutes, then leave it covered off the heat 10 minutes (overlap stated). Set the ramekins in the basket, cover, and steam over medium until the custard no longer jiggles at the center and the fish reaches 145 F, about 22 minutes. Spoon the reserved coconut cream on top and steam 1 minute more.
  - r3: Put 4 cups water in a 14-inch wok (6-quart), cover, and bring to a boil over high, about 6 minutes to come to a boil; it must sit below the base of the bamboo steamer. While it heats, start the rice: combine the rice, 2 1/4 cups water, and 1/2 tsp salt in a 2-quart saucepan, bring to a boil over high, about 4 minutes, cover, cook on low 15 minutes, then leave it covered off the heat 10 minutes (overlap stated). Set the stacked two-tier steamer in the wok, cover with its lid, and steam over medium, swapping the tiers after 11 minutes, until the custard no longer jiggles at the center and the fish reaches 145 F, about 22 minutes. Spoon the reserved coconut cream over the six custards, about 2 tsp each, and steam 1 minute more.
- **step 5 (Serve)**, clock 2 → 2
  - r2: Lift out the ramekins, top with the slivered lime leaf and sliced chile, and serve with the rice.
  - r3: Lift out the ramekins with tongs, top with the slivered lime leaf and sliced chile, and serve with the rice, 1 or 2 ramekins per person.
- **scaling 1**
  - r2: 1 ramekin with a quarter of everything; steam it in the same pot and basket.
  - r3: A quarter of everything in 2 (10-ounce) ramekins, each about half full, in one tier of the bamboo steamer over the wok; start checking at 16 minutes. A quarter of the rice in a 1-quart saucepan.
- **scaling 2**
  - r2: 2 ramekins with half of everything; same pot and basket.
  - r3: Half of everything in 3 (10-ounce) ramekins, three-quarters full, in one tier of the bamboo steamer; about 22 minutes, no tier swap. Half the rice in a 1-quart saucepan.
- **scaling 4**
  - r2: As written (4 ramekins).
  - r3: As written (6 ramekins, three per tier, two tiers).
- **scaling do_not_scale**
  - r2: ['steaming time: about 22 minutes for 12-ounce ramekins however many are in the basket']
  - r3: ['fill: each 10-ounce ramekin about three-quarters full (a scant 1 cup of mix) so the custard can puff; use more ramekins, not fuller ones', 'steaming time: about 22 minutes for three-quarters-full 10-ounce ramekins; with both tiers in use, swap them halfway']

## jamaican-escovitch-snapper

Trigger: audit r1 gates B and C FAIL. `culinary_hash` `1c1ee55f033fbc08…` → `b3211dac4b00da9f…`. Time: 12+31=43 → 12+31=43 min. D-03: moderate/standard → moderate/standard.

Summary:

- Oil kept at 1/2 cup (a thin layer for pan-frying dredged fillets); the do-not-scale note changed from 'about 1/4 inch' to 'a thin layer, about 1/8 inch: 1/2 cup in a 12-inch skillet, about 1/3 cup in a 10-inch skillet'.
- Heat line and step 4 now state the 1/2 cup thin layer, about 1/8 inch.
- Scaling: 1 serving states about 1/3 cup oil in the 10-inch skillet; 2 servings state the full 1/2 cup in the 12-inch skillet.

Field diff (r2 → r3):

- **heat**
  - r2: 12-inch skillet over medium-high for the fish. 3-quart saucepan brought to a boil, then a brief simmer, for the escovitch. 2-quart saucepan covered on low for the rice.
  - r3: 12-inch skillet over medium-high with a thin layer of oil, about 1/8 inch (1/2 cup), for the fish. 3-quart saucepan brought to a boil, then a brief simmer, for the escovitch. 2-quart saucepan covered on low for the rice.
- **step 4 (Pan-fry the fish)**, clock 17 → 17
  - r2: Heat the oil in a 12-inch skillet over medium-high until shimmering, about 3 minutes. Dredge 2 fillets in flour, shake off the excess, and lay them in skin side down. Pan-fry until golden and crisp, about 4 minutes, flip, and cook until the fish flakes and reaches 145 F, 2 to 3 minutes. Drain on a rack and repeat with the other 2 fillets (2 batches).
  - r3: Heat the 1/2 cup oil in a 12-inch skillet (a thin layer, about 1/8 inch) over medium-high until shimmering, about 3 minutes. Dredge 2 fillets in flour, shake off the excess, and lay them in skin side down. Pan-fry until golden and crisp, about 4 minutes, flip, and cook until the fish flakes and reaches 145 F, 2 to 3 minutes. Drain on a rack and repeat with the other 2 fillets (2 batches).
- **scaling 1**
  - r2: One fillet in a 10-inch skillet in one batch; a quarter of the escovitch in a 1-quart saucepan; a quarter of the rice in a 1-quart saucepan.
  - r3: One fillet in a 10-inch skillet in one batch with about 1/3 cup oil (1/8 inch); a quarter of the escovitch in a 1-quart saucepan; a quarter of the rice in a 1-quart saucepan.
- **scaling 2**
  - r2: Two fillets in one batch in the 12-inch skillet; half the escovitch and rice.
  - r3: Two fillets in one batch in the 12-inch skillet with the full 1/2 cup oil (1/8 inch); half the escovitch and rice.
- **scaling 4**
  - r2: As written (2 batches).
  - r3: As written (1/2 cup oil, 2 batches).
- **scaling do_not_scale**
  - r2: ['oil depth: keep about 1/4 inch in the skillet for any batch']
  - r3: ['oil depth: a thin layer, about 1/8 inch, whatever the batch: 1/2 cup in a 12-inch skillet, about 1/3 cup in a 10-inch skillet']

## turkish-mucver-zucchini-fritters

Trigger: audit r1 gate B FAIL. `culinary_hash` `1e49f8d41cc7371c…` → `f8a2f157239511d8…`. Time: 25+21=46 → 25+23=48 min. D-03: involved/standard → involved/standard.

Summary:

- Oil: 1/2 cup total (1/4 cup per batch) -> 1 1/3 cups total, 2/3 cup per batch, which gives the stated ~1/8 inch in a 12-inch skillet; heat, food-safety, and step 5 text agree.
- Step 5 clock 19 -> 21 minutes (3 minutes to heat the first oil, about 1 minute for the second); cook 21 -> 23, total 46 -> 48.
- Garlic yogurt: 1 tbsp of the dill is stirred into the yogurt (matches the hero); dill raised from 1/3 to 1/2 cup (1 tbsp yogurt, 2 tbsp to scatter, the rest in the batter); description and yogurt component updated.
- Scaling: 1 and 2 serving lines state the oil (about 1/2 cup in a 10-inch skillet, 2/3 cup in the 12-inch); a do-not-scale oil-depth note added.

Field diff (r2 → r3):

- **description**
  - r2: Grated zucchini, squeezed dry and mixed with feta, scallions, dill, mint, eggs, flour, and red pepper flakes, shallow-fried into golden fritters. Served with cool garlic yogurt and a tomato, cucumber, and red onion salad dressed with lemon and olive oil.
  - r3: Grated zucchini, squeezed dry and mixed with feta, scallions, dill, mint, eggs, flour, and red pepper flakes, shallow-fried into golden fritters. Served with cool garlic yogurt flecked with dill and a tomato, cucumber, and red onion salad dressed with lemon and olive oil.
- **heat**
  - r2: 12-inch skillet over medium for shallow-frying, oil about 1/8 inch deep.
  - r3: 12-inch skillet over medium for shallow-frying, oil about 1/8 inch deep (2/3 cup per batch).
- **food_safety_note**
  - r2: Shallow-frying: keep the oil at about 1/8 inch, stay at the stove, and keep a lid nearby.
  - r3: Shallow-frying: keep the oil at about 1/8 inch (2/3 cup per batch in a 12-inch skillet), stay at the stove, and keep a lid nearby; let the oil cool before discarding.
- **ingredient dill**
  - r2: dill: 0.33 cup fresh dill
  - r3: dill: 0.5 cup fresh dill (1 tbsp yogurt, 2 tbsp to scatter, the rest in the batter)
- **ingredient neutral-oil**
  - r2: neutral-oil: 0.5 cup neutral oil (for shallow-frying)
  - r3: neutral-oil: 1.33 cup neutral oil (for shallow-frying, 2/3 cup per batch)
- **step 2 (Prep the rest)**, clock 12 → 12
  - r2: Crumble the feta, slice the scallions, and chop the dill and mint. Stir the garlic and 1/4 tsp salt into the yogurt. Dice the tomatoes and cucumber, slice the red onion, and juice the lemon.
  - r3: Crumble the feta, slice the scallions, and chop the dill and mint. Stir the garlic, 1 tbsp of the dill, and 1/4 tsp salt into the yogurt. Dice the tomatoes and cucumber, slice the red onion, and juice the lemon.
- **step 3 (Squeeze and mix)**, clock 5 → 5
  - r2: A handful at a time, wring the zucchini very dry in a clean towel and drop it into the large bowl. Mix in the feta, scallions, all but 2 tbsp each of the dill and mint, the eggs, flour, and pepper flakes to a thick, spoonable batter.
  - r3: A handful at a time, wring the zucchini very dry in a clean towel and drop it into the large bowl. Mix in the feta, scallions, the remaining dill and mint except 2 tbsp of each, the eggs, flour, and pepper flakes to a thick, spoonable batter.
- **step 5 (Shallow-fry the fritters)**, clock 19 → 21
  - r2: Heat 1/4 cup neutral oil in a 12-inch skillet over medium until it shimmers, about 2 minutes. Drop in 6 mounds of batter, 1/3 cup each, and flatten to 3 1/2-inch rounds. Cook until deep golden and set through, turning once, about 8 minutes per batch. Drain on a rack and repeat with the remaining oil and batter (2 batches, 12 fritters).
  - r3: Heat 2/3 cup neutral oil (about 1/8 inch) in a 12-inch skillet over medium until it shimmers, about 3 minutes. Drop in 6 mounds of batter, 1/3 cup each, and flatten to 3 1/2-inch rounds. Cook until deep golden and set through, turning once, about 8 minutes per batch. Drain on a rack. Add the remaining 2/3 cup oil, heat it about 1 minute, and shallow-fry the rest of the batter (2 batches, 12 fritters).
- **scaling 1**
  - r2: A quarter of everything (3 fritters) in one batch in a 10-inch skillet.
  - r3: A quarter of everything (3 fritters) in one batch in a 10-inch skillet with about 1/2 cup oil (1/8 inch).
- **scaling 2**
  - r2: Half of everything (6 fritters) in one batch in the 12-inch skillet.
  - r3: Half of everything (6 fritters) in one batch in the 12-inch skillet with 2/3 cup oil (1/8 inch).
- **scaling 4**
  - r2: As written (12 fritters, 2 batches).
  - r3: As written (12 fritters, 2 batches, 2/3 cup oil each).
- **scaling do_not_scale**
  - r2: ['squeezing: the zucchini must be squeezed very dry whatever the batch size, or the fritters will not hold']
  - r3: ['oil depth: about 1/8 inch whatever the batch: 2/3 cup in a 12-inch skillet, about 1/2 cup in a 10-inch skillet', 'squeezing: the zucchini must be squeezed very dry whatever the batch size, or the fritters will not hold']
- **components** updated (see v1.json).

## austrian-pork-schnitzel-potato-salad

Trigger: audit r1 note (non-blocking, PASS WITH NOTES). `culinary_hash` `11b939c0b408f8de…` → `c19fa32db70ff90d…`. Time: 12+38=50 → 12+38=50 min. D-03: involved/simple → involved/simple.

Summary:

- Breadcrumb ingredient note adds a homemade fallback: about 6 oz day-old plain bakery bread whose label lists only wheat flour, water, yeast, and salt, pulsed and dried in a skillet about 8 minutes (adds about 12 minutes before step 1); allergen note updated.

Field diff (r2 → r3):

- **ingredient breadcrumbs**
  - r2: breadcrumbs: 1.5 cup plain fine dry breadcrumbs whose label lists wheat flour, yeast, and salt only
  - r3: breadcrumbs: 1.5 cup plain fine dry breadcrumbs whose label lists wheat flour, yeast, and salt only (If you cannot find them: before you start, pulse about 6 oz day-old plain bakery bread whose label lists only wheat flour, water, yeast, and salt to fine crumbs in a food processor and dry them in a 12-inch skillet over medium, stirring, about 8 minutes; cool before breading. This adds about 12 minutes before step 1.)
- **allergen_notes**
  - r3: Meat from the pork. Wheat from the flour and breadcrumbs. Egg from the egg wash. The breadcrumbs are a store-bought hard contract: the label lists wheat flour, yeast, and salt, with no milk, butter, soy, or sesame. The homemade fallback uses bread whose label lists only wheat flour, water, yeast, and salt. Mustard (Dijon) has no FlavorWeave allergen token; disclosed here and in runtime_enum_gaps. No milk, soy, sesame, fish, shellfish, or nuts.

## cuban-picadillo-rice

Trigger: audit r1 note (non-blocking, PASS WITH NOTES). `culinary_hash` `cb4f876ef8525d12…` → `2ccffe55ac66494f…`. Time: 10+35=45 → 10+35=45 min. D-03: moderate/simple → moderate/simple.

Summary:

- Tomato-sauce and olive label rules moved onto the ingredient lines ('label lists tomatoes and salt only'; 'label lists olives, pimiento, water, salt, and vinegar only'). Quantities and steps unchanged.

Field diff (r2 → r3):

- **ingredient tomato-sauce**
  - r2: tomato-sauce: 8 oz tomato sauce (one 8-oz can)
  - r3: tomato-sauce: 8 oz tomato sauce (one 8-oz can) whose label lists tomatoes and salt only
- **ingredient olives**
  - r2: olives: 0.5 cup pimiento-stuffed green olives
  - r3: olives: 0.5 cup pimiento-stuffed green olives whose label lists olives, pimiento, water, salt, and vinegar only

## Points worth the auditor's attention

These are observations to verify, not verdicts.

1. **Amok vessel and steamer.** Six 10-oz ramekins hold about 1.77 L in total, so the ~1.3 L mix plus ~60 ml topping fills each about 77%. Three ramekins about 4 inches across per 12-inch bamboo tier, in two tiers over a 14-inch wok with 4 cups of water. The step 4 clock stays at 30 minutes (6 boil + 1 + 22 steam + 1). The hero shows two ramekins; the recipe now makes six (1 or 2 per person). The image and its prompt were not changed.
2. **Amok garnish.** The wording is unchanged and still matches the recipe (slivered makrut lime leaf, sliced chile). The audit r1 note says the image's green garnish reads thicker than lime-leaf slivers. That is an image observation; the text was not changed to match the image.
3. **Escovitch oil.** The thin-layer option was chosen: a 1/2 cup layer, about 1/8 inch, for dredged fillets. The 1/2 cup is the audit r1 suggested figure; the arithmetic in audit r1 puts it nearer 1/10 inch. The quantity, heat line, step 4, scaling lines and do-not-scale note now agree.
4. **Mücver oil.** 2/3 cup per batch (1 1/3 cups total) for about 1/8 inch, which keeps the lacy shallow-fried edges seen in the hero. Cook time is up 2 minutes. 1 tbsp of the dill now goes into the yogurt.
5. **Schnitzel fallback.** The homemade-crumb fallback is in the ingredient note, adds about 12 minutes before step 1, and is not counted in the stated total. The stated total assumes store-bought crumbs.
6. **Picadillo.** The label rules were moved onto the ingredient lines only. The audit r1 image note (olive rings rather than halves) was not addressed.

## Out of scope

Certification, import, D1, publication, deployment, and pull requests. None of these has been started.
