# Image prompt — turkish-lahmacun

Status: package_revision `freeze-r3`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Original AI generation only. Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from this prompt (which encodes the exact recipe and `image-plating-brief.md`), never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 if the tool supports it; otherwise landscape. The prompt keeps the hero centered so a 16:9 source survives the 4:3 center crop (wave-11 sources were 1280x720).
- reference image (quality/light only): /workspace/flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png
- style: premium editorial food photography, professionally styled real food
- self-check before accepting: compare against 'Must be visible' / 'Must not appear' below (K), inspect at 640x480 (L2 card scale), reject flat light, sparse plating, or any forbidden element and regenerate targeting that defect.

## Exact prompt

Premium editorial food photograph of Turkish lahmacun with herb salad on a large light-colored ceramic platter lined with a sheet of parchment. Two paper-thin oval flatbreads with crisp, browned, lightly blistered rims are spread edge to edge with a thin, even layer of red-brown spiced minced lamb paste flecked with parsley and red pepper, sizzled and browned in spots. The front lahmacun is heaped down the middle with a fresh salad of whole flat-leaf parsley leaves, thin magenta sumac-tinted red onion slivers, and diced red tomato, glistening with lemon and olive oil, and is partly rolled up to show how it is eaten; lemon wedges on the platter. Small environmental touches: a little bowl of the herb salad and a pinch of deep-red sumac in a tiny dish. Elevated three-quarter angle, 4:3 landscape composition with the hero flatbread centered and fully inside the middle of the frame, bright soft natural window light from the side, gentle shadows, light neutral stone tabletop, quiet unbranded background, shallow depth of field, vibrant but believable color, professionally styled real food. No cheese, no thick pizza crust, no pita, no meatballs, no yogurt or tahini sauce, no cucumber, no olives, no eggs, no pine nuts, no pickles, no fries. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Thin oval flatbreads with crisp browned rims
- Thin red-brown lamb paste edge to edge
- Parsley, sumac red onion, tomato salad
- One piece partly rolled
- Lemon wedges

## Must not appear

- Cheese or pizza look
- Pita, meatballs, chunky meat
- Yogurt/tahini sauce
- Cucumber, olives, eggs, pine nuts, pickles, fries
- Text, logo, watermark, packaging, hands, faces

## Provenance

- image_id: `img_turkish-lahmacun_v1`
- dish_id: `turkish-lahmacun`
- recipe_version_id: `rv_turkish-lahmacun_v1`
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
- Master: WebP 1200x900 4:3 → `turkish-lahmacun.webp`
- Card: WebP 640x480 4:3 → `turkish-lahmacun-640.webp`

One step (recommended; writes img_v1.jpg, exports both WebPs, re-renders every text file in the frozen state, runs the preflight):

```
python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py finalize turkish-lahmacun --src /path/to/generated-image --preflight
```

Equivalent raw export (if done by hand, the text files must still be re-rendered with `build_batch_b.py render turkish-lahmacun`):

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/turkish-lahmacun/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/turkish-lahmacun turkish-lahmacun
python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py /workspace/flavorweave-catalog-factory/wave-12/candidates/turkish-lahmacun
```

Rejected attempts: `python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py reject turkish-lahmacun --reason "K/L1/L2: <defect>"` (moves files into rejected/ only).

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). See image-plating-brief.md. This file does not grant image certification.
