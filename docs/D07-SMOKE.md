# D-07 MealDiscovery — local smoke

Prerequisites: Node 22+, `npm install`, `npm run db:migrate:local`, catalog available to the worker (`CATALOG_SOURCE` / local D1 as in repo README).

1. Start the app: `npm run dev` (Wrangler worker + static assets).
2. Sign in or create a household through onboarding.
3. Open **Find** (tab or `/find`). First load should show collection shelves when each has ≥ 4 eligible meals.
4. Toggle **Easy** and **Under 30 min** separately; confirm result counts differ (Quick ≠ Easy).
5. Open a recipe from a card; URL should be `/meal/{slug}?from=find`. **Back** should return to Find with chips intact.
6. From an active plan, **Swap** → **See all options** opens Find in focus chrome (Find tab not lit).
7. Empty plan slot → **Pick one yourself** opens `choose_for_plan` Discovery.

Automated checks: `npm run test:unit` and `npm run lint`.

References: discovery contracts and UX on `main` ([PR #24](https://github.com/elephantharbor/harbor-eats-app/pull/24), [PR #25](https://github.com/elephantharbor/harbor-eats-app/pull/25)).
