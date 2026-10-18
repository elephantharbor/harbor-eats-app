# Provider terminology

**Status.** Contract. Every shopping doc, registry row, UI string and handoff uses these three categories. They never merge.

## A. Native / Production-enabled
FlavorWeave's own Shopping: the household list, check-offs, quantities, sharing (read-only links) and exports (copy text, list image, print, download). It runs in Production for households. It needs no provider, account, credential or terms. It is always available. In the registry it is the `instore` row with `category: "native"`. Native is not a provider, and "production-enabled" on this row says nothing about any provider.

## B. Integrated provider
A real, provider-specific adapter in `src/lib/grocery/` that calls the provider's documented API under FlavorWeave's credentials. Status is six flags. Each is true only with evidence, and later flags never imply earlier ones:

| Flag | Meaning |
|---|---|
| Documented | An official page describes the API capability we use. |
| Registration | `available` or `unavailable`: whether FlavorWeave can apply today. |
| Credentials obtained | A dev or production credential exists in secrets. Never in the repo. |
| Mock-tested | Contract tests pass against a mock or fixture. |
| Provider-tested | A real call to the provider's environment succeeded under our credential. |
| Production enabled | `GROCERY_PROVIDERS` lists it in Production and a provider-tested contract passed with the production credential. |

**Instacart (Developer Platform) today:** adapter implemented; Documented ✔; Registration **unavailable** (applications closed, "There is no waitlist available at this time"); Credentials obtained ✘ (no dev key); Mock-tested ✔; Provider-tested ✘; Production enabled ✘ (`GROCERY_PROVIDERS = ""`). It is monitored monthly by a routine that runs on the 1st at 9:00 AM CT. The routine re-reads the developer page and updates `status.registration.last_verified`.

Rows with no adapter (Walmart, Amazon, Schnucks, Dierbergs, Whisk, Trader Joe's, Kroger if added) are **provider research**. They record what an official page documents about a future B path. They are not integrated providers and must never render a connect action.

## C. Consumer-assisted compatible application
A third-party consumer app or assistant that a shopper uses under their own account. It accepts the list that FlavorWeave lets them copy (text) or save (image). Examples: Instacart Shopping List paste/photo, Instacart Clementine, the Schnucks AI assistant, Alexa for Shopping, AnyList. **This is NOT a FlavorWeave integration.** FlavorWeave sends nothing to it, holds no credential, and cannot see what it matched, substituted or bought. Evidence labels are exactly: Documented / Human-tested / Provider-tested / Unverified / Closed/Unavailable. An app can be named in FlavorWeave copy only after a fact about it is **Human-tested**. None are as of 2026-10-18.

## Rules
1. A provider can appear in B and C at once only as two separate records. Example: `instacart` (adapter, B) and `instacart_shopping_list` / `instacart_clementine` (consumer apps, C). A C fact never changes a B flag.
2. Export rows in "How are you shopping?" are A. They stay provider-neutral.
3. "Open a website" is not `list_handoff` (S-01). "Paste into an app" is not an integration (S-07).
