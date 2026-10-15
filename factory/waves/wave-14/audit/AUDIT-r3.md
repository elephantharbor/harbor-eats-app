# Wave-14 audit r3 (image re-check of the two r2 FAILs)

Independent auditor (Vale role), 2026-10-15 (CT). No edits to packages, repo or wave docs. Nothing imported, committed or deployed. Repo `main` @ 565d736, `git status` clean.

## Verdict

**PASS 50 · PASS WITH NOTES 0 · FAIL 0.** All 50 packages are certified at `freeze-r2` (auditor sign-off). Before the import PR, two non-package items need fixing (see the wave-doc section below). Import, PR and deploy remain human-gated.

## Re-audited: the two r2 FAILs

| Slug | K | L1 | L2 | L | M | O | r2 | r3 |
|---|---|---|---|---|---|---|---|---|
| `lebanese-samke-harra-bulgur` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL (K) | **PASS** |
| `new-england-clam-chowder` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL (K) | **PASS** |

- **Samke harra, K PASS.** Viewed with Read and cropped from the source. The img_v3 bulgur is matte, tan-brown, angular cracked wheat in mixed sizes. No pearl, couscous or quinoa look. Fish, tahini, chile, cilantro and lemon are all correct.
- **Clam chowder, K PASS.** Viewed with Read and cropped from the source. Many small, irregular, ruffled chopped-clam bits run through the chowder among the potatoes. There's no shredded mound and there are no shells. Bacon, chives, pepper and oyster crackers are present. Non-blocking: the clam bits are pale and cream-coated rather than grey, which is realistic for canned clams.
- **L1/L2 PASS for both.** 1280×720 source → 960×720 crop → 1200×900 / 640×480 WebP RGB. Bright and appetizing; reads at card size.
- **Hashes, M and O.** `asset_sha256`, `file_hashes` and `image-state.json` all match the files on disk. Only `img_v3.jpg` is active. The v1 and v2 sets are in `rejected/` with matching hashes, and `superseded[1]` equals the r2 active hashes. `package_revision` is `freeze-r2` on every field. README and prompt name img_v3, with no denial strings. Recipe text and culinary_hash are unchanged from r2.
- **Re-runs on copies.** freeze_integrity PASS 2/2; structural preflight PASS 2/2 (hh001=1, samke harra).
- **Non-blocking O notes.**
  - `freeze-r2` now names two image states; image_id `_v3` and the hashes disambiguate them.
  - `superseded[1].reason` says "Audit r1 gate K FAIL", but that failure was in audit r2.
  - The prompt and brief bodies were not revised for v3; only the status line changed. If a different prompt was used, record it.

## The other 48

Byte-identical to the r2 audit snapshot: every file, including images, v1.json, docs and rejected/, except `FREEZE_INTEGRITY.json` and `STRUCTURAL_PREFLIGHT.json`. Those differ only in path and timestamp fields, because the auditor's r2 re-run rewrote them in the snapshot copy. Both still say PASS. r2 verdicts (PASS) are carried forward.

## Wave docs: is WAVE.json `status_detail` accurate? **No.**

- **WAVE.json `status_detail`** still says "50/50 packages have their hero image (img_v1.jpg source…)" and "regenerated at freeze-r2 without touching image files". Actual sources: 43 img_v1, 5 img_v2, 2 img_v3; 9 heroes were regenerated and 18 image sets sit in rejected/.
- **WAVE.json `status`** is still `freeze_r2_audit_r1_fixes_applied_awaiting_reaudit`. `audit.round` is still `r1` (result "FAIL 50/50"), and r2/r3 aren't recorded.
- **notes/curator-notes.md** still lists every package with `img_v1.jpg`. Its "Hero images Cora is regenerating" section, with img_v2 instructions, is stale.
- **notes/r2-image-map.txt** lists the now-rejected v2 hashes for samke harra and chowder.
- **notes/freeze-integrity-freeze-r2.txt** (10:30) predates the r3 finalize (10:42). The per-package FREEZE_INTEGRITY.json files are current.
- Fix: regenerate the wave docs from the package state, with active source per slug, regeneration counts, audit r1→r2→r3 results and current freeze logs. Then re-check. This is a doc fix only; no package change and no re-audit of gates needed.

## Before the import PR

1. Fix the stale wave docs above.
2. Upstream the stronger freeze-integrity denial list (`/workspace/flavorweave-catalog-factory/freeze_integrity.py`) to the repo's `factory/tools/freeze_integrity.py`. The repo copy still lacks it.
3. Open items (not blockers): importer coconut and gluten tokens; D-03 band decision; cluster notes.

## Files

- `AUDIT-r3.md` (this file)
- `AUDIT-r3.json`: full gates for the 2 re-audited; carried r2 verdicts for 48
- Earlier rounds unchanged: `AUDIT-r1.*`, `AUDIT-r2.*`, `<slug>.md`, `<slug>-r2.md`
