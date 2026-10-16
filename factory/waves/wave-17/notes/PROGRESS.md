# Wave-17 progress (200 -> 250)

Resumed 11:21 PM CT Oct 15 after an interruption.

## State at resume (11:21 PM CT)
- tools/: adapted (build_packages, common, title_tags.mjs, overlap_report). coverage_stats.py, write_docs.py, finalize_images.py still in wave-16 form.
- Recipe sources: A1-A10, B1-B10, C1-C10, D1-D10 authored (40); `build_packages.py --check` passes all 40. Batch E (10) not started.
- candidates/: empty (no packages written yet).
- coverage.md, selection-rationale.md, rejected.md: not written.
- /workspace/wave17-prompts.txt: does not exist.
- /workspace/wave17-backups/: did not exist; backup wave17-pre-resume-2321.tgz taken.

## Remaining
- [x] Batch E recipes (E1-E10) authored; --check 50/50 pass; overlap_report 0 too long
- [x] build all 50 packages (author-r1, hh001 17/50); backup wave17-built50 taken
- [x] adapted coverage_stats, write_docs, finalize_images (docstring/paths), mark_preflight docstring
- [x] structural preflight 50/50 PASS (r1, r2); freeze 20/24 with 4 image-only fails on all 50; marked author_r1_preflight_pass_awaiting_images; backup wave17-preflight taken
- [x] coverage.md (+WAVE.json, README.md, curator-notes, roster), selection-rationale.md, rejected.md
- [x] /workspace/wave17-prompts.txt (50) + notes/prompts-author-r1.txt; v1-prompt guard passes on --check
- [x] final backup wave17-final-2333.tgz + wave17-prompts.txt + SHA256SUMS; harbor-eats-app clean at 077bd14

## Done 11:33 PM CT Oct 15
All 50 at author-r1, structural 50/50 PASS, state author_r1_preflight_pass_awaiting_images. No images, no certification, no import, no D1, no PR.

## Image pass (started 11:5x PM CT Oct 15)
- Heroes in place: 41 at v1, 7 at v2, pupusas v3, chivito v4; 62 hashes in notes/image-gen-map.txt verified against files (0 mismatches).
- Backup wave17-pre-finalize taken (includes all source and rejected JPEGs).
- notes/prompts-regen-selfreview.txt = verbatim copy of /workspace/wave17-v2-prompts.txt.
- [x] tools: SELFREVIEW (v2..vN) in common; builder verifies each vN = v1 + one correction sentence and reasons = image-gen-map; finalizer records every rejected version
- [x] image-prompt.md (Active prompt + Version history, word for word) and plating brief (+ accepted correction) for the 9 regenerated meals
- [x] finalize all 50 (notes/finalize-r1.log): 50/50 freeze PASS; backup wave17-finalized taken
- [x] structural r3/r4 50/50 PASS; mark_preflight -> author_r2_preflight_pass_awaiting_vale (50); freeze r3/r4 50/50 PASS 26/26
- [x] notes/AUDITOR_HANDOFF.md; README/WAVE.json/coverage regenerated

## Image pass done (Oct 16, 12:0x AM CT)
All 50 at author-r2 with heroes, frozen; no certification, import, D1, deploy, or PR. Final backup wave17-images-final.

## Author round 3 (after audit r1: 42 PASS / 8 FAIL), 2026-10-16 CT
- [x] Pre-r3 backup `/workspace/wave17-backups/wave17-pre-r3-0018.tgz`; pre-r3 manifests `notes/pre-r3-file-hashes.sha256`, `notes/pre-r3-v1-hashes.sha256`.
- [x] Recipe fixes: empanadas, pierogi, pupusas, pytt i panna, ema datshi; tikin xic tag removed (metadata only).
- [x] `notes/prompts-regen-selfreview.txt` refreshed from /workspace/wave17-v2-prompts.txt; the image-gen-map has the audit-rejection and new hero lines.
- [x] New heroes copied in (pupusas img_v4, ca kho img_v3, chivito img_v5; sha256 verified); finalize_images ran for these 3 only.
- [x] build --force for the other 5; preflight 50/50 PASS; mark_preflight on the 8; re-freeze of the 8 PASS; all 50 freeze PASS on a scratch copy; the 42 are byte-identical.
- [x] write_docs re-run; r2 addendum appended to notes/AUDITOR_HANDOFF.md.
- [x] Post-r3 backup.

## Author round 4 (images only, after audit r2: 48 PASS / 2 FAIL), 2026-10-16 CT
- [x] Pre-r4 backup + `notes/pre-r4-file-hashes.sha256`.
- [x] prompts-regen-selfreview.txt refreshed; image-gen-map has the audit r2 rejections and pupusas v5 / chivito v6.
- [x] img_v5 (pupusas), img_v6 (chivito) copied, sha256 verified; finalize for these 2; preflight 50/50; mark_preflight + freeze for these 2; all 50 freeze PASS on scratch copy; the other 48 are byte-identical.
- [x] write_docs re-run; Addendum r3 appended to AUDITOR_HANDOFF.md; post-r4 backup.

## Author round 5 (pupusas image only, after audit r3: 49 PASS / 1 FAIL), 2026-10-16 CT
- [x] Pre-r5 backup + `notes/pre-r5-file-hashes.sha256`; prompts copy refreshed; image-gen-map has the audit r3 rejection and the v6 line; img_v6 copied (sha256 verified).
- [x] finalize (pupusas only); preflight 50/50; mark_preflight + freeze (pupusas only); all 50 freeze PASS on a scratch copy; the other 49 are byte-identical.
- [x] write_docs re-run; Addendum r4 appended; post-r5 backup.
