# Targeted feedback codes — proposal

This is a proposal. S-08 does not add a migration, does not edit `TARGETED_FEEDBACK_CODES`, and does not change the SQL check in `migrations/0010_cycle2_taste_contract.sql`.

## Why

`dinner_plan_rating.score` is an integer from 1 to 10 on the cooked `recipe_version_id`. The number cannot say whether that meal was bland, salty, sweet, or under-acid.

The codes that exist today:

| Code | Signal | Vocabulary slug |
|---|---|---|
| loved_the_crunch | loved | crispy |
| too_spicy | too_much | spicy |
| great_sauce | loved | null |
| too_rich | too_much | rich |

`too_rich` is the opposite of needing richness. `loved_the_crunch` is crunch only. `great_sauce` is a sauce, not seasoning in general.

## Codes to add

Map every new code the way `great_sauce` is mapped: `vocabulary_slug` null. One meal must not write a standing taste.

| Code | Label | Signal | What it captures |
|---|---|---|---|
| bland | Bland | too_little | The meal needed more seasoning. Not a request to salt every future meal. |
| too_salty | Too salty | too_much | This meal was too salty. |
| too_sweet | Too sweet | too_much | This meal was too sweet. |
| needs_acid | Needs acid | too_little | This meal needed acid. |
| needs_richness | Needs richness | too_little | This meal needed richness. Distinct from `too_rich`. |
| excellent_seasoning | Excellent seasoning | loved | Seasoning of this meal, broader than `great_sauce`. |
| great_texture | Great texture | loved | Texture of this meal, broader than `loved_the_crunch`. |

The 1–10 score stays the household rating. These codes would be optional words on that same meal, not a new scale and not a second rating system.

## What a later migration would touch

- Add the seven codes to the check constraint on `targeted_feedback`.
- Add them to `TARGETED_FEEDBACK_CODES` and `TARGETED_FEEDBACK` in `src/lib/cycle2-schema.js`.
- Leave `vocabulary_slug` null on insert so the vocabulary tables do not gain a standing preference from one dinner.

Do not do that work in S-08.
