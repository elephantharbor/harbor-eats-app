# Image prompt — mushroom-hominy-pozole-rojo

Status: package_revision `freeze-r1`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from the recipe and `image-plating-brief.md`, never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 (landscape)
- reference image: image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality reference only)
- style: premium editorial food photography, professionally styled real food
- save the output as `/workspace/flavorweave-catalog-factory/wave-12/candidates/mushroom-hominy-pozole-rojo/img_v1.jpg` (if GenerateImage returns PNG/WebP, `prepare` converts it to RGB JPEG q95)
- rejected attempts: move to `rejected/` with a different filename (e.g. `rejected/img_v1_try1.jpg`); never reuse the active names

## Exact prompt

Premium editorial food photograph of Mushroom and Hominy Pozole Rojo for a modern meal-planning app. A wide, deep warm-cream ceramic bowl filled with a glossy, brick-red, slightly translucent guajillo chile broth; plump white hominy kernels and deeply browned quartered cremini mushrooms break the surface. Piled to one side on top: finely shredded pale-green cabbage, thin pink-and-white radish coins, and finely diced raw white onion, with a pinch of crumbled dried oregano and a lime wedge tucked at the rim. Beside the bowl, a small plate with two round, golden, crisp corn tostadas; nearby a small dish of extra lime wedges and two whole radishes as subtle props. High three-quarter, near-overhead angle, 4:3 landscape, the bowl centered and filling most of the frame with margin on the left and right. Bright, soft, diffused natural window light, gentle shadows, realistic texture on the hominy, the browned mushroom edges, and the crisp raw garnish. Light warm-gray stone or linen tabletop, quiet unbranded background. Vibrant but believable color, professionally styled real food, light wisps of steam at most. No cheese, no crema or sour cream, no avocado, no cilantro, no pork, chicken, or other meat, no shrimp, no beans, no tortilla chips in the soup. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Brick-red, slightly translucent chile broth
- Plump white hominy kernels
- Deeply browned quartered cremini mushrooms
- Finely shredded pale-green cabbage
- Thin pink-and-white radish coins
- Finely diced raw white onion
- Lime wedge
- Corn tostadas beside the bowl

## Must not appear

- Cheese, crema, sour cream, or avocado
- Cilantro (not in recipe)
- Pork, chicken, or any meat
- Shrimp or seafood
- Tortilla chips or tortilla strips in the soup
- Beans
- Text, logo, watermark, packaging, hands, faces

## Provenance (filled by finalize)

- image_id: `img_mushroom-hominy-pozole-rojo_v1`
- dish_id: `mushroom-hominy-pozole-rojo`
- recipe_version_id: `rv_mushroom-hominy-pozole-rojo_v1`
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
- Master: WebP 1200x900 4:3 → `mushroom-hominy-pozole-rojo.webp`
- Card: WebP 640x480 4:3 → `mushroom-hominy-pozole-rojo-640.webp`

Convert a GenerateImage output into img_v1.jpg and export the pair in one step:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py prepare mushroom-hominy-pozole-rojo /path/to/generated-image.png
```

Or, if `img_v1.jpg` is already saved, export the master + 640 pair directly:

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/mushroom-hominy-pozole-rojo/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/mushroom-hominy-pozole-rojo mushroom-hominy-pozole-rojo
```

Then re-render this package to the frozen state, run freeze_integrity.py, and record the result:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py finalize mushroom-hominy-pozole-rojo
```

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). Check the must-be-visible and must-not-appear lists against the image before export; regenerate if any fail. This file does not grant image certification.
