#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
dotnet build AspireFieldNotes.slnx --verbosity minimal
dotnet test tests/Catalog.Tests/Catalog.Tests.csproj --no-build --no-restore --verbosity minimal
npm ci --prefix catalog/web --no-audit --no-fund
npm run build --prefix catalog/web
node --test tests/*.test.mjs
