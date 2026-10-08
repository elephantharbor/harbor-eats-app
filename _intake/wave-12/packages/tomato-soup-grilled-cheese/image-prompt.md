# Image prompt — tomato-soup-grilled-cheese

Status: package_revision `freeze-r1`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from the recipe and `image-plating-brief.md`, never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 (landscape)
- reference image: image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality reference only)
- style: premium editorial food photography, professionally styled real food
- save the output as `/workspace/flavorweave-catalog-factory/wave-12/candidates/tomato-soup-grilled-cheese/img_v1.jpg` (if GenerateImage returns PNG/WebP, `prepare` converts it to RGB JPEG q95)
- rejected attempts: move to `rejected/` with a different filename (e.g. `rejected/img_v1_try1.jpg`); never reuse the active names

## Exact prompt

Premium editorial food photograph of Roasted Tomato Soup with Grilled Cheese for a modern meal-planning app. A wide off-white ceramic bowl of velvety, smooth, deep orange-red roasted tomato soup with a few darker roasted flecks, a soft swirl of cream on the surface, a few small fresh basil leaves, and a light crack of black pepper. Beside the bowl on a small off-white plate, a sourdough grilled cheese sandwich cut diagonally into two triangles, one leaning on the other so the cut face shows a thick layer of melted orange-yellow sharp cheddar with a gentle, realistic pull; the crust is deep golden-brown, crisp, and buttery, with the open crumb of sourdough. Elevated three-quarter angle, about 35 to 40 degrees, 4:3 landscape, the bowl and sandwich grouped in the center and filling most of the frame with margin on the left and right. Bright, soft, diffused natural window light, gentle shadows, realistic texture and a soft sheen on the soup. Light warm-neutral stone tabletop, quiet unbranded background, two whole Roma tomatoes and a small basil sprig in soft focus, a soup spoon resting nearby. Vibrant but believable color, professionally styled real food, cozy and appetizing, not advertising fantasy, no excessive steam. No croutons, no grated Parmesan, no bacon or ham, no tomato slices in the sandwich, no white sandwich bread, no burnt toast. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Smooth, deep orange-red tomato soup with a few darker roasted flecks
- Cream swirl on the soup
- Small fresh basil leaves
- Sourdough grilled cheese cut diagonally into 2 triangles
- Thick layer of melted orange-yellow sharp cheddar visible in the cut face
- Deep golden, crisp, buttery crust

## Must not appear

- Croutons
- Grated Parmesan
- Bacon or ham
- Tomato slices inside the sandwich
- Pale white sandwich bread
- Burnt or blackened toast
- Exaggerated cheese pull stretching unrealistically
- Text, logo, watermark, packaging, hands, faces

## Provenance (filled by finalize)

- image_id: `img_tomato-soup-grilled-cheese_v1`
- dish_id: `tomato-soup-grilled-cheese`
- recipe_version_id: `rv_tomato-soup-grilled-cheese_v1`
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
- Master: WebP 1200x900 4:3 → `tomato-soup-grilled-cheese.webp`
- Card: WebP 640x480 4:3 → `tomato-soup-grilled-cheese-640.webp`

Convert a GenerateImage output into img_v1.jpg and export the pair in one step:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py prepare tomato-soup-grilled-cheese /path/to/generated-image.png
```

Or, if `img_v1.jpg` is already saved, export the master + 640 pair directly:

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/tomato-soup-grilled-cheese/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/tomato-soup-grilled-cheese tomato-soup-grilled-cheese
```

Then re-render this package to the frozen state, run freeze_integrity.py, and record the result:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py finalize tomato-soup-grilled-cheese
```

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). Check the must-be-visible and must-not-appear lists against the image before export; regenerate if any fail. This file does not grant image certification.
