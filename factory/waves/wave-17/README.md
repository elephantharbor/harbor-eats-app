# FlavorWeave Catalog Factory: wave-17

50 new dinner meals that take the live FlavorWeave catalog from 200 to 250. All work ran on Grok Bot.

State: all 50 packages frozen with heroes at `author-r2/author-r3/author-r4/author-r5`, `structural_qa_state` `author_r2_preflight_pass_awaiting_vale/author_r3_preflight_pass_awaiting_vale/author_r4_preflight_pass_awaiting_vale/author_r5_preflight_pass_awaiting_vale`. Cora generated every hero with Grok Bot GenerateImage: 41 from the author-r1 prompts (`/workspace/wave17-prompts.txt`) and 9 as creator self-review regenerations (`bhutanese-ema-datshi` v2, `french-mushroom-bourguignon` v2, `vietnamese-ca-kho-catfish` v3, `amritsari-fish-mint-chutney` v2, `crab-louie-salad` v2, `georgian-chkmeruli-garlic-chicken` v2, `balkan-cevapi-ajvar` v2, `salvadoran-bean-cheese-pupusas` v6, `uruguayan-chivito-sandwiches` v6). Each regeneration prompt is the v1 prompt plus one appended correction sentence; every version's prompt and rejection reason is recorded word for word in that package's image-prompt.md, rejected sources are in `rejected/`, and image-plating-brief.md matches the accepted prompt. Master 1200x900 and card 640x480 WebPs are 4:3 center crops of the 1280x720 sources. After independent audit r1 (42 PASS / 8 FAIL) the 8 failing packages were revised as author round 3 (`author-r3`; three with new heroes after audit gate K rejections: pupusas v4, ca kho v3, chivito v5); the 42 passing packages are byte-identical to what audit r1 saw. See the r2 addendum in notes/AUDITOR_HANDOFF.md. After audit r2 (48 PASS / 2 FAIL, gate K on the hero only) pupusas and chivito got new heroes as author round 4 (`author-r4`; pupusas v5, chivito v6); the other 48 packages are byte-identical to what audit r2 saw (r3 addendum in notes/AUDITOR_HANDOFF.md). After audit r3 (49 PASS / 1 FAIL) pupusas got a new v6 hero as author round 5 (`author-r5`); the other 49 are byte-identical to what audit r3 saw (r4 addendum). Nothing here is certified, imported, published, or deployed, and D1 was not touched.

## Meals

