# Audit: Filipino Bistek Tagalog: Soy-Citrus Beef with Onion Rings and Rice

| | |
|---|---|
| Slug | `filipino-bistek-tagalog` |
| Recipe version | `rv_filipino-bistek-tagalog_v1` |
| Package revision | `author-r2` (consistent) |
| Hero | `img_v1.jpg` → `filipino-bistek-tagalog.webp` |
| Freeze integrity | stored PASS; auditor re-run PASS (26/26) |
| Structural preflight | stored PASS; auditor re-run PASS |
| Overall | **FAIL** (B, E) |

Independent auditor (Vale role), 2026-10-15 CT, Wave-15 r1. Package not edited; nothing imported, D1 untouched, no PR, nothing deployed. Hero viewed at full size with Read.

## A — PASS

Slug/dish_id/recipe ids consistent; version 1 immutable; draft; recommendation_eligible false. D-03: effort_level `moderate` (sidecar score 3), ingredient_complexity `simple` (sidecar score 0, 8 counted ingredients). Bands ≤12/13-16/17+ and the sums recompute; enums match v1. Auditor re-run of the structural preflight: PASS.

## B — FAIL

The ingredient prep note says the sirloin is 'partly frozen 20 minutes' for slicing, but no step freezes it, and the time clock does not count it (Wave-14 Xi'an cumin lamb precedent: same pattern, B + E FAIL).

**Fix:** Either add a timed step ('Freeze the meat 20 minutes until firm at the edges, then slice...') and count the 20 minutes in prep, or state an explicit overlap with a named parallel task (the rice cooks) that is at least 20 minutes long. Update time_clock and time_reconstruction. Or drop 'partly frozen' and write 'very cold, sliced thin' with no freeze.

## C — PASS

Base 4; 1/2/4 scaling present with do-not-scale items.

## D — PASS

Heat levels and doneness cues stated; every component is completed; a serve step is present.

## E — FAIL

The 20-minute partial freeze from the ingredient note is missing from the clock, so total time under-reports by up to 20 minutes for a cook who follows the note.

**Fix:** Follows the B fix: count the freeze in prep (or state the overlap); if 'partly frozen' is dropped, no clock change is needed.

## F — PASS

Store-bought components carry hard contracts, or none are required.

## G — PASS

**Eligibility:** meat True, poultry False, finfish False, shellfish False, dairy False, vegetarian False, plant-based False, nut_policy `none`; HH001 False (Contains beef (meat).). Labels ['dairy_free'].

**Allergens:** ['meat', 'soy', 'wheat']. Re-derived from the ingredient lines and contracts; all tokens are importer-valid. Notes: ['Meat from the beef.', 'Soy and wheat from the soy sauce.', 'No egg, milk, sesame, fish, shellfish, or nuts.']

## H — PASS

Vocabulary tags ['tangy', 'savory', 'umami', 'tender'] are supported by the recipe; the flavour build is coherent.

## I — PASS

Compared with filipino-chicken-adobo: thin-sliced beef with citrus and onion rings, not vinegar-braised chicken. Compared with japanese-gyudon: seared steak slices in a sour soy-citrus sauce, not simmered beef in a sweet dashi-free broth. Compared with peruvian-lomo-saltado: no fries, tomatoes, or wok stir-fry. Checked against the 135 catalog meals, Wave-14 and the rest of Wave-15: no slug collision, not a cosmetic duplicate.

## J — PASS

Title, description, methods and cooking object agree; the cooking field is deterministic deriveCookingMethod output; no cuisine/pantry bias points.

## K — PASS

Viewed at full size against image-plating-brief.md and the recipe: main, sides and garnishes are as briefed; no invented ingredient or side; identity is unambiguous.

## L1 — PASS

Master WEBP 1200x900 RGB; card 640x480 RGB; source img_v1.jpg 1280x720. SHA-256 match asset_sha256, image-state and notes/image-gen-map.txt. No text, logos or hands.

## L2 — PASS

Appetizing and well lit; the food fills the frame and reads at card size; within the house reference range.

## L — PASS

L1 and L2 both pass (K is judged separately).

## M — PASS

Text provenance `original_ai_assisted`; image `ai_illustration`, generator "Cora via Grok Bot GenerateImage", method_detail states the 1280x720 source; no stock/web photo; no metadata denies present assets.

## N — PASS

Shopping list derivable; units and package sizes are shoppable.

## O — PASS

package_revision `author-r2` consistent across top-level, recipe_version, image, sidecar and docs; version 1; classification_history present; FREEZE_INTEGRITY re-run PASS (26/26).
