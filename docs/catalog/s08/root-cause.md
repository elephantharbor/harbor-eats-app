# Root cause

The thin legacy recipes were not a single missing teaspoon. The authoring rules made "do not add what v1 omitted" look like integrity.

On 2026-10-04 the legacy audit drafts treated fidelity to v1 as a constraint. Salmon v2 says no oil is listed and none is added. Pesto v2 says no oil and no cheese. The same drafts left pasta water unsalted and salt unnamed. That preserved a thin source. It did not produce a cookable sauce.

Three other rules pointed the same way.

- `factory/IMAGE-SPEC.md` told authors not to invent colorful ingredients. That is right for a photograph. It was easy to read as "do not put lemon or dill in the recipe if the current hero lacks them."
- Gate D was the words "Culinary completeness" with no definition. Gates A–O checked schema, diet, time, image, and provenance. None of them asked whether the yield was seasoned.
- The auditor does not rewrite a failing package. That rule is still right. With no flavor gate, a structurally valid thin recipe could be published, and nobody's job was to season it.

The durable change is in the workflow, not in a one-time sprinkle of salt.

- `factory/CERTIFICATION.md` defines Gate D and the six passes: structural, dietary and allergen, serving and unit consistency, cooking and food safety, culinary quality, shopping and adaptation.
- `factory/PACKAGE.md` states the salt standard, absorbed-versus-discarded water, dietary compensation, and when a do-not-add line is allowed.
- `factory/IMAGE-SPEC.md` says image fidelity is not a reason to delete seasoning. A plate that would look different is an image-regen flag.
- `src/lib/culinary-quality.js` checks objective defects. It does not require acid, garlic, or a garnish, and it does not impose a salt floor per serving.
- `factory/tools/structural_preflight.mjs` runs those checks when `evidence.culinary_reviewed` is set. Older waves are not failed in bulk for saying "kosher salt."
- Evidence states stay separate. Model confidence is not a kitchen test.

There is no certification skill file in this repo. The audit mentioned skills outside the repo. None was added here.

The auditor still does not rewrite a package to make a gate pass.
