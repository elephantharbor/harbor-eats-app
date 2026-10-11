# FlavorWeave Catalog Coverage Analysis

Procedure for the author before any factory batch. The wave's own write-up lives at `factory/waves/<wave>/coverage.md` and `selection-rationale.md`. This file is the procedure, not a snapshot.

## Purpose

What does the catalog already cover, where are the gaps, and why does this batch exist?

Inventory `catalog/<slug>/` using the current version (`v2.json` if present, otherwise `v1.json`). Do not count `catalog/legacy-24/` or `catalog/staging-publication.json` as meals. State the git SHA the inventory was taken from.

## Dimensions

Counts, not arbitrary percentages.

- Cuisine (Mexican, Italian, Mediterranean, Indian, Thai, Japanese, Korean, Middle Eastern, American, and other cuisines actually present or actually missing)
- Meal format (tacos, bowls, pasta, soups and stews, sheet-pan, grilled, sandwiches, composed plates, curries, stir-fries, casseroles, and formats with a single meal or none)
- Main ingredient or protein (tofu, beans and lentils, fish, shellfish, poultry, beef, pork, vegetables, grains, eggs, and species or cuts at zero)
- Dietary reach, including Household 001: no dairy, no shellfish, no meat other than fish, no poultry; nuts only as cashews; eggs, finfish, and sesame allowed. HH001 is eligibility awareness. It is not a quota. When a task sets a minimum, meet it with meals that are also worth cooking.
- Flavor, using active D-02 slugs in `src/lib/taste-vocabulary.js`
- Texture (crispy, creamy, crunchy, tender)
- Time bands (under 30, 30–45, 45+)
- D-03 effort and ingredient complexity
- Technique and equipment (skillet, oven, grill, sheet pan, one-pot, air fryer, pressure cooker)

### Cooking-method dimension (D-06.1)

Also inventory frying and crispiness with `deriveCookingMethod` from `src/weave/semantics.js`.

- Frying kinds: deep, pan, shallow
- Not frying: air-fried crisp, baked or roasted crisp, stir-fry

Most current meals have no `methods` array, so the classifier falls through to step prose. Prose mislabels meals ("do not deep-fry" counts as deep; "crisp-fried onions" counts as pan). A gap analysis should separate:

- meals whose `methods` tokens state the kind
- meals classified only because a word appeared in the steps
- meals with no cooking classification

New packages state the kind in `methods` and keep the prose consistent. See `PACKAGE.md`.

Also flag near-duplicate clusters.

## Outputs before candidates

1. Published count and the distribution above
2. The gaps that matter
3. Why this batch exists
4. Explicit rejections: candidates that add no coverage, or that are cosmetic duplicates

Preserve D-03 in the report. This is an author tool, not a consumer dashboard.

## Selection bar

Every pick is a meal someone would cook this week. Coverage does not rescue a dull concept. Name the hard dietary contract for each Household 001 meal at selection time, before the recipe is written. `kitchen_tested` will be false. Proposed D-03 levels are re-scored with the rubric at package time. Complexity is shopping and assembly burden, never cultural unfamiliarity.

Hero-image risk belongs in the rationale. A meal that will photograph as a brown puddle needs contrast named up front, from ingredients the recipe actually contains.
