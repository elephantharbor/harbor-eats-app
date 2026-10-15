# Audit: Philly Cheesesteaks with Griddled Onions and Provolone

| | |
|---|---|
| Slug | `philly-cheesesteaks` |
| Recipe version | `rv_philly-cheesesteaks_v1` |
| Package revision | top-level `freeze-r1`, recipe_version `author-r1` (mismatch) |
| Freeze integrity | stored PASS; auditor re-run PASS (artifact checks only) |
| Overall | **FAIL** (F, G, M, O) |

Independent auditor (Vale role), 2026-10-15, wave-14 r1. Package not edited. Nothing imported, committed, or deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false; effort_level `moderate`, ingredient_complexity `simple` (allowed enums; sidecar score 4 / 0 agree). Re-run structural preflight PASS.

## B — PASS

9 ingredients, 6 steps; every ingredient used; splits stated in notes and steps.

## C — PASS

Base 4; scaling for 1/2/4 present with do-not-scale list.

## D — PASS

Heat and doneness cues stated; every component completed; serve step present.

## E — PASS

Prep 8 + cook 25 = 33 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. Linear stovetop clock. The rolls toast on the griddle while the onions finish (step 3 states the overlap). No oven.

## F — FAIL

Hoagie rolls are a store-bought component without a hard contract. US commercial hoagie rolls commonly contain soy (lecithin/flour), and some contain milk or egg.

**Fix:** Add a hard contract to the roll line: 'hoagie rolls whose label lists no soy, milk, or egg', or tokenize instead (see G).

## G — FAIL

allergen_notes claim 'No egg, soy...' but the roll is uncontracted. A wrong 'safe for X' claim is a FAIL (wave-12 smash-burger bun precedent).

**Fix:** Either add 'soy' (and 'egg') to allergens and delete 'No egg, soy' from the notes, or keep the claim and add the hard roll contract from F.

**Dietary eligibility** and **Allergens** audited separately (see line above).

## H — PASS

Vocabulary tags ['savory', 'rich', 'sandwiches', 'american'] active and supported by the recipe.

## I — PASS

Compared with classic-smash-burgers: chopped shaved steak in a roll, no patty. Compared with crispy-skillet-chicken-sandwiches: beef, not breaded chicken. Compared with tomato-soup-grilled-cheese: a hot meat sandwich, no soup. Checked against 85-meal live catalog at 565d736: not a cosmetic duplicate.

## J — PASS

Title/description/methods/cooking object agree; D-03 classification consistent under the repo contract (<=12/13-16/17+); no cuisine/pantry bias points.

## K — PASS

Hero shows the recipe's main, sides and garnishes as briefed; no forbidden elements; identity unambiguous.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480; source 1280x720 (16:9 cropped/upscaled, visibly clean). SHA-256 match. No text/logo/hands. No rejected/ assets.

## L2 — PASS

Appetizing, well-lit, food fills the frame, reads at card size; in range of house reference.

## L — PASS

L1 and L2 both pass (K is judged separately).

## M — FAIL

FAIL (systemic). Metadata denies assets that are present. README.md says "The WebP master and card are not, yet. Freeze integrity fails until the image pass adds..."; image-prompt.md opens "Status: pending_image_pass... Not a finished asset"; recipe_version.immutability_note says the image slot is pending_image_pass; recipe_version.structural_qa_state is `author_r1_image_slot_pending`; image.recipe_fidelity_state is `awaiting_preflight`; image.generation.method_detail says "4:3 landscape" but the source is 1280x720 (16:9), centre-cropped and upscaled. catalog-package forbids README lines claiming images incomplete once WebPs exist, and catalog-certification refuses audit when metadata denies present assets (wave-11 tibs precedent: M and O FAIL on the same pattern). Text provenance `original_ai_assisted`, image `ai_illustration`, generator "Cora via Grok Bot GenerateImage", model `unknown`, stock/web photo false, rights not cleared: those parts are fine.

**Fix:** Scrub denial/stale lines in the generators (tools/write_docs.py, tools/finalize_images.py), then re-freeze: README.md remove "not, yet"/"Freeze integrity fails until..." and state the master/card are present with hashes; image-prompt.md drop "Status: pending_image_pass... Not a finished asset"; recipe_version.immutability_note drop "pending_image_pass"; recipe_version.structural_qa_state -> `frozen_for_audit`; image.recipe_fidelity_state -> `frozen_for_audit` (or `pending_audit`); image.generation.method_detail -> "GenerateImage 1280x720 (16:9) source, centre-cropped to 960x720 and LANCZOS-upscaled to 1200x900".

## N — PASS

Shopping list derivable; units and package sizes shoppable.

## O — FAIL

FAIL (systemic). Top-level and image `package_revision` are `freeze-r1`, but `recipe_version.package_revision` is still `author-r1`, the plating brief header says "revision author-r1", and README cites package_revision `author-r1`. One package must carry one revision. Version 1, immutable, unpublished, classification_history present: fine.

**Fix:** Set recipe_version.package_revision, the image-plating-brief.md header and README to `freeze-r1` (or bump everything to one new revision), regenerate FREEZE_INTEGRITY.json and STRUCTURAL_PREFLIGHT.json after the image pass (current preflight files are timestamped 09:50, before the 09:57 images).
