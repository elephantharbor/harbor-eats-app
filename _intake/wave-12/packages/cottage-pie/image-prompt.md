# Image prompt — cottage-pie

Status: package_revision `freeze-r2`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from the recipe and `image-plating-brief.md`, never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 (landscape)
- reference image: image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality reference only)
- style: premium editorial food photography, professionally styled real food
- save the output as `/workspace/flavorweave-catalog-factory/wave-12/candidates/cottage-pie/img_v1.jpg` (if GenerateImage returns PNG/WebP, `prepare` converts it to RGB JPEG q95)
- rejected attempts: move to `rejected/` with a different filename (e.g. `rejected/img_v1_try1.jpg`); never reuse the active names

## Exact prompt

Premium editorial food photograph of Cottage Pie with Thyme Gravy for a modern meal-planning app. A cream-enameled 12-inch cast-iron skillet holds a freshly baked cottage pie: fluffy mashed potatoes raked into deep fork ridges with golden-brown, crisp, lightly browned peaks; one portion has been scooped out, revealing a glossy brown thyme gravy with tender ground beef, small diced orange carrots, and bright green peas, the gravy bubbling slightly at the skillet's edge. In the foreground, an off-white plate with a served portion showing creamy mash over the beef filling. Fresh thyme leaves are scattered on top, with a small thyme sprig beside the skillet and a serving spoon resting on the rim. Elevated three-quarter angle, about 40 degrees, 4:3 landscape, the skillet and plate filling most of the frame and centered with margin on the left and right. Bright, soft, diffused natural window light, gentle shadows, realistic texture on the crisp ridges and the glossy gravy. Light warm-neutral stone tabletop with a folded neutral linen, quiet unbranded background. Vibrant but believable color, warm and comforting, professionally styled real food, not advertising fantasy, at most a light wisp of steam. No melted cheese on top, no pastry crust, no lamb, no corn kernels, no mushrooms, no bread or salad, no burnt peaks. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Mash top raked into fork ridges with golden-brown crisp peaks
- One scooped portion missing from the skillet, exposing the filling
- Glossy brown gravy with ground beef
- Diced orange carrots and green peas visible
- Fresh thyme leaves scattered on top
- A served portion on a plate showing mash over filling

## Must not appear

- Melted cheese on top
- Pastry crust
- Lamb chops or lamb
- Corn kernels
- Mushrooms
- Bread or side salad
- Black, burnt peaks
- Text, logo, watermark, packaging, hands, faces

## Provenance (filled by finalize)

- image_id: `img_cottage-pie_v1`
- dish_id: `cottage-pie`
- recipe_version_id: `rv_cottage-pie_v1`
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
- Master: WebP 1200x900 4:3 → `cottage-pie.webp`
- Card: WebP 640x480 4:3 → `cottage-pie-640.webp`

Convert a GenerateImage output into img_v1.jpg and export the pair in one step:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py prepare cottage-pie /path/to/generated-image.png
```

Or, if `img_v1.jpg` is already saved, export the master + 640 pair directly:

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/cottage-pie/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/cottage-pie cottage-pie
```

Then re-render this package to the frozen state, run freeze_integrity.py, and record the result:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py finalize cottage-pie
```

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). Check the must-be-visible and must-not-appear lists against the image before export; regenerate if any fail. This file does not grant image certification.
