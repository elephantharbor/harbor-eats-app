# Curator notes: wave-14-2026-10-15 (Juniper, creator role, via Grok Bot)

## State at freeze-r2 (2026-10-15) — certified, audit r3 PASS 50/50

- 50 packages are in `candidates/<slug>/`. Each has `v1.json`, `d03-classification.json`, `image-plating-brief.md`, `image-prompt.md`, `README.md`, `image-state.json`, its active GenerateImage source (1280x720), and the master and card WebPs (`<slug>.webp` 1200x900, `<slug>-640.webp` 640x480). Active sources: **43 img_v1.jpg, 5 img_v2.jpg, 2 img_v3.jpg** (per-meal table below). package_revision is `freeze-r2` everywhere.
- Audits (Vale): r1 PASS 0 / FAIL 50; r2 PASS 48 / FAIL 2; r3 PASS 50 / FAIL 0. All 50 are certified at freeze-r2.
- Freeze integrity (`freeze_integrity.py`, also scanning README, prompt, brief, and image-state for pending-image phrasings): **PASS 50/50**. See `notes/freeze-integrity-final.txt`.
- Structural preflight (`factory/tools/structural_preflight.mjs`): **PASS 50/50**, HH001 20. See `notes/structural-preflight-freeze-r2.txt`.
- Import, PR, and deploy are separate human-gated steps.

## Audit r1 fixes applied at freeze-r2

Audit r1 (Vale) failed all 50 on gates M/O and 15 on culinary, safety, or image gates. Fixed in the generators (`tools/build_packages.py`, `tools/recipes_*.py`, `tools/common.py`, `tools/finalize_images.py`, `tools/write_docs.py`) and the shared `freeze_integrity.py`; all 50 packages were regenerated. Existing image files and their sha256 provenance were verified and left untouched.

- M/O: post-image wording everywhere; one revision (`freeze-r2`); `method_detail` states the real 1280x720 (16:9) source, the 960x720 4:3 center crop, and the LANCZOS resize to 1200x900 and 640x480; `recipe_fidelity_state` is `awaiting_audit`.
- Gate E/J clocks: chiles rellenos 20 + 41 = 61; gyudon is a 25-minute bowl (8 + 17); Xi'an lamb uses store-bought thin-sliced lamb, so there is no partial-freeze step (12 + 15 = 27).
- Gate B pots: bún chả, mohinga, paprikash, laksa, and Swedish meatballs boil their 12 to 16 cups of water in a 6- to 8-quart pot.
- Gates F/G: Philly hoagie rolls, bobotie white bread, and feijoada linguica are store-bought components with hard label contracts (no soy, milk, or egg; no soy; no wheat, milk, or soy). Käsespätzle cheeses are microbial-rennet. Krupnik says "Contains gluten (barley)". The same label-contract rule was applied to the gumbo andouille, the bangers, and the sloppy-joe buns (egg added, per the audit note).
- Spanakopita: no red onion in the recipe; the brief forbids onion in the salad for the regenerated image.

## Active hero image per meal

| Meal | Active source | Regenerations |
|---|---|---|
| `aloo-paratha-kachumber-chutney` | `img_v1.jpg` | 0 |
| `bangers-and-mash-onion-gravy` | `img_v1.jpg` | 0 |
| `brazilian-feijoada` | `img_v1.jpg` | 0 |
| `burmese-mohinga-fish-noodle-soup` | `img_v1.jpg` | 0 |
| `chicken-andouille-gumbo` | `img_v1.jpg` | 0 |
| `chilean-porotos-granados` | `img_v1.jpg` | 0 |
| `chiles-rellenos-ranchero` | `img_v2.jpg` | 1 |
| `chinese-tomato-egg-stir-fry` | `img_v1.jpg` | 0 |
| `colombian-ajiaco` | `img_v1.jpg` | 0 |
| `egyptian-koshari` | `img_v1.jpg` | 0 |
| `filipino-fish-sinigang` | `img_v1.jpg` | 0 |
| `french-onion-soup` | `img_v1.jpg` | 0 |
| `georgian-adjaruli-khachapuri` | `img_v1.jpg` | 0 |
| `ghanaian-red-red-plantains` | `img_v1.jpg` | 0 |
| `glazed-turkey-meatloaf` | `img_v1.jpg` | 0 |
| `greek-gemista-stuffed-vegetables` | `img_v1.jpg` | 0 |
| `greek-spanakopita` | `img_v2.jpg` | 1 |
| `grilled-mahi-mahi-mango-salsa` | `img_v1.jpg` | 0 |
| `hungarian-chicken-paprikash` | `img_v1.jpg` | 0 |
| `japanese-gyudon` | `img_v2.jpg` | 1 |
| `kasespatzle-caramelized-onions` | `img_v1.jpg` | 0 |
| `lebanese-samke-harra-bulgur` | `img_v3.jpg` | 2 |
| `malaysian-curry-laksa` | `img_v1.jpg` | 0 |
| `moroccan-seven-vegetable-couscous` | `img_v1.jpg` | 0 |
| `new-england-clam-chowder` | `img_v3.jpg` | 2 |
| `nigerian-beef-suya-skewers` | `img_v1.jpg` | 0 |
| `oven-bbq-baby-back-ribs` | `img_v1.jpg` | 0 |
| `pan-seared-halibut-lemon-butter-corn` | `img_v1.jpg` | 0 |
| `persian-ghormeh-sabzi` | `img_v1.jpg` | 0 |
| `peruvian-ceviche-sweet-potato-corn` | `img_v2.jpg` | 1 |
| `philly-cheesesteaks` | `img_v1.jpg` | 0 |
| `polish-mushroom-barley-krupnik` | `img_v1.jpg` | 0 |
| `pork-shogayaki` | `img_v1.jpg` | 0 |
| `portuguese-piri-piri-chicken` | `img_v1.jpg` | 0 |
| `roasted-whole-branzino-salmoriglio` | `img_v1.jpg` | 0 |
| `senegalese-fish-yassa` | `img_v1.jpg` | 0 |
| `slow-cooker-ropa-vieja` | `img_v1.jpg` | 0 |
| `south-african-bobotie` | `img_v1.jpg` | 0 |
| `spanish-sopa-de-ajo-egg` | `img_v1.jpg` | 0 |
| `steak-au-poivre-smashed-potatoes` | `img_v1.jpg` | 0 |
| `swedish-meatballs-lingonberry` | `img_v1.jpg` | 0 |
| `swiss-rosti-smoked-trout` | `img_v1.jpg` | 0 |
| `taiwanese-beef-noodle-soup` | `img_v1.jpg` | 0 |
| `tomato-goat-cheese-galette` | `img_v1.jpg` | 0 |
| `turkey-sloppy-joes` | `img_v1.jpg` | 0 |
| `tuscan-panzanella-white-beans` | `img_v1.jpg` | 0 |
| `ukrainian-beet-borscht` | `img_v1.jpg` | 0 |
| `venezuelan-black-bean-plantain-arepas` | `img_v1.jpg` | 0 |
| `vietnamese-bun-cha` | `img_v2.jpg` | 1 |
| `xian-cumin-lamb-stir-fry` | `img_v1.jpg` | 0 |