| # | Slug | Title | Batch | Cuisine | Protein | Time (prep+cook=total) | Effort / complexity | HH001 |
|---|---|---|---|---|---|---|---|---|
| 1 | `south-indian-sambar-rice` | South Indian Vegetable Sambar with Toor Dal and Steamed Rice | A | south-indian | veg | 12+59=71 min | moderate / standard | yes |
| 2 | `vietnamese-lemongrass-tofu-banh-mi` | Vietnamese Lemongrass Tofu Banh Mi with Pickled Carrot and Daikon | A | vietnamese | veg | 21+20=41 min | moderate / standard | yes |
| 3 | `nigerian-jollof-rice-boiled-eggs` | Nigerian Jollof Rice with Boiled Eggs | A | nigerian | veg | 10+72=82 min | moderate / simple | yes |
| 4 | `japanese-vegetable-omurice` | Japanese Vegetable Omurice with Mushroom Ketchup Rice | A | japanese | veg | 2+58=60 min | moderate / simple | yes |
| 5 | `mexican-rajas-con-crema-tacos` | Mexican Rajas con Crema Tacos with Corn and Queso Fresco | A | mexican | veg | 24+33=57 min | moderate / simple | no |
| 6 | `polish-potato-cheese-pierogi` | Polish Potato-and-Cheese Pierogi with Golden Onions and Sour Cream | A | polish | veg | 52+38=90 min | involved / simple | no |
| 7 | `indo-chinese-gobi-manchurian` | Indo-Chinese Gobi Manchurian with Basmati Rice | A | indo-chinese | veg | 16+28=44 min | involved / standard | yes |
| 8 | `greek-fasolakia-green-beans` | Greek Fasolakia: Green Beans and Potatoes Braised in Tomato and Olive Oil | A | greek | veg | 12+65=77 min | easy / simple | yes |
| 9 | `chinese-hot-sour-soup-tofu` | Chinese Hot and Sour Soup with Tofu, Shiitake, and Egg Ribbons | A | chinese | veg | 4+51=55 min | moderate / simple | yes |
| 10 | `salvadoran-bean-cheese-pupusas` | Salvadoran Bean-and-Cheese Pupusas with Curtido and Salsa Roja | A | salvadoran | veg | 37+33=70 min | involved / simple | no |
| 11 | `bhutanese-ema-datshi` | Bhutanese Ema Datshi: Green Chiles in Farmer's Cheese Sauce with Red Rice | B | bhutanese | veg | 14+36=50 min | moderate / simple | no |
| 12 | `ecuadorian-locro-de-papa` | Ecuadorian Locro de Papa: Potato Soup with Queso Fresco and Avocado | B | ecuadorian | veg | 14+46=60 min | easy / simple | no |
| 13 | `thai-pad-see-ew-tofu` | Thai Pad See Ew with Tofu, Broccoli, and Egg | B | thai | veg | 10+31=41 min | moderate / simple | yes |
| 14 | `jamaican-ital-stew` | Jamaican Ital Stew with Squash, Kidney Beans, and Coconut | B | jamaican | veg | 18+46=64 min | easy / simple | yes |
| 15 | `penne-alla-vodka` | Penne alla Vodka with Basil | B | italian-american | veg | 6+32=38 min | moderate / simple | no |
| 16 | `french-mushroom-bourguignon` | French Mushroom Bourguignon over Olive Oil Mashed Potatoes | B | french | veg | 15+55=70 min | moderate / simple | yes |
| 17 | `persian-ash-reshteh` | Persian Ash Reshteh: Herb, Bean, and Noodle Soup with Kashk and Mint Oil | B | persian | veg | 20+55=75 min | moderate / standard | no |
| 18 | `vietnamese-ca-kho-catfish` | Vietnamese Ca Kho: Caramel-Braised Catfish with Black Pepper and Jasmine Rice | B | vietnamese | fish | 10+31=41 min | moderate / simple | yes |
| 19 | `british-kedgeree-smoked-salmon` | British Kedgeree with Hot-Smoked Salmon, Jammy Eggs, and Peas | B | british | fish | 8+40=48 min | moderate / simple | yes |
| 20 | `yucatecan-tikin-xic-fish` | Yucatecan Tikin Xic: Achiote-Citrus Baked Fish with Pickled Red Onions | B | yucatecan | fish | 27+20=47 min | moderate / standard | yes |
| 21 | `turkish-balik-ekmek-mackerel` | Turkish Balik Ekmek: Seared Mackerel Sandwiches with Sumac Onions | C | turkish | fish | 12+19=31 min | moderate / simple | yes |
| 22 | `amritsari-fish-mint-chutney` | Amritsari Fish with Cilantro-Mint Chutney, Kachumber, and Basmati Rice | C | punjabi | fish | 34+20=54 min | involved / standard | yes |
| 23 | `korean-spicy-cod-stew` | Korean Maeuntang: Spicy Cod Stew with Radish, Tofu, and Watercress | C | korean | fish | 16+32=48 min | easy / standard | yes |
| 24 | `finnish-lohikeitto-salmon-soup` | Finnish Lohikeitto: Creamy Salmon Soup with Potatoes and Dill | C | finnish | fish | 14+37=51 min | easy / simple | no |
| 25 | `indonesian-ikan-bakar-tilapia` | Indonesian Ikan Bakar: Broiled Kecap-Glazed Tilapia with Sambal Tomat | C | indonesian | fish | 12+30=42 min | moderate / simple | yes |
| 26 | `greek-shrimp-saganaki` | Greek Shrimp Saganaki with Tomato, Feta, and Crusty Bread | C | greek | shellfish | 10+26=36 min | easy / simple | no |
| 27 | `san-francisco-cioppino` | San Francisco Cioppino with Clams, Mussels, Shrimp, and Cod | C | californian | shellfish | 15+45=60 min | moderate / simple | no |
| 28 | `crab-louie-salad` | Crab Louie Salad with Asparagus, Eggs, and Louie Dressing | C | american | shellfish | 12+28=40 min | easy / simple | no |
| 29 | `korean-ojingeo-bokkeum-squid` | Korean Ojingeo Bokkeum: Spicy Stir-Fried Squid with Vegetables and Rice | C | korean | shellfish | 24+11=35 min | moderate / standard | no |
| 30 | `galician-pulpo-potatoes` | Galician Pulpo a la Gallega: Octopus and Potatoes with Smoked Paprika | C | spanish | shellfish | 10+28=38 min | easy / simple | no |
| 31 | `japanese-chicken-nanban` | Japanese Chicken Nanban with Tartar Sauce, Shredded Cabbage, and Rice | D | japanese | poultry | 18+51=69 min | involved / standard | no |
| 32 | `chicken-tinga-tostadas` | Chicken Tinga Tostadas with Crema, Queso Fresco, and Avocado | D | mexican | poultry | 6+50=56 min | moderate / simple | no |
| 33 | `greek-avgolemono-chicken-soup` | Greek Avgolemono Chicken Soup with Rice, Lemon, and Dill | D | greek | poultry | 10+51=61 min | moderate / simple | no |
| 34 | `georgian-chkmeruli-garlic-chicken` | Georgian Chkmeruli: Crisp Chicken Thighs in Garlic Cream Sauce | D | georgian | poultry | 8+44=52 min | moderate / simple | no |
| 35 | `moroccan-chicken-preserved-lemon-tagine` | Moroccan Chicken Tagine with Preserved Lemon, Green Olives, and Couscous | D | moroccan | poultry | 12+69=81 min | easy / simple | no |
| 36 | `southern-chicken-and-dumplings` | Southern Chicken and Dumplings with Carrots, Celery, and Thyme | D | american | poultry | 16+53=69 min | moderate / simple | no |
| 37 | `palestinian-musakhan-chicken` | Palestinian Musakhan: Sumac Chicken and Onions on Flatbread | D | palestinian | poultry | 14+42=56 min | moderate / simple | no |
| 38 | `ivorian-chicken-kedjenou` | Ivorian Chicken Kedjenou with Eggplant, Tomatoes, and Rice | D | ivorian | poultry | 15+55=70 min | easy / simple | no |
| 39 | `uzbek-lamb-plov` | Uzbek Lamb Plov with Carrots, Chickpeas, and a Whole Garlic Head | D | uzbek | meat | 25+121=146 min | moderate / simple | no |
| 40 | `filipino-pork-menudo` | Filipino Pork Menudo with Potatoes, Carrots, Raisins, and Rice | D | filipino | meat | 18+76=94 min | easy / simple | no |
| 41 | `taiwanese-lu-rou-fan` | Taiwanese Lu Rou Fan: Braised Pork Belly over Rice with Soy Eggs and Bok Choy | E | taiwanese | meat | 15+82=97 min | moderate / simple | no |
| 42 | `sichuan-dan-dan-noodles` | Sichuan Dan Dan Noodles with Crisp Pork and Sesame Chili Sauce | E | sichuan | meat | 8+20=28 min | moderate / standard | no |
| 43 | `uruguayan-chivito-sandwiches` | Uruguayan Chivito Steak Sandwiches with Ham, Bacon, Mozzarella, and Egg | E | uruguayan | meat | 10+34=44 min | moderate / simple | no |
| 44 | `argentine-beef-empanadas` | Argentine Baked Beef Empanadas with Olives and Boiled Egg | E | argentine | meat | 34+55=89 min | moderate / simple | no |
| 45 | `pakistani-lamb-keema-peas` | Pakistani Lamb Keema Matar with Green Peas and Warm Chapatis | E | pakistani | meat | 12+52=64 min | moderate / simple | no |
| 46 | `tex-mex-steak-fajitas` | Tex-Mex Skirt Steak Fajitas with Peppers, Onions, and Pico de Gallo | E | tex-mex | meat | 20+30=50 min | moderate / simple | no |
| 47 | `balkan-cevapi-ajvar` | Balkan Cevapi with Ajvar, Raw Onion, and Warm Pita | E | balkan | meat | 23+26=49 min | moderate / simple | no |
| 48 | `orecchiette-sausage-broccoli-rabe` | Orecchiette with Italian Sausage, Broccoli Rabe, Garlic, and Pecorino | E | italian | meat | 10+32=42 min | moderate / simple | no |
| 49 | `lebanese-arayes` | Lebanese Arayes: Spiced Lamb-Stuffed Pita with Tahini Sauce | E | lebanese | meat | 22+20=42 min | moderate / standard | no |
| 50 | `swedish-pytt-i-panna` | Swedish Pytt i Panna Ham and Potato Hash with Pan-Fried Eggs and Pickled Beets | E | swedish | meat | 15+47=62 min | moderate / simple | no |

