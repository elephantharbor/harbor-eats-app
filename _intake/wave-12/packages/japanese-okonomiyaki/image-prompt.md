# Image prompt — japanese-okonomiyaki

Status: package_revision `freeze-r1`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Original AI generation only. Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from this prompt (which encodes the exact recipe and `image-plating-brief.md`), never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 if the tool supports it; otherwise landscape. The prompt keeps the hero centered so a 16:9 source survives the 4:3 center crop (wave-11 sources were 1280x720).
- reference image (quality/light only): /workspace/flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png
- style: premium editorial food photography, professionally styled real food
- self-check before accepting: compare against 'Must be visible' / 'Must not appear' below (K), inspect at 640x480 (L2 card scale), reject flat light, sparse plating, or any forbidden element and regenerate targeting that defect.

## Exact prompt

Premium editorial food photograph of homemade Japanese okonomiyaki (savory cabbage pancake) on a flat matte off-white ceramic plate. One thick round pancake, about 3/4 inch tall, with deep golden-brown crisp edges, its top fully glazed with glossy dark-brown okonomi sauce spread to the edges, a fine crosshatch lattice of thin white Japanese mayonnaise lines, a generous tumble of feathery pale tan bonito flakes, and a scatter of thinly sliced bright green scallions. One wedge is cut and slightly pulled away, revealing a tender interior of finely shredded pale-green cabbage and scallion bound in set egg batter, with browned sliced shiitake mushrooms visible on the underside crust. A second dressed pancake sits softly out of focus on another plate behind, plain wooden chopsticks beside the plate. Elevated three-quarter angle showing the pancake's thickness, 4:3 landscape composition with the hero plate centered and fully inside the middle of the frame, bright soft natural window light from the side, gentle shadows, light neutral tabletop, quiet unbranded background, shallow depth of field, vibrant but believable color, professionally styled real food. No shrimp, no squid, no pork, no bacon, no meat, no noodles, no cheese, no fried egg, no sesame seeds, no nori, no green seaweed powder, no red pickled ginger, no rice. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Thick round golden-crisp cabbage pancake
- Glossy dark sauce to the edges
- White mayo lattice
- Bonito flakes
- Scallion greens
- Cut wedge showing shredded cabbage and shiitake underside

## Must not appear

- Shrimp, squid, pork belly, bacon, any meat
- Noodles, cheese, fried egg
- Sesame, nori, aonori coating, red pickled ginger on hero
- Text, logo, watermark, packaging, hands, faces

## Provenance

- image_id: `img_japanese-okonomiyaki_v1`
- dish_id: `japanese-okonomiyaki`
- recipe_version_id: `rv_japanese-okonomiyaki_v1`
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
- Master: WebP 1200x900 4:3 → `japanese-okonomiyaki.webp`
- Card: WebP 640x480 4:3 → `japanese-okonomiyaki-640.webp`

One step (recommended; writes img_v1.jpg, exports both WebPs, re-renders every text file in the frozen state, runs the preflight):

```
python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py finalize japanese-okonomiyaki --src /path/to/generated-image --preflight
```

Equivalent raw export (if done by hand, the text files must still be re-rendered with `build_batch_b.py render japanese-okonomiyaki`):

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/japanese-okonomiyaki/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/japanese-okonomiyaki japanese-okonomiyaki
python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py /workspace/flavorweave-catalog-factory/wave-12/candidates/japanese-okonomiyaki
```

Rejected attempts: `python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py reject japanese-okonomiyaki --reason "K/L1/L2: <defect>"` (moves files into rejected/ only).

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). See image-plating-brief.md. This file does not grant image certification.
