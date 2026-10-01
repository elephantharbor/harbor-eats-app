# Deploy log (alpha)

Record each production deploy. **Do not invent metrics.**

| UTC date | Git SHA | Environment | Migrations | Notes |
|----------|---------|-------------|------------|-------|
| _pending_ | _this PR_ | pages.dev + worker | through 0003 | Apply `0003_member_sessions` on remote D1 before session restore works in prod |

## Template row

```
| 2026-10-01T12:00:00Z | abc1234 | pages.dev | 0003 | alpha hardening session + CI |
```
