# Image prompt — seared-scallops-parsnip-puree

Status: package_revision `freeze-r2`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from the recipe and `image-plating-brief.md`, never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 (landscape)
- reference image: image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality reference only)
- style: premium editorial food photography, professionally styled real food
- save the output as `/workspace/flavorweave-catalog-factory/wave-12/candidates/seared-scallops-parsnip-puree/img_v1.jpg` (if GenerateImage returns PNG/WebP, `prepare` converts it to RGB JPEG q95)
- rejected attempts: move to `rejected/` with a different filename (e.g. `rejected/img_v1_try1.jpg`); never reuse the active names

## Exact prompt

Premium editorial food photograph of Seared Scallops with Parsnip Purée and Crispy Sage for a modern meal-planning app. On a wide off-white rimmed dinner plate, a generous swoosh of silky, smooth ivory parsnip purée, with four large, plump sea scallops set on it, each with a deep golden-brown caramelized seared crust on top and tall sides that turn from opaque to slightly translucent. Nutty amber brown butter with tiny brown flecks is spooned over the scallops and pools glossily around them, and dark-green crispy fried sage leaves rest on top. To one side, a small mound of tender baby arugula lightly dressed in lemon and olive oil, and a fresh lemon wedge. Low-to-mid three-quarter angle, about 30 to 35 degrees, 4:3 landscape, the plate centered and filling most of the frame with margin on the left and right. Bright, soft, diffused natural window light, gentle shadows, realistic texture on the seared crusts, the satiny purée, and the brittle fried sage. Light gray stone tabletop with a neutral linen napkin and a fork, a sage sprig and a halved lemon in soft focus, quiet unbranded background. Vibrant but believable color, elegant yet warm, professionally styled real food, not advertising fantasy, no steam. No bacon or pancetta, no green or pea purée, no microgreens or edible flowers, no shrimp, no scallop shells, no pale steamed-looking scallops, no cream sauce or foam, no burnt black butter. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Four large sea scallops with a deep golden-brown seared crust on top
- Visible translucent-to-opaque scallop sides, tall and plump
- Silky ivory parsnip purée swooshed beneath
- Nutty brown butter spooned over, with small brown flecks
- Dark-green crispy fried sage leaves
- Small mound of baby arugula
- Lemon wedge

## Must not appear

- Bacon or pancetta
- Pea purée or green purée
- Microgreens or edible flowers
- Shrimp, shells, or scallop shells
- Pale, steamed-looking or rubbery scallops
- Cream sauce or foam
- Black burnt butter
- Text, logo, watermark, packaging, hands, faces

## Provenance (filled by finalize)

- image_id: `img_seared-scallops-parsnip-puree_v1`
- dish_id: `seared-scallops-parsnip-puree`
- recipe_version_id: `rv_seared-scallops-parsnip-puree_v1`
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
- Master: WebP 1200x900 4:3 → `seared-scallops-parsnip-puree.webp`
- Card: WebP 640x480 4:3 → `seared-scallops-parsnip-puree-640.webp`

Convert a GenerateImage output into img_v1.jpg and export the pair in one step:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py prepare seared-scallops-parsnip-puree /path/to/generated-image.png
```

Or, if `img_v1.jpg` is already saved, export the master + 640 pair directly:

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/seared-scallops-parsnip-puree/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/seared-scallops-parsnip-puree seared-scallops-parsnip-puree
```

Then re-render this package to the frozen state, run freeze_integrity.py, and record the result:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py finalize seared-scallops-parsnip-puree
```

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). Check the must-be-visible and must-not-appear lists against the image before export; regenerate if any fail. This file does not grant image certification.