## Checks

- Structural preflight (`node factory/tools/structural_preflight.mjs`): 50/50 PASS.
- Freeze integrity (`freeze_integrity.py`) with heroes: 50/50 PASS (26/26 checks each). Image hashes match image.file_hashes and notes/image-gen-map.txt.
- `tools/mark_preflight.py` set `structural_qa_state` to `author_r2_preflight_pass_awaiting_vale/author_r3_preflight_pass_awaiting_vale/author_r4_preflight_pass_awaiting_vale/author_r5_preflight_pass_awaiting_vale` on all 50; both preflights were re-run afterwards.
- Builder guards (`tools/build_packages.py`): near-duplicate guard against the 200 live meals and the other wave-17 meals, pot size against water volume, boil-up minutes inside the step clock, no untimed waits, counted equipment named in the 1- and 2-serving scaling notes, description words present in the ingredients, step clocks consistent with stated minutes, the props guard, and three wave-17 guards: oil depth against oil volume for every shallow-fry or stated depth, pan and sheet-pan fit (grid packing for rectangles, circle-packing for rounds), and the app's own title-word allergen matcher (`src/lib/eligibility.js`, via `tools/title_tags.mjs`).
- `tools/overlap_report.py`: every overlap step fits inside the steps it runs alongside.

## Files

