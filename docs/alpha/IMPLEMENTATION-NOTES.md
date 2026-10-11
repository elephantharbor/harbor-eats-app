# Alpha Readiness — implementation notes

## Card conflicts resolved

| Topic | Resolution |
|---|---|
| Guest range | Architecture: `guest_count` 0–6. UX stepper clamped to total ≤ 8 diners. Copy uses “For N · … guests” per UX card. |
| Tab Back vs architecture §1.1 | UX card: Back from any tab → Home; architecture table lists destination-to-destination stack. **Implemented UX**: tab switches use `replaceState` without stacking; in-app Back from a tab goes Home first (UX §2.1). |
| `shopList` back target | Architecture §1.3: recipe from shop returns to `shopList`. `nav-context.js` `backTarget` updated; `shopList` back from list itself goes to Tonight after plan confirm (UX finished-task fold). |

## UI shipped (UX decision card)

- **Recipe adaptation**: `recipe` / `recipeCook` Weave adapters (`public/recipe-weave.js`), change preview (`.weave-change`), apply/undo toast, “Your version” badge, changed row/step markers, “See what changed” sheet with per-op undo and “Back to the original”.
- **Explanations**: Deterministic reason lines on plan cards; in-place “Why this one?” with `/api/explain` on first open (`public/explanation-ui.js`). Static “Fits everyone’s limits” removed from plan cards.
- **Diner labels**: “For N” on plan cards, “Cooking for N” on recipe detail and kitchen mode, shopping eyebrow summary; named Back labels via `nav-context.js`.
- **Service worker**: `fw-sw-v52`.

## Deviations / follow-ups

- Explanation on small Find grid cards omitted per UX §5.1.
- Navigation E2E: brief §7/§53 cases are split across `e2e/specs/d07-find.spec.js` (Find → recipe → Back), `e2e/specs/d06-weave.spec.js` / `d061-weave-ux.spec.js` (Weave plan → recipe → Back, replace/choose flows), and `e2e/specs/alpha-readiness-ui.spec.js` (plan → recipe → Back, adaptation apply/undo, Why this one? when a reason line exists). Shop-list and cook-flow Back paths still rely on manual QA unless extended in a follow-up spec.

## Dependency order (as shipped)

1. `0016` + scaler + `diner-count.js`
2. Participants/guests API + onboarding active member default
3. `public/nav-history.js` + `nav-context` label fixes
4. `recipe_adaptation@2` + mutations + recipe Weave UI
5. `explanation@2` + packet builder + `/api/explain` + disclosure UI
6. Telemetry client events (`adaptation_*`, `explanation_opened`, etc.)
