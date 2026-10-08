# Image prompt — peruvian-lomo-saltado

Status: package_revision `freeze-r4`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Revision (freeze-r4): Revised freeze-r3 prompt (after attempt4), re-rendered before the active generation: the beef is described positively as thin, irregular, bite-size stir-fried strips lacquered in a glossy dark soy-vinegar pan sauce with smooth sauce-coated surfaces (lattice-priming words removed); tomato wedges lie skin side up; the plate is medium, round and centred in the central 60% of the frame width; negatives lead with no grill marks, no steak, no tomato seeds. This block is the exact text pasted into GenerateImage for the active hero; any change goes into recipes_part4.py and is re-rendered first (no ad-hoc additions). The first freeze-r3 prompt (attempt4) is superseded; retired heroes are logged in rejected/REJECTIONS.md.

Original AI generation only. Do not substitute a stock photo, a web photo, or a recipe-site photo. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality/light/appeal reference, not a composition clone). Generated from the exact recipe + image-plating-brief.md + house style.

## Exact prompt (single GenerateImage prompt)

Premium realistic editorial food photograph for a modern meal-planning app: Peruvian Lomo Saltado on a medium round off-white stoneware plate, elevated three-quarter angle (about 40 degrees), 4:3 landscape. The plate is small in the frame and centered, occupying only the central 60% of the frame width, with wide empty stone tabletop visible on both the left and right sides. A generous heap of thin, irregular, bite-size strips of tender stir-fried beef, lacquered in a glossy dark mahogany soy-vinegar pan sauce like teriyaki beef, with soft rounded edges and a smooth, shiny, sauce-coated surface, tossed with charred red onion wedges that are still crisp and juicy red tomato wedges lying skin side up so only their smooth glossy red skin shows, flecked with chopped cilantro; about a third of the golden, crisp straight-cut French fries tossed right into the stir-fry, glossed with the amber pan sauce and mingled with the beef, onion, and tomato, the rest piled alongside; a neat smooth dome of white rice on the left side of the plate. Bright soft natural window light, gentle realistic shadows, vibrant but believable color. Light neutral stone tabletop; a few cilantro sprigs near one edge, out of focus. No grill marks, no steak, no tomato seeds, no fried egg, no cheese or creamy yellow sauce, no green bell peppers, no broccoli, no sesame seeds, no scallions, no lime, no ketchup or mayo, no chips, no chopsticks, no heavy steam, no text, logos, watermarks, packaging, hands, or faces.

## GenerateImage call notes

- Aspect ratio 4:3 landscape if the tool accepts one; otherwise landscape (the prompt keeps the dish inside the central 75% of the width so a 16:9 output survives the 4:3 center crop).
- If the tool accepts a reference image, attach `/workspace/flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png` as a style/light reference only.
- Save the accepted image as `/workspace/flavorweave-catalog-factory/wave-12/candidates/peruvian-lomo-saltado/img_v1.jpg` (JPEG). If the tool returns PNG/WebP: `python3 -c "from PIL import Image; Image.open('<downloaded file>').convert('RGB').save('/workspace/flavorweave-catalog-factory/wave-12/candidates/peruvian-lomo-saltado/img_v1.jpg', quality=95)"`
- Rejected attempts go only under `rejected/` with a different filename (for example `rejected/img_v1-attempt1.jpg`); never reuse the active filenames there.

## Self-critique before accepting (K / L1 / L2)

- **K fidelity:** every item in the brief's Required list is visible; nothing from the Forbidden list appears; protein cut/doneness and sauce match the steps.
- **L1 style:** bright soft window light, neutral surfaces, no text/logos/hands, crop-safe center; check the 640x480 card after export.
- **L2 hero appeal:** would this make someone choose the meal next to the Chipotle Lime Black Bean Bowl reference? Textures visible, abundant not sparse, colors distinct at card size. Accurate-but-dull is a FAIL — regenerate.

## Targeted regeneration levers

- Reads as Chinese stir-fry -> 'with French fries tucked in and a domed white rice mound'
- Fries soggy/pale -> 'golden crisp fries'
- Green peppers appear -> lead negatives with them
- Beef grey -> 'deeply seared, glossy, juicy'
- Grill marks / char stripes or sliced-steak look on the beef -> lead with 'bite-size sirloin strips pan-seared in a smoking-hot wok, even deep-brown seared crust, no grill marks or char stripes' and keep 'no grill marks, no char stripes, no sliced grilled steak' at the front of the negatives
- All fries in a separate pile (reads as steak frites) -> 'about a third of the fries tossed into the stir-fry, glossed with sauce and mingled with the beef, onion, and tomato; the rest alongside'
- Tomato seeds visible -> 'tomato wedges with the seeds scooped out' plus 'no tomato seeds' in the negatives
- Crosshatch/diamond scoring or grill-like lattice on the beef -> 'smooth, naturally uneven deep-brown caramelized sear, no scoring, crosshatch or diamond pattern' and lead the negatives with 'no crosshatch or diamond scoring on the beef'
- Tomato seeds or gel visible -> 'seeds and seed gel fully scooped out so only smooth firm red flesh shows' (or show wedges skin-side up)
- Lattice/scored texture persisted through r3 wording (attempt4) -> r3b: describe beef positively as thin irregular glossy sauce-lacquered strips (teriyaki-like), drop lattice words that prime the pattern; tomatoes skin side up; plate in central 60% of width
- Diamond/lattice texture persists on the meat -> strengthen 'glossy sauce-coated, smooth-surfaced strips like the beef in a classic wok stir-fry' (edit here and re-render image-prompt.md first; no ad-hoc additions at generation time)

## Export (after accepting img_v1.jpg)

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/peruvian-lomo-saltado/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/peruvian-lomo-saltado peruvian-lomo-saltado
python3 /workspace/flavorweave-catalog-factory/wave-12/batch-a-tools/render_batch_a.py --finalize peruvian-lomo-saltado --generation-date YYYY-MM-DD --model unknown
python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py /workspace/flavorweave-catalog-factory/wave-12/candidates/peruvian-lomo-saltado
```

## Provenance (filled at finalize)

- image_id: `img_peruvian-lomo-saltado_v1`
- dish_id: `peruvian-lomo-saltado`
- recipe_version_id: `rv_peruvian-lomo-saltado_v1`
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
- Master: WebP 1200x900 4:3 → `peruvian-lomo-saltado.webp`
- Card: WebP 640x480 4:3 → `peruvian-lomo-saltado-640.webp`
- WebPs exported; package_revision freeze-r4; Freeze Integrity result in FREEZE_INTEGRITY.json. Awaiting Vale.

## Fidelity the image will owe Vale

See image-plating-brief.md required/forbidden lists. This file does not grant image certification.
