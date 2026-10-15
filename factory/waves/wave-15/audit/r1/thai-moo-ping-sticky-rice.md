# Audit: Thai Moo Ping: Grilled Pork Skewers with Sticky Rice and Jaew Dipping Sauce

| | |
|---|---|
| Slug | `thai-moo-ping-sticky-rice` |
| Recipe version | `rv_thai-moo-ping-sticky-rice_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `thai-moo-ping-sticky-rice.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (B, E) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `involved` (sidecar score 8), ingredient_complexity `standard` (sidecar score 3, 14 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — FAIL

The ingredient prep note says the pork shoulder is 'partly frozen 20 minutes' for slicing, but no step freezes it, and the time clock does not count it (Wave-14 Xi'an cumin lamb precedent: same pattern, B + E FAIL).

**Fix:** Either add a timed step ('Freeze the meat 20 minutes until firm at the edges, then slice...') and count the 20 minutes in prep, or state an explicit overlap with a named parallel task (the marinade is blended) that is at least 20 minutes long. Update time_clock and time_reconstruction. Or drop 'partly frozen' and write 'very cold, sliced thin' with no freeze.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — FAIL

The 20-minute partial freeze from the ingredient note is missing from the clock, so total time under-reports by up to 20 minutes for a cook who follows the note.

**Fix:** Follows the B fix: count the freeze in prep (or state the overlap); if 'partly frozen' is dropped, no clock change is needed.

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry False, finfish True, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains pork (meat).). Labels ['dairy_free'].

**Allergens:** ['meat', 'finfish', 'soy', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the pork.', 'Finfish from the fish sauce (anchovy).', 'Soy and wheat from the soy sauce.', 'The fish sauce label lists anchovy, salt, and sugar, with no shrimp or shellfish.', 'Coconut (coconut milk) is not a FlavorWeave allergen token; diners avoiding coconut should skip this dish.', 'No egg, milk, sesame, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['grilled', 'smoky', 'savory', 'tangy', 'thai'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with nigerian-beef-suya-skewers: pork with a sweet coconut-soy marinade and sticky rice, not beef with peanut spice. Compared with vietnamese-bun-cha: skewered grilled pork with sticky rice and jaew, not patties in a dipping broth with noodles. Compared with hawaiian-huli-huli-chicken in this wave: pork skewers with sticky rice and a chile-lime sauce, not glazed chicken thighs with pineap Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Viewed at full size against image-plating-brief.md and the recipe: main, sides and garnishes are as briefed; no invented ingredient or side; identity is unambiguous.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v1.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. No text, logos or hands.

## L2 — PASS

Appetizing and well lit; the food fills the frame and reads at card size; within the house reference range.

## L — PASS

L1 and L2 both pass (K is judged separately).

## M — PASS

Text provenance `original_ai_assisted`; image `ai_illustration`, generator "Cora via Grok Bot GenerateImage", method_detail states the 1280x720 source; no stock/web photo; no metadata denies present assets.

## N — PASS

Shopping list derivable; units and package sizes are shoppable.

## O — PASS

package_revision `author-r2` consistent across top-level, recipe_version, image, sidecar and docs; version 1; classification_history present; FREEZE_INTEGRITY re-run PASS (26/26).

## Notes (non-blocking)

- G: fish sauce tokenized finfish; coconut milk disclosed in notes (no coconut token); not HH001 (pork). K: lime is in the recipe.
