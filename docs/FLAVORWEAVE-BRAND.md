# FlavorWeave brand (consumer) vs Harbor Eats (internal)

- **Consumer product brand:** FlavorWeave (CamelCase, one word). Working line: *Your tastes, woven together.*
- **Internal venture / repo / infra:** Harbor Eats (`harbor-eats-app`, D1 `harbor-eats-db`, Pages project names unchanged).

## Design tokens

Primary CSS tokens live in `public/styles.css` under `:root`:

| Token | Hex | Role |
|-------|-----|------|
| `--flavor-ink` | `#1C2A2B` | Text, structure |
| `--woven-coral` | `#DB6D4B` | Brand accent, CTAs, selection |
| `--warm-canvas` | `#FCFBF9` | App background |
| `--soft-surface` | `#F4F1EE` | Cards, grouped content |
| `--signal-indigo` | `#5B4DFF` | Intelligence / data cues (sparingly) |

Legacy aliases (`--ink`, `--eats`, `--tide`) map to the brand palette for incremental migration.

Typography: **Plus Jakarta Sans** with **Inter** fallback (Google Fonts link in `public/index.html`).

## Logo & icons

Production assets under `public/brand/`:

| Asset | Purpose |
|-------|---------|
| `flavorweave-emblem.svg` | App mark (vector, traced from approved artwork) |
| `flavorweave-wordmark.svg` | Custom wordmark paths (no stock font substitute) |
| `flavorweave-lockup-stacked.svg` / `flavorweave-lockup-horizontal.svg` | Primary lockups |
| `favicon.ico`, `favicon-16.png`, `favicon-32.png`, `favicon-48.png` | Favicons |
| `icon-192.png`, `icon-512.png` | PWA |
| `apple-touch-icon.png` | iOS install |

Root `public/favicon.svg` is a canvas-framed emblem for browsers.

Source of truth: FlavorWeave Brand + Product Design Guide v1.0 (see repo uploads / brand pack).

## Voice & API copy

Recommendation explanation labels are composed in `src/lib/taste-model.js` (`buildWhy`). Consumer UI strings are in `public/index.html` and `public/app.js`.

## Deferred polish

- Further simplify emblem/wordmark SVG paths (reduce trace speckle at extreme sizes).
- Optional dark-background lockup variant for splash screens only.
- Richer food photography pipeline (placeholder gradients remain in CSS until catalog art lands).
- Full marketing-site OG URL when a canonical public origin is fixed for share previews.

## Visual QA

1. Open `/` — welcome shows emblem, tagline, Warm Canvas shell (not cream/purple gradients).
2. DevTools → Application → Manifest → name **FlavorWeave**, theme `#FCFBF9`.
3. Onboarding → **Tonight’s picks** — weave loader, coral primary buttons, match chips.
4. Taste profile — subtle weave accent on list markers.
5. Install PWA — icon matches emblem, title **FlavorWeave**.
