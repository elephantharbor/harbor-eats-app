# S-01 Accessibility, Privacy, and Safety

**Status.** Contract for S-02 and S-03. Shopping must work with no LLM. The parser in the architecture card is the whole of natural-language entry.

## Accessibility

The current row control is a `button` with `role="checkbox"` and `aria-checked`, inside a target at least 56px tall (`.shop-row__toggle` in `public/styles.css`). S-02 keeps that pattern and fixes the state it announces.

Today, already-have and purchased both announce checked. S-02 announces the real state: “Still need”, “Already have”, “Bought”, or “Skipping”. The ⋯ sheet remains for the less common transitions. The primary control in the store toggles `open` and `purchased` only, so a shopping trip does not require the sheet. Already-have and skipped stay on the sheet so a mis-tap does not erase a plan requirement.

Targets stay at least 44px, controls 52px where they are buttons, matching `--target-min` and `--control-h`. The add field uses the existing `.field` anatomy, `type="text"`, `enterkeyhint="done"`, and `autocomplete="off"`. It is not a search of a provider. The sticky action bar respects `safe-area-inset-bottom` the way the tab bar already must, and it does not cover the last row: the list padding equals the bar height plus the safe area.

Focus uses `--color-focus`. The view heading receives focus on navigation, as the rest of the app does. Sheets stay `<dialog>`. Reduced motion: no new transition longer than `--duration-base`, and `@media (prefers-reduced-motion: reduce)` disables them, consistent with `docs/FLAVORWEAVE-BRAND.md`. The weave loader is not used on the list. Loading is the existing sunken skeleton, not a spinner parade.

Print and the read-only share page are a single column with real headings, not a screenshot of the app.

Contrast stays on semantic tokens. The Instacart dark button is their specified pair `#003D29` / `#FAF1E5`, used only on that control, on a white surface. It is not a FlavorWeave primary button and is not restyled coral. Coral remains our action color. `.btn-sm` is still never primary.

## Authorization

Session cookie as today. Every list and handoff route checks `requireSession` and the household id. A share token is the only public read, and it is the redacted projection. Members with status other than `active` cannot write. Revoked sessions fail closed the way dinner-plan routes already do.

## Redirects and credentials

Provider URLs pass the allowlist in the adapter card before `location` changes. Linkback URLs are same-origin. Secrets stay in Worker secrets. `configured()` is boolean. Logs and `event.props_json` exclude the key, the postal code, item names, and the provider URL.

Retailer names and logo URLs are untrusted strings. Names are escaped as text. Logos render only when the URL is `https` and is assigned to an `img` `src`, with `referrerpolicy="no-referrer"` and no inline SVG from the provider.

## Provider terms and data minimization

The Instacart terms restrict scraping and redistribution of their data. We store the URL they returned and the error code. We do not store their retailer catalog, prices, or shopper data. We do not have that data from the shopping-list API.

The payload to Instacart is title, line names, display text, measurements, expiry, and linkback. It is not constraints, member names, ratings, adaptation warnings, or the raw add-item keystrokes beyond the display name the person saved.

Health filters are not derived from `constraint_rule`. Sending `GLUTEN_FREE` because a member has a limit would disclose a dietary or medical fact to Instacart and would still not be a safety guarantee. If a later card adds filters, they are an explicit shopper toggle, default off, and the copy says they are a preference sent to Instacart, not a promise.

## Substitutions

The person controls recipe changes through the existing adaptation review. Provider substitutions happen in the provider UI, where we cannot see them and must not describe them as applied. Copy near the Instacart button: “You’ll confirm products on Instacart. FlavorWeave won’t swap items for you.”

## No model on the shop path

`public/app.js` shop rendering does not import `src/ai`. S-02 and S-03 keep it that way. A failed parser does not “try the model”. The line is saved unparsed or rejected with `item_name_required`.
