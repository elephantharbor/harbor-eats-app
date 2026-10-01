# Multi-diner alpha behavior (2–4 active diners)

## Participation (alpha default)

- **Who counts:** Every household member with `status = active` participates in tonight’s meal by default.
- **Recommendations & eligibility:** Hard limits are intersected across active members; Taste Model scoring uses `active_member_count`.
- **No attendance picker in alpha:** We do not expose “who’s eating tonight” yet. The data model keeps `household.servings_default` and per-request `?servings=` as the seam for future participation overrides.
- **Invited vs active:** Invited members appear in settings but do not vote or rate until they join and become active.

## Recipe servings

- Canonical recipes in `recipe-store.js` declare **base servings** (default 4).
- Consumer requests pass **`GET /api/recipes/:slug?servings=N`** where `N` = active diners on the client (1–8 clamp server-side).
- Response includes `base_servings`, `requested_servings`, `scale_factor`, and **scaled ingredient quantities**. Step text stays instructional; step ingredient lists reflect scaled amounts.
- Scaling prefers culinary sanity (whole tortillas/fillets, ¼-tsp rounding) over blind decimals.

## Voting & ties

- Plurality wins; ties break on household Taste score, then letter order (see `selection-resolution.js`).
- UI never surfaces internal tie-break names (“disagreement penalty”, etc.).

## Ratings & CML

Operational stages (also in funnel/ops):

| Stage | Meaning |
|-------|---------|
| Cook recorded | `cook` row exists |
| Awaiting feedback | Cooked, zero ratings |
| Partial | Some active members rated |
| Full / CML | Cook + **every active member** rated → plan `Rated` |

**North Star CML is unchanged:** cook + all active ratings. Partial ratings never block other app use.

## Copy

- **2 active diners:** warm “both of you” where appropriate.
- **3–4:** “everyone”, “your household”, “your crew” via client `householdCopy()` — not hard-coded in HTML for critical paths.
