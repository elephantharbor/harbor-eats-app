# Selection rationale — wave-13-2026-10-11

Ten new meals. Author role only: packages, plating briefs, and prompts. No images, no certification, no `catalog/` copy, no D1 import.

Base is the 75 meals in `catalog/` at `b28f03e`. See `coverage.md`. Household 001 (Tom and Renata): no dairy, no shellfish, no meat other than fish, no poultry; nuts only as cashews; eggs, finfish, and sesame allowed. **8 of 10 are HH001-eligible.** The task floor is 6.

D-03 scores below are the package rubric, not the first guess. `kitchen_tested` is false on all ten. Cooking tokens are the words `src/weave/semantics.js` actually classifies. Negated frying words are kept out of the title, description, and steps, because "do not deep-fry" still counts as deep.

---

## 1. Deep-Fried Cod with Oven-Roasted Potatoes

`deep-fried-cod-roasted-potatoes` · HH001 **yes**

**Why this gap.** Cod is only a taco. British food is only cottage pie, which HH001 cannot eat (beef, dairy, fish in the gravy). A deep-fried fish plate does not exist. The potatoes are oven-roasted until crisp, so the meal is frying kind `deep` plus roasted crisp, not a second fryer for the potatoes.

**Cuisine / format / primary.** british · plate · cod

**D-03.** effort `involved` (7; technique floor) · complexity `simple` (1) · **55 minutes** (45+)

**Contract.** Club-soda batter, not beer and not a dairy batter. No butter. Cod only, no shellfish. Wheat and egg in the batter.

**Deliberately not.** Not fish tacos, not blackened catfish, not fish cakes, not deep-fried potatoes.

## 2. Pan-Fried Trout with Lemon and Capers

`pan-fried-trout-lemon-capers` · HH001 **yes**

**Why this gap.** No trout. Under-30 dinners are 11 of 75. Salmon is already glazed, miso-seared, or baked. This is a 24-minute pan-fry. The clock is quick. The effort is moderate, not easy.

**Cuisine / format / primary.** american · skillet · trout

**D-03.** effort `moderate` (3) · complexity `standard` (2; trout is a less common case) · **24 minutes**

**Contract.** Olive oil, not butter. Dairy-free vegetable broth in the pan sauce. No nuts. Flour dredge, so wheat is declared.

**Deliberately not.** Not trout meunière. Not grilled swordfish with olives (different fish, different method, no caper-olive overlap).

## 3. Shallow-Fried Green Tomatoes with White Beans and Slaw

`shallow-fried-green-tomatoes` · HH001 **yes**

**Why this gap.** The only southern meal is a shrimp boil with sausage and butter. Green tomatoes are absent. Shallow-fry is almost unused on purpose (sabich and fish cakes pick it up from prose). This plate is shallow-fried, egg-bound, cornmeal, and wheat-free.

**Cuisine / format / primary.** southern · composed-plate · green tomatoes

**D-03.** effort `moderate` (5) · complexity `simple` (1) · **36 minutes**

**Contract.** Egg and water in the dredge, not buttermilk. Vinegar slaw, not mayonnaise. No bacon.

**Deliberately not.** Not a fried-chicken plate. Not another bean stew; the beans are a warm side under a crisp tomato.

## 4. Air-Fried Vegetable Spring Rolls

`air-fried-vegetable-spring-rolls` · HH001 **yes**

**Why this gap.** Vietnamese food is pho (chicken) and turmeric dill fish. No spring roll. Air-frying today is pork, plus a legacy tofu taco. These rolls are the crisp-without-frying case: method `air-fry` only.

**Cuisine / format / primary.** vietnamese · handheld · cabbage

**D-03.** effort `moderate` (5) · complexity `standard` (3) · **41 minutes**

**Contract.** No shrimp. No fish sauce. Soy, lime, and rice vinegar for the dip, so the meal stays plant-based. Wheat wrappers, soy, sesame oil.

**Deliberately not.** Not a deep-fried egg roll. Not a fresh rice-paper summer roll (different texture, and this wave needs the air-fryer).

## 5. Roasted Cabbage Steaks with Cashew Romesco

`roasted-cabbage-cashew-romesco` · HH001 **yes**

**Why this gap.** Cabbage is a stuffed bake and an okonomiyaki, not a roasted steak. Romesco is the honest cashew exception: the classic sauce uses almonds, which HH001 cannot have. This one is cashews only, no bread, so no wheat.

**Cuisine / format / primary.** spanish · composed-plate · green cabbage

**D-03.** effort `moderate` (4) · complexity `simple` (1) · **45 minutes**

**Contract.** `nut_policy: cashews_only_ok`. No almonds, hazelnuts, pine nuts, or dairy. Oven-roasted until crisp. Not frying.

