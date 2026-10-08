# Image prompt — sheet-pan-gnocchi-brussels-apples

Status: package_revision `freeze-r1`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Original AI generation only. Do not substitute a stock photo, a web photo, or a recipe-site photo. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality/light/appeal reference, not a composition clone). Generated from the exact recipe + image-plating-brief.md + house style.

## Exact prompt (single GenerateImage prompt)

Premium realistic editorial food photograph for a modern meal-planning app: Sheet-Pan Crispy Gnocchi with Brussels Sprouts and Apples, shown on the light natural-aluminum rimmed sheet pan it was roasted on, high three-quarter angle (about 60 degrees), 4:3 landscape. The pan is generously filled with golden, crisp-edged potato gnocchi pillows with visible ridges and browned faces, halved Brussels sprouts with deeply caramelized dark-brown cut sides and a few crispy loose leaves, red-skinned apple wedges with browned edges that still hold their shape, and soft purple red-onion wedges, all tossed together and lightly lacquered with a thin sticky maple-Dijon glaze, flecked with fresh thyme leaves and cracked black pepper. Bright soft natural window light from the side, gentle realistic shadows, vibrant but believable color, crisp textures clearly visible, food filling most of the frame with the busiest mix at the center. Light neutral stone tabletop, a neutral linen napkin, and at the frame edge only a couple of thyme sprigs, one whole red apple and a few raw Brussels sprouts, small and out of focus. Keep the entire pan within the central 75% of the frame width so it survives a 4:3 center crop. No cheese, no Parmesan, no butter, no sage, no bacon, no nuts, no pomegranate or cranberries, no cream sauce, no parchment paper, no pale boiled gnocchi, no excessive steam, no text, logos, watermarks, packaging, hands, or faces.

## GenerateImage call notes

- Aspect ratio 4:3 landscape if the tool accepts one; otherwise landscape (the prompt keeps the dish inside the central 75% of the width so a 16:9 output survives the 4:3 center crop).
- If the tool accepts a reference image, attach `/workspace/flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png` as a style/light reference only.
- Save the accepted image as `/workspace/flavorweave-catalog-factory/wave-12/candidates/sheet-pan-gnocchi-brussels-apples/img_v1.jpg` (JPEG). If the tool returns PNG/WebP: `python3 -c "from PIL import Image; Image.open('<downloaded file>').convert('RGB').save('/workspace/flavorweave-catalog-factory/wave-12/candidates/sheet-pan-gnocchi-brussels-apples/img_v1.jpg', quality=95)"`
- Rejected attempts go only under `rejected/` with a different filename (for example `rejected/img_v1-attempt1.jpg`); never reuse the active filenames there.

## Self-critique before accepting (K / L1 / L2)

- **K fidelity:** every item in the brief's Required list is visible; nothing from the Forbidden list appears; protein cut/doneness and sauce match the steps.
- **L1 style:** bright soft window light, neutral surfaces, no text/logos/hands, crop-safe center; check the 640x480 card after export.
- **L2 hero appeal:** would this make someone choose the meal next to the Chipotle Lime Black Bean Bowl reference? Textures visible, abundant not sparse, colors distinct at card size. Accurate-but-dull is a FAIL — regenerate.

## Targeted regeneration levers

- Gnocchi pale or soft-looking -> 'deep golden-brown crisp faces, roasted not boiled'
- Sprouts look steamed/green-only -> 'dark caramelized cut faces, charred crispy outer leaves'
- Cheese or sage appears -> move those words to the front of the negative list
- Too sparse/tiny on pan -> 'pan filled edge to edge, closer framing'

## Export (after accepting img_v1.jpg)

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/sheet-pan-gnocchi-brussels-apples/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/sheet-pan-gnocchi-brussels-apples sheet-pan-gnocchi-brussels-apples
python3 /workspace/flavorweave-catalog-factory/wave-12/batch-a-tools/render_batch_a.py --finalize sheet-pan-gnocchi-brussels-apples --generation-date YYYY-MM-DD --model unknown
python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py /workspace/flavorweave-catalog-factory/wave-12/candidates/sheet-pan-gnocchi-brussels-apples
```

## Provenance (filled at finalize)

- image_id: `img_sheet-pan-gnocchi-brussels-apples_v1`
- dish_id: `sheet-pan-gnocchi-brussels-apples`
- recipe_version_id: `rv_sheet-pan-gnocchi-brussels-apples_v1`
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
- Master: WebP 1200x900 4:3 → `sheet-pan-gnocchi-brussels-apples.webp`
- Card: WebP 640x480 4:3 → `sheet-pan-gnocchi-brussels-apples-640.webp`
- WebPs exported; package_revision freeze-r1; Freeze Integrity result in FREEZE_INTEGRITY.json. Awaiting Vale.

## Fidelity the image will owe Vale

See image-plating-brief.md required/forbidden lists. This file does not grant image certification.
