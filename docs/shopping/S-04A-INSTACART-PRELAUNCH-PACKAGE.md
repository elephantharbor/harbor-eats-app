# S-04A Instacart pre-launch package (outline only)

**Do not submit this.** Oversight has not approved a production application. There is no production key, no official logo in the repo, and no real Instacart call on record. This outline is the material a person would assemble later, from the Instacart pre-launch checklist re-read on **2026-10-16**.

Source: https://docs.instacart.com/developer_platform_api/guide/concepts/launch_activities/pre-launch_checklist

The page says last updated **Jun 18, 2026**. It says a production-key request notifies Instacart, they ask for a demo within 5 business days, and approval also sends an Impact.com invitation. Affiliate enrollment stays deferred. The page contains the typo “PUse” in the logo color-scheme bullet. This outline does not correct their page.

## Demo flow to record

Short screen recording, phone and desktop, of a synthetic household only.

1. Open the FlavorWeave list. Show items that will go and items that will stay, including an unsupported unit such as cloves.
2. Choose Order online. Show Shop in store still pinned as the primary in-store action.
3. Open the Instacart review. Show counts, human quantities, and “Staying on your FlavorWeave list” with Edit or Leave it off. Nothing is omitted silently.
4. Show the call-to-action slot. Today the control is disabled. The recording for submission cannot be made until the official logo is committed and the button is the real “Shop on Instacart” control.
5. After a real development link exists, click that control and land on the Instacart shopping-list page. Then return to `/shop` and show “Your list is still here.” Nothing is marked bought.

| Slot | What the frame must show | File |
|---|---|---|
| 01 | List before order online, phone | `docs/shopping/s04a-screens/01-list-phone.png` |
| 02 | Order online choice, development or test label visible | `docs/shopping/s04a-screens/02-choice-phone.png` |
| 03 | Review, going and staying, unsupported unit | `docs/shopping/s04a-screens/03-review-phone.png` |
| 04 | Disabled CTA today, or the official CTA once the logo exists | `docs/shopping/s04a-screens/04-cta-phone.png` |
| 05 | Same review on a desktop width | `docs/shopping/s04a-screens/05-review-desktop.png` |
| 06 | Instacart landing page after a real link, address bar visible | `docs/shopping/s04a-screens/06-instacart-landing.png` |
| 07 | Return to FlavorWeave, list unchanged | `docs/shopping/s04a-screens/07-return-phone.png` |
| 08 | Failure state, list unchanged, retry available | `docs/shopping/s04a-screens/08-error-phone.png` |

Slots 01–05 and 08 can be captured from Preview. Slots 06–07 wait for a real development URL. Do not paste a mock URL into the submission and call it live.

## CTA evidence

From the checklist, the submission must show an approved label and theme.

- Label in this product: **Shop on Instacart**. The other approved label, “Shop ingredients”, is not used.
- Dark theme already specified in S-03: background `#003D29`, text `#FAF1E5`, height 46px, radius 29.5px, logo 22px, full color, not rotated.
- The checklist says the logo sits full color on white, cashew, or dark kale, unmodified. Do not redraw it. Do not pair it with the FlavorWeave mark in a header or in copy that implies a joint offer.
- Until `INSTACART_LOGO_PRESENT` is true, the control is grey, dashed, tagged Off, and `aria-disabled`. That screenshot is evidence the button is not live yet. It is not the submission CTA.

## Sample handoff

One development `products_link_url` from `POST /idp/v1/products/products_link` with `link_type: shopping_list`, plus the request id and HTTP status from the safe diagnostic. Include the line names and measurements that were sent, and the lines that stayed on the FlavorWeave list with the reason. Do not include the API key, member names, notes, or postal code.

The checklist also asks for the URL of the Instacart shopping list or recipe page so they can review ingredient matching. That URL is the one Instacart returns. FlavorWeave does not claim match accuracy.

## Error, privacy, and no-orders

- A timeout, a provider error, and a rejected URL leave every `list_state` as it was. Copy does not say an order was placed.
- Return copy is “Your list is still here.” There is no purchased, ordered, or delivered handoff state.
- The payload is name, display text, and `line_item_measurements`. No diet, allergen, member, or health field is sent.
- Database failures return a stable code. They do not return SQL.
- Customer-facing copy must not say “Free Delivery”, “Partner” or “Partnership”, “Instacart delivers”, “Instacart grocery delivery”, “Instacart shops for you”, or any delivery-speed claim. This app does not say those things. Do not add “$0 Delivery Fee” either. Omit delivery.

## Environment to describe, without secrets

| | Preview | Production |
|---|---|---|
| Provider list | Pages secret, not the committed file | Committed `GROCERY_PROVIDERS = ""` |
| API host | `https://connect.dev.instacart.tools` when development mode is selected | Not called. Host in code is `https://connect.instacart.com` and is unused while the provider list is empty |
| Key | `INSTACART_API_KEY` Pages secret, if a person has stored one | Not set by this change |
| Mode | Fixture mock, or `GROCERY_RUNTIME` / `X-FlavorWeave-Grocery-Mode` at request time | Fixture, runtime, and the header are ignored |
| Orders | None | None |

Mock results are not evidence for this package.
