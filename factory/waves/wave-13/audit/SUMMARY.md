# Wave-13 audit summary

Independent auditor (Vale role), 2026-10-11. Run `bc-d19f3d1e-d801-59d5-8734-22463092a47a` ([run](https://cursor.com/agents/bc-d19f3d1e-d801-59d5-8734-22463092a47a)). Branch `cursor/catalog-factory-wave-13-c595`. Recipe text was not edited by the auditor. Nothing was imported, published, or deployed.

First audit, commit `f2f95a9`, was of `author-r1`: 8 PASS, 2 FAIL (cabbage gate E, Sichuan gate B).

Re-audit is of the author revision at `73f897a`. Those two meals are now `author-r2`. Freeze integrity is PASS on the revised packages. Gates A–O were run again on both. The other eight stayed `author-r1`.

## Verdicts

| Meal | Revision | Overall | Failed gates |
|---|---|---|---|
| Air-Fried Vegetable Spring Rolls | author-r1 | PASS | — |
| Deep-Fried Cod with Oven-Roasted Potatoes | author-r1 | PASS | — |
| Grilled Mackerel with Fennel and Orange | author-r1 | PASS | — |
| Linguine with Clams | author-r1 | PASS | — |
| Pan-Fried Trout with Lemon and Capers | author-r1 | PASS | — |
| Roasted Cabbage Steaks with Cashew Romesco | author-r2 | PASS | — |
| Seared Duck Breast with Cherry Pan Sauce | author-r1 | PASS | — |
| Shallow-Fried Green Tomatoes with White Beans and Slaw | author-r1 | PASS | — |
| Sichuan Green Bean and Mushroom Stir-Fry | author-r2 | PASS | — |
| Spanish Potato Tortilla | author-r1 | PASS | — |

**10 PASS, 0 FAIL.**

## What changed on the two revisions

**Cabbage, gate E, now PASS.** Step 1 heats the oven to 425 F for about 15 minutes and keeps the pan out. Cutting and oiling happen during that preheat. The pan goes in only after the oven is hot. Cook 30 is 8 minutes with the cashews plus about 22 minutes more. The sauce is blended during the roast. Prep 15 + cook 30 = 45. Active time, about 15 minutes, sits inside that total.

**Sichuan stir-fry, gate B, now PASS.** Water is two lines: 2.25 cups for the rice and 0.5 cup for the sauce. Half a cup is 8 tbsp, split in the step as 2 tbsp of slurry and 6 tbsp in the sauce. The rice step uses only the rice water. The stir-fry adds the finished sauce and no more water.

Both stay on version 1. They were unpublished drafts. `classification_history` records `author-r1` to `author-r2` with the same D-03 enums. Image SHA-256 values match the first audit, so K, L1, and L2 were re-applied to the same pixels and still pass.

## The other eight

`v1.json`, `img_v1.jpg`, both WebPs, the plating brief, the image prompt, and `d03-classification.json` are the same git blobs as `f2f95a9`. Image SHA-256 values match the first audit. Package revision is still `author-r1`. Those gates were not reopened.

`FREEZE_INTEGRITY.json` on those eight differs from the first audit only in the recorded `candidate_dir` path. The freeze result is still PASS.

## What still holds

Household 001 claims match the booleans. Eight meals are eligible. Linguine is out because clams are shellfish. Duck is out because duck is poultry. Allergen tokens still match the ingredients. `deriveCookingMethod` still matches the stored cooking object on the two revised packages, including after the new step text. No fry word was added.

Per-meal evidence is in `factory/waves/wave-13/audit/<slug>.md`.
