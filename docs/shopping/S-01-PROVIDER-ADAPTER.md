# S-01 Grocery Provider Adapter

**Status.** Contract. No adapter module is added in S-01.

**Decision.** One small capability interface. The core list engine and the general UI call a server function that checks capabilities. They do not contain provider URLs, request shapes, or brand rules. V1 implements two adapters in S-03: `instore` and `instacart`. Other registry rows get no code until a later card says the capability is tested.

This is not the AI provider adapter. `src/ai/providers/contract.js` stays the generation boundary. Grocery lives under `src/lib/grocery/` when S-03 builds it. No shared base class hierarchy, no plugin loader, no “connector framework”.

## Registration

A fixed map in `src/lib/grocery/registry.js`:

```js
{ instore: createInStoreAdapter(), instacart: createInstacartAdapter() }
```

An id not in the map is unknown. An id in the map but absent from `GROCERY_PROVIDERS` is disabled. `GROCERY_PROVIDERS` is a comma list, default empty, same pattern as `AI_TASKS_ENABLED` in `src/ai/config.js`. Empty means the in-store adapter is still available, because it has no secret and no network. Instacart is off until the env lists it **and** `INSTACART_API_KEY` is set. S-03 adds the env key with an empty default. S-03 does not set it on preview or production. S-04 is the only unit that may set it, and only after the human gate in `S-01-EXECUTION-PLAN.md`.

`configured(env)` returns a boolean. It never returns the key.

## Capabilities

Mandatory on every adapter:

| Method | Behavior |
|---|---|
| `id` | Stable string. |
| `capabilities()` | Frozen set of the optional names below. |
| `fulfillmentMethods()` | Subset of `in_store`, `pickup`, `delivery`, `provider_checkout`. |

Optional. Absent means the server returns `capability_unsupported` and the UI hides the control.

| Capability | What it may claim |
|---|---|
| `retailer_discovery` | Names of nearby retailers the provider actually returns. |
| `in_store` | Our own list, on the phone, in the aisle. |
| `list_handoff` | A URL or payload the provider accepted. Not a cart and not an order. |
| `product_search` | Search hits the provider documented. |
| `product_match` | A provider match result. Not inferred from a name we sent. |
| `price` | A price the provider returned. |
| `availability` | An explicit availability field the provider returned. |
| `cart_create` | A cart id the provider returned. |
| `customer_auth` | The shopper authorized that provider. |
| `pickup` | The provider’s pickup option, only if their response says so. |
| `delivery` | The provider’s delivery option, only if their response says so. |
| `order_status` | An order state the provider returned. |
| `substitution_info` | A substitution the provider returned. Never one we invent. |

`instore` capabilities: `in_store` only. Fulfillment: `in_store`.

`instacart` capabilities in S-03, and only these: `retailer_discovery`, `list_handoff`. Fulfillment method we may show: `provider_checkout`, meaning the person continues on Instacart. We do not declare `pickup` or `delivery`. Instacart’s page is where those choices happen, and the API does not return the choice.

Walmart’s affiliate docs describe search, item price, and item availability. That does **not** put those capabilities on an adapter. No Walmart adapter in S-03. A URL-only provider, including a future Amazon or Whole Foods link, declares no `availability`. Opening a website is not `list_handoff`.

## Typed operations

JavaScript in this repo, validated with the same discipline as `src/ai/schema.js` (explicit required fields, no extra properties). S-03 can use a small validator. It does not need a new schema library.

### `discoverRetailers({ postal_code, country_code })`

Input: postal code string, country `US` or `CA`. Output: `{ retailers: [{ retailer_key, name, logo_url }] }` or an error. `logo_url` is untrusted. The client may display it only as an image with a URL that is `https`. No HTML.

### `createListHandoff({ title, linkback_url, lines, expires_in_days })`

`lines` are already filtered to lines the review screen included. Each line:

```json
{
  "line_id": "hl_…",
  "name": "yellow onion",
  "display_text": "Yellow onion",
  "measurements": [{ "quantity": 2, "unit": "each" }]
}
```

`measurements` is the representation we send when the provider has one. For Instacart this maps to `line_item_measurements`. The deprecated top-level `quantity` and `unit` on their line item are not the shape we send. See `S-01-INSTACART.md`.

