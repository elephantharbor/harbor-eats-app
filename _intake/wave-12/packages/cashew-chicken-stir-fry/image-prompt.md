# Image prompt — cashew-chicken-stir-fry

Status: package_revision `freeze-r3`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Revision (freeze-r3): Rewritten for Vale r1 Gate K: chicken must read as bite-size 3/4-inch cubes of stir-fried chicken breast (no whole cutlets, no sliced cutlets, no strips longer than 1 inch, no grill marks); the only nuts are whole, curved cashews; added negatives for peanuts, chickpeas, round nuggets, grill marks, and sliced cutlets. The r1 hero is in rejected/attempt1_*.

Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from the recipe and `image-plating-brief.md`, never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 (landscape)
- reference image: image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality reference only)
- style: premium editorial food photography, professionally styled real food
- save the output as `/workspace/flavorweave-catalog-factory/wave-12/candidates/cashew-chicken-stir-fry/img_v1.jpg` (if GenerateImage returns PNG/WebP, `prepare` converts it to RGB JPEG q95)
- rejected attempts: move to `rejected/` with a different filename (e.g. `rejected/img_v1_try1.jpg`); never reuse the active names

## Exact prompt

Premium editorial food photograph of Cashew Chicken Stir-Fry for a modern meal-planning app. In a wide off-white shallow ceramic bowl, a generous serving of cashew chicken stir-fry: bite-size 3/4-inch cubes of stir-fried chicken breast, each small cube golden at the edges and lightly glossed (velveted, not breaded), with no whole cutlets, no sliced cutlets, no strips longer than 1 inch, and no grill marks; red bell pepper squares, pale-green celery slices cut on the bias, translucent onion pieces, 1-inch lengths of scallion, and plenty of whole, curved, kidney-shaped golden toasted cashews, the only nuts in the dish; everything lightly glossed in a thin, glossy brown soy-hoisin sauce with no pooling. Beside the stir-fry in the same bowl, a neat mound of fluffy white jasmine rice with separate grains. Higher three-quarter angle, about 55 to 60 degrees, 4:3 landscape, the bowl centered and filling most of the frame with margin on the left and right. Bright, soft, diffused natural window light, gentle shadows, realistic texture on the stir-fried chicken cubes, the crisp-tender vegetables with a few charred spots, and the crunchy cashews. Light warm-gray stone tabletop, quiet unbranded background; a pair of wooden chopsticks and a small knob of ginger in soft focus. Vibrant but believable color, professionally styled real food, not advertising fantasy, no excessive steam. No peanuts, no chickpeas, no round nuggets or round nuts of any kind, no grill marks, no sliced cutlets or whole chicken cutlets, no broccoli, no carrots, no sesame seeds on top, no whole dried chiles, no breaded or deep-fried orange-chicken look, no thick gloopy sauce, no noodles. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Bite-size 3/4-inch cubes of stir-fried chicken breast, golden at the edges and lightly glossed (velveted, not breaded); no whole or sliced cutlets, no strips longer than 1 inch, no grill marks
- Red bell pepper squares
- Pale-green celery slices cut on the bias
- Translucent onion pieces
- Plentiful whole, curved (kidney-shaped) golden toasted cashews, the only nuts in the dish
- 1-inch scallion lengths
- Thin glossy brown soy-hoisin sauce coating
- Fluffy white jasmine rice

## Must not appear

- Peanuts
- Chickpeas or any other legume
- Round nuggets, round nuts, or any nut other than whole cashews
- Grill marks or grill-striped chicken
- Whole chicken cutlets, sliced cutlets, or strips longer than 1 inch
- Broccoli
- Carrots
- Sesame seeds scattered on top
- Whole dried chiles
- Breaded or deep-fried chicken (orange chicken look)
- Thick gloopy or bright orange sauce
- Noodles
- Text, logo, watermark, packaging, hands, faces

## Provenance (filled by finalize)

- image_id: `img_cashew-chicken-stir-fry_v1`
- dish_id: `cashew-chicken-stir-fry`
- recipe_version_id: `rv_cashew-chicken-stir-fry_v1`
- asset_generated: true
- generation method: cursor_GenerateImage_then_format_size_conversion
- generator: Cora (Grok Bot Catalog Factory wave-12) via GenerateImage
- model: unknown unless GenerateImage metadata exposes it
- prompt authored: 2026-10-08 (America/Chicago)
- generation_date: 2026-10-08
- external image API called by executor: false
- rights: not_cleared_for_external_release
- qa_state: frozen_for_audit

## Technical targets and commands

- Source JPEG: `img_v1.jpg`
- Master: WebP 1200x900 4:3 → `cashew-chicken-stir-fry.webp`
- Card: WebP 640x480 4:3 → `cashew-chicken-stir-fry-640.webp`

Convert a GenerateImage output into img_v1.jpg and export the pair in one step:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py prepare cashew-chicken-stir-fry /workspace/flavorweave-catalog-factory/wave-12/incoming-batch-c/cashew-chicken-stir-fry-r2.png
```

Or, if `img_v1.jpg` is already saved, export the master + 640 pair directly:

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/cashew-chicken-stir-fry/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/cashew-chicken-stir-fry cashew-chicken-stir-fry
```

Then re-render this package to the frozen state, run freeze_integrity.py, and record the result:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py finalize cashew-chicken-stir-fry
```

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). Check the must-be-visible and must-not-appear lists against the image before export; regenerate if any fail. This file does not grant image certification.
