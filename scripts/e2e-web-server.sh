#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run db:migrate:local
node scripts/seed-local-d1-catalog.mjs
exec npx wrangler dev --config wrangler.worker.toml --port 8787 --ip 127.0.0.1 --var CATALOG_SOURCE:d1
