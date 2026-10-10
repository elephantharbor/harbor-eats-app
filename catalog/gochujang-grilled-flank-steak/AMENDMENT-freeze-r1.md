# AMENDMENT freeze-r1 — gochujang-grilled-flank-steak

Type: contract-forward creator records amendment (records/classification only). Author: Juniper (Harbor Eats - Catalog Curator). Date: 2026-10-10 (America/Chicago). Source: `dry-run-1/candidates/gochujang-grilled-flank-steak/v1.json` (Dry Run #1, Vale r2 PASS, pre-contract; no package_revision).

## Contract migration (old -> new)
- package_revision added
- dietary_eligibility object added
- poultry/meat moved from allergens to dietary_eligibility
- D-03 effort_level/ingredient_complexity replace legacy effort/complexity
- image.generation.generator added from existing generator_identity
- image.dimensions converted to master/card format
- wheat added to allergens (soy sauce + gochujang carry no wheat-free requirement)

## Current values
- package_revision: freeze-r1 · version_number 1 (unchanged)
- effort_level: moderate · ingredient_complexity: standard (classification_history in v1.json; factor scores in d03-classification.json)
- dietary_eligibility: {"contains_meat": true, "contains_poultry": false, "contains_finfish": false, "contains_shellfish": false, "contains_dairy": false, "plant_based_compatible": false, "vegetarian_compatible": false, "pescatarian_compatible": false, "nut_policy": "none", "hh001_eligible": false}
- dietary_labels: ['dairy_free']
- allergens: ['soy', 'sesame', 'wheat']
- image: generator added from existing generation.generator_identity; dimensions now master_width/master_height/card_width/card_height (1200x900 / 640x480); pixels byte-identical (sha256 in image.carried_forward).

## Unchanged
Ingredients, quantities, steps, times, components, equipment, scaling notes, images. culinary_hash `cf9efd51ba33d4a6bd7ee99eb3816199cd41655fae454e6717dfc5d5716e5ca8` equals the dry-run-1 record under the basis in v1.json culinary_hash_basis.

## Certification scope
The `certification` block is the Dry Run #1 Vale r2 PASS of the pre-contract record and does not certify freeze-r1. Re-audit scope: A, G, J-classification, M, N, O.
