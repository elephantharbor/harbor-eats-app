# Wave-16 selection rationale

Goal: 15 dinners that take the catalog from 185 to 200 and fill real gaps, without duplicating any of the 185 existing meals (135 live before wave-15 plus the 50 wave-15 meals) or each other. The numbers behind this are in `coverage.md` and `notes/existing-185.tsv`.

## Rules used

1. **No chicken, no poultry.** Poultry already has 23 meals (19 with chicken in the title), so wave-16 adds none.
2. **Lean on vegetarian, seafood, and non-chicken proteins.** The mix is 6 vegetarian, 6 seafood (2 shrimp, 4 fish), and 3 pork or beef.
3. **Shellfish first among the seafood.** Shellfish is the thinnest class (5 meals), and shrimp leads only a pasta, a sheet-pan boil, and a laksa. The two shrimp meals use formats the catalog does not have.
4. **New cuisines where possible, one meal per cuisine.** Six labels are new (austrian, cambodian, goan, indonesian, jamaican, russian), and Sichuan flavor goes under chinese. Only one meal (pasta alla Norma) joins the large Italian cluster.
5. **Weeknight time.** 62 existing meals take over an hour and 25 take over 90 minutes. Wave-16 runs 35 to 53 minutes, and 10 of the 15 take 45 minutes or less. There are no braises, marinades, or overnight steps.
6. **HH001 where the dish allows it honestly.** 6 of 15 are HH001: two plant-based meals (mapo tofu, japchae) and four fish meals (amok, sabzi polo, escovitch, poke). None is forced into the contract by dropping a defining ingredient.
7. **Format gaps.** The wave adds a steamed custard, a no-cook raw fish bowl, a shrimp curry, shrimp over grits, a breaded cutlet with potato salad, fritters, glass noodles, and a seared-steak main salad.
8. **Near-duplicate guard.** Each package names at least two existing or planned meals it was compared with and explains the difference (`near_duplicate_review` in v1.json). The builder refuses a slug that already exists and any comparison that points to a meal that doesn't exist.

## The 15

| Slug | Gap it fills |
|---|---|
| sichuan-mapo-tofu-shiitake | Plant-based HH001 tofu in a thickened chili-bean sauce over rice. Sichuan flavor is otherwise only a dry green bean stir-fry. |
| korean-japchae-vegetables | Plant-based HH001 Korean noodles. The Korean meals are a steak, a fried rice, a stew, a braise, and short ribs. It is the first sweet potato starch noodle in the catalog. |
| indonesian-gado-gado-tempeh | New cuisine (Indonesian). A warm composed vegetable plate with peanut sauce. It is the second tempeh lead. |
| russian-mushroom-stroganoff | New cuisine (Russian). A vegetarian creamy mushroom sauce over egg noodles. |
| sicilian-pasta-alla-norma | Eggplant pasta, since eggplant has no pasta lead. It is the only Italian meal in the wave. |
| turkish-mucver-zucchini-fritters | Vegetarian fritters, and zucchini has no lead. The Turkish meals are both lamb. |
| southern-shrimp-and-grits | Shellfish in a new format: shrimp over creamy grits. |
| goan-shrimp-ambot-tik | New label (Goan). A sour-hot shrimp curry without coconut, so it doesn't repeat the coconut seafood stews. |
| cambodian-fish-amok | New cuisine (Cambodian). An HH001 steamed fish custard, a hands-off method. |
| persian-sabzi-polo-salmon | An HH001 salmon dinner (salmon leads only two). Herbed rice is the Persian format the catalog lacks. |
| jamaican-escovitch-snapper | New label (Jamaican). An HH001 fried fish with a pickled-vegetable topping. |
| hawaiian-ahi-poke-bowl | An easy, no-cook HH001 raw tuna bowl. Hawaiian is otherwise only huli-huli chicken. |
| austrian-pork-schnitzel-potato-salad | New cuisine (Austrian). The first breaded pork cutlet, a meat dinner that isn't chicken. |
| cuban-picadillo-rice | A 45-minute Cuban ground-beef dinner. The Cuban meals are an all-day ropa vieja and a sandwich. |
| thai-yum-nua-beef-salad | A beef main salad. Main salads exist only with chicken (Cobb) and tuna (niçoise). |

## Realism checks applied while writing

These lessons were applied up front:

- Every pot named fits its water. The rule is about 0.46 quart per cup, so 12 cups uses a 6-quart pot and 16 cups an 8-quart pot.
- Every step that brings 4 or more cups to a boil states the minutes it takes, and those minutes are inside the step clock.
- No untimed waits: no chilling, freezing, overnight, or "until set" steps.
- Counted equipment (the amok's four 12-ounce ramekins) is named in the 1- and 2-serving scaling notes.
- Every food word in a description is an ingredient.
- Image styling props are limited to recipe items and neutral tableware.

Rice overlaps were checked by hand. Each rice pot's boil, cook, and rest fits inside the steps it runs under.
