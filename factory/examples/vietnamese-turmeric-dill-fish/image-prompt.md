# Image prompt — vietnamese-turmeric-dill-fish

Status: package_revision `freeze-r1`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Original AI generation only. Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from this prompt (which encodes the exact recipe and `image-plating-brief.md`), never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 if the tool supports it; otherwise landscape. The prompt keeps the hero centered so a 16:9 source survives the 4:3 center crop (wave-11 sources were 1280x720).
- reference image (quality/light only): /workspace/flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png
- style: premium editorial food photography, professionally styled real food
- self-check before accepting: compare against 'Must be visible' / 'Must not appear' below (K), inspect at 640x480 (L2 card scale), reject flat light, sparse plating, or any forbidden element and regenerate targeting that defect.

## Exact prompt

Premium editorial food photograph of Vietnamese turmeric fish with dill and rice noodles (chả cá style) in a wide, shallow off-white stoneware bowl. A nest of fine white rice vermicelli is topped with bite-size pieces of catfish, golden turmeric-yellow with deep golden-brown seared faces, tender and flaky, generously draped with glossy, just-wilted bright green dill sprigs and 2-inch scallion lengths. Finished with whole fresh mint leaves, coarsely chopped pale-golden roasted cashews with a few recognizable cashew halves, thin red chile rings, and a lime wedge. A small off-white dipping bowl of amber lime-fish-sauce dressing (nuoc cham) with floating red chile and garlic flecks sits beside the bowl. Small environmental touches: a little bunch of dill and a lime half. Higher three-quarter angle, 4:3 landscape composition with the bowl centered and fully inside the middle of the frame, bright soft natural window light, gentle shadows, light neutral stone tabletop, quiet unbranded background, shallow depth of field, vibrant but believable color, professionally styled real food. No peanuts, no shrimp, no broth or soup, no cilantro, no basil, no bean sprouts, no lettuce, no rice paper, no battered or deep-fried fish, no fish skin, no sesame seeds. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Turmeric-gold seared catfish pieces
- Abundant wilted bright green dill and scallion lengths
- White rice vermicelli
- Mint leaves
- Chopped cashews (recognizably cashew)
- Red chile
- Lime wedge
- Small bowl of nước chấm

## Must not appear

- Peanuts
- Shrimp or shrimp paste
- Broth/soup
- Cilantro, basil, bean sprouts, lettuce, rice paper
- Battered/deep-fried or skin-on fish
- Text, logo, watermark, packaging, hands, faces

## Provenance

- image_id: `img_vietnamese-turmeric-dill-fish_v1`
- dish_id: `vietnamese-turmeric-dill-fish`
- recipe_version_id: `rv_vietnamese-turmeric-dill-fish_v1`
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
- Master: WebP 1200x900 4:3 → `vietnamese-turmeric-dill-fish.webp`
- Card: WebP 640x480 4:3 → `vietnamese-turmeric-dill-fish-640.webp`

One step (recommended; writes img_v1.jpg, exports both WebPs, re-renders every text file in the frozen state, runs the preflight):

```
python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py finalize vietnamese-turmeric-dill-fish --src /path/to/generated-image --preflight
```

Equivalent raw export (if done by hand, the text files must still be re-rendered with `build_batch_b.py render vietnamese-turmeric-dill-fish`):

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/vietnamese-turmeric-dill-fish/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/vietnamese-turmeric-dill-fish vietnamese-turmeric-dill-fish
python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py /workspace/flavorweave-catalog-factory/wave-12/candidates/vietnamese-turmeric-dill-fish
```

Rejected attempts: `python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py reject vietnamese-turmeric-dill-fish --reason "K/L1/L2: <defect>"` (moves files into rejected/ only).

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). See image-plating-brief.md. This file does not grant image certification.
