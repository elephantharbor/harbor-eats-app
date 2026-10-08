# Image prompt — salade-nicoise-seared-tuna

Status: package_revision `freeze-r2`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Revision (freeze-r2): Prompt and brief revised for Vale r1 gate K before regeneration: lettuce must be smooth, rounded cup-shaped butter (Bibb) leaves (not napa/savoy cabbage, romaine, or iceberg); eight jammy egg halves from the recipe's four eggs, at least six clearly visible; tuna crust is coarsely cracked black peppercorns only with no pale seeds; no sesame. The r1 hero is archived in rejected/.

Original AI generation only. Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from this prompt (which encodes the exact recipe and `image-plating-brief.md`), never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 if the tool supports it; otherwise landscape. The prompt keeps the hero centered so a 16:9 source survives the 4:3 center crop (wave-11 sources were 1280x720).
- reference image (quality/light only): /workspace/flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png
- style: premium editorial food photography, professionally styled real food
- self-check before accepting: compare against 'Must be visible' / 'Must not appear' below (K), inspect at 640x480 (L2 card scale), reject flat light, sparse plating, or any forbidden element and regenerate targeting that defect.

## Exact prompt

Premium editorial food photograph of Salade Niçoise with Seared Tuna, family-style on a large oval off-white ceramic platter. In the center, a fan of 1/2-inch slices of pepper-crusted seared yellowfin ahi tuna: thin browned seared edge crusted with coarsely cracked black peppercorns only (dark, no pale seeds), glistening deep ruby-red rare center. Arranged around it in distinct, generous groups on smooth, rounded cup-shaped butter (Bibb) lettuce leaves, soft and tender, no crinkling, no thick white ribs: eight jammy soft-boiled egg halves (four eggs, halved lengthwise) with deep orange yolks (at least six halves clearly visible), glossy and spread across the platter, halved warm baby Yukon Gold potatoes glossy with Dijon-shallot vinaigrette, bright green crisp-tender green beans, halved red cherry tomatoes, dark Niçoise olives, a scattering of capers and chopped parsley, the vinaigrette with tiny shallot flecks beading over everything. A small glass jar of the vinaigrette sits at the edge of the platter. Higher three-quarter, near-overhead angle, 4:3 landscape composition with the platter centered and fully inside the middle of the frame, bright soft natural window light, gentle shadows, light neutral linen-and-stone tabletop, quiet unbranded background, vibrant but believable color, professionally styled real food. No napa cabbage, no savoy cabbage, no romaine, no iceberg, no sesame seeds, no sesame crust, no pale seeds in the pepper crust, no canned tuna, no avocado, no cheese, no croutons, no bread, no corn, no red onion, no radishes, no lemon, no anchovies, no butter pats. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- Fanned seared tuna slices with rare red center and a crust of coarsely cracked black peppercorns only (dark, no pale seeds)
- Eight jammy egg halves with deep orange yolks (four eggs, halved); at least six halves clearly visible
- Dressed halved baby potatoes
- Green beans
- Cherry tomatoes
- Olives and capers
- Butter (Bibb) lettuce: smooth, rounded cup-shaped leaves, soft and tender, no crinkling, no thick white ribs (must not read as cabbage)
- Oval light platter

## Must not appear

- Napa cabbage, savoy cabbage, romaine, iceberg (crinkled leaves or thick white ribs)
- Sesame crust / sesame seeds; pale seeds or seed-like specks in the tuna crust
- Canned or grey overcooked tuna
- Avocado, cheese, croutons, bread, corn
- Red onion, radishes, lemon
- Anchovies on the hero (optional garnish left off)
- Text, logo, watermark, packaging, hands, faces

## Provenance

- image_id: `img_salade-nicoise-seared-tuna_v1`
- dish_id: `salade-nicoise-seared-tuna`
- recipe_version_id: `rv_salade-nicoise-seared-tuna_v1`
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
- Master: WebP 1200x900 4:3 → `salade-nicoise-seared-tuna.webp`
- Card: WebP 640x480 4:3 → `salade-nicoise-seared-tuna-640.webp`

One step (recommended; writes img_v1.jpg, exports both WebPs, re-renders every text file in the frozen state, runs the preflight):

```
python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py finalize salade-nicoise-seared-tuna --src /path/to/generated-image --preflight
```

Equivalent raw export (if done by hand, the text files must still be re-rendered with `build_batch_b.py render salade-nicoise-seared-tuna`):

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/salade-nicoise-seared-tuna/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/salade-nicoise-seared-tuna salade-nicoise-seared-tuna
python3 /workspace/flavorweave-catalog-factory/freeze_integrity.py /workspace/flavorweave-catalog-factory/wave-12/candidates/salade-nicoise-seared-tuna
```

Rejected attempts: `python3 /workspace/flavorweave-catalog-factory/wave-12/notes/batch-b/build_batch_b.py reject salade-nicoise-seared-tuna --reason "K/L1/L2: <defect>"` (moves files into rejected/ only).

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). See image-plating-brief.md. This file does not grant image certification.
