# Audit: Malaysian Curry Laksa with Shrimp

| | |
|---|---|
| Slug | `malaysian-curry-laksa` |
| Recipe version | `rv_malaysian-curry-laksa_v1` |
| Package revision | top-level `freeze-r1`, recipe_version `author-r1` (mismatch) |
| Freeze integrity | stored PASS; auditor re-run PASS (artifact checks only) |
| Overall | **FAIL** (B, M, O) |

Independent auditor (Vale role), 2026-10-15, wave-14 r1. Package not edited. Nothing imported, committed, or deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false; effort_level `involved`, ingredient_complexity `adventurous` (allowed enums; sidecar score 8 / 5 agree). Re-run structural preflight PASS.

## B — FAIL

Equipment/quantity reconciliation fails: 16 cups (4 qt) of noodle water in a 4-quart pot. A 4-quart pot cannot hold 4 quarts of water at a boil (plus the food) without boiling over.

**Fix:** Change equipment to a 6- to 8-quart pot, or cut the water to 12 cups (3 qt) and update the water ingredient line and the step text to match.

## C — PASS

Base 4; scaling for 1/2/4 present with do-not-scale list.

## D — PASS

Heat and doneness cues stated; every component completed; serve step present.

## E — PASS

Prep 25 + cook 28 = 53 minutes. Prep is the sum of prep-phase steps, cook is the sum of cook-phase steps, and overlap steps run inside another step's minutes and add 0. The dried chiles soak during the prep. The noodles cook inside the broth simmer (step 4 states the overlap).

## F — PASS

Store-bought components contracted or none required.

## G — PASS

Eligibility: meat False, poultry True, finfish True, shellfish True, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains shrimp (shellfish) and chicken stock (poultry).). Labels ['dairy_free']. Allergens ['shellfish', 'poultry', 'finfish'] checked against ingredients separately; tokens all importer-valid.

**Dietary eligibility** and **Allergens** audited separately (see line above).

## H — PASS

Vocabulary tags ['spicy', 'rich', 'creamy', 'soups', 'shrimp', 'rice-noodles'] active and supported by the recipe.

## I — PASS

Compared with thai-red-curry-kabocha and coconut-chickpea-curry: a noodle soup with shrimp and homemade laksa paste, not a curry over rice. Compared with brazilian-fish-moqueca: Malaysian spice paste, noodles, shrimp. Compared with the burmese mohinga in this wave: coconut broth, shrimp, no chickpea Checked against 85-meal live catalog at 565d736: not a cosmetic duplicate.

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

## Notes (non-blocking)

- G: coconut disclosed in notes only (no token exists); consistent with the accepted moqueca precedent. HH001 not claimed (shellfish).
