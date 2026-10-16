# Wave-17 independent audit, round 2 (2026-10-16 CT)

Scope: a full A–O re-audit of the 8 packages revised to `author-r3`, plus a byte-identity check of the 42 that passed in r1. Packages were not edited; D1 and the app repo were read-only; no import, deploy, PR or cloud agent. No raw image-prompt text is reproduced.

## Result
- **Round 2: 6 PASS / 2 FAIL** of 8.
- **Batch: 48 PASS / 2 FAIL** of 50, so **the batch is not certified**. No certification record was written. It will be written once the 2 remaining meals pass.

| Meal | r1 | r2 | Notes |
|---|---|---|---|
| argentine-beef-empanadas | FAIL B | **PASS** | ~3 cups filling = 16 × 3 tbsp |
| polish-potato-cheese-pierogi | FAIL B | **PASS** | ~2 1/4 cups = 36 × 1 tbsp; 1/8 in gives ~36 rounds |
| salvadoran-bean-cheese-pupusas | FAIL B, K | **FAIL K** | B fixed (1 1/2 cups = 8 × 3 tbsp; bean named). Curtido fixed. Filling still lumpy, dark, saucy, and reads as meat/chili, against the recipe's "puréed smooth" |
| swedish-pytt-i-panna | FAIL B | **PASS** | 2 batches of ~1 lb, each one layer; clock 52 → 62 |
| vietnamese-ca-kho-catfish | FAIL K | **PASS** | v3: ~13-14 skinless rectangular pieces; the top is glaze, not skin |
| bhutanese-ema-datshi | FAIL K | **PASS** | Recipe now says halved with stems on, matching the v2 hero; simmer 12 min stays inside the rice step |
| uruguayan-chivito-sandwiches | FAIL K | **FAIL K** | v5 fixes thickness, doneness, egg and olives, but the steak's cut face has a ground-beef crumb and reads as a thin smash-burger patty |
| yucatecan-tikin-xic-fish | FAIL H | **PASS** | "smoky" removed; hash unchanged |

## Fixes for the 2 FAILs
- **Pupusas (K):** regenerate v5.
  - The cut face should show a thin, smooth, matte, medium-brown bean-purée layer with no lumps or sauce sheen, with the cheese pull dominant.
  - Keep the v4 curtido and salsa.
  - If the generator keeps adding chunks, show only a small, clean cut edge.
- **Chivito (K):** regenerate v6.
  - Keep v5's thinness, doneness, egg and olives.
  - Make the steak read as whole-muscle meat: visible grain on the cut face, a natural steak outline, and an edge overhanging the bun. It must not look like a round patty.

## Handoff points
- **Pupusa lumps:** they do read as meat. FAIL.
- **Ca kho glaze vs skin:** it is glaze. PASS.
- **Chivito runny yolk:** not a defect. The recipe offers either yolk, and the food-safety note covers firm yolks. The FAIL is the ground-beef texture.
- **Ema datshi brief:** the author-r1 sections still say "strips". This is a documentation note only. Also update the stale "chile strips" wording in near_duplicate_review.

## Mechanical re-checks (the 8)
- Freeze integrity 26/26 and structural preflight both pass when re-run on scratch copies.
- culinary_hash recomputes. Step clocks sum. D-03 sums, levels and bands recompute and are unchanged. Every ingredient is used.
- Allergens, labels and HH001 are unchanged.
- Images:
  - SHA-256 values match file_hashes, asset_sha256 and image-gen-map.
  - Masters are 1200×900, cards 640×480, sources 1280×720.
  - The 1.25x LANCZOS re-derivation holds (mean diff 1.6–1.9).
  - Each rejected r1 hero in `rejected/` is byte-identical to the hero I audited in r1.
- package_revision is `author-r3` everywhere.
- The revision_history entries match my field-level diff against the r1 copies.

## The 42 unchanged packages: PASS
- I compared SHA-256 for every file (467 in total) in each of the 42 against my r1 pre-audit copies. All content files are byte-identical.
- The only differences are FREEZE_INTEGRITY.json and STRUCTURAL_PREFLIGHT.json. My r1 tool runs on the copies overwrote those two files there, and the only difference is the embedded directory path. After normalizing the path, all 84 are identical.
- As a cross-check, there are 0 mismatches against the author's `notes/pre-r3-file-hashes.sha256`.

## Duplicate check
Not re-run. No title or slug changed, so the r1 result stands: PASS, no duplicates.

## Files
- `audit/r2/<slug>.md` ×8
- `audit/r2/AUDIT-r2.json`: verdicts, fixes, notes, the 42-unchanged check, and status for all 50.
