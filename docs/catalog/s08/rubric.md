# Culinary quality rubric

Gate D is this judgment. It is not a score, and it is not a salt minimum per serving. Acid, garlic, onion, umami, oil, and garnish are not required.

Judge each dimension against the yield, the ingredients, the technique, and the diet.

| Dimension | What a pass looks like |
|---|---|
| Seasoning | Salt is enough for this yield and this technique. Prepared ingredients that are already salty count. A lower-sodium version says what still seasons the dish. |
| Balance | Sweet, salty, acid, heat, and bitterness are in a relationship a cook would recognize for this dish. One of them may be absent on purpose. |
| Aromatics | The aromatics the title promises are in the method, at a time when they can be tasted. |
| Technique | The heat, the order, and the vessel can produce the texture the title claims. |
| Texture | The steps name the doneness that matches the dish. |
| Finishing | A finisher is used if the recipe lists one. A missing garnish is not a failure. |
| Dietary compensation | If a swap removes salt, fat, or savoriness, the recipe puts something back that the diet still allows. |
| Reproducibility | Amounts, units, and salt type are specific enough that two cooks are not guessing. |

## Salt

Grams plus a named salt. Volume is the equivalent, not the source of truth.

UC ANR publication 390575, November 2023, "Salt for Preserving and Cooking": https://ucanr.edu/sites/default/files/2023-11/390575.pdf

| Salt | Grams per teaspoon |
|---|---|
| Diamond Crystal kosher | 2.8 |
| Morton coarse kosher | 4.8 |
| Table or canning | 6 |

Discarded pasta or potato water that the dish relies on states a ratio or a reason to leave it unsalted. About 1% by weight is the usual target: 28 g in 3 qt, 38 g in 4 qt, 24 g in 10 cups. Absorbed rice, quinoa, and couscous use about 0.5% to 0.8%, because that water is eaten.

Do not print a precise sodium number from these kitchen measures. Brand Dijon, soy, and broth vary.

## Deterministic checks

`src/lib/culinary-quality.js` fails a package for an unnamed salt, a missing or unusable amount, a missing unit, an ingredient the steps never use, a step that cites an unlisted ingredient, a do-not-add with no culinary or dietary reason, a taste step on raw protein, and an internal temperature below the FDA default for the protein in that sentence.

Seafood 145 F. Poultry 165 F. Ground meat 160 F. Whole-muscle beef, pork, and lamb 145 F. A pull temperature within 10 F of the floor is accepted when the doneness text says carryover or rising to the floor. A lower number that the text marks as not the instruction is accepted.

A missing boil-salt ratio is a warning. A reviewer override `boiling_salt_ratio`, or `do_not_add:<step number>`, records that a person accepted it.

Structural preflight runs the checks only when `evidence.culinary_reviewed` is set.

## Evidence

Structurally validated, culinary-reviewed, kitchen-tested, and household-rated are separate. Only a recorded human cook moves the last two. This cycle's revisions are culinary-reviewed and not kitchen-tested.
