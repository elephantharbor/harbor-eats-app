# Curator notes — wave-15 (Grok Bot, creator role)

## State at author-r2/author-r3 (2026-10-15T16:02:24-05:00)

- 50 packages built by `tools/build_packages.py` (deterministic; every guard must pass before anything is written).
- Images: 50/50 finalized from Cora's GenerateImage heroes. Regenerated after audit r1: 9 (cuban-sandwiches, dominican-mangu-eggs-pickled-onions, egyptian-ful-medames, japanese-hambagu, japanese-vegetable-curry-rice, peruvian-tacu-tacu-egg, portuguese-grilled-sardines-potatoes, puerto-rican-pollo-guisado, southern-smothered-pork-chops). Earlier v2 self-review regenerations: grilled-lamb-chops-mint-salsa-verde, peruvian-tacu-tacu-egg, thai-crispy-barramundi-tamarind, turkish-iskender-kebab.
- Audit r1: 31/50 certified, 19 FAIL. Fixed at author-r3 (20 packages including galbi-jjim); see notes/AUDITOR_HANDOFF-r2.md.
- Structural preflight 50/50 PASS. Freeze integrity 50/50 PASS (26/26 checks x 50). `tools/mark_preflight.py` set structural_qa_state on all packages that passed both.
- Not audited, not certified, not imported. kitchen_tested is false on all 50. The creator does not self-certify.

## Guards added in this wave

- A wheat-free regex (rice flour, corn tortillas, cornmeal), so these aren't flagged as wheat.
- A near-duplicate check: every "Compared with <slug>" must name a live or planned slug, and no planned slug may collide with a live one.
- The built set must equal PLANNED.
- The unit word may not appear anywhere in the display name (catches "8 slice … slices" and "1 loaf crusty loaf").
- `finalize_images.py` refuses a SELFREVIEW_V2 slug whose chosen source is not img_v2. It moves the never-finalized v1 into `rejected/` without overwriting and records it under `image.superseded` and `image.regeneration`.

## Judgment calls left to the auditor

- Mustard (bengali-mustard-fish) has no allergen token in the runtime enum; it is disclosed in allergen notes.
- Coconut (moo ping) and barley/rye gluten (Irish stew with stout, bigos with rye bread) are declared in `runtime_enum_gaps` with notes.
- Fish sauce in moo ping is flagged finfish_seasoning_only.
- Peanut: malian-chicken-maafe. Tree nuts: peruvian-aji-de-gallina (walnut), lebanese-baked-kibbeh (pine nut).
- Alcohol used in cooking (notes in each package): three-cup mushrooms, basque hake, cacciatore, galbi-jjim (mirin), char siu, hambagu, Irish stew.
- Long clocks: new-mexican-carne-adovada 199, cantonese-char-siu-pork-rice 187, irish-beef-stew 184, korean-galbi-jjim 148, german-beef-rouladen 147, polish-bigos 143, thai-moo-ping-sticky-rice 122, herb-roast-turkey-breast-cranberry 118, lebanese-baked-kibbeh 114, hawaiian-huli-huli-chicken 104, cuban-sandwiches 95.
- Image sources are 1280x720. The 4:3 center crop is smaller than 1200x900, so the master is an upscale.
