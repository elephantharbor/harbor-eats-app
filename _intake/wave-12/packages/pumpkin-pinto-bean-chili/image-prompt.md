# Image prompt — pumpkin-pinto-bean-chili

Status: package_revision `freeze-r1`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Original AI generation only. Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from this prompt (which encodes the exact recipe and `image-plating-brief.md`), never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 if the tool supports it; otherwise landscape. The prompt keeps the hero centered so a 16:9 source survives the 4:3 center crop (wave-11 sources were 1280x720).
- reference image (quality/light only): /workspace/flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png
- style: premium editorial food photography, professionally styled real food
- self-check before accepting: compare against 'Must be visible' / 'Must not appear' below (K), inspect at 640x480 (L2 card scale), reject flat light, sparse plating, or any forbidden element and regenerate targeting that defect.

## Exact prompt

Premium editorial food photograph of Smoky Pumpkin and Pinto Bean Chili, served in a wide, shallow warm off-white stoneware bowl. The chili is thick and spoon-coating, deep brick-red and glossy, full of whole cooked pinto beans (tan-pink with brown speckles) and small pieces of red bell pepper, with a few beans crushed into the base. On top, arranged in a deliberate off-center crescent so the red chili still shows: fresh-cut diced bright-green avocado, thin crisp radish coins with magenta edges, chopped cilantro leaves, and a handful of crushed golden corn tortilla chips; a lime wedge tucked at the rim and a spoon resting in the bowl. Small environmental touches only: a lime half, two whole radishes, and a few loose tortilla chips beside the bowl. Higher three-quarter angle, 4:3 landscape composition with the bowl centered and fully inside the middle of the frame, soft bright natural window light from the side, gentle shadows, light neutral stone tabletop, quiet unbranded background, shallow depth of field, vibrant but believable color, professionally styled real food. No sour cream, no crema, no cheese, no meat, no black beans, no kidney beans, no corn kernels, no jalapeño slices, no green onions, no cornbread, no rice, no whole pumpkin. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Thick brick-red chili with whole pinto beans and red pepper pieces
- Diced avocado
- Thin radish coins
- Cilantro
- Crushed corn tortilla chips
- Lime wedge
- Wide shallow light stoneware bowl

## Must not appear

- Sour cream / crema / cheese
- Any meat
- Black or kidney beans
- Corn kernels, jalapeño, green onion
- Cornbread or rice
- Whole decorative pumpkin or pumpkin chunks
- Text, logo, watermark, packaging, hands, faces

## Provenance

- image_id: `img_pumpkin-pinto-bean-chili_v1`
- dish_id: `pumpkin-pinto-bean-chili`
- recipe_version_id: `rv_pumpkin-pinto-bean-chili_v1`
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
- Master: WebP 1200x900 4:3 → `pumpkin-pinto-bean-chili.webp`
- Card: WebP 640x480 4:3 → `pumpkin-pinto-bean-chili-640.webp`

One step (recommended; writes img_v1.jpg, exports both WebPs, re-renders every text file in the frozen state, runs the preflight):

```
python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py finalize pumpkin-pinto-bean-chili --src /path/to/generated-image --preflight
```

Equivalent raw export (if done by hand, the text files must still be re-rendered with `build_batch_b.py render pumpkin-pinto-bean-chili`):

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/pumpkin-pinto-bean-chili/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/pumpkin-pinto-bean-chili pumpkin-pinto-bean-chili
python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py /workspace/flavorweave-catalog-factory/wave-12/candidates/pumpkin-pinto-bean-chili
```

Rejected attempts: `python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py reject pumpkin-pinto-bean-chili --reason "K/L1/L2: <defect>"` (moves files into rejected/ only).

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). See image-plating-brief.md. This file does not grant image certification.
