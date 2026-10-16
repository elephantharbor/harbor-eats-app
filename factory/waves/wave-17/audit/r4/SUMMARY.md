# Wave-17 independent audit, round 4 (2026-10-16 CT)

## Result: pupusas PASS. Batch 50/50, CERTIFIED (gates A–O only)

- **salvadoran-bean-cheese-pupusas (v6, author-r5): PASS.**
  - The filling is now the mixed bean-and-cheese filling the recipe makes: a soft, reddish-brown bean paste marbled with melted mozzarella. It reads as beans, not meat.
  - The curtido and salsa are right.
  - Puffiness: both pupusas look domed, about 3/4 inch against the recipe's 1/2 inch raw. That is within tolerance for griddled masa, so it's a note only.
  - Recipe hash unchanged. Freeze integrity 26/26 and structural preflight pass on a scratch copy. Image hashes, sizes and the 1.25x re-derivation check out. The v5 hero in `rejected/` is byte-identical to the one I rejected in r3.
- **Other 49: unchanged.** All 558 files are byte-identical to my pre-audit copies (directory path in the QA JSONs normalized), so none needed re-audit. 0 mismatches against `notes/pre-r5-file-hashes.sha256`.
- **Duplicate check:** not re-run (no title or slug changed). The r1 PASS stands.
- **Non-blocking:** the bhutanese-ema-datshi "chile strips" wording in near_duplicate_review. Note only.

## Certification
`audit/r4/CERTIFICATION.json` covers all 50 meals and records, for each meal:
- per-gate PASS results;
- the package revision, recipe hash and active image hashes;
- the round it passed in.

It certifies gate results only. It is not publication, import, release, or a kitchen test. No packages were edited; no import, deploy, PR or D1 access.
