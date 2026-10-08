# Image prompt — sheet-pan-shrimp-boil

Status: package_revision `freeze-r1`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Original AI generation only. Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from this prompt (which encodes the exact recipe and `image-plating-brief.md`), never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 if the tool supports it; otherwise landscape. The prompt keeps the hero centered so a 16:9 source survives the 4:3 center crop (wave-11 sources were 1280x720).
- reference image (quality/light only): /workspace/flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png
- style: premium editorial food photography, professionally styled real food
- self-check before accepting: compare against 'Must be visible' / 'Must not appear' below (K), inspect at 640x480 (L2 card scale), reject flat light, sparse plating, or any forbidden element and regenerate targeting that defect.

## Exact prompt

Premium editorial food photograph of a sheet-pan shrimp boil, served on a light-colored aluminum rimmed half-sheet pan. The pan is generously loaded with large tail-on peeled shrimp, roasted pink-orange and opaque in loose C shapes; halved baby red potatoes with deep golden-browned cut faces; 2-inch rounds of corn on the cob with golden spots; browned coins of smoky andouille sausage; and soft, lightly charred red onion wedges. Everything glistens with garlic butter flecked with red-orange Old Bay seasoning and minced garlic, finished with chopped fresh parsley and a few lemon wedges, with a squeezed lemon half on the pan. Small environmental touches: a lemon half and a tiny dish of Old Bay beside the pan, a neutral linen napkin. Higher three-quarter, near-overhead angle, 4:3 landscape composition with the loaded pan centered and its best area in the middle of the frame, bright soft natural window light, gentle shadows, light neutral stone tabletop, quiet unbranded background, vibrant but believable color, roasted (not boiled) textures, professionally styled real food. No crab, no crawfish, no mussels, no clams, no head-on or shell-on shrimp, no raw shrimp, no whole uncut corn ears, no dipping sauces, no bread, no beer, no newspaper, no parchment paper. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Pink tail-on roasted shrimp
- Browned halved baby potatoes
- Corn rounds
- Andouille coins
- Red onion wedges
- Butter sheen with Old Bay flecks
- Parsley and lemon wedges
- Light rimmed sheet pan

## Must not appear

- Crab, crawfish, mussels, clams
- Head-on/shell-on or raw shrimp
- Whole uncut corn ears
- Dipping sauces, bread, beer, newspaper, parchment
- Text, logo, watermark, packaging, hands, faces

## Provenance

- image_id: `img_sheet-pan-shrimp-boil_v1`
- dish_id: `sheet-pan-shrimp-boil`
- recipe_version_id: `rv_sheet-pan-shrimp-boil_v1`
- asset_generated: true
- generation method: cursor_GenerateImage_then_format_size_conversion
- model: unknown
- prompt authored: 2026-10-08 (America/Chicago) by Juniper (Harbor Eats - Catalog Curator)
- generator: Grok Bot Catalog Factory wave-12 (Cora)
- generation date: 2026-10-08
- external image API called by executor: false
- rights: not_cleared_for_external_release
- qa_state: frozen_for_audit

## Technical targets and exact commands

- Source JPEG: `img_v1.jpg`
- Master: WebP 1200x900 4:3 → `sheet-pan-shrimp-boil.webp`
- Card: WebP 640x480 4:3 → `sheet-pan-shrimp-boil-640.webp`

One step (recommended; writes img_v1.jpg, exports both WebPs, re-renders every text file in the frozen state, runs the preflight):

```
python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py finalize sheet-pan-shrimp-boil --src /path/to/generated-image --preflight
```

Equivalent raw export (if done by hand, the text files must still be re-rendered with `build_batch_b.py render sheet-pan-shrimp-boil`):

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/sheet-pan-shrimp-boil/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/sheet-pan-shrimp-boil sheet-pan-shrimp-boil
python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py /workspace/flavorweave-catalog-factory/wave-12/candidates/sheet-pan-shrimp-boil
```

Rejected attempts: `python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py reject sheet-pan-shrimp-boil --reason "K/L1/L2: <defect>"` (moves files into rejected/ only).

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). See image-plating-brief.md. This file does not grant image certification.
