# Deep links (canonical routes)

Harbor Eats uses stable path routes so links survive auth boundaries and PWA install.

| Route | Purpose | Auth |
|-------|---------|------|
| `/invite/{HE-INV-*}` | Join a household | Public resolve; join mutates via scoped invite |
| `/share/{HE-SHARE-*}` | Guest choice set | Public resolve |
| `/recover/{token}?dest=…` | Passwordless session restore | Consumes one-time token → HttpOnly cookie → redirect `dest` |
| `/rate/{plan_id}` | Pending rating (future) | Session or recover → rate view |

Legacy query params `?invite=` and `?share=` remain supported in the client boot script.

## Auth boundary pattern

1. User opens deep link (may be unauthenticated).
2. Public GET resolves invite/share metadata where applicable.
3. Protected household data requires `he_session` cookie.
4. If session missing but `he_household_id` / `he_member_id` hints exist, client calls `POST /api/recovery/request` and (in dev/test) auto-consumes the returned link; production uses email delivery via `MAIL_TRANSPORT`.
5. After consume, client navigates to `dest` (or server `destination_path`) without losing intent.

## API link generation

- Invites: `POST /api/invites` → `invite_url` like `…/invite/HE-INV-…`
- Shares: `POST /api/shares` → `share_url` like `…/share/HE-SHARE-…`
- Recovery: `POST /api/recovery/request` → `dev_recovery_url` (test) or mail transport

Worker serves `index.html` for `/invite/*`, `/share/*`, `/recover/*`, `/rate/*`, `/meal/*` so refreshes work on the same routes.
