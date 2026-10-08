# Image prompt — sabich-pita-sandwiches

Status: package_revision `freeze-r1`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from the recipe and `image-plating-brief.md`, never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 (landscape)
- reference image: image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality reference only)
- style: premium editorial food photography, professionally styled real food
- save the output as `/workspace/flavorweave-catalog-factory/wave-12/candidates/sabich-pita-sandwiches/img_v1.jpg` (if GenerateImage returns PNG/WebP, `prepare` converts it to RGB JPEG q95)
- rejected attempts: move to `rejected/` with a different filename (e.g. `rejected/img_v1_try1.jpg`); never reuse the active names

## Exact prompt

Premium editorial food photograph of Sabich Pita with Crispy Eggplant and Tahini for a modern meal-planning app. Two generously stuffed, soft, lightly toasted pocket pitas stand upright side by side on a light off-white ceramic plate, their open tops showing layered fillings: golden-brown pan-fried eggplant rounds with crisp edges and creamy interiors, thick slices of hard-boiled egg with firm bright-yellow yolks, a finely diced red tomato and green cucumber salad, thin dill pickle slices, and chopped flat-leaf parsley, all drizzled with glossy ivory tahini sauce that runs a little down the pita. Beside the plate, a small bowl of extra tahini and half a lemon; in soft focus, a couple of Persian cucumbers. Elevated three-quarter angle, about 30 to 35 degrees, so the layers inside the pockets are clearly visible; 4:3 landscape with both pitas centered and filling most of the frame, with margin on the left and right. Bright, soft, diffused natural window light, gentle shadows, realistic texture on the crisp eggplant and the set egg. Light warm-neutral stone tabletop, quiet unbranded background. Vibrant but believable color, professionally styled real food, not advertising fantasy. No feta or any cheese, no yogurt or white creamy sauce other than tahini, no falafel, no meat or chicken, no fish, no lettuce, no French fries, no yellow mango sauce. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Pocket pita (soft, lightly toasted)
- Golden-brown pan-fried eggplant rounds with crisp edges and creamy interiors
- Hard-boiled egg slices with firm yellow yolks
- Finely diced tomato-cucumber salad
- Dill pickle slices
- Chopped parsley
- Ivory tahini drizzle running over the filling

## Must not appear

- Feta, labneh, yogurt, or any cheese
- Falafel balls
- Meat, shawarma, or chicken
- Fish or shellfish
- Lettuce (not in recipe)
- French fries
- Yellow-orange amba drizzle (optional; omitted from hero)
- Text, logo, watermark, packaging, hands, faces

## Provenance (filled by finalize)

- image_id: `img_sabich-pita-sandwiches_v1`
- dish_id: `sabich-pita-sandwiches`
- recipe_version_id: `rv_sabich-pita-sandwiches_v1`
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
- Master: WebP 1200x900 4:3 → `sabich-pita-sandwiches.webp`
- Card: WebP 640x480 4:3 → `sabich-pita-sandwiches-640.webp`

Convert a GenerateImage output into img_v1.jpg and export the pair in one step:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py prepare sabich-pita-sandwiches /path/to/generated-image.png
```

Or, if `img_v1.jpg` is already saved, export the master + 640 pair directly:

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/sabich-pita-sandwiches/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/sabich-pita-sandwiches sabich-pita-sandwiches
```

Then re-render this package to the frozen state, run freeze_integrity.py, and record the result:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py finalize sabich-pita-sandwiches
```

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). Check the must-be-visible and must-not-appear lists against the image before export; regenerate if any fail. This file does not grant image certification.
