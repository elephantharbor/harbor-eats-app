# Audit: Deep-Fried Cod with Oven-Roasted Potatoes

| | |
|---|---|
| Slug | `deep-fried-cod-roasted-potatoes` |
| Recipe version | `rv_deep-fried-cod-roasted-potatoes_v1` |
| Package revision | `author-r1` |
| Freeze integrity | PASS |
| Overall | **PASS** |

Independent auditor (Vale role), 2026-10-11. Run `bc-d19f3d1e-d801-59d5-8734-22463092a47a`. Recipe text was not edited. Importer accepts the package. Structural preflight image slot is PASS.

Hash re-check at `73f897a`: `v1.json`, `img_v1.jpg`, both WebPs, the plating brief, the image prompt, and `d03-classification.json` are the same blobs as the audit at `f2f95a9`. Image SHA-256 values match. Package revision is still `author-r1`. Gates were not reopened. Verdict remains PASS.

## A — PASS

Identity ids agree. Version 1, immutable, draft, not recommendation-eligible. `kitchen_tested` false, cooks and ratings 0. `effort_level` `involved`, `ingredient_complexity` `simple`. Equipment includes a heavy pot, a deep-fry thermometer, a sheet pan, a rack, and tongs. `certification` and `auditor` are null.

## B — PASS

Salt is split in the note and the steps: 1 tsp on the potatoes, 1/2 tsp in the batter, 1 tsp on the fish, and 2.5 tsp is the ingredient. Flour, cornstarch, baking powder, egg, and club soda are the batter. Parsley, lemon, and vinegar are the finish. Every ingredient id is referenced.

## C — PASS

Four fillets and 2 lb potatoes at 4 servings. Scaling keeps oil depth and 375 F fixed and quarters the fish, batter, and potatoes. Quantities are numeric.

## D — PASS

Oven 425 F, oil 375 F, cod to 145 F and deep golden, potatoes tender with crisp edges, turned once. Club-soda batter lumps are allowed. The fry is sequenced into the last 10 minutes of the roast.

## E — PASS

Prep 20 + cook 35 = 55. Step 1 turns the oven to 425 F before the other prep and says it heats during that prep. Step 2 states the 20 minutes include the oven heat. The roast clock starts after that. The fry sits inside the 35-minute roast, so it is not added again.

## F — PASS

The batter is made in the recipe. Club soda is contracted as the liquid, not beer and not milk. Neutral oil is contracted as canola or peanut-free vegetable oil. No beer batter and no dairy batter.

## G — PASS

**Dietary eligibility.** Meat, poultry, shellfish, and dairy are false. `contains_finfish` true. Plant-based and vegetarian false. `nut_policy` `none`. `hh001_eligible` true. Finfish and egg are allowed for Household 001. The oil note excludes peanut oil, so the nut policy is not contradicted. Labels: `dairy_free`, `fish`. No conditional dietary claim.

**Allergens.** `finfish`, `wheat`, `egg`. Finfish is the cod. Wheat is the flour (cornstarch is also in the batter; the wheat token is justified by the flour). Egg is the egg. Club soda is not milk. No peanut token, and the frying oil is peanut-free by contract. No shellfish.

## H — PASS

`cod`, `crispy`, `savory`, `fresh` are active slugs. `cod` is an active ingredient term. Crisp matches the batter and the potato edges.

## I — PASS

Catalog cod is a taco, not a deep-fried plate. Cottage pie is the British meal and HH001 cannot eat it. Catfish is blackened. Fish cakes are a different shape. The gap is real.

## J — PASS

Deep-fried battered cod plus oven-roasted wedges matches the title and the steps. `methods` are `deep-fry` and `roast`. Derived cooking is `frying: ["deep"]`, `crispy_non_fry: ["baked", "roasted"]`, `stir_fry: false`, `source: "metadata"`, and the stored object matches. "Oven" plus "crisp" is why `baked` appears beside `roasted`. That is the classifier, not a second fryer. No negated fry phrase. Potatoes are roasted, not deep-fried.

**Classification.** Effort 1 + 2 + 1 + 2 + 1 = 7, involved. Technique 2 with prep 1 also trips the involved floor. Complexity: 10 counted items, band 0, specialty 0, flavor breadth 1, pantry 0, sum 1, simple. Oils, salt, and pepper are excluded. Club soda is ordinary grocery. British cooking is not scored. Sidecar matches the package.

## K — PASS

The hero is two pieces of rough golden batter, a broken edge of white fish, roasted potato wedges with browned edges, parsley, a lemon wedge, and a small ramekin of dark vinegar. No fries, slaw, peas, butter, tartar, or shrimp. The crust reads deep-fried. The potatoes read roasted, not a second fry.

## L1 — PASS

Master 1200×900 WebP RGB, card 640×480 WebP RGB, source 1280×720 JPEG. SHA-256 values match. No text, logo, or rejected files. Provenance complete, model `unknown`.

## L2 — PASS

Crust, lemon, and browned potato edges are the appetite. The plate is full. Both the fish and the wedges survive a card crop. Light and dishware match the house standard without copying the bowl.

## L — PASS

L1 and L2 both pass.

## M — PASS

`original_ai_assisted` text. Image generation dated 2026-10-11, generator named, model `unknown`, stock flag false. Brief and prompt present.

## N — PASS

Fish is a count with a weight note (about 6 oz, 1.5 lb total). Oil is 6 cups with a depth note and a do-not-scale on depth. Vinegar is a table spoonful, not an unlabeled condiment.

## O — PASS

First version, classification history present, auditor and certification null.
