#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cli="${ASPIRE_BIN:-$root/.tools/aspire}"
if [[ ! -x "$cli" ]]; then
  if [[ -n "${ASPIRE_BIN:-}" ]]; then
    echo "ASPIRE_BIN must name an executable Aspire 13.6.0 CLI." >&2
    exit 1
  fi
  cli="$(command -v aspire || true)"
fi
if [[ -z "$cli" ]] || ! "$cli" --version | grep -Eq '^13\.6\.0(\+|$)'; then
  echo "Aspire CLI 13.6.0 is required. Run: bash scripts/install-cli.sh" >&2
  exit 1
fi

exec "$cli" "$@"
