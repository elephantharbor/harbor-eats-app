# S-03 Grocery Provider Framework

**Status.** Implemented. Not deployed. Instacart is mock-tested only. Shop in store stays the live path.

FlavorWeave owns the shopping list. A provider receives a reviewed copy and may return a link. A handoff is not a purchase. Nothing in this change marks a line bought, and nothing writes the canonical list except the household’s own shop actions.

Official Instacart pages were re-read on **2026-10-16**. URLs are in the registry row and in `S-03-INSTACART-ACTIVATION-CHECKLIST.md`.

## Capability model

| Provider | Capabilities | Fulfillment | Lifecycle | Integration |
|---|---|---|---|---|
| instore | `in_store` | `in_store` | production-enabled | production |
| instacart | `retailer_discovery`, `list_handoff` | `provider_checkout` | documented | mock_only |
| walmart | none | none | documented | none |
| amazon | none | none | documented | none |
| trader_joes | none | none | documented | none |

Instacart does not advertise pickup or delivery. `cart_create` and any other unlisted capability return `capability_unsupported` and do not call the network. There is no Walmart, Amazon, or Whole Foods adapter.

`verified_capabilities` and `provider_tested_capabilities` stay empty for Instacart. Mock contract tests do not move the lifecycle. In-store is the only production-enabled row.

Credential status for every external provider is `none`. No key is in the repo.

## Config

`GROCERY_PROVIDERS` is a comma list. Committed Preview, Production, and local worker configs set it to `""`. Empty means no external provider. In-store does not read the flag.

Instacart is configured only when it is listed and either:

- `GROCERY_FIXTURE=instacart_mock` and `ENVIRONMENT` is `preview`, `test`, `development`, `dev`, or `e2e`, and `DEPLOY_ENV` is not `production`, or
- `INSTACART_API_KEY` is a non-empty server secret and the environment maps to a known API host.

Unknown environments cannot activate. Production ignores `GROCERY_FETCH`, `GROCERY_FIXTURE`, and `GROCERY_MOCK_MODE`. `validateGroceryVars` refuses a committed key, a committed fixture, or a non-empty provider list.

The development host is `https://connect.dev.instacart.tools`. The production host is `https://connect.instacart.com`. The server picks the host from `ENVIRONMENT`. The client does not.

## What a handoff may do

States on `grocery_handoff`: `prepared`, `link_created`, `stale`, `expired`, `failed`, `cancelled`, `rejected`. There is no purchased, ordered, or delivered state.

1. Review builds two sections: **Going to Instacart** and **Staying on your FlavorWeave list**.
2. Create inserts `prepared`, calls the adapter, then stores `link_created` with the URL and a 14-day expiry. Shopping lists have no documented default expiry. 14 days is inside the documented maximum of 365.
3. The same `request_hash` while that row is still `link_created`, not stale, and not expired, returns the existing row. No second HTTP call.
4. A unique partial index on `(shop_list_id, provider_id, request_hash)` where `status = 'link_created'` covers a race. If the winner’s URL matches, the caller gets that row. If it does not, the winner is marked stale, the second URL is not stored, and the response is `provider_rejected`. The list revision is not bumped.
5. `refreshHandoffStates` marks `link_created` rows `expired` when `expires_at` is due, then `stale` when `content_fingerprint` no longer matches.
6. Cancel sets `cancelled` and keeps the stored URL. It does not tell Instacart to delete anything.
7. Return is `POST /api/grocery/return`. The copy is “Your list is still here.” The linkback is the app origin plus `/shop`, https or local dev, no query string.

The URL is stored. It is omitted from JSON while `INSTACART_LOGO_PRESENT` is false. That constant is false: the repo has no official Instacart logo file. The button label is “Shop on Instacart”, the colors are `#003D29` / `#FAF1E5`, the height is 46px, and the radius is 29.5px, and the button stays disabled. The client does not draw a substitute mark. Preview mock may show “Prepare the test link” or “Send the list again”. That button does not navigate and does not mark anything bought. Live mode without the logo is review only.

## Request shape

`POST /idp/v1/products/products_link` with `link_type: shopping_list`. Each line uses `line_item_measurements` only. The deprecated top-level quantity and unit are not sent. `expires_in` is 14. The body omits `enable_pantry_items`, filters, UPCs, product ids, image URLs, and instructions. Title is “FlavorWeave list”. Auth is `Bearer`. The mock sends `Bearer mock` and never sees a real key.