Output on success: `{ products_link_url, expires_at }`. The URL is stored on the handoff. The client receives it only in the response to the member who confirmed the review, and only to navigate. It is not written into `event`.

### `getCapabilities()`

Server route `GET /api/grocery/capabilities`, session required. Returns enabled adapters and their capability names. No secrets, no logos, no account ids.

## Error contract

```json
{
  "ok": false,
  "code": "capability_unsupported",
  "retryable": false,
  "provider_id": "instacart",
  "capability": "cart_create",
  "provider_code": null,
  "message": "Instacart does not confirm a cart to FlavorWeave."
}
```

| `code` | When | Retryable |
|---|---|---|
| `capability_unsupported` | Method not in `capabilities()` | No |
| `not_configured` | Disabled or no secret | No |
| `auth_failed` | Provider rejected the credential (HTTP 401) | No, until a human rotates the key |
| `rate_limited` | Provider asked us to slow down | Yes, once |
| `provider_rejected` | Provider 4xx with a field error | No, until the line is edited |
| `invalid_request` | Our validation failed before the network | No |
| `timeout` | Our deadline exceeded | Yes, once |
| `cancelled` | Member cancelled | No |

`message` is a sentence we write. Provider HTML and raw bodies are not shown. A provider field key may be logged on the server only.

Instacart’s documented error codes (`1001`, `2003`, `4000`, `4001`, `4002`, `500x`, `9999`) go in `provider_code`. `2003` (“retry later”) maps to `rate_limited`. `500x` maps to `provider_rejected` with `retryable: true` once.

## Credential isolation

`INSTACART_API_KEY` is a Worker secret, same class as `OPENAI_API_KEY`. Development and production are different keys and different hosts (`connect.dev.instacart.tools` and `connect.instacart.com`). The host is chosen from `ENVIRONMENT`, not from the client. The client never sends the key, and the key is never selected into D1, `event`, or a handoff row.

Outbound navigation allowlist after a successful handoff: `https://www.instacart.com/` and `https://instacart.com/` only. The development host is not opened from the production client. If the returned URL fails the allowlist, store the handoff as `rejected` with `invalid_request` and do not navigate.

`partner_linkback_url` is our own origin plus `/shop`. No query parameters that carry diet, allergens, member names, or the list contents.

## Observability

Closed event names, written server-side:

- `shop_handoff_created`
- `shop_handoff_failed`
- `shop_handoff_cancelled`

Props: `provider_id`, `capability`, `code`, `provider_code`, `revision_sent`, `line_count`. No names, no postal code, no URL, no key.

## Idempotency

`createListHandoff` computes `request_hash` before the network call. A matching `link_created` handoff that is not stale or expired is returned with no second HTTP call. A retry after a timeout uses the same hash. If the provider has no idempotency key of its own, a timeout can create two of their pages. We store one URL. A second 200 with a different URL replaces nothing automatically; the route returns `provider_rejected` with a message that the member should send again, and the list revision bumps so the first URL is stale. We do not guess which page Instacart kept.

## Contract tests and mocks

`test/grocery-adapter-contract.test.js` in S-03:

- Every registered adapter implements `id`, `capabilities`, `fulfillmentMethods`, `configured`.
- Calling a missing capability returns `capability_unsupported` and performs no fetch.
- `instore` never calls `fetch`.
- The Instacart mock accepts a measurements array and rejects quantity `<= 0` with a body shaped like their documented `1001` quantity error.
- The mock does not return availability, a cart id, or an order id. A test fails if the client treats the URL as purchased.
- Allowlist rejects a `products_link_url` on any other host.
- `configured` is false when the env flag omits `instacart`.

The mock is `src/lib/grocery/instacart-mock.js`, used when `ENVIRONMENT` is `test` or `AI`-style fake is not reused. Tests pass `fetch` in. Production code paths use `globalThis.fetch` only inside the Instacart adapter.

## What the UI may assume

The shop screen asks `GET /api/grocery/capabilities`. If `instacart` is absent, “Order online” explains that online ordering is not connected and offers “Shop in store”. It does not render a dead checkout. Provider-specific copy and the Instacart button live in one module, `public/shop-handoff.js` when S-03 adds it, not in the list renderer.
