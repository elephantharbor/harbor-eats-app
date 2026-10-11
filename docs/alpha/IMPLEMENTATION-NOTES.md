# Alpha Readiness — implementation notes

## Card conflicts resolved

| Topic | Resolution |
|---|---|
| Guest range | Architecture: `guest_count` 0–6. UX stepper clamped to total ≤ 8 diners. Copy uses “For N · … guests” per UX card. |
| Tab Back vs architecture §1.1 | UX card: Back from any tab → Home; architecture table lists destination-to-destination stack. **Implemented UX**: tab switches use `replaceState` without stacking; in-app Back from a tab goes Home first (UX §2.1). |
| `shopList` back target | Architecture §1.3: recipe from shop returns to `shopList`. `nav-context.js` `backTarget` updated; `shopList` back from list itself goes to Tonight after plan confirm (UX finished-task fold). |

## Deviations

- Full Opus-level UI polish for adaptation “See what changed” sheet is functional but not every motion token from UX §7 is wired.
- Explanation on small Find grid cards omitted per UX §5.1.

## Dependency order (as shipped)

1. `0016` + scaler + `diner-count.js`
2. Participants/guests API + onboarding active member default
3. `public/nav-history.js` + `nav-context` label fixes
4. `recipe_adaptation@2` + mutations
5. `explanation@2` + packet builder + `/api/explain`
6. Telemetry allowlist extension
