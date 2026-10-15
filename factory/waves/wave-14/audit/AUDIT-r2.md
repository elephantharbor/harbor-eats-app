# Wave-14 audit r2 (re-audit of freeze-r2)

Independent auditor (Vale role), 2026-10-15 (CT). Full A–O re-audit of all 50 packages at `freeze-r2`, against the r1 report (`AUDIT-r1.md`) and the r1 backup (`/workspace/wave14-candidates-backup-r1.tgz`, extracted to /tmp for diffing only). Skills: flavorweave-catalog-certification, -catalog-package, -meal-image-spec, -catalog-factory. Packages, repo and wave docs were not edited. Nothing imported, committed or deployed. Repo `/workspace/harbor-eats-app` is still `main` @ 565d736 with a clean `git status`.

## Verdict

**PASS 48 · PASS WITH NOTES 0 · FAIL 2.** Certification is binary; notes are listed separately.

- FAIL: `lebanese-samke-harra-bulgur` (K), `new-england-clam-chowder` (K). Both are image-only; recipe text passes every gate.
- **The wave is NOT certified for import as a 50-meal set.** The 48 PASS packages are individually certified at freeze-r2 (auditor sign-off only; import, PR and deploy remain separate human-gated steps). The two FAILs need a new hero, re-freeze and a K/L re-audit. No text change is needed for either.

## How r2 was checked

1. **Freeze integrity.** Re-ran `/workspace/flavorweave-catalog-factory/freeze_integrity.py` on copies of all 50: PASS 50/50.
2. **Structural preflight.** `node factory/tools/structural_preflight.mjs` (repo, read-only) on the copies: PASS 50/50, hh001=20. The importer `normalizeFactoryPackage` accepts every package, including the new runtime_enum_gaps keys.
3. **Metadata consistency (all 50, scripted).**
   - `package_revision` is `freeze-r2` on the top level, recipe_version, image, d03 sidecar and image-state.json, and in README, brief and prompt.
   - No `author-r1`/`freeze-r1`, `pending_image_pass`, 'not, yet', 'Not a finished asset', `image_slot_pending` or `awaiting_preflight` outside rejected/.
   - structural_qa_state is `freeze_r2_preflight_pass_awaiting_vale` on both levels, and recipe_fidelity_state is `awaiting_audit`.
   - method_detail and source_dimensions match the real 1280×720 source.
   - asset_sha256 and file_hashes match the files on disk; WebPs are 1200×900 RGB and 640×480.
   - No stray `img_vN` beside the active source.
   - For the 7 regenerated meals, every `image.superseded` → rejected/ entry exists and its SHA-256 equals the r1 active hash.
4. **Culinary diff r1→r2.** Field-level diff of dish and recipe_version for all 50. 16 packages changed recipe text and 4 more changed only their hero (20 per-slug r2 notes). The other 30 differ only in revision and status wording. culinary_hash recomputed with `build_packages.culinary_hash`: it matches on all 50.
5. **D-03.** The sidecars differ from r1 only in rationale text (Xi'an lamb, käsespätzle) and one specialty-item entry (Xi'an lamb, scored once). Enums are unchanged, so no classification_history entry was needed.
6. **Images.** 43 heroes are byte-identical to r1, so the r1 K/L1/L2 judgments carry over to the same pixels. All 7 regenerated heroes were viewed with Read, and the two doubtful ones were also cropped from the 1280×720 source.

## Slug × gate table (r2)

