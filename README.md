# Harbor Eats — Consumer Prototype

**Owner:** Mira (Product & Experience)  
**Date:** 2026-09-28 (CDT)  
**PRD:** [`docs/product/PRD-VERTICAL-SLICE.md`](../../docs/product/PRD-VERTICAL-SLICE.md)  
**Decisions:** [`docs/product/DECISIONS.md`](../../docs/product/DECISIONS.md)

Phone-first static HTML/CSS/JS under **`product/prototype/`** only (no competing tree). No build step. Consumer look — not Operating Desk.

## How to open

```bash
# From repo root:
python3 -m http.server 8765 --directory product/prototype
# → http://localhost:8765/
# or open product/prototype/index.html directly
```

Use ~375px width. Subtle QA screen-jump sits **outside** the phone frame; primary flow is sequential.

## Clickable flows

### A. Onboarding (first-class)
Welcome → Create Household → Add Members → Hard Constraints (per diner) → Taste Seed (≤3, Skip) → Invite S1 (Skip OK) → First N×3

Approved copy: *“Dinner choices both of you can live with…”* · *“Two profiles. One dinner. Eligibility is hard law.”*

### B. Meal loop
Select → Recipe Detail → Cook → Finish → Dual Rating **1–10** (Tom + Renata) → Loop Closed (“we’ll remember / smarter next time”)

Anchors: **1** hard miss · **5** fine · **10** craving. CML only when both rated. Never invent scores. (Cora: 1–5 revoked. Sage: model aligning to 1–10 — no blockers.)

### C. Personalization chips
Demo slots on choice cards: Why this / Trying something new / Improved / Returning favorite.

### D. PLG surfaces (Bloom)
| ID | Surface |
|----|---------|
| **S1** | Household invite — `HE-INV-*`, channel chips, Invited→Active; join sets **own** constraints |
| **S2** | Shareable choice-set — `HE-SHARE-*`, “which should we make tonight?”, minimal account view |
| **S3** | Read-only dual-constraint demo card |
| S4/S5 | Stub labels only |

Viral-to-new-HH **OFF**. External acquisition CLOSED.

### Analytics stubs (`window.__HE_ANALYTICS__`)
`invite_sent`, `invite_accepted`, `share_choice_created`, `share_choice_viewed`, `share_choice_acted`, `selection_recorded`, `cook_recorded`, `rating_submitted`, `loop_completed` (+ `attribution_last_touch`). Namespaces: `HE-INV` / `HE-SHARE` (+ `HE-AFF` future). UTMs stubbed. Dashboards should prefer **loops**, not installs.

## Brand tokens

Ink `#10262C` · Deep Tide `#236B6A` · Signal Brass `#D49A45` · Canvas `#F5F2EA` · Fog `#E8EFED` · Eats `#B85F35`

Kitchen chrome follows `prefers-color-scheme`.

## Publish (product ≠ desk)

```bash
bash product/app/scripts/prepare-github-io.sh
bash product/app/scripts/publish-github-io.sh
# → https://elephantharbor.github.io/harbor-eats-app/
# Desk untouched: https://elephantharbor.github.io/harbor-eats/
```

Persistence target: Cloudflare Pages + Workers + D1 (`product/app/`). See [`docs/product/PERSISTENCE-PLAN.md`](../../docs/product/PERSISTENCE-PLAN.md).

## Limits

- In-memory state only; does not write `plans/` or invent ops metrics.
- Email/chat pilot paths remain first-class conceptually (mirror SoR).
- Explainability / personalization demo strings labeled; Sage owns real evidence.
