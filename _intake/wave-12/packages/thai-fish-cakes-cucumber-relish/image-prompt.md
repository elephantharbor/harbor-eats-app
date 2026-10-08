# Image prompt — thai-fish-cakes-cucumber-relish

Status: package_revision `freeze-r3`. asset_generated is true. Master and card WebPs present. Not certified. Not published.

Revision (freeze-r3): Rewritten for Vale r1 Gate K (surface wording rewritten again after attempt3, the freeze-r2 pre-screen): the cut cake must show an opaque, matte, pale tan, lightly curry-tinted (warm beige-orange, from the red curry paste) fully cooked interior (no pink, no salmon color, not translucent or moist-looking); inclusions are thin green-bean rings, never peas or edamame; each cake reads as classic Thai tod mun pla, in the active exact prompt's words: 'an irregular, slightly lumpy, puffed patty of springy fish paste with a smooth, glossy, deep reddish-golden-brown pan-fried skin (tinted by red curry paste), soft rounded bumps and a few shallow blisters, and thin, irregular, frilly fried edges; the surface is sleek like a fried fish ball, never sandy, grainy or textured', with the negatives 'no breaded or crumbed look, no grainy or sandy crust, no perfect discs'. Attempts 1 (crumb-coated), 2 (r1 active hero) and 3 (freeze-r2 pre-screen, crumb-like surface) are in rejected/.

Do not substitute a stock photo, a web photo, or a recipe-site photo. Generate from the recipe and `image-plating-brief.md`, never from the title alone. Intended frame: 4:3 landscape, master 1200x900, card 640x480. House-quality reference: flavorweave-catalog-factory/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality / light / appeal reference, not a composition clone). Standard: image-standards/hero-appeal-amendment.md — truthful enough to trust, attractive enough to choose.

## GenerateImage call (for Cora)

- aspect_ratio: 4:3 (landscape)
- reference image: image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png (quality reference only)
- style: premium editorial food photography, professionally styled real food
- save the output as `/workspace/flavorweave-catalog-factory/wave-12/candidates/thai-fish-cakes-cucumber-relish/img_v1.jpg` (if GenerateImage returns PNG/WebP, `prepare` converts it to RGB JPEG q95)
- rejected attempts: move to `rejected/` with a different filename (e.g. `rejected/img_v1_try1.jpg`); never reuse the active names

## Exact prompt

Premium editorial food photograph of Thai Fish Cakes with Cucumber Relish for a modern meal-planning app. On an off-white ceramic dinner plate, five or six round, flattened, pan-fried Thai fish cakes about 2 1/2 inches wide and 1/2 inch thick, overlapping in a loose fan, irregular in shape. Each cake looks like classic Thai tod mun pla: an irregular, slightly lumpy, puffed patty of springy fish paste with a smooth, glossy, deep reddish-golden-brown pan-fried skin (tinted by red curry paste), soft rounded bumps and a few shallow blisters, and thin, irregular, frilly fried edges; the surface is sleek like a fried fish ball, never sandy, grainy or textured. Thin green-bean rings (1/8-inch slices of green bean, each a small pale-green ring showing tiny seeds) are flecked through the cakes, with a few fine threads of lime leaf. One cake is cut in half to show a fully cooked interior: dense, springy, opaque, matte, pale tan, lightly curry-tinted (warm beige-orange, from the red curry paste) fish paste with only tiny scattered flecks of curry paste and green-bean rings; not pink, not salmon-colored, not translucent, not moist-looking. Beside the cakes, a small pale ceramic bowl of cucumber relish: thin translucent cucumber quarter-moons, purple-pink shallot slices, and red chile rings glistening in a clear sweet-sour vinegar brine, with a few cilantro leaves. A neat mound of fluffy white jasmine rice at the back of the plate, a lime wedge, and scattered cilantro leaves. Elevated three-quarter angle, about 40 to 45 degrees, 4:3 landscape, the plate centered and filling most of the frame with margin on the left and right. Bright, soft, diffused natural window light, gentle shadows, realistic crisp texture on the blistered fish-cake surfaces. Light warm-gray stone tabletop, quiet unbranded background, a halved lime and a red chile in soft focus at the edge. Vibrant but believable color, professionally styled real food, not advertising fantasy. No pink, salmon-colored, or translucent interior, no salmon, no peas, no edamame, no whole green beans, no breaded or crumbed look, no grainy or sandy crust, no perfect discs, no peanuts, cashews, or crushed nuts, no sweet chili sauce or dark dipping sauce, no shrimp or shellfish, no perfectly round deep-fried balls, no lettuce, no noodles. No text, logo, watermark, packaging, hands, or faces.

