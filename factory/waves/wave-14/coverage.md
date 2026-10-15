# FlavorWeave catalog coverage — wave-14-2026-10-15

Source: local clone `/workspace/harbor-eats-app`, `main` at **565d736**. The inventory comes from each meal's `v2.json` or `v1.json` under `catalog/`. **Base count: 85.** README.md, `legacy-24/`, and `staging-publication.json` are excluded. D1 was not queried and not touched. Counts are counts. HH001 is eligibility awareness, not a quota.

Scope: Thomas raised this wave from 25 to 50 new meals on 2026-10-15. Target after import: **135**.

## Cuisine

| Cuisine | Base 85 | Wave-14 | After |
|---|---|---|---|
| american | 12 | 6 | 18 |
| mexican | 6 | 1 | 7 |
| italian-inspired | 7 | 0 | 7 |
| japanese | 4 | 2 | 6 |
| mediterranean | 6 | 0 | 6 |
| french | 2 | 3 | 5 |
| thai-inspired | 4 | 0 | 4 |
| indian-inspired | 4 | 0 | 4 |
| spanish | 3 | 1 | 4 |
| vietnamese | 3 | 1 | 4 |
| greek | 1 | 2 | 3 |
| italian | 1 | 2 | 3 |
| korean | 3 | 0 | 3 |
| chinese | 1 | 2 | 3 |
| british | 2 | 1 | 3 |
| californian | 2 | 0 | 2 |
| brazilian | 1 | 1 | 2 |
| asian-fusion | 2 | 0 | 2 |
| filipino | 1 | 1 | 2 |
| moroccan | 1 | 1 | 2 |
| peruvian | 1 | 1 | 2 |
| cajun | 1 | 1 | 2 |
| chinese-inspired | 2 | 0 | 2 |
| caribbean | 1 | 1 | 2 |
| southern | 2 | 0 | 2 |
| north-african | 2 | 0 | 2 |
| west-african | 0 | 1 | 1 |
| indian | 0 | 1 | 1 |
| egyptian | 0 | 1 | 1 |
| burmese | 0 | 1 | 1 |
| new-american | 1 | 0 | 1 |
| venezuelan | 0 | 1 | 1 |
| italian-american | 1 | 0 | 1 |
| japanese-inspired | 1 | 0 | 1 |
| chinese-american | 1 | 0 | 1 |
| swedish | 0 | 1 | 1 |
| taiwanese | 0 | 1 | 1 |
| scandinavian-inspired | 1 | 0 | 1 |
| georgian | 0 | 1 | 1 |
| lebanese | 0 | 1 | 1 |
| malaysian | 0 | 1 | 1 |
| portuguese | 0 | 1 | 1 |
| swiss | 0 | 1 | 1 |
| nigerian | 0 | 1 | 1 |
| cuban | 0 | 1 | 1 |
| german | 0 | 1 | 1 |
| israeli | 1 | 0 | 1 |
| persian | 0 | 1 | 1 |
| ethiopian | 1 | 0 | 1 |
| south-african | 0 | 1 | 1 |
| middle-eastern | 1 | 0 | 1 |
| chilean | 0 | 1 | 1 |
| polish | 0 | 1 | 1 |
| hungarian | 0 | 1 | 1 |
| southwestern | 1 | 0 | 1 |
| turkish | 1 | 0 | 1 |
| colombian | 0 | 1 | 1 |
| ghanaian | 0 | 1 | 1 |
| ukrainian | 0 | 1 | 1 |

Wave-14 adds 22 cuisines that had zero catalog meals: West African (Senegalese), Ukrainian, Venezuelan, Swiss, Lebanese, Cuban, Persian, German, South African, Portuguese, Georgian, Egyptian, Chilean, Polish, Burmese, Ghanaian, Taiwanese, Malaysian, Swedish, Nigerian, Colombian, and Hungarian. The `indian` label also appears for the first time, next to the base's `indian-inspired`. American (+6) and French (+3) are the only cuisines that gain more than two meals.

## D-03 effort

| Effort | Base 85 | Wave-14 | After |
|---|---|---|---|
| moderate | 49 | 27 | 76 |
| involved | 16 | 14 | 30 |
| easy | 20 | 9 | 29 |

## D-03 ingredient complexity

| Complexity | Base 85 | Wave-14 | After |
|---|---|---|---|
| standard | 49 | 22 | 71 |
| simple | 33 | 25 | 58 |
| adventurous | 3 | 3 | 6 |

