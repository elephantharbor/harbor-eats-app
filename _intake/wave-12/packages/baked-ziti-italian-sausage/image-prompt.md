# Image prompt — baked-ziti-italian-sausage

Status: package_revision `freeze-r1`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Original AI generation only. Do not substitute a stock photo, a web photo, or a recipe-site photo. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality/light/appeal reference, not a composition clone). Generated from the exact recipe + image-plating-brief.md + house style.

## Exact prompt (single GenerateImage prompt)

Premium realistic editorial food photograph for a modern meal-planning app: Baked Ziti with Italian Sausage in an off-white ceramic 9x13 baking dish, higher three-quarter angle (about 45 degrees), 4:3 landscape. A bubbling golden mozzarella and Parmesan crust with appetizing browned spots covers the dish; one front corner is scooped out with a serving spoon resting there, revealing ziti tubes coated in rich red crushed-tomato sauce, browned Italian sausage crumbles, and creamy white pockets of ricotta; red sauce bubbles at the dish edges; torn fresh basil leaves on top. Bright soft natural window light, gentle realistic shadows, vibrant but believable color, the dish filling most of the frame. Light neutral stone tabletop; at the frame edge only a small wedge of Parmesan and a few basil sprigs, out of focus. Keep the whole dish within the central 75% of the frame width so it survives a 4:3 center crop. No lasagna sheets, no meatballs, no spinach or mushrooms, no bread, no salad, no burnt cheese, no orange grease pools, no parsley, no heavy steam, no text, logos, watermarks, packaging, hands, or faces.

## GenerateImage call notes

- Aspect ratio 4:3 landscape if the tool accepts one; otherwise landscape (the prompt keeps the dish inside the central 75% of the width so a 16:9 output survives the 4:3 center crop).
- If the tool accepts a reference image, attach `/workspace/flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png` as a style/light reference only.
- Save the accepted image as `/workspace/flavorweave-catalog-factory/wave-12/candidates/baked-ziti-italian-sausage/img_v1.jpg` (JPEG). If the tool returns PNG/WebP: `python3 -c "from PIL import Image; Image.open('<downloaded file>').convert('RGB').save('/workspace/flavorweave-catalog-factory/wave-12/candidates/baked-ziti-italian-sausage/img_v1.jpg', quality=95)"`
- Rejected attempts go only under `rejected/` with a different filename (for example `rejected/img_v1-attempt1.jpg`); never reuse the active filenames there.

## Self-critique before accepting (K / L1 / L2)

- **K fidelity:** every item in the brief's Required list is visible; nothing from the Forbidden list appears; protein cut/doneness and sauce match the steps.
- **L1 style:** bright soft window light, neutral surfaces, no text/logos/hands, crop-safe center; check the 640x480 card after export.
- **L2 hero appeal:** would this make someone choose the meal next to the Chipotle Lime Black Bean Bowl reference? Textures visible, abundant not sparse, colors distinct at card size. Accurate-but-dull is a FAIL — regenerate.

## Targeted regeneration levers

- Looks like lasagna -> 'tube-shaped ziti pasta clearly visible at the scooped corner'
- Ricotta invisible -> 'creamy white ricotta pockets in the cross-section'
- Crust burnt -> 'golden with light browned spots'
- Greasy -> 'no pooled grease'

## Export (after accepting img_v1.jpg)

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/baked-ziti-italian-sausage/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/baked-ziti-italian-sausage baked-ziti-italian-sausage
python3 /workspace/flavorweave-catalog-factory/wave-12/batch-a-tools/render_batch_a.py --finalize baked-ziti-italian-sausage --generation-date YYYY-MM-DD --model unknown
python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py /workspace/flavorweave-catalog-factory/wave-12/candidates/baked-ziti-italian-sausage
```

## Provenance (filled at finalize)

- image_id: `img_baked-ziti-italian-sausage_v1`
- dish_id: `baked-ziti-italian-sausage`
- recipe_version_id: `rv_baked-ziti-italian-sausage_v1`
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
- Master: WebP 1200x900 4:3 → `baked-ziti-italian-sausage.webp`
- Card: WebP 640x480 4:3 → `baked-ziti-italian-sausage-640.webp`
- WebPs exported; package_revision freeze-r1; Freeze Integrity result in FREEZE_INTEGRITY.json. Awaiting Vale.

## Fidelity the image will owe Vale

See image-plating-brief.md required/forbidden lists. This file does not grant image certification.
