#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
shopt -s nullglob
files=(migrations/*.sql)
if ((${#files[@]} == 0)); then
  echo "No migration files found"
  exit 1
fi
for f in "${files[@]}"; do
  if ! grep -qi 'CREATE\|ALTER\|PRAGMA' "$f"; then
    echo "Migration looks empty or invalid: $f"
    exit 1
  fi
done
# Forward-only naming
prev=""
for f in $(ls migrations/*.sql | sort); do
  base=$(basename "$f")
  num="${base%%_*}"
  if [[ ! "$num" =~ ^[0-9]{4}$ ]]; then
    echo "Migration must start with 4-digit prefix: $f"
    exit 1
  fi
  if [[ -n "$prev" && "$num" < "$prev" ]]; then
    echo "Migrations out of order: $f"
    exit 1
  fi
  prev="$num"
done
echo "OK: ${#files[@]} migration file(s)"
