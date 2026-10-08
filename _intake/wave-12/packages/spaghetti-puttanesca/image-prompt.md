# Image prompt — spaghetti-puttanesca

Status: package_revision `freeze-r2`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from the recipe and `image-plating-brief.md`, never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 (landscape)
- reference image: image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality reference only)
- style: premium editorial food photography, professionally styled real food
- save the output as `/workspace/flavorweave-catalog-factory/wave-12/candidates/spaghetti-puttanesca/img_v1.jpg` (if GenerateImage returns PNG/WebP, `prepare` converts it to RGB JPEG q95)
- rejected attempts: move to `rejected/` with a different filename (e.g. `rejected/img_v1_try1.jpg`); never reuse the active names

## Exact prompt

Premium editorial food photograph of Spaghetti Puttanesca for a modern meal-planning app. A generous twirled nest of spaghetti in a wide, shallow off-white stoneware pasta bowl, every strand coated in a glossy, chunky, brick-red tomato sauce made with hand-crushed tomatoes, studded with chopped purple-black Kalamata olives, small green capers, and thin pale-gold slices of garlic; the anchovies are fully melted into the sauce, so no whole fillets are visible. A little extra chunky sauce and olive pieces rest on top of the twirl, finished with freshly chopped flat-leaf parsley, a few red chile flakes, and a thin sheen of olive oil glistening at the edge of the sauce. Higher three-quarter angle (about 60 degrees), the bowl filling most of the frame and centered with clear margin on the left and right, 4:3 landscape. Bright, soft, diffused natural window light from the side, gentle shadows, realistic texture on the al dente strands and the sauce. Light warm-gray stone tabletop, quiet unbranded background; in soft focus at the edge of the frame a small bunch of flat-leaf parsley and a tiny ramekin of capers, plus a fork resting beside the bowl. Vibrant but believable color, professionally styled real food, not advertising fantasy, no excessive steam. No cheese of any kind (no grated or shaved Parmesan), no butter, no basil, no whole anchovy fillets, no shrimp or other seafood, no meat, no bread, no lemon. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Spaghetti (long strands, twirled), fully coated, not sitting on top of sauce
- Chunky tomato sauce, brick red, glossy
- Purple-black Kalamata olive pieces
- Small green capers
- Thin pale-gold garlic slices
- Chopped flat-leaf parsley
- A few red chile flakes

## Must not appear

- Grated, shaved, or powdered cheese of any kind
- Butter
- Basil leaves (not in recipe)
- Whole anchovy fillets draped on top
- Shrimp or other shellfish
- Meat or meatballs
- Bread, garlic bread, or a side salad
- Lemon wedges
- Text, logo, watermark, packaging, hands, faces

## Provenance (filled by finalize)

- image_id: `img_spaghetti-puttanesca_v1`
- dish_id: `spaghetti-puttanesca`
- recipe_version_id: `rv_spaghetti-puttanesca_v1`
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
- Master: WebP 1200x900 4:3 → `spaghetti-puttanesca.webp`
- Card: WebP 640x480 4:3 → `spaghetti-puttanesca-640.webp`

Convert a GenerateImage output into img_v1.jpg and export the pair in one step:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py prepare spaghetti-puttanesca /path/to/generated-image.png
```

Or, if `img_v1.jpg` is already saved, export the master + 640 pair directly:

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/spaghetti-puttanesca/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/spaghetti-puttanesca spaghetti-puttanesca
```

Then re-render this package to the frozen state, run freeze_integrity.py, and record the result:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py finalize spaghetti-puttanesca
```

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). Check the must-be-visible and must-not-appear lists against the image before export; regenerate if any fail. This file does not grant image certification.
