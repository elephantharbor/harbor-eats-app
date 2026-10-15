# FlavorWeave Catalog Factory: wave-16

Fifteen new dinner meals that take the Harbor Eats catalog from 185 to 200. This is an approved exception to the Harbor Eats hold: catalog content only, with no product features and no AI expansion. All work ran on Grok Bot.

State: all 15 packages frozen with heroes: 10 at `author-r2`, 5 at `author-r3` (author-r3 = text-only revision after audit r1; images unchanged). Cora generated every hero with Grok Bot GenerateImage: 12 from the author-r1 prompts (`/workspace/wave16-prompts.txt`) and 3 (`sichuan-mapo-tofu-shiitake`, `turkish-mucver-zucchini-fritters`, `thai-yum-nua-beef-salad`) as v2 regenerations after Cora's creator self-review rejected v1; the v2 prompts are recorded verbatim in each image-prompt.md (source `/workspace/wave16-v2-prompts.txt`), v1 is kept in `rejected/` and recorded as superseded. Master 1200x900 and card 640x480 WebPs are 4:3 center crops of the 1280x720 sources. Nothing here is certified, imported, published, or deployed, and D1 was not touched.

## Meals

| # | Slug | Batch | Cuisine | Protein | Time (prep+cook=total) | Effort / complexity | HH001 |
|---|---|---|---|---|---|---|---|
| 1 | `sichuan-mapo-tofu-shiitake` | A | chinese | veg | 10+31=41 min | moderate / adventurous | yes |
| 2 | `korean-japchae-vegetables` | A | korean | veg | 15+28=43 min | moderate / simple | yes |
| 3 | `indonesian-gado-gado-tempeh` | A | indonesian | veg | 15+32=47 min | moderate / standard | no |
| 4 | `russian-mushroom-stroganoff` | A | russian | veg | 10+31=41 min | moderate / simple | no |
| 5 | `sicilian-pasta-alla-norma` | A | italian | veg | 12+32=44 min | moderate / simple | no |
| 6 | `turkish-mucver-zucchini-fritters` | A | turkish | veg | 25+23=48 min | involved / standard | no |
| 7 | `southern-shrimp-and-grits` | B | southern | shellfish | 10+29=39 min | moderate / simple | no |
| 8 | `goan-shrimp-ambot-tik` | B | goan | shellfish | 10+30=40 min | moderate / standard | no |
| 9 | `cambodian-fish-amok` | B | cambodian | fish | 22+32=54 min | moderate / standard | yes |
| 10 | `persian-sabzi-polo-salmon` | B | persian | fish | 10+41=51 min | moderate / simple | yes |
| 11 | `jamaican-escovitch-snapper` | B | jamaican | fish | 12+31=43 min | moderate / standard | yes |
| 12 | `hawaiian-ahi-poke-bowl` | B | hawaiian | fish | 23+12=35 min | easy / standard | yes |
| 13 | `austrian-pork-schnitzel-potato-salad` | C | austrian | meat | 12+38=50 min | involved / simple | no |
| 14 | `cuban-picadillo-rice` | C | cuban | meat | 10+35=45 min | moderate / simple | no |
| 15 | `thai-yum-nua-beef-salad` | C | thai | meat | 12+30=42 min | moderate / standard | no |

## Checks

- Structural preflight (`node factory/tools/structural_preflight.mjs`): 15/15 PASS.
- Freeze integrity (`freeze_integrity.py`) with heroes: 15/15 PASS (26/26 checks each). Image hashes match notes/image-gen-map.txt.
- `tools/mark_preflight.py` set `structural_qa_state` to `author_r2_preflight_pass_awaiting_vale/author_r3_preflight_pass_awaiting_vale` on all 15; both preflights were re-run afterwards.
- Builder guards (`tools/build_packages.py`): near-duplicate guard against the 185 existing meals and the legacy set, pot size against water volume, boil-up minutes inside the step clock, no untimed waits, counted equipment named in the 1- and 2-serving scaling notes, description words present in the ingredients, step clocks consistent with stated minutes, and the props guard (styling props limited to recipe items and neutral tableware).

## Files

- `coverage.md`: coverage analysis of the 185 existing meals and what wave-16 adds.
- `selection-rationale.md`: why these 15.
- `rejected.md`: ideas considered and dropped.
- `notes/existing-185.tsv`, `notes/coverage-stats.json`, `notes/wave16-roster.tsv`, `notes/curator-notes.md`.
- `notes/structural-r*.log`, `notes/freeze-r*.log`: preflight runs.
- `tools/`: builder, recipes (`recipes_w16_a.py`, `_b.py`, `_c.py`), preflight marker, image finalizer, stats, and this docs generator.

## Next steps (not done here)

1. Independent audit r2 of the author-r3 packages (see notes/AUDITOR_HANDOFF-r2.md). Certification, import, and publication are separate later steps.

Generated 2026-10-15T17:01:31-05:00 by tools/write_docs.py.
