# Wave-17 selection rationale

Fifty dinners taking the live FlavorWeave catalog from 200 to 250. Each was checked against the 200 live meals in `notes/existing-200.tsv` and against the other 49. Every package records at least two "Compared with" references to real live slugs, and the builder refuses unknown slugs.

## Targets and how the 50 meet them

| Target | Result |
|---|---|
| Protein spread that fills the thin classes | veg 17, meat 12, fish 8, poultry 8, shellfish 5 (poultry 13% to 14%, shellfish 4% to 5% of the catalog) |
| Vegetarian options | 17 vegetarian, 5 of them plant-based |
| Effort spread | easy 11, moderate 34, involved 5 |
| Sensible HH001 share | 17 of 50 (34%); the catalog stays at 38% (94 of 250) |
| No more peanut-sauce dishes | 0 peanut meals; dan dan uses sesame paste |
| New cuisines | 15 cuisine labels not in the base |
| No duplicates or near-duplicates | builder near-dup guard, plus in-wave notes where two meals share a protein or format |

## Batches

- **A (vegetarian 1-10):** sambar, lemongrass tofu banh mi, jollof with eggs, vegetable omurice, rajas con crema tacos, potato-cheese pierogi, gobi Manchurian, fasolakia, hot and sour soup, bean-and-cheese pupusas.
- **B (vegetarian 11-17, fish 18-20):** ema datshi, locro de papa, pad see ew with tofu, Ital stew, penne alla vodka, mushroom bourguignon, ash reshteh; ca kho catfish, kedgeree, tikin xic.
- **C (fish 21-25, shellfish 26-30):** balik ekmek, Amritsari fish, maeuntang cod stew, lohikeitto, ikan bakar; shrimp saganaki, cioppino, crab Louie, ojingeo bokkeum, pulpo a la gallega.
- **D (poultry 31-38, meat 39-40):** chicken nanban, chicken tinga tostadas, avgolemono, chkmeruli, chicken tagine with preserved lemon, chicken and dumplings, musakhan, kedjenou; lamb plov, pork menudo.
- **E (meat 41-50):** lu rou fan, dan dan noodles, chivito, baked beef empanadas, lamb keema matar, steak fajitas, cevapi with ajvar, orecchiette with sausage and broccoli rabe, arayes, pytt i panna.

## Why these, by gap

- **Poultry (8).** The base has 26 poultry meals, and most are braises, curries, or roasts. The eight new ones each add a format the catalog lacks: a sweet-vinegar fried cutlet with tartar, tostadas, an egg-lemon soup, a garlic-cream skillet, a preserved-lemon tagine, dumplings, a sumac flatbread, and a sealed-pot stew.
- **Shellfish (5).** Only 7 or 8 shellfish meals exist. The new five are shrimp baked with tomato and feta, a mixed-seafood tomato stew, a no-cook crab salad, a spicy squid stir-fry, and boiled octopus with potatoes.
- **Fish (8).** These are species and formats new to the catalog: caramel-braised catfish, a hot-smoked salmon rice dish, a mackerel sandwich, achiote-baked white fish, a chickpea-battered fried fish, a spicy cod stew, a creamy salmon soup, and broiled tilapia. Seven of the eight are HH001.
- **Vegetarian (17).** The aim was protein formats the catalog lacks: stuffed doughs (pierogi, pupusas), egg-wrapped rice (omurice), Indo-Chinese, a tofu banh mi, a South Indian dal, and chile-cheese stews (ema datshi, locro). Ten are HH001.
- **Meat (12).** These are weeknight and weekend formats not yet covered: a braised pork rice bowl, Sichuan noodles, a Central Asian pilaf, baked hand pies, keema, fajitas, Balkan sausages, a bitter-greens sausage pasta, stuffed pita, a loaded steak sandwich, a Swedish hash, and a Filipino tomato pork stew.

## In-wave near-duplicate calls

- Pupusas and rajas tacos are both Salvadoran/Mexican corn and cheese, but one is a stuffed griddled masa cake and the other a soft taco of chile strips in crema.
- Avgolemono and chicken and dumplings are both chicken in broth, but one is a lemon-egg rice soup and the other a roux-thickened stew with steamed dumplings.
- Keema, cevapi, and arayes all use ground meat. Keema is a loose curry with chapatis, cevapi are seared sausages in pita with ajvar, and arayes are raw spiced lamb baked inside pita. Each package records the in-wave distinction.
- Shrimp saganaki and cioppino both have shrimp in tomato. Saganaki is a single-protein feta bake with bread; cioppino is a wine-tomato seafood stew with clams, mussels, and cod.
- Two selection swaps were made during drafting:
  - Honduran baleadas were replaced by mushroom bourguignon because they were too close to the in-wave pupusas (beans, cheese, and griddled dough).
  - Sri Lankan devilled shrimp was replaced by shrimp saganaki because its sweet-hot ketchup-chile glaze was too close to the in-wave gobi Manchurian.

## Equipment, oil, and label realism

- **Pan and vessel fit.** Every pan-crowding step has a recorded `fit` (piece size, vessel base, per layer, layers) that the builder checks. Rectangular pieces use grid packing; rounds use a circle-packing table, so four rounds in a 10-inch base must be at most 4.1 inches. Two cases were resized to fit: the pupusas were resized to 4-inch rounds, and the chkmeruli thighs were specified at about 6 oz (4 x 3 in) so six fit one layer.
- **Oil depth.** Every shallow-fry has an `oil` record. The builder computes the oil volume from the vessel base and stated depth, requires the listed oil to be within 0.8-1.25x of that volume, and requires every depth stated in the text to match. For example, 1/4 inch in a 12-inch skillet (10-inch base) needs about 1 1/3 cups.
- **Title words.** Each title was run through the app's own title-word allergen matcher (`src/lib/eligibility.js`), and every tag it raises is true of the recipe. Titles avoid trap words such as "king oyster" and "butter beans".
- **Store-bought labels.** Every store-bought item names a label that real US products meet. Examples:
  - corn tortillas listing corn, lime, and water;
  - lard-free flour tortillas and refried beans;
  - gochujang and kecap manis that contain wheat (declared);
  - an anchovy-and-salt fish sauce;
  - a vegan-labeled wine;
  - rennet statements for every vegetarian cheese;
  - no asafoetida or chaat masala, since common US blends contain wheat.
