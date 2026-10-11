# FlavorWeave Catalog Certification

Binary **PASS** or **FAIL**. There is no PASS WITH NOTES for publication.

The independent auditor is a different cloud agent from the author. The author cannot self-certify. The auditor does not rewrite the package to make a gate pass.

## Freeze integrity is not certification

Do not start gates A–O unless the candidate directory has `FREEZE_INTEGRITY.json` with `FREEZE_INTEGRITY: PASS` from `factory/tools/freeze_integrity.py` for the current revision. A FAIL stops certification. The auditor cannot override it.

A freeze PASS says nothing about culinary quality, diet, image fidelity, hero appeal, novelty, or whether the D-03 labels are plausible.

Run:

```bash
python3 factory/tools/freeze_integrity.py <candidate-dir>
```

## Binding rules

- **Dietary eligibility and allergens are separate.** Allergens that exist only in notes fail.
- **No conditional dietary claims.** "Dairy-free if…" without a hard ingredient contract fails.
- **Freeze before audit.** Refuse the audit if the WebP master or card, image provenance, `dietary_eligibility`, `allergens`, `package_revision`, `effort_level`, or `ingredient_complexity` is missing, or if metadata denies files that are present.
- **Time realism (E).** Reconstruct prep, cook, and total from the steps. A cold oven that starts at the bake step, with no preheat minutes and no earlier overlap, fails. A short clock is not a low effort score.
- **Culinary promise vs technique (J).** Challenge the title, description, and taste tags against the method. Also check that D-03 labels match the method and the shopping list. A label driven by cuisine unfamiliarity, rather than sourcing or assembly, fails the cultural-bias rule.
- **Image fidelity (K).** Ingredients, technique, plating, sauce, texture, and grain identity match the recipe. A beautiful picture of the wrong meal fails.
- **Image style (L = L1 + L2).** L1 is technical (WebP 1200×900 and 640×480, crop, forbidden artifacts, provenance). L2 is hero appeal. Either failure fails L. Accurate but dull fails L2. See `IMAGE-SPEC.md`.
- **Rejected images** are not the active hero.
- **Plating brief.** A new image without `image-plating-brief.md` is a process defect.
- **D-03.** Gate A requires both enums (`easy|moderate|involved`, `simple|standard|adventurous`). There is no separate classification gate. A classification-only audit (A, and J for classification) does not reopen K or L.

## Gates A–O

| Gate | What it covers |
|---|---|
| A | Schema and identity, including D-03 enums |
| B | Ingredient and instruction reconciliation |
| C | Quantity integrity at 1, 2, and 4 servings |
| D | Culinary completeness |
| E | Time realism |
| F | Compound ingredients |
| G | Dietary eligibility and allergen integrity, audited separately |
| H | Taste vocabulary (active D-02 slugs only) |
| I | Duplicate and novelty against the live catalog |
| J | Culinary plausibility, consumer promises, and classification plausibility / cultural bias |
| K | Image fidelity |
| L | L1 technical/style and L2 hero appeal. Either failure fails L |
| M | Provenance |
| N | Shopping compatibility |
| O | Version and history |

In every image audit, report K, L1, and L2 separately, then the rolled-up L. Report dietary eligibility and allergens as separate sections. Report `effort_level` and `ingredient_complexity` under A and under J-classification.

### L2 checklist

Appetite appeal. Freshness. Hero ingredient clarity. Useful contrast. Visible textures. Flattering, believable light. Intentional plating. Abundant, not sparse. Still readable at card size. Parity with the strongest existing FlavorWeave cards. The house reference is Chipotle Lime Black Bean Bowl quality (`factory/tools/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png`), not a composition to copy. Attractive without fidelity violations.

## Revision loop

FAIL → name the gate (K vs L1 vs L2 vs A vs J-classification, and say so) → the author revises → re-freeze → freeze integrity PASS → a new audit by the independent auditor.

A classification-only FAIL is a metadata amendment on the same version. No culinary v2. No image regeneration.

A first-pass recipe or image FAIL is not a factory-process failure when the loop handles it. Retire a weak concept instead of sanding it into a duplicate.

## What the auditor writes

A `VALE-AUDIT-<slug>.json` (the filename is historical; the file is the auditor's record) with candidate id, version ids, audit date, per-gate A–O, K/L1/L2, classification notes, `overall: PASS|FAIL`, and the auditor's run identity. The author does not create this file.
