# Taste learning

No second rating system was added. The taste vocabulary was not redesigned. No migration was written.

## What exists

A meal rating is `dinner_plan_rating.score`, an integer from 1 to 10, stored on the cooked `recipe_version_id`. The number cannot say whether the meal was bland, salty, sweet, or under-acid.

Targeted feedback codes, in `src/lib/cycle2-schema.js` and the check constraint in `migrations/0010_cycle2_taste_contract.sql`:

| Code | What it captures |
|---|---|
| too_spicy | Too spicy. Writes the spicy vocabulary slug. |
| too_rich | Too rich. It does not mean "needs richness." |
| loved_the_crunch | Crunch specifically, not texture in general. |
| great_sauce | A loved sauce. Adjacent to seasoning, not the same judgment. |

The vocabulary itself can record that a person likes crispy, spicy, rich, or a cuisine. It cannot record that this bowl was bland.

## The eight phrases

| Phrase | Captured today |
|---|---|
| Bland | No |
| Too salty | No |
| Too sweet | No |
| Needs acid | No |
| Too spicy | Yes, `too_spicy` |
| Lacking richness | No. `too_rich` is the opposite direction. |
| Excellent seasoning | No. `great_sauce` is narrower. |
| Great texture | No. `loved_the_crunch` is crunch only. |

## Proposal, not a change

The proposal is `docs/catalog/s08/TASTE-FEEDBACK-PROPOSAL.md`. It extends the targeted-feedback codes with `bland`, `too_salty`, `too_sweet`, `needs_acid`, `needs_richness`, `excellent_seasoning`, and `great_texture`, mapped the way `great_sauce` is mapped, with `vocabulary_slug` null, so one meal does not write a standing taste. That needs a forward migration. The migration is not in S-08.

The 1–10 score stays the household rating. These codes would be optional words on that same meal, not a new scale.
