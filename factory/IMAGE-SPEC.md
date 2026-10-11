# FlavorWeave Meal Image Specification

Visual and technical standard for new factory images and for legacy replacements. The author writes the plating brief and the prompt. An image pass generates the pixels. The independent auditor judges them. The author does not audit their own image.

Full amendment: `factory/tools/image-standards/hero-appeal-amendment.md`.

House-quality reference (light, finish, appetite, product-family consistency — not a layout to copy): `factory/tools/image-standards/house-quality-reference-chipotle-lime-black-bean-bowl.png` (Chipotle Lime Black Bean Bowl).

## Two publication standards

1. **Recipe fidelity** — the picture is the meal FlavorWeave is offering.
2. **Hero appeal** — the real meal looks genuinely desirable in a premium meal-planning product.

Both are required. Accurate but dull fails. Beautiful but wrong fails. Truthful enough to trust. Attractive enough to choose.

## Source policy

Original AI-generated assets only for new meals. Forbidden: web search, stock, restaurant photos, recipe-site images, scraped assets, and uncertain licenses. Keep generation provenance (date, method, generator). The model may be `unknown`. Do not go looking for a third-party license as the normal way to replace a legacy image.

## Technical

- Master: WebP RGB, **1200×900**, 4:3, file `<slug>.webp`
- Card: WebP RGB, **640×480**, 4:3, file `<slug>-640.webp`
- Spec catalog paths, once an integrator publishes: `/images/meals/<slug>.webp` and `/images/meals/<slug>-640.webp`
- Crop-safe center. The subject is still legible at card size.
- One active set. Rejected files only under `rejected/`.
- Export with `python3 factory/tools/export_meal_webps.py <source> <candidate-dir> <slug>`

## Image / plating brief

The author writes `image-plating-brief.md` before any generation. Minimum sections:

- Hero subject
- Vessel
- Camera angle (chosen on purpose)
- Required visible components (fidelity)
- Texture cues
- Sauce and component placement
- Legitimate garnish (recipe-listed only)
- Environmental styling (props that correspond to the recipe only; optional; they must not dominate)
- Color opportunities from real ingredients
- Forbidden elements
- Crop strategy for 1200×900, 640×480, and the FlavorWeave card crop

Do not generate from the title alone. The prompt is the recipe plus the plating brief plus the house style. Save that prompt as `image-prompt.md`.

## When the image pass is out of scope

The author still writes the brief and the prompt. `image.asset_generated` is `false`. The slot status is `pending_image_pass`. No WebP is invented. Freeze integrity fails until the files exist, which is what should happen. The image pass generates, exports, updates provenance (`method`, `generation_date`, `generator`, `model`), and re-runs freeze integrity. The auditor waits for PASS.

## Creative direction

Bright, premium, realistic editorial food photography for a modern meal-planning app. Art-directed, not clinical, not generic AI food, not a menu thumbnail.

Use the house reference for quality and light, not for identical staging. Do not force every meal into a bowl, an overhead angle, or cilantro and lime.

### Lighting

Bright diffused daylight, soft direction, real highlights, gentle shadows, texture visible. Avoid harsh flash, muddy restaurant dark, flat shadowless light, heavy yellow, gray desaturation, excessive HDR, and synthetic gloss.

### Color

Vibrant but believable from the recipe. Do not invent colorful ingredients. A monochrome meal improves through light, texture, plating, the vessel, and legitimate finishers.

### Texture

Show the claim the recipe makes: crisp, grilled, creamy, glazed, roasted, tender, as applicable. A pan-seared crust must not look deep-fried. An air-fried or oven-crisp surface must not look like a fryer.

### Composition and angle

Food fills a substantial part of the frame. Components are separated on purpose. Prefer an elevated three-quarter view for plates, sandwiches, steaks, fish, and casseroles. Prefer a higher, near-overhead angle for bowls, pasta, and curries. Use a lower angle only when height matters. Avoid a tiny portion on an empty plate, clutter, and the same documentation angle on every meal.

### Dishware and background

Modern ceramic, off-white or warm-neutral, light neutral tabletop. Avoid ornate dishes, logos, competing saturated ware, and dark nightclub surfaces.

### Garnish and environment

On-plate garnish only if the recipe lists it or the metadata lists it as an optional garnish. Environmental props (an herb sprig, a citrus half, a chile) only when they correspond to the recipe. They must not imply an extra side. No default cilantro-and-lime language on unrelated meals.

### Plant-forward meals

Equal hero treatment. Abundant and intentional. Not the plain healthy option.

### Avoid

Fake gloss, impossible char, unsupported giant portions, gravity-defying stacks, excessive steam. Coherence comes from light and realism, not from cloned bowls.

## Certification

The auditor reports:

- **K — fidelity** to the recipe
- **L1 — technical** WebP dimensions, crop, forbidden artifacts, provenance
- **L2 — hero appeal** appetite, light, color, texture, composition, plating, focal clarity, card-scale readability, parity with the strongest cards

Gate L fails if L1 or L2 fails. No PASS WITH NOTES. An L2 failure means regenerate against the diagnosed weakness and keep the rejected files under `rejected/`.

## Legacy replacements

A replacement keeps or improves the visual quality of the strongest existing card, and it gains clean AI provenance and recipe fidelity. Do not replace an attractive legacy image with a duller AI image just to tidy the rights note.
