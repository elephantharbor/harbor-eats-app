# Image prompt — thai-turkey-larb-lettuce-wraps

Status: package_revision `freeze-r1`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Original AI generation only. Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from this prompt (which encodes the exact recipe and `image-plating-brief.md`), never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 if the tool supports it; otherwise landscape. The prompt keeps the hero centered so a 16:9 source survives the 4:3 center crop (wave-11 sources were 1280x720).
- reference image (quality/light only): /workspace/flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png
- style: premium editorial food photography, professionally styled real food
- self-check before accepting: compare against 'Must be visible' / 'Must not appear' below (K), inspect at 640x480 (L2 card scale), reject flat light, sparse plating, or any forbidden element and regenerate targeting that defect.

## Exact prompt

Premium editorial food photograph of Thai turkey larb lettuce wraps on a large light off-white ceramic platter. Four or five cupped pale-green butter lettuce leaves are generously filled with finely crumbled cooked ground turkey larb, light golden-brown with a few browned bits and a light sheen of lime-fish-sauce dressing, flecked with red dried chile flakes, thin purple-pink shallot slices, green scallion rings, whole and torn fresh mint leaves, chopped cilantro, and a dusting of golden toasted rice powder. Thin cucumber slices and lime wedges are arranged on the platter between the cups, with a tiny dish of extra toasted rice powder and a few mint sprigs nearby. Higher three-quarter angle, 4:3 landscape composition with the platter centered and the filled cups fully inside the middle of the frame, bright soft natural window light, gentle shadows, light neutral stone tabletop, quiet unbranded background, shallow depth of field, vibrant but believable color, professionally styled real food. No brown hoisin or teriyaki glaze, no water chestnuts, no mushrooms, no carrots, no red cabbage, no peanuts, no cashews, no sesame seeds, no sriracha, no tomatoes, no rice, no noodles. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Butter lettuce cups filled with finely crumbled turkey larb
- Red chile flakes and shallot slices
- Mint, cilantro, scallion
- Toasted rice powder
- Cucumber slices
- Lime wedges

## Must not appear

- Glossy brown hoisin/teriyaki glaze
- Water chestnuts, mushrooms, carrots, red cabbage
- Peanuts, cashews, sesame
- Rice bowls, noodles
- Text, logo, watermark, packaging, hands, faces

## Provenance

- image_id: `img_thai-turkey-larb-lettuce-wraps_v1`
- dish_id: `thai-turkey-larb-lettuce-wraps`
- recipe_version_id: `rv_thai-turkey-larb-lettuce-wraps_v1`
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
- Master: WebP 1200x900 4:3 → `thai-turkey-larb-lettuce-wraps.webp`
- Card: WebP 640x480 4:3 → `thai-turkey-larb-lettuce-wraps-640.webp`

One step (recommended; writes img_v1.jpg, exports both WebPs, re-renders every text file in the frozen state, runs the preflight):

```
python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py finalize thai-turkey-larb-lettuce-wraps --src /path/to/generated-image --preflight
```

Equivalent raw export (if done by hand, the text files must still be re-rendered with `build_batch_b.py render thai-turkey-larb-lettuce-wraps`):

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/thai-turkey-larb-lettuce-wraps/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/thai-turkey-larb-lettuce-wraps thai-turkey-larb-lettuce-wraps
python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py /workspace/flavorweave-catalog-factory/wave-12/candidates/thai-turkey-larb-lettuce-wraps
```

Rejected attempts: `python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py reject thai-turkey-larb-lettuce-wraps --reason "K/L1/L2: <defect>"` (moves files into rejected/ only).

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). See image-plating-brief.md. This file does not grant image certification.
