#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" != 1 || "$1" != "compose" ]]; then
  echo "Usage: bash scripts/publish.sh compose" >&2
  echo "An explicit target is required. This sample only publishes Docker Compose artifacts; it never deploys." >&2
  exit 64
fi
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
apphost="$root/catalog/Catalog.AppHost/Catalog.AppHost.csproj"
rm -f "$root/artifacts/compose/review.json"
export Deployment__Target=compose
bash "$root/scripts/aspire.sh" publish --apphost "$apphost" --list-steps --non-interactive --nologo
bash "$root/scripts/aspire.sh" publish --apphost "$apphost" --output-path "$root/artifacts/compose" --non-interactive --nologo
node "$root/scripts/review-compose.mjs" "$root/artifacts/compose"
