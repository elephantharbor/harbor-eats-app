# S-04B activation checklist

S-04A stopped before consumer activation. Do not start these steps until Oversight says so. None of them are done.

Affiliate enrollment stays deferred. The June 18, 2026 pre-launch page names an Impact.com invitation after production approval. Do not enroll from this repo.

1. **Production application approval.** Thomas submits Instacart’s production-key request only after the pre-launch package in `S-04A-INSTACART-PRELAUNCH-PACKAGE.md` is real: official logo, a recording of the live CTA, and a real development list URL. Do not submit the outline.

2. **Production key.** Create it in Instacart’s production project after they approve the application. It is a different key from the development key. Do not paste it into chat, a fixture, or a file.

3. **Secure production secret.** Store it only as the Pages secret `INSTACART_API_KEY` on the production project, through a secret prompt. The committed production config must still refuse a key written into `wrangler.toml`.

4. **Provider config verification.** Confirm production `GROCERY_PROVIDERS` is still `""` before the gate. Activation is a later, separate change that sets that list to `instacart` in the production secret path. Confirm Preview is the only place with a development key. Confirm `GROCERY_FIXTURE` is unset for that live path. Health must show the production channel only after that gate, and must not echo the key.

5. **Approved branding.** Commit the official logo asset Instacart provides. Set `INSTACART_LOGO_PRESENT` to true only in that change. The label stays “Shop on Instacart”. Dark theme stays `#003D29` on `#FAF1E5`, 46px tall, 29.5px radius, 22px logo. No partner or delivery claim.

6. **Live production connectivity.** One production `products_link` call against `https://connect.instacart.com`, synthetic household only, after the secret and the provider flag are in place. Record status, request id, and URL validity. A green mock suite is not this step. A development-host success is not this step.

7. **Consumer handoff testing.** On a phone and a desktop, walk List → Order online → review → the real CTA → Instacart → back to `/shop`. Items and quantities match the review. Unsupported lines stay visible. A failed call leaves the list. Return does not mark anything bought.

8. **Final Oversight approval.** A person confirms the six official pages still match the adapter, the logo is the official file, and production health shows no fixture. This is a human gate, not a test result.

9. **Activation.** Deploy that approved build with `--confirm-production`. Production `GROCERY_PROVIDERS=instacart` is set only in this step. The development key is not copied into production.

10. **Post-launch monitoring and rollback.** Watch `client_errors_24h_actionable`, handoff failures, and purchased-state counts. Rollback is: set production `GROCERY_PROVIDERS` back to empty, confirm health shows Instacart off, and leave the shopping list data in place. Do not delete handoff history as part of rollback. No order exists to cancel on Instacart’s side because this integration does not create orders.
