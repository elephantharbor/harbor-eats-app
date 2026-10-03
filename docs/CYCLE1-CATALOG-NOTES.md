# Cycle 1 — Catalog slice (Composer 2.5)

Branch: `feature/fw-c1-catalog` (child of `feature/flavorweave-alpha-remediation`).

Model: **composer-2.5**.

Scope: FW-03 recipe completeness, FW-04 serving scale audit, FW-08 meal image stability. Structural QA only — not kitchen-tested cooking evidence. HH001 taste evidence not written.

## What failed structurally (before fixes)

- **FW-03:** `crispy-fish-tacos-cabbage-slaw` matched the Oct QA pattern (slaw refs without full ingredients, no frying oil quantity, weak heat/time/doneness, compound crema/slaw without guidance). Several catalog meals referenced oil in steps without listing it; some fish/tofu cooks lacked doneness language; compound pantry items (salsa, harissa, chipotle in adobo, preserved lemon, pickled onion, shawarma blend) lacked store-bought/prep notes. `sesame-soba-noodle-bowl` and `peanut-noodle-stir-fry` had step/ingredient mismatches (soy, lime).
- **FW-04:** Scaling to 1–2 diners produced **`1 cups`** unit grammar across many volume ingredients.
- **FW-08:** Client removed failed `<img>` nodes (`onerror`), so Tonight cards could layout-shift when images loaded late or failed; fallback was hidden until load with no stable ready/error states.

## What changed

- Extended `src/lib/catalog-quality.js` with `validateRecipeCompleteness`, `validateCatalogScaling`, and `validateTofuLimeRegression`; wired into `runAllCatalogQualityChecks`.
- Recipe edits in `src/lib/recipe-store.js` (fish tacos rewrite, oil/doneness/compound notes, soba/peanut/shawarma/peach fixes).
- `src/lib/recipe-scaling.js`: singular unit grammar when scaled amount is 1 (`1 cup` not `1 cups`).
- `public/app.js` + `public/styles.css`: stable aspect-ratio media shell, fallback visible until `meal-media--ready`, `meal-media--error` keeps placeholder (no DOM removal).
- `public/sw.js`: cache bump **`fw-sw-v4` → `fw-sw-v5`**.

## Tests added

- `test/catalog-recipe-completeness.test.js` — FW-03/FW-04 gates, fish taco regression, Oct 1 tofu/lime PASS.
- `test/meal-image-lookup.test.js` — deterministic lookup for all 24 meals (slug, version id, title, restore-style title-only).
- `test/recipe-scaling.test.js` — singular cup grammar cases.

## Oct 1 tofu/lime retest

**PASS** — `crispy-chipotle-tofu-tacos` lists **2 limes**; all step `ingredient_refs` for lime resolve; guarded by `validateTofuLimeRegression()` in CI.

## Image lookup (24 meals)

**PASS (unit/component)** — Every `MEAL_CONCEPTS` slug resolves via `FlavorWeaveMedia.imageFor` for `{ recipe_slug }`, `{ recipe_version_id }`, and catalog `{ title }`; bundled `/images/meals/<slug>.webp` and `-640.webp` files exist on disk.

Not browser-verified this session: animated load/fade on real Tonight grid (no GUI run); client behavior inferred from `meal-media--ready` / `--error` CSS and tests above.

## Production

No production Pages/Worker deploy, no production D1 migrations, no merge to `main`, integration branch not fast-forwarded.
