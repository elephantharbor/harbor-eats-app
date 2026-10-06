# FlavorWeave brand (consumer) vs Harbor Eats (internal)

- **Consumer product brand:** FlavorWeave (CamelCase, one word). Working line: *Your tastes, woven together.*
- **Internal venture / repo / infra:** Harbor Eats (`harbor-eats-app`, D1 `harbor-eats-db`, Pages project names unchanged). Harbor Eats never appears in consumer UI.

Source of truth: **FlavorWeave Brand & Product Design Guide v2.0** (supersedes v1.0). The approved artwork and exemplar board are committed under `design/flavorweave-v2/` so production assets can be regenerated from them.

## Wordmark & emblem

The wordmark is custom lettering. **Never** set "FlavorWeave" in Plus Jakarta Sans, Inter or any other font as a stand-in for it.

| Context | Use |
|---------|-----|
| Desktop + standard mobile header | `flavorweave-lockup-horizontal.svg` (`alt="FlavorWeave"`); `-reversed` in Dark Mode |
| Welcome hero | `flavorweave-wordmark.svg` inside the `<h1>` (`alt="FlavorWeave"`); `-reversed` in Dark Mode |
| Favicon, app icon, tiny collapsed contexts | `flavorweave-emblem.svg` / PNG icons only |

Production assets in `public/brand/` are traced from `design/flavorweave-v2/approved-*.png` and split into two flat layers: Ink `#17393A` and Coral `#F15D3C`. Reversed variants use `#E9F2EF` ink. To regenerate them:

```bash
pip install pillow numpy cairosvg && sudo apt-get install -y potrace
python3 scripts/brand/build-brand-assets.py
```

| Asset | Purpose |
|-------|---------|
| `flavorweave-wordmark.svg` / `-reversed.svg` | Wordmark only |
| `flavorweave-lockup-horizontal.svg` / `-reversed.svg` | Header lockup (emblem + wordmark) |
| `flavorweave-lockup-stacked.svg` | Stacked lockup (splash / marketing) |
| `flavorweave-emblem.svg` | Emblem |
| `favicon.ico`, `favicon-16/32/48.png`, `/favicon.svg` | Favicons |
| `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | PWA / install |

## Design system

All styling goes through semantic custom properties in `public/styles.css`. Components never reference raw hex values, so a theme is just a token swap.

**Scales (theme-independent, `:root`):** type (`--text-xs` … `--text-display`, `--text-button`), spacing (`--space-1` … `--space-10`, 4px base), radii (`--radius-xs` … `--radius-xl`, `--radius-pill`), icon sizes (`--icon-sm/md/lg`), motion (`--duration-*`, `--ease-*`), layout widths.

**Semantic tokens (per theme):**

| Group | Tokens |
|-------|--------|
| Canvas & surfaces | `--color-bg`, `--color-surface`, `--color-surface-quiet`, `--color-surface-sunken`, `--surface-hero`, `--color-header-bg` |
| Text & borders | `--color-text`, `--color-text-secondary`, `--color-text-tertiary`, `--color-border`, `--color-border-strong` |
| Primary action | `--color-primary`, `-hover`, `-pressed`, `--color-on-primary`, `--color-primary-soft`, `--color-primary-text` |
| Structure / secondary | `--color-structure`, `-hover`, `-soft`, `--color-on-structure` |
| Accents | `--color-accent`, `-soft`, `-text`; `--color-natural`, `-soft`, `-text` |
| Selection & badges | `--color-selected-bg/border`; `--badge-fit-*`, `--badge-match-*`, `--badge-neutral-*` |
| Status | `--color-success/warning/error` with `-soft` and `-text` |
| Focus, overlay, elevation | `--color-focus`, `--color-inverse-bg/text`, `--color-overlay`, `--shadow-rgb` (shadows derived per theme) |
| Weave | `--weave-1..3` (loader, onboarding, Taste Profile, selection only) |

Typography for UI text is Plus Jakarta Sans with Inter and system fallbacks. This applies to body copy only, never the wordmark.

## Appearance themes

These are under Settings → Appearance. `public/theme.js` runs synchronously in `<head>` so the saved theme applies before first paint.

| Theme | Canvas | Primary action | Notes |
|-------|--------|----------------|-------|
| **Signature** (default) | `#FFFDF8` | Coral `#F15D3C` (pressed `#D9472D`) | Ink `#17393A`, Teal `#0F5D5B`, Sage `#A9BA9B`, Oat `#F7F2EC`, Blush `#FBE6DB`, Line `#E5DED7`, Saffron `#D6A13A` |
| Citrus Berry | `#FFF9F4` | Berry `#D51F63` | Orange `#FF6A2A` and violet `#7B45D8` as accents |
| Fresh Herb | `#FFFDF6` | Herb `#2F6F3E` | Apricot `#E98B5D`, mustard `#D3A633` |
| Cobalt Coral | `#FBFCFF` | Cobalt `#3D5AF1` | Coral `#FF604D`, lavender `#9A7CF7` |
| Dark Mode | `#101819` | Coral `#FF6A50` with dark label | Text `#E9F2EF`, structure `#385E5C`; reversed wordmark |

