#!/usr/bin/env bash
# Create/update elephantharbor/harbor-eats-app and enable GitHub Pages.
# NEVER pushes to elephantharbor/harbor-eats (desk).
set -euo pipefail
ROOT="/home/box/harbor-eats"
STAGE="$ROOT/product/app/.github-io-stage"
REPO="elephantharbor/harbor-eats-app"
WORKDIR="/tmp/harbor-eats-app-publish"

bash "$ROOT/product/app/scripts/prepare-github-io.sh"

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Creating public repo $REPO ..."
  gh repo create "$REPO" --public \
    --description "Harbor Eats consumer product prototype (distinct from Operating Desk)" \
    --homepage "https://elephantharbor.github.io/harbor-eats-app/"
fi

rm -rf "$WORKDIR"
gh repo clone "$REPO" "$WORKDIR" 2>/dev/null || {
  mkdir -p "$WORKDIR"
  cd "$WORKDIR"
  git init
  git remote add origin "https://github.com/${REPO}.git"
}

cd "$WORKDIR"
# Ensure on main
git checkout -B main 2>/dev/null || true

# Replace site content with staged prototype only
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -a "$STAGE"/. .

git add -A
if git diff --cached --quiet; then
  echo "No changes to publish."
else
  git -c user.name="elephantharbor" -c user.email="harbor@elephantharbor.com" \
    commit -m "Publish Harbor Eats consumer prototype (interim github.io)

Distinct from Operating Desk. In-memory prototype only; no invented metrics."
  git push -u origin main
fi

# Enable Pages from main root (idempotent-ish)
gh api -X POST "repos/${REPO}/pages" \
  -f "build_type=legacy" \
  -f "source[branch]=main" \
  -f "source[path]=/" 2>/dev/null || \
gh api -X PUT "repos/${REPO}/pages" \
  -f "build_type=legacy" \
  -f "source[branch]=main" \
  -f "source[path]=/" 2>/dev/null || \
  echo "Pages API note: configure Settings → Pages → Deploy from main / root if needed."

echo "Product interim URL: https://elephantharbor.github.io/harbor-eats-app/"
echo "Desk (untouched):     https://elephantharbor.github.io/harbor-eats/"