- `coverage.md`: coverage analysis of the 200 live meals and what wave-17 adds.
- `selection-rationale.md`: why these 50.
- `rejected.md`: ideas considered and dropped.
- `notes/existing-200.tsv`, `notes/coverage-stats.json`, `notes/wave17-roster.tsv`, `notes/curator-notes.md`, `notes/PROGRESS.md`.
- `notes/structural-r*.log`, `notes/freeze-r*.log`, `notes/finalize-r1.log`, `notes/*-author-r3.log`: preflight, freeze and finalize runs (r1-r4 are run numbers; `author-r3` logs are the post-audit round). `notes/prompts-author-r1.txt`: frozen author-r1 prompts. `notes/prompts-regen-selfreview.txt`: regeneration prompts. `notes/image-gen-map.txt`: every generated image with its sha256. `notes/AUDITOR_HANDOFF.md`.
- `tools/`: builder, recipes (`recipes_w17_a.py` to `_e.py`), preflight marker, image finalizer, stats, overlap report, title matcher bridge, and this docs generator.

## Next steps (not done here)

1. Independent audit r4 of salvadoran-bean-cheese-pupusas (author-r5, hero image, gate K); see the r4 addendum in notes/AUDITOR_HANDOFF.md. Certification, import, and publication are separate later steps.

Generated 2026-10-16T00:42:52-05:00 by tools/write_docs.py.
