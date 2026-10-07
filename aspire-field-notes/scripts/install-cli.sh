#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$(uname -s)" in
  Darwin) platform=osx ;;
  Linux) platform=linux ;;
  *) echo "Use the official Aspire 13.6.0 installer on this platform; set ASPIRE_BIN to its executable." >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) architecture=arm64 ;;
  x86_64) architecture=x64 ;;
  *) echo "Unsupported CLI architecture: $(uname -m)" >&2; exit 1 ;;
esac

asset="aspire-cli-$platform-$architecture-13.6.0.tar.gz"
url="https://github.com/microsoft/aspire/releases/download/v13.6.0/$asset"
mkdir -p "$root/.tools"
archive="$root/.tools/$asset"
checksum="$archive.sha512"
trap 'rm -f "$archive" "$checksum"' EXIT
curl --fail --location --silent --show-error --retry 2 --connect-timeout 15 --max-time 180 "$url" -o "$archive"
curl --fail --location --silent --show-error --retry 2 --connect-timeout 15 --max-time 60 "$url.sha512" -o "$checksum"
node --input-type=module - "$archive" "$checksum" <<'JS'
import { createHash } from "node:crypto";
import { createReadStream, readFileSync } from "node:fs";
const [archive, checksum] = process.argv.slice(2);
const expected = readFileSync(checksum, "utf8").trim().split(/\s+/)[0].toLowerCase();
if (!/^[a-f0-9]{128}$/.test(expected)) throw new Error("Invalid release checksum.");
const hash = createHash("sha512");
for await (const chunk of createReadStream(archive)) hash.update(chunk);
if (hash.digest("hex") !== expected) throw new Error("Aspire release checksum mismatch.");
JS
tar -xzf "$archive" -C "$root/.tools"
"$root/.tools/aspire" --version
echo "Installed the pinned CLI locally. Use bash scripts/aspire.sh; global tooling is unchanged."