9 heroes were regenerated across 7 meals after audits r1 and r2 (gate K). Each superseded set (source JPEG, master, card) is in that meal's `rejected/` under a `-replaced-<timestamp>` name and recorded with its sha256 under `image.superseded`. The two r2 FAILs (samke harra, chowder) moved to img_v3 and passed audit r3.

## Open items

1. **Allergen-code gap (importer).** FlavorWeave has no coconut token and no gluten token. Laksa discloses coconut in `allergen_notes` and `runtime_enum_gaps.coconut`; krupnik carries "Contains gluten (barley)" and `runtime_enum_gaps.gluten`. Decide: add tokens, or a wave rule requiring the note.
2. **D-03 band decision.** Packages follow the repo contract (`factory/PACKAGE.md`: ≤12 / 13–16 / 17+). Under the design draft (`/workspace/d03-design/DESIGN-DRAFT.md`: ≤8 / 9–14 / ≥15), 10 meals would shift: koshari, French onion soup, khachapuri, gyudon, suya, krupnik, ceviche, and Xi'an lamb simple→standard; couscous and Swedish meatballs standard→adventurous. The bands need a decision before the draft is adopted.
3. **Clusters.** 10 soups (burmese-mohinga-fish-noodle-soup, colombian-ajiaco, filipino-fish-sinigang, french-onion-soup, malaysian-curry-laksa, new-england-clam-chowder, polish-mushroom-barley-krupnik, spanish-sopa-de-ajo-egg, taiwanese-beef-noodle-soup, ukrainian-beet-borscht) form a new cluster; feijoada is the 5th black-bean meal catalog-wide; laksa is the 4th coconut meal; spanakopita and the galette are the 2 pastry pies. See `coverage.md`.

## Concerns carried for the auditor

1. **Time skew.** 4 of the 50 fall in 30–45 minutes, 12 run over 90, and 9 are under 30. The ropa vieja is mostly unattended slow-cooker time, and its 512-minute total is honest.
2. **HH001 at 40%** (20/50): 10 plant-based, 2 egg-vegetarian, 8 finfish. All have nut_policy none. Re-verified at freeze-r2: none of the audit-r1 edits touched an HH001 meal's eligibility.
3. **Raw fish.** The ceviche carries a food-safety note: buy fish sold for raw consumption.
4. **Alcohol.** Brandy in steak au poivre and mirin in shōgayaki and gyudon. Each has an alcohol_note.
5. **Reversed wave-12 rejections:** feijoada (5th black-bean meal), spanakopita and the tomato galette (pastry), and laksa (coconut dish 4); koshari is the one lentil-primary exception. See `selection-rationale.md`. Feijoada is the first swap candidate.
6. **Käsespätzle** sits close to the mac-and-cheese / baked-ziti rejection. It is kept as a German dumpling-noodle dish; its cheeses are now microbial-rennet for the vegetarian label.
7. **Plantains in two dishes** (the arepas and red-red). Red palm oil in red-red is a specialty item.
8. **Peanut in suya** is integral, so nut_policy is `peanuts_present`.
9. **Fish sauce as seasoning** in bún chả and laksa. These carry the `finfish` allergen, but `finfish_seasoning_only` keeps the `fish` dietary label off.
10. Primary-ingredient values such as onion, clams, spinach, tomatoes, pork, and halibut are free text. Only vocab terms become tags.
