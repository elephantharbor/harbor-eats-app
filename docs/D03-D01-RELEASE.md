# D-03, D-01, and swap dialog

One release: catalog classification, planning-run preferences, and the active-plan swap dialog. Culinary recipe text, images, and the 50-meal count stay as they were. Gate K/L and culinary versions are not reopened.

Classifications are locked for this cycle after Vale’s D-03 prep-r2 re-check, PASS 50/50. The batch id is `d03-classification-backfill-juniper-prep-r2`. The vendored labels are `data/d03-backfill-classifications-r2.json`.

## D-03 fields

Published recipe versions store:

- `effort_level`: `easy` | `moderate` | `involved`
- `ingredient_complexity`: `simple` | `standard` | `adventurous`

Final distribution: effort 16 easy / 29 moderate / 5 involved; complexity 22 simple / 26 standard / 2 adventurous.

Removed from published packages and from D1:

- `recipe_version.effort` (display string)
- `recipe_version.complexity` (the old package field)
- `dish.effort_band`

Superseded `v1.json` files stay on disk, including those legacy keys. Import treats them as retired when a v2 exists, so they are not published and they are not required to carry the new enums.

`content_hash` is the culinary hash. It excludes classification enums, `classification_hash`, and the removed legacy strings. Changing only a classification does not mint a recipe version and does not change `content_hash`. `classification_hash` is the sha256 of canonical `{effort_level, ingredient_complexity}`.

Historical hashes already stored in preview and production were computed when `effort` was still inside the hash. `data/d03-classification-import.sql` updates classification columns and appends history. It does not rewrite `content_hash`. A full replay of `data/staging-catalog-import.sql` onto those databases would conflict with the stored culinary hashes. Use that full file only for an empty database created after migration `0013`.

Audit rows live in `catalog_classification_history` (`recipe_version_id`, prior values, new values, source, reason, timestamp). The initial prior is null. The reason is the batch id. Reason codes stay in factory artifacts and are not on the runtime API.

## D-01

“Keep it easy” and “Keep ingredients simple” are optional chips on Plan our dinners, Find a dinner, the plan review, and What are we cooking tonight? Both default off. Off means the previous ranking. They are stored on the dinner plan intent for that run, not on household Taste. A new Plan our dinners run starts with both off. Toggling them mid-plan updates later swaps and added nights. It does not rewrite dinners already chosen.

Ranking order:

1. Hard household eligibility
2. Planning requirements (a requested ingredient stays ahead of an easier meal)
3. This run’s preference signals
4. Taste ranking
5. Diversity, recency, and plan composition, inside the winning preference tier

Keep it easy prefers `easy`, then `moderate`, then `involved`. Keep ingredients simple prefers `simple`, then `standard`, then `adventurous`. Both on, lower tier first, holding effort until that effort’s ingredient bands are exhausted:

| Tier | Effort | Ingredients | Meals |
| --- | --- | --- | --- |
| 0 | easy | simple | 13 |
| 1 | easy | standard | 3 |
| 2 | easy | adventurous | 0 |
| 3 | moderate | simple | 9 |
| 4 | moderate | standard | 19 |
| 5 | moderate | adventurous | 1 |
| 6 | involved | simple | 0 |
| 7 | involved | standard | 4 |
| 8 | involved | adventurous | 1 |

Keep it easy is not a time filter. Simple ingredients is not a pantry check. Cards may show Easy and Simple ingredients. They do not show the other bands.

## Swap dialog

Preview, create, and mutate all read the published D1 catalog when `CATALOG_SOURCE=d1`. Preview used to plan from the 24-meal in-memory store (`rv_{slug}_v1`) while mutate resolved the published id (`rv_{slug}_v2` for the original meals). The version did not resolve, the client showed “We couldn’t reach the kitchen,” and the dialog stayed open over that toast.

Use this now persists the chosen published version, keeps the meal id and the other dinners’ pins, rebuilds the shopping list with the existing checked and bought semantics, closes the dialog, and then shows feedback. Keep this one closes the dialog and does not change the meal. Escape closes the same way. A failed swap leaves the dialog open and shows the error in the sheet.

## Apply

Preview database `harbor-eats-cycle1-preview` (`65bc636d-7048-4e58-900b-9066edf6509f`), config `wrangler.staging.toml`:

```
npx wrangler d1 migrations apply harbor-eats-cycle1-preview --remote --config wrangler.staging.toml
npx wrangler d1 execute harbor-eats-cycle1-preview --remote --config wrangler.staging.toml --file data/d03-classification-import.sql
```

Production database `harbor-eats-db` (`23aa3db3-1090-471b-8c8a-b6fe71f5c053`), config `wrangler.toml`, is Cora’s apply. Do not point the staging config at production D1.

Pages deploys use `wrangler pages deploy public`, not the repo root. This branch does not deploy production.

Unit tests and lint cover this bundle. The full Playwright suite stays for after the preview deploy.