Retailers are `GET /idp/v1/retailers?postal_code&country_code=US|CA`. The response fields used are `retailer_key`, `name`, and `retailer_logo_url`. A logo that is not https is dropped. The docs’ example host `www.logoUrl.com` is dropped for that reason.

## Units

Mapped, one measurement per line: cup, tbsp→tablespoon, tsp→teaspoon, oz→ounce (weight, not fluid ounces), lb→pound, g→gram, kg→kilogram, ml→milliliter, l→liter, can, bunch, head, package, count→each.

Never coerced to each: clove, jar, serving, unparsed, carton. Carton is a FlavorWeave unit. The Instacart units page does not list it as a bare unit.

Excluded from the payload, still on the list: purchased, already have, skipped, still needed 0, stale override, zero or negative quantity, missing name, unmapped unit.

## Fingerprints

Neither hash includes a timestamp, a secret, a note, a member, or a postal code.

`content_fingerprint` covers still-needed lines: line id, display name, unit, buy quantity, override-stale, still needed. It ignores `list_state`. A check-off does not stale a link.

`request_hash` covers the included lines that would be sent: name, display text, and measurements.

A quantity, name, unit, or override change changes the content fingerprint and stales an open link. S-01 said a check-off does not stale a link. This build keeps that. The S-03 brief said a transferable-payload change stales. A check-off removes the line from the next payload, so the request hash changes, but the stored content fingerprint does not, and the existing link stays. The next create with the new request hash is a new handoff. The old link is not marked stale solely because someone checked an item off.

## Error contract

Messages are ours. Provider HTML is not copied. Provider codes are kept only when they are 3–4 digits, optional trailing `x`.

| Condition | Code | HTTP | Retryable |
|---|---|---|---|
| Capability the provider does not advertise | `capability_unsupported` | 400 | no |
| Instacart not listed or incomplete | `not_configured` | 403 | no |
| Retailers 401 or 403 | `not_configured` for `retailer_discovery` only | 403 | no |
| products_link 401 or 403 | `auth_failed` | 401 | no |
| 429 or provider code 2003 | `rate_limited` | 429 | yes |
| HTTP 408 or client timeout | `timeout` | 504 | yes |
| HTTP 5xx, including code 5000 | `provider_rejected` | 502 | yes |
| Other provider error body | `provider_rejected` | 502 | no |
| Quantity ≤ 0 (provider 1001 on the measurement) | `invalid_request` | 400 | no |
| URL not on the allowlist, or a body with no products link | `invalid_request` | 400 | no |
| `expected_revision` mismatch | `revision_conflict` | 409 | no |
| Reviewed fingerprint ≠ current request hash | `invalid_request` | 400 | no |
| Inactive member | `auth_failed` | 403 | no |
| Missing session | session error | 401 | no |

A 409 returns the current list and does not call the network. A failed or rejected row stores no URL. A body that contains `cart_id` or `order_id` is rejected and those fields are not echoed.

## URL allowlist

Navigation, exact hosts, https only, no userinfo, no port, no substring match:

- `https://www.instacart.com`
- `https://instacart.com`

The docs’ 200 example `http://example.com` is a placeholder and is not allowed. Affiliate parameters are not hardcoded.

## Telemetry

Events: `shop_provider_selected`, `shop_review_opened`, `shop_handoff_requested`, `shop_handoff_created`, `shop_handoff_failed`, `shop_handoff_stale`, `shop_handoff_returned`, `shop_handoff_cancelled`.

Props are a closed set: `provider_id`, `capability`, `code`, `provider_code`, `revision_sent`, `line_count`, `lifecycle_state`. No names, postal codes, URLs, keys, restrictions, or notes. A write failure is swallowed.

## UX defects found in the phone pass

Captured at 390×844 in `docs/shopping/s03-screens/`.

- The order sheet could grow past the phone and hide “Shop in store instead”. The open sheet is now capped to the viewport. The review scrolls. The in-store action stays pinned.
- “Edit” and “Leave it off” used the 40px small-button height. They are 44px.
- Quantity text is not allowed to shrink off the row.

