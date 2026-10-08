# Image prompt — classic-smash-burgers

Status: package_revision `freeze-r2`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Original AI generation only. Do not substitute a stock photo, a web photo, or a recipe-site photo. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality/light/appeal reference, not a composition clone). Generated from the exact recipe + image-plating-brief.md + house style.

## Exact prompt (single GenerateImage prompt)

Premium realistic editorial food photograph for a modern meal-planning app: a Classic Smash Burger with Special Sauce, low three-quarter angle (about 20 degrees), 4:3 landscape. One hero double cheeseburger front and center on a small off-white ceramic plate: two thin smashed beef patties with lacy, deeply browned crispy edges extending slightly past the bun, slices of melted American cheese draping over the patty edges, dill pickle chips, paper-thin white onion, finely shredded iceberg lettuce, and a little pink-orange special sauce peeking from the layers, on a soft sesame-seed bun with a golden butter-toasted cut side. A second identical burger softly out of focus behind it. Bright soft natural window light, gentle realistic shadows, vibrant but believable color, crisp textures, the hero burger filling most of the frame height. Light neutral stone tabletop and a folded neutral linen napkin; nothing else. Keep the hero burger within the central 75% of the frame width so it survives a 4:3 center crop. No French fries, no onion rings, no chips, no tomato, no bacon, no thick pub-style patty, no toothpick, no drinks, no condiment bottles, no jalapeños, no text, logos, watermarks, packaging, hands, or faces.

## GenerateImage call notes

- Aspect ratio 4:3 landscape if the tool accepts one; otherwise landscape (the prompt keeps the dish inside the central 75% of the width so a 16:9 output survives the 4:3 center crop).
- If the tool accepts a reference image, attach `/workspace/flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png` as a style/light reference only.
- Save the accepted image as `/workspace/flavorweave-catalog-factory/wave-12/candidates/classic-smash-burgers/img_v1.jpg` (JPEG). If the tool returns PNG/WebP: `python3 -c "from PIL import Image; Image.open('<downloaded file>').convert('RGB').save('/workspace/flavorweave-catalog-factory/wave-12/candidates/classic-smash-burgers/img_v1.jpg', quality=95)"`
- Rejected attempts go only under `rejected/` with a different filename (for example `rejected/img_v1-attempt1.jpg`); never reuse the active filenames there.

## Self-critique before accepting (K / L1 / L2)

- **K fidelity:** every item in the brief's Required list is visible; nothing from the Forbidden list appears; protein cut/doneness and sauce match the steps.
- **L1 style:** bright soft window light, neutral surfaces, no text/logos/hands, crop-safe center; check the 640x480 card after export.
- **L2 hero appeal:** would this make someone choose the meal next to the Chipotle Lime Black Bean Bowl reference? Textures visible, abundant not sparse, colors distinct at card size. Accurate-but-dull is a FAIL — regenerate.

## Targeted regeneration levers

- Fries appear -> lead negatives with 'no fries'
- Patty looks thick/grilled -> 'two very thin smashed patties with lacy crispy edges'
- Cheese not melted -> 'molten American cheese draping over edges'
- Bun shiny brioche -> 'soft matte sesame-seed bun'

## Export (after accepting img_v1.jpg)

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/classic-smash-burgers/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/classic-smash-burgers classic-smash-burgers
python3 /workspace/flavorweave-catalog-factory/wave-12/batch-a-tools/render_batch_a.py --finalize classic-smash-burgers --generation-date YYYY-MM-DD --model unknown
python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py /workspace/flavorweave-catalog-factory/wave-12/candidates/classic-smash-burgers
```

## Provenance (filled at finalize)

- image_id: `img_classic-smash-burgers_v1`
- dish_id: `classic-smash-burgers`
- recipe_version_id: `rv_classic-smash-burgers_v1`
- asset_generated: true
- generation method: cursor_GenerateImage_then_format_size_conversion
- generator: Cora (Harbor Eats Lead) via Grok Bot GenerateImage
- model: unknown
- prompt authored: 2026-10-08 (America/Chicago) by Juniper (FlavorWeave Catalog Curator, Harbor Eats)
- generation date: 2026-10-08
- external image API called by executor: false
- rights: not_cleared_for_external_release
- qa_state: frozen_for_audit

## Technical targets

- Source JPEG: `img_v1.jpg` (1280x720)
- Master: WebP 1200x900 4:3 → `classic-smash-burgers.webp`
- Card: WebP 640x480 4:3 → `classic-smash-burgers-640.webp`
- WebPs exported; package_revision freeze-r2; Freeze Integrity result in FREEZE_INTEGRITY.json. Awaiting Vale.

## Fidelity the image will owe Vale

See image-plating-brief.md required/forbidden lists. This file does not grant image certification.