| Slug | A | B | C | D | E | F | G | H | I | J | K | L1 | L2 | L | M | N | O | r1 | r2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `aloo-paratha-kachumber-chutney` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `bangers-and-mash-onion-gravy` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `brazilian-feijoada` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `burmese-mohinga-fish-noodle-soup` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `chicken-andouille-gumbo` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `chilean-porotos-granados` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `chiles-rellenos-ranchero` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `chinese-tomato-egg-stir-fry` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `colombian-ajiaco` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `egyptian-koshari` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `filipino-fish-sinigang` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `french-onion-soup` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `georgian-adjaruli-khachapuri` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `ghanaian-red-red-plantains` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `glazed-turkey-meatloaf` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `greek-gemista-stuffed-vegetables` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `greek-spanakopita` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `grilled-mahi-mahi-mango-salsa` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `hungarian-chicken-paprikash` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `japanese-gyudon` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `kasespatzle-caramelized-onions` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `lebanese-samke-harra-bulgur` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **FAIL** |
| `malaysian-curry-laksa` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `moroccan-seven-vegetable-couscous` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `new-england-clam-chowder` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **FAIL** |
| `nigerian-beef-suya-skewers` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `oven-bbq-baby-back-ribs` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `pan-seared-halibut-lemon-butter-corn` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `persian-ghormeh-sabzi` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `peruvian-ceviche-sweet-potato-corn` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `philly-cheesesteaks` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `polish-mushroom-barley-krupnik` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `pork-shogayaki` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `portuguese-piri-piri-chicken` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `roasted-whole-branzino-salmoriglio` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `senegalese-fish-yassa` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `slow-cooker-ropa-vieja` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `south-african-bobotie` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `spanish-sopa-de-ajo-egg` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `steak-au-poivre-smashed-potatoes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `swedish-meatballs-lingonberry` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `swiss-rosti-smoked-trout` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `taiwanese-beef-noodle-soup` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `tomato-goat-cheese-galette` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `turkey-sloppy-joes` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `tuscan-panzanella-white-beans` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `ukrainian-beet-borscht` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `venezuelan-black-bean-plantain-arepas` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `vietnamese-bun-cha` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |
| `xian-cumin-lamb-stir-fry` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | FAIL | **PASS** |

✓ PASS, ✗ FAIL. L = L1 + L2; K is reported separately.

## Remaining FAILs (exact fixes)

### `lebanese-samke-harra-bulgur` — K

r1 NOT closed. img_v2 grains are bigger than in r1 but still smooth, plump, uniform round beads (a full-size crop of the source confirms this). They read as pearl (moghrabieh) couscous or sorghum, not cracked wheat. The revised brief forbids 'fine round pearl-like grains' and asks for coarse #3/#4 angular bulgur. The fish, tahini, chile, cilantro, and lemon are correct. L2 is strong.

**Fix:** Regenerate the hero. The bulgur must show angular, fractured, irregular cracked-wheat pieces in mixed sizes, with a matte tan-brown surface and visible split edges, loosely piled. No round, glossy, uniform or bead-like grains. Add 'no pearl couscous, no moghrabieh, no sorghum, no quinoa' to Do-not-include. Save as img_v3.jpg, then run finalize_images.py and re-freeze.

### `new-england-clam-chowder` — K

r1 NOT closed, and a new prop problem. (1) The central protein mound in img_v2 is long fibrous shreds that read as pulled chicken or crab. Small chopped clam pieces are not visible, and the few grey bits look like mushroom. The brief requires 'chopped clam pieces (small tan-grey, ruffled, chewy-looking bits)'. (2) The creator's question: two empty clam shells sit on the plate. The recipe uses canned chopped clams, so the shells don't correspond to the recipe. meal-image-spec allows props only 'from/corresponding to the recipe'. The brief forbids 'whole clams in shells', and the shells are the in-shell cue that rule exists to keep out. Verdict: the shells violate the brief in spirit and the spec in letter. Bacon, chives, potatoes, oyster crackers, and the creamy base are correct. L2 PASS.

**Fix:** Regenerate the hero. Show many small chopped clam pieces (pea-sized, tan-grey, ruffled/chewy) dispersed through and on the chowder among the potato cubes, and no shredded or fibrous mound. Remove all clam shells from the plate and table. Keep bacon, chives, cracked pepper, and the oyster crackers. Add 'shredded chicken or crab look, clam shells (empty or whole)' to Do-not-include. Save as img_v3.jpg, then run finalize_images.py and re-freeze.

**Creator question: empty clam shells beside the chowder.** They violate the brief. The recipe uses canned chopped clams, so shells aren't a recipe-corresponding prop (meal-image-spec: props only 'from/corresponding to the recipe'). They signal in-shell clams, which is exactly what the brief's 'whole clams in shells' rule keeps out. And they can't make up for the clams missing from the bowl. Remove them.

**Creator question: is samke harra bulgur still fine/round?** Yes, judged honestly. The grains are now larger, but they're smooth, round, uniform beads that read as pearl couscous. The brief bans that look as well as the fine one.

## r1 findings: closure check

| r1 finding | r2 status |
|---|---|
| M/O systemic denial wording + revision split (all 50) | **Closed** on all 50 |
| chiles-rellenos E (clock) | **Closed**: prep 20 + cook 41 = 61 |
| chiles-rellenos K (crumb coating) | **Closed**: puffed egg batter |
| gyudon J ('20-minute') | **Closed**: '25-minute', clock 25 |
| gyudon K (ground-looking beef) | **Closed**: shaved sheets |
| xian-cumin-lamb B/E (freeze step) | **Closed**: store-bought thin-sliced lamb, 27 min |
| Pot capacity B (bún chả, mohinga, paprikash, laksa, meatballs) | **Closed**: 6–8 qt pots in equipment and steps |
| bún chả K (large patties) | **Closed**: small 2-inch patties |
| philly F/G (rolls) | **Closed**: hard roll contract |
| bobotie F/G (bread soy) | **Closed**: bread component + contract |
| feijoada F/G (conditional sausage note) | **Closed**: hard linguiça contract |
| samke-harra K (couscous look) | **Open**: still pearl-like |
| ceviche K (red cubes, lime half) | **Closed** |
| chowder K (no clams) | **Open**, plus a non-recipe shell prop |
| spanakopita K (red onion) | **Closed** |
| Note: käsespätzle rennet | Closed (microbial rennet on both cheeses) |
| Note: krupnik gluten | Closed ('Contains gluten (barley)' + runtime gap) |
| Note: sloppy-joe bun egg | Closed |
| Note: farofa cassava naming | Closed ('coarse cassava meal… not fine tapioca-style') |
| Notes: ribs 'crisp pickles' wording, halibut 130–135 F, arepa prep time, mohinga/beef-noodle boil times, couscous vessel/'steam' token | Not addressed; still non-blocking |

## Did the fixes introduce new problems?

- **New hard contracts** (gumbo andouille, bangers sausages, sloppy-joe buns, and the r1 trio): all are unconditional label requirements. The allergen lists still cover what the contracts can't exclude, e.g. milk from provolone and wheat from the gravy/roux. No new unsafe claim. Bangers and gumbo carry the contract on the ingredient line rather than in `components[]`; PACKAGE.md accepts a hard ingredient contract. Non-blocking: list them as components for consistency with feijoada and bobotie.
- **Xi'an lamb:** frozen hot-pot slices need a day-before fridge thaw that sits outside the 27-minute clock. This is disclosed on the ingredient line, and the butcher-sliced fresh option needs no thaw. Non-blocking: also surface it in the shopping note.
- **Bobotie shopping line** renders as '2 slice slices store-bought white sandwich bread…' (unit and display name both say 'slice'). Cosmetic N note.
- **Bún chả:** the hero shows 6 patties in the bowl and the recipe serves 4 per bowl. That's within the brief's 4–6, so non-blocking.
- **Spanakopita:** fresh flat-leaf herb leaves appear on the salad, but the recipe salad uses dried oregano. Parsley is a recipe ingredient (filling), so it isn't invented. Non-blocking.
- **build_packages.py change:** reviewed the diff. It now reuses a finalized image block only after verifying the recorded SHA-256 values, never writes, moves or deletes image files, and writes post-image wording at `common.REV`. All 50 outputs are consistent (see check 3). It runs `deriveCookingMethod` via node in the repo cwd, read-only; the repo is still clean. Latent risk: `refresh_image` would write an `audit_r1_image_note` ('Cora is regenerating this hero') for any `AUDIT_R1_REGEN` slug not yet marked `regenerated_for_audit`. That's correct today (no package carries it), but the freeze tool doesn't ban the phrase. Re-running finalize for the two FAIL slugs will handle it as designed. Recommend adding 'is regenerating' to the freeze denial list.
- **freeze_integrity.py scope change:** the wave copy adds 7 denial phrases and scans README.md, image-prompt.md, image-plating-brief.md and image-state.json as well as the JSON. That's a strict superset of the old checks, I found no false positives (50/50 PASS with clean text), and it would have caught the r1 defect. **But the repo's `factory/tools/freeze_integrity.py` is unchanged.** The fix lives only in `/workspace/flavorweave-catalog-factory/freeze_integrity.py`. It should go upstream through a reviewed repo PR before any import (I didn't touch the repo).

## Wave-level issues (r2)

1. **Stale WAVE.json `status_detail`.** It says all 50 use 'img_v1.jpg source' and that packages were 'regenerated… without touching image files'. 7 now use img_v2.jpg and were regenerated. `audit.image_regeneration_pending` is [], which will be wrong once the two FAILs are queued. Update the wave doc (not a package gate).
2. **Repo freeze tool** lacks the new denial phrases (above).
3. **Open items, recorded correctly in WAVE.json:** importer has no coconut or gluten allergen token; D-03 band decision (repo ≤12/13–16/17+ governs; the draft would move 10 meals); clusters (10 soups, feijoada as the 5th black-bean meal, laksa as the 4th coconut meal, 2 pastry pies). selection-rationale.md and rejected.md now state the feijoada count (5th) and the koshari lentil exception correctly. coverage.md HH001 now shows 20/50.
4. **HH001 (Tom & Renata):** 20/50 claim eligibility, and all 20 claims are correct. None of the 20 changed allergens in r2. Samke harra is HH001-eligible and its recipe passes G; it fails on the image only. The chowder is not HH001-eligible (shellfish, meat, dairy), which is correct.

## Non-blocking notes (carried)

- `burmese-mohinga-fish-noodle-soup`: E: water-boil time tight.
- `chicken-andouille-gumbo`: K: broth a little light for mahogany roux; acceptable.
- `egyptian-koshari`: I: rejected.md says lentil leads are closed but koshari is lentil-primary with a lentils tag; curator should reconcile the rationale (not a duplicate: layered rice-lentil-macaroni with tomato and dakka).
- `filipino-fish-sinigang`: K: broth slightly turbid/orange rather than clear amber; still reads sinigang.
- `georgian-adjaruli-khachapuri`: G: runny-yolk note present. K: only the yolk is visible (recipe bakes a whole egg until the white is just set); acceptable, consider showing set white.
- `greek-gemista-stuffed-vegetables`: K: peppers shown without lids; tomatoes lidded. Not blocking.
- `greek-spanakopita`: I: pastry overlap with the galette is a cluster concern only (phyllo/spinach-feta vs short-crust/tomato-goat cheese).
- `hungarian-chicken-paprikash`: K: a sour-cream dollop is on top (sour cream is in the recipe but only whisked into the sauce; brief lists parsley/paprika only). Not blocking.
- `japanese-gyudon`: G: mirin alcohol note present.
- `malaysian-curry-laksa`: G: coconut disclosed in notes only (no token exists); consistent with the accepted moqueca precedent. HH001 not claimed (shellfish).
- `moroccan-seven-vegetable-couscous`: B/J: vessel for boiling the couscous water unstated; methods token 'steam' does not match the pour-over method.
- `nigerian-beef-suya-skewers`: G: peanut token present and nut_policy peanuts_present; correct.
- `oven-bbq-baby-back-ribs`: J: deriveCookingMethod tags crispy_non_fry `baked` from the phrase 'crisp pickles'; suggest 'crunchy pickles' so the cooking metadata is not driven by the side.
- `pan-seared-halibut-lemon-butter-corn`: G/D: doneness 130-135 F is below FDA 145 F for fish; acceptable chef practice but consider adding '145 F for USDA guidance'.
- `peruvian-ceviche-sweet-potato-corn`: G: sashimi-grade, previously frozen fish contract plus pregnancy/immunocompromised raw-fish note; PASS.
- `pork-shogayaki`: G: mirin/sake alcohol note present.
- `slow-cooker-ropa-vieja`: K: olive rings shown without pimento; brief asked pimento-stuffed halves. Not blocking.
- `spanish-sopa-de-ajo-egg`: G: runny-yolk note present.
- `steak-au-poivre-smashed-potatoes`: G: brandy alcohol note present. K: three to four smashed potatoes visible vs brief 4-5; acceptable.
- `taiwanese-beef-noodle-soup`: E: water-boil time tight. K: noodles read medium rather than thick; acceptable.
- `tomato-goat-cheese-galette`: G: microbial-rennet Parmesan specified; good.
- `venezuelan-black-bean-plantain-arepas`: E: 5-minute prep is optimistic for mixing/shaping dough; tolerable.

## Files

- `/workspace/flavorweave-catalog-factory/wave-14/audit/AUDIT-r2.md` (this file)
- `/workspace/flavorweave-catalog-factory/wave-14/audit/AUDIT-r2.json`: `{slug: {verdict, gates:{A..O, K/L1/L2/L}, fixes:[...], ...}}`
- `/workspace/flavorweave-catalog-factory/wave-14/audit/<slug>-r2.md`: per-slug r2 notes for the 20 packages whose recipe text or hero changed
- r1 files unchanged: `AUDIT-r1.md`, `AUDIT-r1.json`, `<slug>.md`