**Deliberately not.** Not biryani's cashews. Not cauliflower shawarma. Not a second lentil pot.

## 6. Sichuan Green Bean and Mushroom Stir-Fry

`sichuan-green-bean-mushroom-stir-fry` · HH001 **yes**

**Why this gap.** Stir-fries are chicken-cashew, peanut noodles, Thai basil eggplant, lomo saltado, and kimchi rice. A plant Chinese stir-fry with no peanut and no chicken is missing. Green beans are not a lead. Method `stir-fry` is not a frying kind.

**Cuisine / format / primary.** chinese · stir-fry · green beans

**D-03.** effort `involved` (6) · complexity `standard` (3; chili bean paste is the specialty item) · **35 minutes**

**Contract.** Chili bean paste is broad beans, chile, and soy, with no shrimp paste. No oyster sauce. No nuts. Steamed rice is part of the meal.

**Deliberately not.** Not the dish under a name that contains "fried." The steps say blistered and stir-fry. Not cashew chicken.

## 7. Spanish Potato Tortilla

`spanish-potato-tortilla` · HH001 **yes**

**Why this gap.** Eggs lead only shakshuka. Spain is only chorizo rice, which HH001 cannot eat. A potato tortilla is the second egg dinner and the first HH001 Spanish meal. Potatoes are shallow-fried in olive oil, then set in egg. Technique floor makes it involved even though the shopping list is four items.

**Cuisine / format / primary.** spanish · skillet · potatoes

**D-03.** effort `involved` (score 5, technique floor) · complexity `simple` (0) · **45 minutes**

**Contract.** No manchego, no other cheese, no chorizo, no milk. Olive oil only.

**Deliberately not.** Not shakshuka. Not a frittata with cream. Not the chorizo rice.

## 8. Grilled Mackerel with Fennel and Orange

`grilled-mackerel-fennel-orange` · HH001 **yes**

**Why this gap.** Grilled dinners are flank steak and swordfish. No mackerel, no whole fish. Fennel and orange are a different plate from olive and caper.

**Cuisine / format / primary.** mediterranean · grilled · mackerel

**D-03.** effort `moderate` (5) · complexity `standard` (2; mackerel is a less common case) · **33 minutes**

**Contract.** Olive oil. No butter, no nuts, no shellfish. Finfish only.

**Deliberately not.** Not swordfish with olives. Not another salmon fillet.

## 9. Seared Duck Breast with Cherry Pan Sauce

`seared-duck-breast-cherry` · HH001 **no**

**Why this gap.** Duck is absent. French food is only a niçoise. General households have a lot of chicken and almost no duck. The skin is seared until crisp. That is not frying: there is no fry token in the title, description, steps, or methods.

**Cuisine / format / primary.** french · composed-plate · duck breast

**D-03.** effort `involved` (7; technique floor) · complexity `standard` (2) · **32 minutes**

**Not HH001.** Poultry. No dairy: the sauce is shallot, cherry, vinegar, and red wine, not butter.

**Deliberately not.** Not a chicken skillet. Not confit.

## 10. Linguine with Clams

`linguine-with-clams` · HH001 **no**

**Why this gap.** Shellfish is shrimp, mussels, and scallops. No clams. Pasta is four meals and none of them are clam linguine. Olive oil, garlic, and white wine. No cheese and no butter, so the dairy flag stays false even though HH001 still cannot eat the shellfish.

**Cuisine / format / primary.** italian · pasta · clams

**D-03.** effort `moderate` (4) · complexity `standard` (2; live clams) · **33 minutes**

**Not HH001.** Shellfish. Wheat from the linguine.

**Deliberately not.** Not shrimp pasta. Not mussels in tomato broth.

---

## Rejected

- **Falafel.** Chickpeas and pita are already doing a lot of work (curry, Moroccan skillet, sabich, shawarma). A third pita would be a format duplicate.
- **Chicken katsu.** Chicken is the largest protein cluster. Duck covers the "something that is not chicken" gap better.
- **Almond romesco or pesto.** Tree nuts other than cashew fail HH001. The romesco uses cashews and says so.
- **Butter meunière, beer batter, mayo slaw, buttermilk dredge, fish sauce in the spring rolls, oyster sauce in the beans, manchego on the tortilla.** Each one is a conditional dietary claim or a hard HH001 miss. The packages require the compliant ingredient instead.
- **A second lentil or bean stew.** HH001 already leans on pulses. The white beans under the green tomatoes are a side, not the meal.
- **Another salmon, another taco, another bowl.** All three formats are crowded.
- **Naming the green beans "dry-fried."** Accurate in some cookbooks, and it would mark the stir-fry as pan-frying under D-06.1. The package uses stir-fry only.