**Behavior:**
- Themes switch instantly.
- Preferences persist per browser (`fw_theme`) and per member (`fw_theme:<memberId>`).
- Unknown or invalid values fall back to Signature.
- `FlavorWeaveTheme.setStorageAdapter({read, write})` is the seam for syncing preferences to the server later.

**Contrast rule:**
- Body text pairs must reach at least 4.5:1.
- Primary button labels are bold and at least 19px (WCAG "large text"), so they must reach at least 3:1. Signature coral with white labels is 3.3:1.
- `.btn-sm` is never a primary action.
- When coral is used as text, it switches to `--color-primary-text` (`#B53A24`).
- Orange (Citrus Berry) fails with white labels, so berry carries primary actions in that theme.

`test/theme-contrast.test.js` enforces these pairs for every theme.

## Food imagery

- Every catalog meal has recipe-specific photography bundled under `public/images/meals/<recipe_slug>.webp` (1200×900) and `-640.webp`.
- The style is a consistent 4:3 crop: bright, food-forward overhead or three-quarter shots.
- Nothing is hotlinked.
- `public/meal-media-manifest.js` (generated from catalog) supplies titles; `public/meal-media.js` resolves images by `recipe_slug`, then `recipe_version_id`, then title.
- Unknown meals render a quiet placeholder instead of a gradient.
- New catalog meals need both files, and `test/meal-media.test.js` fails until they exist.

## Layout

| Breakpoint | Composition |
|------------|-------------|
| < 768px (mobile) | Wordmark header, bottom tab bar, single primary CTA, sticky action bar, 52px controls (`--control-h`) |
| ≥ 768px (tablet) | Top nav replaces the tab bar; option cards go vertical; two-column flows |
| ≥ 1024px (desktop) | Editorial side-by-side layouts: tonight hero with photo, sticky recipe media, three-up choices |
| ≥ 1440px (wide) | Wider content max with the same compositions |

Chrome modes (`#app[data-chrome]`):

| Mode | Shows | Used on |
|------|-------|---------|
| `full` | Header nav and tab bar | Default |
| `focus` | Header without tab bar | Recipe detail, rating |
| `brand` | Wordmark only | Onboarding, join, guest share |
| `none` | Nothing | Cook mode |

## Discovery (D-07)

Full spec: `docs/D07-UX.md`. Navigation: `docs/D07-NAV-DECISION.md`. Visual rules that apply beyond that screen:

- **Photo first.** Find a dinner leads with one large hero card (`.tonight-hero` composition on tablet and desktop, full-width 4:3 on phone), then shelves of 4:3 photo cards. Images are resolved by `recipe_slug`, never by title.
- **Quiet cards.** Title, then one meta row (minutes; “Easy” and “Simple ingredients” only when true), then at most one taste line. No more than three pills on a card. No emoji, flags, scores, or rank.
- **Chips, not panels.** Refinement is a single chip row plus a sheet (phone/tablet) or popovers (desktop). No filter sidebar. Applied chips are filled with a ×; unapplied chips are outlined.
- **Two kinds of “easy”.** The “Easy” chip hides other dinners. “Keep it easy” only sorts and lives under “Lean toward”. Copy never says “Quick” (use “Under 30 min”) and never links Simple ingredients to a pantry.
- **Loading.** Skeleton cards on `--color-surface-sunken`. The weave loader stays reserved for building a plan.
- New icon: `#i-search` (magnifier) for the Find tab and the search field.

## Voice

Copy should be confident, friendly, honest and concise.

- Explanation labels come from `src/lib/taste-model.js` (`buildWhy`).
- The UI never shows model scores, confidence math or invented personalization.
- Consumer strings live in `public/index.html` and `public/app.js`.

## Accessibility

- Visible `--color-focus` rings.
- Skip link.
- Focus moves to the view heading on navigation.
- Recipe tabs follow the ARIA tabs pattern, with arrow, Home and End keys.
- Confirm dialogs use `<dialog>`.
- `prefers-reduced-motion` disables the weave loader and transitions.
- `forced-colors` support.

## Deferred polish

- Server-synced theme preference via the storage adapter seam.
- Further simplification of the traced wordmark paths at very small sizes.
- Canonical public origin for OG share previews.

## Visual QA

1. Open `/`. The welcome headline shows the wordmark artwork and the Signature canvas `#FFFDF8`.
2. In DevTools → Application → Manifest, the name is **FlavorWeave** and the theme is `#FFFDF8`, with a maskable icon.
3. Onboarding → Tonight's picks: weave loader, photo option cards, coral primary CTA.
4. Desktop (≥1024px): top nav, editorial tonight hero, side-by-side recipe with Overview/Ingredients/Steps/Notes tabs.
5. Settings → Appearance: each of the five themes switches instantly and survives a reload. Dark Mode shows the reversed lockup.
6. Install the PWA. The icon is the emblem and the title is **FlavorWeave**.
