# FlavorWeave Catalog Factory

Coverage-driven catalog growth toward about 100 high-quality meals. Quality over count. A count is directional. Do not lower the bar to hit it.

This directory is the factory inside `harbor-eats-app`. Certified meals that the importer already consumes live in `catalog/`. New work stays under `factory/waves/` until an integrator is explicitly told to copy a certified package into `catalog/`.

Contracts:

- [Package](PACKAGE.md) — Dish → Recipe → Recipe Version → Image metadata
- [Certification](CERTIFICATION.md) — gates A–O
- [Meal image spec](IMAGE-SPEC.md)
- [Coverage analysis](COVERAGE.md)
- [D1 architecture](D1-ARCHITECTURE.md)

Tools:

- `factory/tools/freeze_integrity.py` — artifact agreement, before any audit
- `factory/tools/structural_preflight.mjs` — author structural gate (importer shape, diet, D-03, D-06.1 cooking)
- `factory/tools/export_meal_webps.py` — 1200×900 and 640×480 WebP export after an image exists
- `factory/tools/image-standards/` — hero-appeal amendment and the house-quality reference

Examples (already certified, wave-12, images included): `factory/examples/sabich-pita-sandwiches` and `factory/examples/vietnamese-turmeric-dill-fish`. They show the package the importer accepts. Do not edit them to match a new wave.

## Roles

Three cloud agents. They are separate runs. One agent does not play two roles on the same packages.

Earlier factory notes called the author Juniper, the auditor Vale, and release authority Cora, and they ran inside Grok Bot. Those names are history. They are not identities in this repo.

### Author

One cloud agent writes the wave:

1. Coverage over the current `catalog/` (procedure in `COVERAGE.md`).
2. A selection rationale that rejects cosmetic duplicates.
3. Complete Dish → Recipe → Recipe Version packages in the shape `PACKAGE.md` describes, including D-03 `effort_level` and `ingredient_complexity`, dietary eligibility separate from allergens, equipment, and cooking-method data that `src/weave/semantics.js` can classify.
4. An image / plating brief and an image prompt before any pixels exist.
5. `freeze_integrity.py`, then `structural_preflight.mjs`.

The author does not certify, does not copy packages into `catalog/`, does not import D1, and does not deploy or publish.

Image generation is a later pass. The author leaves the WebP slot pending when the task says not to generate images. The image pass (currently Grok Bot) generates original AI art from the brief and prompt, exports both WebPs with `export_meal_webps.py`, and re-runs freeze integrity. The auditor does not start while freeze integrity is FAIL.

### Independent auditor

A different cloud agent from the author. Continuing the author conversation is not an audit.

Start only when `FREEZE_INTEGRITY.json` for the current revision says `PASS`. A FAIL stops the audit. The auditor cannot waive it.

Apply gates A–O in `CERTIFICATION.md`. The only results are PASS and FAIL. Report K, L1, and L2 separately. Report dietary eligibility and allergens separately. Report D-03 under gates A and J.

The auditor does not rewrite the recipe, regenerate art, or import anything. Defects go back to a new author run (or an image-pass run, for image defects). Re-freeze and re-run freeze integrity before a re-audit.

### Integrator

A cloud agent copies a PASS-certified package into `catalog/<slug>/` without changing ingredients, quantities, steps, tags, eligibility, ids, or imagery. `scripts/import-catalog.mjs` is the only writer into D1, and only when a task explicitly allows a staging import. Staging publication policy is `catalog/staging-publication.json`. Production D1 is out of scope unless a separate release task says otherwise.

Content defects go back to the author. The integrator does not quietly repair a recipe in `catalog/`.

## Pipeline

Coverage → selection rationale → author package, plating brief, and D-03 → image pass when it is in scope → `freeze_integrity.py` → structural preflight → independent auditor (gates A–O) only on freeze PASS → revise, re-freeze, re-audit → integrator copies into `catalog/` only when that copy is authorized.

## Commands

From the repo root. Freeze integrity reads WebP pixels with Pillow (`pip install -r factory/tools/requirements.txt`).

```bash
python3 factory/tools/freeze_integrity.py factory/waves/<wave>/candidates/<slug>
node factory/tools/structural_preflight.mjs factory/waves/<wave>/candidates
python3 factory/tools/export_meal_webps.py <source-image> factory/waves/<wave>/candidates/<slug> <slug>
```

## Cooking methods (D-06.1)

`deriveCookingMethod` in `src/weave/semantics.js` classifies a meal from `methods`, then the description and step text, and uses the title only when those did not already classify it.

- Frying kinds are `deep`, `pan`, and `shallow`. Tokens: `deep-fry`, `pan-fry`, `shallow-fry` (hyphen or underscore).
- A bare `fry` / `fried` / `frying` counts as pan.
- `air-fry` is crispy and not frying (`air_fried`).
- Baked, roasted, or oven crispiness is not frying.
- `stir-fry` is not frying.
- A negation still counts. "Do not deep-fry" in the description or a step is read as deep-frying. Keep warnings out of `methods`, `title`, `description`, and step bodies. Put them in the plating brief, the README, or `recipe_version.cooking.intent`.

Every new package sets `recipe_version.methods` to the tokens above and a `cooking` object that matches what `deriveCookingMethod` returns. Structural preflight fails when they disagree.

## Freeze integrity vs structural preflight

Freeze integrity checks files that are actually in the directory: identity, required fields, WebP magic and dimensions, provenance keys, and denial strings. It does not judge the food. Pending image slots fail it. That failure is expected until the image pass lands the WebP pair and the package is re-frozen.

Structural preflight checks the importer contract and the authoring rules that do not need pixels: schema, times, allergens, eligibility, D-03 enums, equipment, plating brief, and D-06.1 agreement. It can pass while freeze integrity fails on missing WebPs.

## Modes

- Author batch — packages and briefs, not certified
- Certified batch — auditor PASS on a frozen revision
- Implement — integrator copies into `catalog/` and, when authorized, staging import
- Legacy audit — a new version beside an existing `catalog/<slug>/v1.json`
- Classification-only amendment — D-03 metadata on the same `version_number`, no culinary rewrite and no image re-audit

Publication stays gated. Factory establishment does not publish.

## Bundled release

When catalog, runtime, and product changes share one deploy, Harbor Eats prefers one integrated candidate over paying a staging and end-to-end cycle per meal. That preference does not authorize an author or an auditor to deploy.
