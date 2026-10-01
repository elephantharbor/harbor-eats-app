#!/usr/bin/env bash
# Stage consumer UI for optional DISTINCT github.io mirror (legacy / in-memory).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="$ROOT/.github-io-stage"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -a "$ROOT/public/." "$STAGE/"
cp -a "$ROOT/legacy/github-io/PRODUCT-SITE.md" "$STAGE/PRODUCT-SITE.md" 2>/dev/null || cp "$ROOT/PRODUCT-SITE.md" "$STAGE/"
touch "$STAGE/.nojekyll"
echo "Staged legacy github.io mirror → $STAGE"
ls -la "$STAGE"
