# Harbor Eats — Vertical Slice Prototype

**Owner:** Mira (Product & Experience)  
**Date:** 2026-09-28  
**PRD:** [`docs/product/PRD-VERTICAL-SLICE.md`](../../docs/product/PRD-VERTICAL-SLICE.md)

Phone-first static HTML/CSS/JS. No build step, no framework, no CDN fonts.

## How to open

```bash
# From repo root — any static server, or open the file directly:
open product/prototype/index.html
# or
python3 -m http.server 8765 --directory product/prototype
# then visit http://localhost:8765/
```

Use a phone or narrow window (~375px). The stage shows a 375×812 frame plus a screen navigator for review.

## What’s P0 (clickable end-to-end)

Sample meal: **Crispy Chipotle Tofu Tacos with Lime Slaw** (`HE-2026-09-23-P01-A`, real HH001 selection). Steps from `recipes/crispy-chipotle-tofu-tacos/v1.md`.

1. **Recipe Detail** — ingredients, time, why-slot, **Cook** CTA  
2. **Kitchen Cook Mode** — one step at a time, progress, Previous/Next, **Finish**  
3. **Cook Finished** — lifecycle bridge; Rate now / Rate later  
4. **Dual Rating** — N named rows (Tom + Renata), 1–10, optional note, partial save, Submit Rated when both  
5. **Loop Closed** — both rated acknowledgment  

**Kitchen chrome** follows `prefers-color-scheme` (system light/dark) — not forced night.

## What’s stub (linked, minimal)

- Home / Plans  
- Choice Set (N×3)  
- Create Household (+ invite chrome: share link + email code)  
- Hard Constraints  

**Taste Sparks:** intentionally omitted (Cora lock — cut until ≥1 completed loop).

## Brand tokens

| Token | Hex |
|---|---|
| Ink | `#10262C` |
| Deep Tide | `#236B6A` |
| Signal Brass | `#D49A45` |
| Canvas | `#F5F2EA` |
| Fog | `#E8EFED` |
| Eats accent | `#B85F35` |

## Prototype limits

- Ratings/cook state are **in-memory only** (debug chip top-right). Does not write `plans/` or invent ops metrics.  
- Email/chat cook + select paths are first-class in product SoR; this UI demonstrates the in-app Finish → dual rate path.  
- Explainability slot shows the plan’s exploration field as sample evidence; empty when Sage has none.

## Cora §6 locks reflected here

Cook SoR both channels · partial ratings OK · either member cooks · email+app select · invite parity · no Taste Sparks · system kitchen chrome · N-row dual rating.
