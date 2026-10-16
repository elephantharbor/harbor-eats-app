# S-03 Instacart activation checklist

Do this before any live Instacart call. This repo does not contain a key, and this change does not deploy.

Verified by re-reading the pages below on **2026-10-16**.

## Official pages

- Shopping list: https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page/
- Nearby retailers: https://docs.instacart.com/developer_platform_api/api/retailers/get_nearby_retailers/
- Units: https://docs.instacart.com/developer_platform_api/api/units_of_measurement
- Errors: https://docs.instacart.com/developer_platform_api/api/error_and_status_codes (page says last updated Aug 11, 2026)
- CTA: https://docs.instacart.com/developer_platform_api/guide/concepts/design/cta_design (page content dated May 14, 2026 in the extract)
- Pre-launch: https://docs.instacart.com/developer_platform_api/guide/concepts/launch_activities/pre-launch_checklist (Jun 18, 2026; says Impact.com; the live page contains the typo “PUse”)

## Before a development key

1. Confirm `GROCERY_PROVIDERS` is still `""` in `deploy/pages/preview/wrangler.toml`, `deploy/pages/production/wrangler.toml`, and `wrangler.worker.toml`.
2. Put `INSTACART_API_KEY` only in the host’s secret store. Never in a wrangler `[vars]` block, a fixture, a test, or a log.
3. Development calls go to `https://connect.dev.instacart.tools`. Production calls go to `https://connect.instacart.com`. The server chooses. Do not accept a host from the client.
4. Leave `GROCERY_FIXTURE` unset for a live key. The fixture is Preview, test, and local dev only, and production refuses it.
5. Re-read the six pages above if their “last updated” date moved. Update `last_verified` on the Instacart registry row in the same change as any request-shape edit.
6. Do not mark `lifecycle` above `documented`, and do not add `verified_capabilities`, until a person has called the development API with the real key and saved the contract result. Mock tests are not that call.

## Before production

1. Complete Instacart’s pre-launch checklist, including the Impact.com invitation the June 18 page names.
2. Commit the official logo asset they provide. Set `INSTACART_LOGO_PRESENT` to true only in that change. Until then the button stays disabled and the URL stays off the client.
3. Button label remains “Shop on Instacart”. Dark theme remains `#003D29` on `#FAF1E5`, 46px tall, 29.5px radius, 22px logo. Do not add “Partner”, “Free delivery”, or checkout language.
4. Affiliate parameters stay out of the repo. If Impact issues a parameter, it belongs in server config, not in a hardcoded URL.
5. Navigation stays on `https://www.instacart.com` and `https://instacart.com` only.
6. Apply migration 0018 on Production only after the Preview apply and verify. Commands are in `S-03-DECISION-CARD.md`. Take a backup first. The file is one shot.
7. Production activation is a later change that sets `GROCERY_PROVIDERS=instacart` in the production secret/config path and stores the production key. A green mock suite does not do that.

## What this build already refuses

- A live call when the key or the host is missing.
- The mock fixture when `ENVIRONMENT` or `DEPLOY_ENV` is production.
- A destination that is not the two Instacart hosts.
- A non-https retailer logo.
- Cart, order, stock, and price fields. They are not parsed into the client.
- A handoff that marks lines purchased or edits guest counts.
