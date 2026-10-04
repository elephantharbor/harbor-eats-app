# Cycle 3B Golden Path — Hosted Recheck #2 (Oct 3 preview)

**Preview:** https://56ac5ce2.harbor-eats-cycle1-preview.pages.dev/?qa=1  
**Service worker:** `fw-sw-v15` (confirmed via `/sw.js` `CACHE_VERSION`)  
**Run date (UTC):** 2026-10-04  
**Product code / deploy / PR:** none (procedure + QA only)

## Procedure fix (vs prior recheck)

Prior recheck failed partial rating because **Jordan was never on meal `participant_ids`** — the walker avoided **“They’re at the table”** to protect the toast no-op.

**Correct order:**

1. Create household **QA Golden C3B Recheck2 Oct3** with Alex + Jordan (Jordan may start as invited).
2. **Before finalize and before the step 5 no-op:** on **planReview**, for **each** dinner open **Who’s eating** → if Jordan shows as invited, tap **They’re at the table** → ensure **both** Alex and Jordan are selected → **Save**. Confirm `participant_ids` on both meals (API or UI).
3. Finalize plan and start shopping.
4. Mark ≥1 shop line purchased / already-have.
5. **True no-op:** Tonight → **More** → **Who’s eating** on a meal where both are already selected → change nothing → **Save**. **PASS only if no list-change toast** (`List updated.` / `Your list changed.`).
6. Continue swap, invite join, cook, partial + full rating, history.

Do **not** omit step 2 to avoid toasts — that breaks step 10 partial rating.

## IDs (authoritative run)

| Field | Value |
|--------|--------|
| `household_id` | `hh_498c67b40702` |
| `dinner_plan_id` | `dp_20371f90ec60` |
| Alex `member_id` | `owner-a4gy` |
| Jordan `member_id` | `jordan-bmq` |
| Invite (POST `/api/invites` on open) | `HE-INV-N8V8UW` |
| `participant_ids` (both meals) | `owner-a4gy`, `jordan-bmq` |
| Cooked / rated meal | Maple Mustard Glazed Salmon (after swap on Dinner 1) |

Machine-readable log: `/opt/cursor/artifacts/recheck2-report.json`

Screenshots:

- `/opt/cursor/artifacts/step10_partial_rating.png` — Alex rated, Jordan waiting (`partially_rated`)
- `/opt/cursor/artifacts/step11_fully_rated.png` — `fully_rated`

## Step scorecard

| Step | Description | Score | Notes |
|------|-------------|-------|--------|
| 0 | SW `fw-sw-v15` | **PASS** | |
| 1 | Synthetic household + Alex/Jordan | **PASS** | Name: QA Golden C3B Recheck2 Oct3 |
| 2 | Both active/selected on planned dinners pre-shop | **PASS** | `1:jordan-bmq,owner-a4gy; 2:jordan-bmq,owner-a4gy` |
| 3 | Finalized 2-dinner plan | **PASS** | IDs above |
| 4 | Shopping mark ≥1 item | **PASS** | Shop line toggled (e.g. Basil) |
| 5 | No-op Who’s eating, no list toast | **FAIL** | Toast: **`List updated.`** after Save with no UI toggles (Tonight → More → Who’s eating → Save). Investigate client `shopLinesMateriallyChanged` / post-finalize `set_participants` reconciliation. |
| 6 | Swap after shopping | **PASS** | Quesadillas → Maple Mustard Glazed Salmon; toast `Your list changed. 4 added, 6 no longer needed.` |
| 7 | Invite + Context B join | **PASS** | `HE-INV-N8V8UW`; B sees same `dinner_plan_id`, shopping, swap deltas |
| 8 | Clear localStorage, plan persists | **PASS** | `/api/dinner-plans/current` unchanged |
| 9 | Tonight cook → cooked | **PASS** | Maple Mustard Glazed Salmon |
| 10 | Alex rates → partial | **PASS** | API/UI `state=partially_rated` (both participants on meal) |
| 11 | Jordan rates → complete | **PASS** | `state=fully_rated` |
| 12 | History pinned recipe version | **FAIL** | Harness could not open History tab (mobile tab hidden in headless layout). Rating loop + API fully_rated with pinned cook confirmed in-run; no `step12_history_pinned.png`. |

## Overall

**FAIL** — steps **5** and **12** did not pass criteria. Steps **2** and **10–11** confirm the **procedure fix** (Jordan on `participant_ids`) resolves the prior partial-rating blocker.

## Step 5 follow-up

Repeated hosted runs show **`List updated.`** on no-op **Save** even when `participant_ids` already include both diners before finalize. Step 5 may require a product-side no-op guard **or** a documented harness timing constraint; do not drop Jordan from meals to silence the toast.

## Banned regression

Do not use Tom, Renata, or Household 001 in this golden path.
