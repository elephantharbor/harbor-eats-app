# Wave-17 independent audit, round 3 (2026-10-16 CT)

Scope: a full A–O re-audit of the 2 packages revised to `author-r4` (image only), plus a byte-identity check of the other 48. Packages were not edited; D1 and the app repo were read-only; no import, deploy, PR or cloud agent. No raw image-prompt text is reproduced.

## Result
- **Round 3: 1 PASS / 1 FAIL.**
- **Batch: 49 PASS / 1 FAIL** of 50, so **not certified**. No certification record was written.

| Meal | r2 | r3 | Basis |
|---|---|---|---|
| uruguayan-chivito-sandwiches | FAIL K | **PASS** | v6: whole-muscle grain visible; cooked through to 145 F look; egg and olives inside; about 3/8–1/2 in thick (within tolerance, noted) |
| salvadoran-bean-cheese-pupusas | FAIL K | **FAIL K** | v5: matte, but a thick, near-black, crumbly slab that reads as ground beef. It contradicts "puréed smooth" and the step-3 mixed bean-and-cheese filling |

## Fix (pupusas, K)
Regenerate v6 so it shows the filling the recipe actually makes:
- Beans and mozzarella mixed into one marbled filling, about 1/4 inch thick: a smooth, reddish-brown bean paste streaked with melted cheese.
- No separate dark layer, no crumbly grain, no near-black colour.
- Keep v5's masa, cheese pull, curtido, salsa and griddle spotting.
- Fallback: two whole pupusas plus one torn open just enough to show a creamy cheese-and-bean edge.
- Then re-finalize, re-freeze, and re-audit K/L.

## Mechanical re-checks (the 2)
- Freeze integrity 26/26 and structural preflight both pass when re-run on scratch copies.
- culinary_hash recomputes and is unchanged. Since my r2 copy, only the image block and revision labels changed.
- Images:
  - SHA-256 values match file_hashes, asset_sha256 and image-gen-map.
  - Masters are 1200×900, cards 640×480, sources 1280×720.
  - The 1.25x LANCZOS re-derivation holds (mean diff 1.68 / 1.75).
  - The heroes rejected in r2 are in `rejected/`, byte-identical to the ones I audited.
  - The superseded records and both revision_history entries are present.
- package_revision is `author-r4` everywhere.

## The other 48: PASS (unchanged)
- I compared all 538 files byte-for-byte with my own pre-audit copies (42 from before r1, 6 from before r2). After normalizing the directory path in the QA JSONs my tools rewrote, there are 0 differences.
- There are also 0 mismatches against `notes/pre-r4-file-hashes.sha256`.

## Duplicate check
Not re-run. No title or slug changed, so the r1 PASS stands.

## Open, non-blocking
bhutanese-ema-datshi still has the stale "chile strips" wording in near_duplicate_review, as ruled in r2.

## Files
- `audit/r3/<slug>.md` ×2
- `audit/r3/AUDIT-r3.json`: includes status for all 50.