The disabled Instacart button uses the documented colors at reduced opacity so it does not read as the primary action. The primary action on that sheet is “Shop in store instead”. Copy under the button says the official logo is not in the app yet. No Partner, Free Delivery, or “order completed” language.

## Discrepancies versus S-01

- Check-off does not stale a link (S-01). A later create uses the new request hash. Documented above.
- A conflicting second URL does not bump the canonical list revision. S-01 said to bump it. This build does not mutate the list.
- Carton stays unmapped. It is not sent as `package` or `each`.
- The CTA stays disabled until an official asset is committed. That is stricter than the S-01 execution plan’s “show the button” step.
- The error-codes page now says last updated Aug 11, 2026.
- The pre-launch checklist (Jun 18, 2026) says Impact.com, confirms 46px, 29.5px radius, 22px logo, and “Shop on Instacart”. S-01 noted a Tastemakers versus Impact disagreement. The June 18 page says Impact. The live page also contains the typo “PUse”.
- The CTA page (May 14, 2026) confirms the dark theme `#003D29` / `#FAF1E5` and a 22px logo. Light and white theme extracts in that read were partial (strokes `#EFE9E1` and `#E8E9EB`). Missing hex values were not invented. This build uses the dark theme only.

## Migration 0018

`migrations/0018_grocery_handoff.sql` creates `grocery_handoff` and its indexes. It does not UPDATE existing rows. Apply it once. Rehearse on a backup copy with `scripts/shop-migration-0018.mjs` (`--dry-run`, `--apply`, `--verify`). Do not run Wrangler against remote from this change. The box team runs Preview and Production.

Take a backup or restore point first.

Preview D1 `harbor-eats-cycle1-preview` (`65bc636d-7048-4e58-900b-9066edf6509f`), config `deploy/pages/preview/wrangler.toml`:

```
npx wrangler d1 execute harbor-eats-cycle1-preview --remote --config deploy/pages/preview/wrangler.toml --file migrations/0018_grocery_handoff.sql
npx wrangler d1 export harbor-eats-cycle1-preview --remote --config deploy/pages/preview/wrangler.toml --output /tmp/preview-0018.sqlite
node scripts/shop-migration-0018.mjs --sqlite /tmp/preview-0018.sqlite --verify
```

Production D1 `harbor-eats-db` (`23aa3db3-1090-471b-8c8a-b6fe71f5c053`), config `deploy/pages/production/wrangler.toml`:

```
npx wrangler d1 execute harbor-eats-db --remote --config deploy/pages/production/wrangler.toml --file migrations/0018_grocery_handoff.sql
npx wrangler d1 export harbor-eats-db --remote --config deploy/pages/production/wrangler.toml --output /tmp/prod-0018.sqlite
node scripts/shop-migration-0018.mjs --sqlite /tmp/prod-0018.sqlite --verify
```

Verify checks zero rows for: household mismatch, missing list, purchase statuses, a live link that is not https, a stored URL outside the allowlist, a failed/rejected/prepared row that kept a URL, order/cart/payment columns, and a member in another household.

## Hosted Preview without a real key

Committed config stays empty. On the Preview project only, set dashboard vars:

- `GROCERY_PROVIDERS=instacart`
- `GROCERY_FIXTURE=instacart_mock`

`ENVIRONMENT` is already `preview`. Do not set `INSTACART_API_KEY` for this fixture. Production code refuses the fixture even if those vars are copied.

Optional `GROCERY_MOCK_MODE`: `timeout`, `provider_error`, `bad_url`, `invalid_body`, `unauthorized`, `rate_limited`, `quantity_error`. Default is `ok`.

Scenarios to exercise on hosted Preview:

1. A list from more than one dinner, plus a typed general item.
2. An unsupported unit (garlic cloves, a carton) stays on the FlavorWeave list with an edit action.
3. A shopper override (a new amount on a recipe line) is what the review would send.
4. Change a quantity after a test link. The next review reports the earlier link stale.
5. `GROCERY_MOCK_MODE=timeout` and `provider_error`. The list is unchanged. Retry once.
6. Shop in store from the same sheet. Nothing is sent.
7. One broad pass: review, prepare the test link, return to `/shop`, and read “Your list is still here.”

The mock success body is only `{ products_link_url: "https://www.instacart.com/store/shopping-list/mock" }`. It does not invent a cart, an order, stock, or a price.
