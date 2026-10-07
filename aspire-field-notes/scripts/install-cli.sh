#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "$(uname -s)" in
  Darwin) platform=osx ;;
  Linux) platform=linux ;;
  *) echo "Use the official Aspire 13.6.1 installer on this platform; set ASPIRE_BIN to its executable." >&2; exit 1 ;;
esac
case "$(uname -m)" in
  arm64|aarch64) architecture=arm64 ;;
  x86_64) architecture=x64 ;;
  *) echo "Unsupported CLI architecture: $(uname -m)" >&2; exit 1 ;;
esac

# Reviewed SHA-512 values from the official v13.6.1 release, not fetched at install time.
case "$platform-$architecture" in
  osx-arm64) expected=4AB9C55831E19D99C3A00BB474B1E41177E375FE6FCCA38F30DB1713A68C20A64C44DD36D59409C4E87B15306059016F6C4FDAB8C607535FC4A15992531C6291 ;;
  osx-x64) expected=6A63E9DBABFE801425CCC5DF7CB2D90BA1C09E66EC40591F01218B5CD7BC45085ABABA3AB4F8CD759068BBA9030F2BDB4811FF18E7351A86E0F4DCA711D15EF9 ;;
  linux-arm64) expected=25F13B0692AEE7BBD6B4E61095D8D1D617DA6268D65E4166C882A776D8DFAEDE2FACD4738BC9E13CD0154B3B0E1C5816B01D0BFDAE0F83F3916E3880E85221D2 ;;
  linux-x64) expected=B512AE977C62F3B83F59636B4D03660D96284DBA491BD7F9F070006A8840E4F1BA8ADDC5B4ACB11EADD01FAB431002703F1655C10C6FD913F77BAA580C6FA2A1 ;;
esac
asset="aspire-cli-$platform-$architecture-13.6.1.tar.gz"
url="https://github.com/microsoft/aspire/releases/download/v13.6.1/$asset"
mkdir -p "$root/.tools"
archive="$root/.tools/$asset"
trap 'rm -f "$archive"' EXIT
curl --fail --location --silent --show-error --retry 2 --retry-all-errors --connect-timeout 15 \
  --speed-limit 1024 --speed-time 60 "$url" -o "$archive"
node --input-type=module - "$archive" "$expected" <<'JS'
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
const [archive, pinnedHash] = process.argv.slice(2);
const expected = pinnedHash.toLowerCase();
if (!/^[a-f0-9]{128}$/.test(expected)) throw new Error("Invalid release checksum.");
const hash = createHash("sha512");
for await (const chunk of createReadStream(archive)) hash.update(chunk);
if (hash.digest("hex") !== expected) throw new Error("Aspire release checksum mismatch.");
console.log("Verified archive against the pinned platform SHA-512.");
JS
tar -xzf "$archive" -C "$root/.tools"
"$root/.tools/aspire" --version
echo "Installed the pinned CLI locally. Use bash scripts/aspire.sh; the global CLI binary is unchanged."
echo "The CLI still uses shared ~/.aspire state for bundles, dashboard runs, and logs."
