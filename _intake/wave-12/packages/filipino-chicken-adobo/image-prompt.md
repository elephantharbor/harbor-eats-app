# Image prompt — filipino-chicken-adobo

Status: package_revision `freeze-r1`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Original AI generation only. Do not substitute a stock photo, a web photo, or a recipe-site photo. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality/light/appeal reference, not a composition clone). Generated from the exact recipe + image-plating-brief.md + house style.

## Exact prompt (single GenerateImage prompt)

Premium realistic editorial food photograph for a modern meal-planning app: Filipino Chicken Adobo served in a wide shallow off-white stoneware bowl, elevated three-quarter angle (about 40 degrees), 4:3 landscape. Two bone-in, skin-on chicken thighs with deep golden-mahogany seared skin, lacquered with a glossy reduced dark soy-vinegar glaze, rest against a fluffy mound of white jasmine rice with a little glaze running into the rice; scattered on top are pale-golden crisp garlic chips and bright green bias-cut scallions, with a single dried bay leaf on the plate. The skin is braised-and-glazed, not breaded or fried. Bright soft natural window light, gentle realistic shadows, vibrant but believable color, food filling most of the frame. Light neutral stone tabletop; at the frame edge only a whole garlic head, a few black peppercorns, and two scallions, out of focus. Keep the whole bowl within the central 75% of the frame width so it survives a 4:3 center crop. No hard-boiled eggs, no potatoes, no coconut or creamy sauce, no pork, no breaded or fried chicken, no sesame seeds, no cilantro, no chiles, no lime, no side salad, no heavy steam, no text, logos, watermarks, packaging, hands, or faces.

## GenerateImage call notes

- Aspect ratio 4:3 landscape if the tool accepts one; otherwise landscape (the prompt keeps the dish inside the central 75% of the width so a 16:9 output survives the 4:3 center crop).
- If the tool accepts a reference image, attach `/workspace/flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png` as a style/light reference only.
- Save the accepted image as `/workspace/flavorweave-catalog-factory/wave-12/candidates/filipino-chicken-adobo/img_v1.jpg` (JPEG). If the tool returns PNG/WebP: `python3 -c "from PIL import Image; Image.open('<downloaded file>').convert('RGB').save('/workspace/flavorweave-catalog-factory/wave-12/candidates/filipino-chicken-adobo/img_v1.jpg', quality=95)"`
- Rejected attempts go only under `rejected/` with a different filename (for example `rejected/img_v1-attempt1.jpg`); never reuse the active filenames there.

## Self-critique before accepting (K / L1 / L2)

- **K fidelity:** every item in the brief's Required list is visible; nothing from the Forbidden list appears; protein cut/doneness and sauce match the steps.
- **L1 style:** bright soft window light, neutral surfaces, no text/logos/hands, crop-safe center; check the 640x480 card after export.
- **L2 hero appeal:** would this make someone choose the meal next to the Chipotle Lime Black Bean Bowl reference? Textures visible, abundant not sparse, colors distinct at card size. Accurate-but-dull is a FAIL — regenerate.

## Targeted regeneration levers

- Looks flat brown -> 'bright window light, glossy highlights on glaze, bright green scallions'
- Looks fried/breaded -> 'braised and glazed skin, no breading'
- Egg or potato appears -> lead negatives with them
- Too much sauce -> 'modest glossy glaze, not soupy'

## Export (after accepting img_v1.jpg)

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/filipino-chicken-adobo/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/filipino-chicken-adobo filipino-chicken-adobo
python3 /workspace/flavorweave-catalog-factory/wave-12/batch-a-tools/render_batch_a.py --finalize filipino-chicken-adobo --generation-date YYYY-MM-DD --model unknown
python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py /workspace/flavorweave-catalog-factory/wave-12/candidates/filipino-chicken-adobo
```

## Provenance (filled at finalize)

- image_id: `img_filipino-chicken-adobo_v1`
- dish_id: `filipino-chicken-adobo`
- recipe_version_id: `rv_filipino-chicken-adobo_v1`
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
- Master: WebP 1200x900 4:3 → `filipino-chicken-adobo.webp`
- Card: WebP 640x480 4:3 → `filipino-chicken-adobo-640.webp`
- WebPs exported; package_revision freeze-r1; Freeze Integrity result in FREEZE_INTEGRITY.json. Awaiting Vale.

## Fidelity the image will owe Vale

See image-plating-brief.md required/forbidden lists. This file does not grant image certification.
