# Audit r2: Bangers and Mash with Onion Gravy

| | |
|---|---|
| Slug | `bangers-and-mash-onion-gravy` |
| Package revision | `freeze-r2` (all fields agree) |
| Freeze integrity | stored PASS; auditor re-run PASS on a copy |
| r1 | FAIL (M, O) |
| **r2 overall** | **PASS** |

Independent auditor (Vale role), 2026-10-15 r2. Package not edited. Nothing imported, committed, or deployed.

Only gates whose evidence changed in r2 are expanded here. All other gates PASS; see AUDIT-r2.json for the full A–O record and the r1 file for the base evidence.

## F — PASS

New in r2. The sausage line is a hard contract: 'the ingredient list shows no egg, soy, milk, or sesame.' Wheat is tokenized (gravy flour; rusk noted). The contract sits on the ingredient line, not in components[]; PACKAGE.md accepts a hard ingredient contract.

## G — PASS

Allergens meat, milk, wheat. 'No egg, soy, sesame…' is backed by the sausage contract. No new problem.

## M — PASS

PASS. r1 systemic defect closed. README, image-prompt.md, plating brief and image-state.json now state that the master and card are present and frozen at freeze-r2. The immutability_note no longer says pending_image_pass. structural_qa_state (top level and recipe_version) is `freeze_r2_preflight_pass_awaiting_vale` and image.recipe_fidelity_state is `awaiting_audit`. method_detail now reads 'Source 1280x720 (16:9)… center-cropped to 4:3 (960x720), then LANCZOS-upscaled 1.25x…', which matches the real source. No denial strings remain outside rejected/ (auditor grep). Text provenance `original_ai_assisted`; image `ai_illustration`, generator 'Cora via Grok Bot GenerateImage', model `unknown`, no stock or web photo, rights not cleared.

## O — PASS

PASS. r1 defect closed. package_revision is `freeze-r2` everywhere: top level, recipe_version, image, d03 sidecar, image-state.json, README, brief and prompt. Version 1, immutable, unpublished. Culinary text changes on an unpublished v1 with no durable history stay on v1 (package skill: a new version is needed only after durable history; wave-13 precedent). culinary_hash was recomputed and matches. D-03 enums are unchanged, so no classification_history entry is required.
