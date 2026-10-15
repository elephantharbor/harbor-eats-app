# Audit r2: Vietnamese Bún Chả: Grilled Pork Patties with Noodles and Herbs

| | |
|---|---|
| Slug | `vietnamese-bun-cha` |
| Package revision | `freeze-r2` (all fields agree) |
| Freeze integrity | stored PASS; auditor re-run PASS on a copy |
| r1 | FAIL (B, K, M, O) |
| **r2 overall** | **PASS** |

Independent auditor (Vale role), 2026-10-15 r2. Package not edited. Nothing imported, committed, or deployed. New hero viewed at full size with Read, and the source crop inspected.

Only gates whose evidence changed in r2 are expanded here. All other gates PASS; see AUDIT-r2.json for the full A–O record and the r1 file for the base evidence.

## B — PASS

r1 closed. 16 cups (4 qt) in a 6- to 8-quart pot (equipment and step 1). Water lines are unchanged and still reconcile.

## K — PASS

r1 closed. img_v2 shows six small round charred patties (about 2 inches) half-submerged in nước chấm with carrot ribbons, chile and garlic slices, a separate white vermicelli nest, and a lettuce/mint/cilantro/Thai-basil plate. No large flat patty, no pork belly, no broth. Note: recipe step 4 puts 4 patties per bowl and the image shows 6; that is within the brief's 4–6. Superseded r1 set is under rejected/ and recorded in image.superseded; the rejected SHA-256s equal the r1 active hashes. image_id is `_v2`, regeneration_count 1.

## L1 — PASS

img_v2.jpg 1280x720 source, center-crop to 960x720, master WEBP 1200x900 RGB, card 640x480. SHA-256 match v1.json and image-state.json. No text, logos, or hands. Active paths are not under rejected/. Upscale artifacts are not visible at card or master size.

## L2 — PASS

Bright, appetizing, food fills the frame, clear hero ingredient, reads at card size; parity with the house reference.

## L — PASS

L1 and L2 both PASS (K judged separately).

## M — PASS

PASS. r1 systemic defect closed. README, image-prompt.md, plating brief and image-state.json now state that the master and card are present and frozen at freeze-r2. The immutability_note no longer says pending_image_pass. structural_qa_state (top level and recipe_version) is `freeze_r2_preflight_pass_awaiting_vale` and image.recipe_fidelity_state is `awaiting_audit`. method_detail now reads 'Source 1280x720 (16:9)… center-cropped to 4:3 (960x720), then LANCZOS-upscaled 1.25x…', which matches the real source. No denial strings remain outside rejected/ (auditor grep). Text provenance `original_ai_assisted`; image `ai_illustration`, generator 'Cora via Grok Bot GenerateImage', model `unknown`, no stock or web photo, rights not cleared.

## O — PASS

PASS. r1 defect closed. package_revision is `freeze-r2` everywhere: top level, recipe_version, image, d03 sidecar, image-state.json, README, brief and prompt. Version 1, immutable, unpublished. Culinary text changes on an unpublished v1 with no durable history stay on v1 (package skill: a new version is needed only after durable history; wave-13 precedent). culinary_hash was recomputed and matches. D-03 enums are unchanged, so no classification_history entry is required.