## Must be visible (fidelity)

- 5 to 6 round, flattened pan-fried fish cakes, about 2 1/2 inches wide and 1/2 inch thick
- Smooth, puffed, golden-brown blistered pan-fried surface with crisp lacy edges and no breadcrumbs, panko, batter, or crumb coating
- Thin green-bean rings (1/8-inch slices, each a small pale-green ring showing tiny seeds) flecked through the cakes, plus fine lime-leaf threads
- One cake cut open: opaque, matte, pale tan, lightly curry-tinted (warm beige-orange, from the red curry paste) fully cooked interior with only tiny flecks of curry paste and green-bean rings; no pink, no salmon color
- Cucumber relish: thin cucumber quarter-moons, shallot slices, red chile rings in clear brine
- Fluffy white jasmine rice
- Cilantro leaves and a lime wedge

## Must not appear

- Pink, salmon-colored, or translucent interior; moist, raw, or undercooked-looking centers
- Salmon or any salmon-colored fish
- Peas, edamame, or whole or long-cut green beans
- Breadcrumbs, panko, batter, or any crumb coating; pebbly, crumbly, or crusted surface
- Peanuts, cashews, or any crushed nuts
- Sweet chili sauce or dark dipping sauce
- Shrimp or other shellfish
- Uniform deep-fried spheres
- Lettuce cups
- Noodles
- Text, logo, watermark, packaging, hands, faces

## Provenance (filled by finalize)

- image_id: `img_thai-fish-cakes-cucumber-relish_v1`
- dish_id: `thai-fish-cakes-cucumber-relish`
- recipe_version_id: `rv_thai-fish-cakes-cucumber-relish_v1`
- asset_generated: true
- generation method: cursor_GenerateImage_then_format_size_conversion
- generator: Cora (Grok Bot Catalog Factory wave-12) via GenerateImage
- model: unknown unless GenerateImage metadata exposes it
- prompt authored: 2026-10-08 (America/Chicago)
- generation_date: 2026-10-08
- external image API called by executor: false
- rights: not_cleared_for_external_release
- qa_state: frozen_for_audit

## Technical targets and commands

- Source JPEG: `img_v1.jpg`
- Master: WebP 1200x900 4:3 → `thai-fish-cakes-cucumber-relish.webp`
- Card: WebP 640x480 4:3 → `thai-fish-cakes-cucumber-relish-640.webp`

Convert a GenerateImage output into img_v1.jpg and export the pair in one step:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py prepare thai-fish-cakes-cucumber-relish /workspace/flavorweave-catalog-factory/wave-12/incoming-batch-c/thai-fish-cakes-cucumber-relish-r2.png
```

Or, if `img_v1.jpg` is already saved, export the master + 640 pair directly:

```
python3 /workspace/flavorweave-catalog-factory/export_meal_webps.py /workspace/flavorweave-catalog-factory/wave-12/candidates/thai-fish-cakes-cucumber-relish/img_v1.jpg /workspace/flavorweave-catalog-factory/wave-12/candidates/thai-fish-cakes-cucumber-relish thai-fish-cakes-cucumber-relish
```

Then re-render this package to the frozen state, run freeze_integrity.py, and record the result:

```
python3 /workspace/flavorweave-catalog-factory/wave-12/candidates/batch_c_build.py finalize thai-fish-cakes-cucumber-relish
```

## Fidelity the image will owe Vale

K (fidelity), L1 (technical/style), L2 (hero appeal / card-scale). Check the must-be-visible and must-not-appear lists against the image before export; regenerate if any fail. This file does not grant image certification.
