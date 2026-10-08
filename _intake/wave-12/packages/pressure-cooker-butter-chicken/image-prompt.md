# Image prompt — pressure-cooker-butter-chicken

Status: package_revision `freeze-r2`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Original AI generation only. Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from this prompt (which encodes the exact recipe and `image-plating-brief.md`), never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 if the tool supports it; otherwise landscape. The prompt keeps the hero centered so a 16:9 source survives the 4:3 center crop (wave-11 sources were 1280x720).
- reference image (quality/light only): /workspace/flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png
- style: premium editorial food photography, professionally styled real food
- self-check before accepting: compare against 'Must be visible' / 'Must not appear' below (K), inspect at 640x480 (L2 card scale), reject flat light, sparse plating, or any forbidden element and regenerate targeting that defect.

## Exact prompt

Premium editorial food photograph of pressure-cooker butter chicken served in a wide, shallow off-white stoneware bowl. On one side, tender bite-size pieces of boneless chicken thigh sit in a generous pool of thick, glossy, velvety orange-red tomato-butter-cream sauce with a soft buttery sheen and a single loose swirl of white cream on top, scattered with chopped fresh cilantro. On the other side, a neat mound of fluffy white long-grain basmati rice with distinct separate grains. A spoon rests at the rim; small environmental touches only: a cilantro sprig, a small knob of fresh ginger and two garlic cloves on the table. Higher three-quarter angle, 4:3 landscape composition with the bowl centered and fully inside the middle of the frame, bright soft natural window light from the side, gentle shadows, light neutral stone tabletop, quiet unbranded background, shallow depth of field, rich but believable color, professionally styled real food. No naan or flatbread, no nuts, no paneer, no peas, no chickpeas, no potatoes, no bone-in chicken, no charred tandoori pieces, no yogurt bowl, no lemon or lime, no pressure cooker, no copper or brass dishes. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Boneless chicken thigh pieces in orange-red tomato-cream sauce
- Cream swirl
- Cilantro
- Fluffy basmati rice
- Wide shallow light bowl

## Must not appear

- Naan/flatbread
- Nuts, paneer, peas, chickpeas, potatoes
- Bone-in or tandoori-charred chicken
- Yogurt bowl, citrus, pressure cooker, copper serveware
- Text, logo, watermark, packaging, hands, faces

## Provenance

- image_id: `img_pressure-cooker-butter-chicken_v1`
- dish_id: `pressure-cooker-butter-chicken`
- recipe_version_id: `rv_pressure-cooker-butter-chicken_v1`
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
- Master: WebP 1200x900 4:3 → `pressure-cooker-butter-chicken.webp`
- Card: WebP 640x480 4:3 → `pressure-cooker-butter-chicken-640.webp`

One step (recommended; writes img_v1.jpg, exports both WebPs, re-renders every text file in the frozen state, runs the preflight):

```
python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py finalize pressure-cooker-butter-chicken --src /path/to/generated-image --preflight
```

Equivalent raw export (if done by hand, the text files must still be re-rendered with `build_batch_b.py render pressure-cooker-butter-chicken`):

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/pressure-cooker-butter-chicken/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/pressure-cooker-butter-chicken pressure-cooker-butter-chicken
python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py /workspace/flavorweave-catalog-factory/wave-12/candidates/pressure-cooker-butter-chicken
```

Rejected attempts: `python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py reject pressure-cooker-butter-chicken --reason "K/L1/L2: <defect>"` (moves files into rejected/ only).

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). See image-plating-brief.md. This file does not grant image certification.
