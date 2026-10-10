# AMENDMENT freeze-r1 — crispy-skillet-chicken-sandwiches

Type: contract-forward creator records amendment (records/classification only). Author: Juniper (Harbor Eats - Catalog Curator). Date: 2026-10-10 (America/Chicago). Source: `dry-run-1/candidates/crispy-skillet-chicken-sandwiches/v1.json` (Dry Run #1, Vale r2 PASS, pre-contract; no package_revision).

## Contract migration (old -> new)
- package_revision added
- dietary_eligibility object added
- poultry/meat moved from allergens to dietary_eligibility
- D-03 effort_level/ingredient_complexity replace legacy effort/complexity
- image.generation.generator added from existing generator_identity
- image.dimensions converted to master/card format
- dairy_free label removed; dietary_eligibility.contains_dairy set conservatively true (Cora decision)

## Current values
- package_revision: freeze-r1 · version_number 1 (unchanged)
- effort_level: moderate · ingredient_complexity: standard (classification_history in v1.json; factor scores in d03-classification.json)
- dietary_eligibility: {"contains_meat": false, "contains_poultry": true, "contains_finfish": false, "contains_shellfish": false, "contains_dairy": true, "plant_based_compatible": false, "vegetarian_compatible": false, "pescatarian_compatible": false, "nut_policy": "none", "hh001_eligible": false}
- dietary_labels: []
- allergens: ['egg', 'wheat']
- image: generator added from existing generation.generator_identity; dimensions now master_width/master_height/card_width/card_height (1200x900 / 640x480); pixels byte-identical (sha256 in image.carried_forward).

## Unchanged
Ingredients, quantities, steps, times, components, equipment, scaling notes, images. culinary_hash `0c0cd0c7b7220636001787b27880334b1ef2108c6b9432047e289ea6d9b1c62b` equals the dry-run-1 record under the basis in v1.json culinary_hash_basis.

## Certification scope
The `certification` block is the Dry Run #1 Vale r2 PASS of the pre-contract record and does not certify freeze-r1. Re-audit scope: A, G, J-classification, M, N, O.