The base is heavy in moderate/standard (33 of 85). Wave-14 leans moderate/simple (15) and involved/standard (10) to widen the spread. Adventurous stays scarce: the wave adds 3 (mohinga, Taiwanese beef noodle soup, laksa), for 6 total.

## Time bands (total_minutes, reconstructed from steps)

| Band | Base 85 | Wave-14 | After |
|---|---|---|---|
| 46-90 | 26 | 25 | 51 |
| 30-45 | 45 | 4 | 49 |
| under 30 | 12 | 9 | 21 |
| over 90 | 2 | 12 | 14 |

Wave-14 is long-skewed. Only 4 new meals fall in the 30-45 minute default band, and 12 run over 90 minutes (Greek Gemista, Slow-Cooker Cuban Ropa Vieja, Persian Ghormeh Sabzi, Chicken and Andouille Gumbo, Portuguese Piri-Piri Roast Chicken, Georgian Adjaruli Khachapuri, Oven-Barbecued Baby Back Ribs, Taiwanese Red-Braised Beef Noodle Soup, French Onion Soup, Greek Spanakopita Pan Pie, Rustic Tomato and Goat Cheese Galette, Brazilian Feijoada). 9 are under 30. This is a deliberate weekend/project slot, but it is flagged in the concerns in `notes/curator-notes.md`.

## Clusters to manage

- **Soups: 10 of 50** (burmese-mohinga-fish-noodle-soup, colombian-ajiaco, filipino-fish-sinigang, french-onion-soup, malaysian-curry-laksa, new-england-clam-chowder, polish-mushroom-barley-krupnik, spanish-sopa-de-ajo-egg, taiwanese-beef-noodle-soup, ukrainian-beet-borscht). The base has few soups, so this is a new cluster; diversity is acceptable, but later waves should not add soups without a gap.
- **Black beans: 5 catalog-wide** after this wave: black-bean-quesadillas, chipotle-lime-black-bean-bowls, and grilled-peach-burrito-bowl in the base, then the Venezuelan arepas (4th) and feijoada (5th).
- **Coconut: 4 catalog-wide**, with laksa the 4th. Coconut has no allergen token (open item in WAVE.json).
- **Pastry pies: 2** (spanakopita, tomato galette).

## HH001

| | Base 85 | Wave-14 | After |
|---|---|---|---|
| HH001-eligible | 31 | 20 | 51 |
| Not eligible | 54 | 30 | 84 |

Wave-14: **20/50** HH001-eligible.

## Creator batches

| Batch | Meals | Slugs |
|---|---|---|
| A | 13 | senegalese-fish-yassa, peruvian-ceviche-sweet-potato-corn, filipino-fish-sinigang, ukrainian-beet-borscht, chinese-tomato-egg-stir-fry, venezuelan-black-bean-plantain-arepas, aloo-paratha-kachumber-chutney, swiss-rosti-smoked-trout, lebanese-samke-harra-bulgur, greek-gemista-stuffed-vegetables, slow-cooker-ropa-vieja, persian-ghormeh-sabzi, xian-cumin-lamb-stir-fry |
| B | 12 | kasespatzle-caramelized-onions, chicken-andouille-gumbo, glazed-turkey-meatloaf, philly-cheesesteaks, south-african-bobotie, pork-shogayaki, steak-au-poivre-smashed-potatoes, portuguese-piri-piri-chicken, georgian-adjaruli-khachapuri, oven-bbq-baby-back-ribs, chiles-rellenos-ranchero, vietnamese-bun-cha |
| C | 13 | egyptian-koshari, chilean-porotos-granados, polish-mushroom-barley-krupnik, tuscan-panzanella-white-beans, grilled-mahi-mahi-mango-salsa, roasted-whole-branzino-salmoriglio, moroccan-seven-vegetable-couscous, burmese-mohinga-fish-noodle-soup, spanish-sopa-de-ajo-egg, ghanaian-red-red-plantains, bangers-and-mash-onion-gravy, japanese-gyudon, taiwanese-beef-noodle-soup |
| D | 12 | malaysian-curry-laksa, turkey-sloppy-joes, swedish-meatballs-lingonberry, nigerian-beef-suya-skewers, colombian-ajiaco, french-onion-soup, greek-spanakopita, new-england-clam-chowder, tomato-goat-cheese-galette, pan-seared-halibut-lemon-butter-corn, brazilian-feijoada, hungarian-chicken-paprikash |
