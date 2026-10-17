# S-01 — FlavorWeave Shopping Architecture + Premium UX Blueprint

**Status.** Design and research only. This directory is the contract for later units. It does not ship runtime code, a D1 migration, a feature flag, a deploy, or an external account.

**Owner.** Grok 4.7, Harbor Eats work unit S-01.

**Verification date.** 2026-10-16. Repo claims were read from this tree at `main` `8b5a7e1`. External claims cite a URL from that date. Nothing in this directory was called against Instacart, Walmart, or Amazon.

**Claim marks.**

| Mark | Meaning here |
|---|---|
| production-enabled | Running for households. Shopping evidence is the 2026-10-12 production deploy in `DEPLOYMENTS.md`, which applied migration `0016`. This pass did not query production D1. |
| tested | A test in this repo asserts the behavior. This docs pass did not re-run the suite. |
| accessible | The source or public page could be read on 2026-10-16. |
| documented | An official page states it. Documented is not the same as accessible to us, tested, or production-enabled. |

## What this unit keeps

FlavorWeave owns one household list. Recipe aggregation, diner counts, and adaptation stay the engines they are. Grocery services are optional fulfillment. Instacart is the first online integration, and only as far as its current Developer Platform docs actually go. A handoff is not a purchase. No unverified automatic substitution. Shopping works with no LLM.

## Reading order

| # | File | Contract |
|---|---|---|
| 1 | `S-01-CURRENT-STATE.md` | What the repo does today, what to extend, what is a new primitive |
| 2 | `S-01-ARCHITECTURE-DECISION-CARD.md` | Canonical list, states, provenance, inventory extension points |
| 3 | `S-01-PROVIDER-ADAPTER.md` | Capability contract, errors, credentials, tests |
| 4 | `S-01-PROVIDER-REGISTRY.md` | Registry schema, maintenance, comparison |
| 5 | `S-01-INSTACART.md` | Feasibility from official docs, including measurements |
| 6 | `S-01-MISSING-ITEMS.md` | V1 resolution rules |
| 7 | `S-01-UX-DECISION-CARD.md` | Premium flows. Wireframes in `prototypes/` |
| 8 | `S-01-SHARING-EXPORT.md` | Household sync, export, read-only links |
| 9 | `S-01-PRIVACY-SAFETY.md` | Accessibility, privacy, safety |
| 10 | `S-01-FUTURE-READINESS.md` | Later capabilities and the one V1 primitive each needs |
| 11 | `S-01-EXECUTION-PLAN.md` | S-02, S-03, S-04, human decisions |

## Prototypes

Static only. They are not served by the app.

- `prototypes/board.html` — annotated phone screens on the Signature canvas
- `prototypes/proto.css` — tokens copied from `public/styles.css` Signature theme
- `prototypes/model.svg` — entity sketch, also `prototypes/png/model.png`
- `prototypes/png/` — screenshots of the board and each screen (`00-board.png`, `01-list.png` through `09-add.png`)

## Explicit non-goals

No change to `public/app.js`, `src/`, `migrations/`, Wrangler, flags, or catalog. No Instacart, Walmart, Amazon, or Impact account. No automatic multi-store search. No recipe replanning when an item is missing. No pantry quantities. No price comparison. No sixth tab.

## Later research

S-05B research and the S-05C decision live beside this index. Oversight refinements in `S-05C-DECISION.md` override the S-05B card where they conflict. The copied list is flat. Documented is not human-tested.
