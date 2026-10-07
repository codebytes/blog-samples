import { spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const installUrl = "https://aspire.dev/get-started/install-cli/";

export function requireAspire() {
  const command = process.env.ASPIRE_BIN || "aspire";
  const result = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 15_000 });
  if (result.error?.code === "ENOENT") {
    throw new Error(`Aspire CLI not found. Install Aspire CLI 13.6.1 or later and put aspire on PATH. See ${installUrl}`);
  }
  if (result.error || result.status !== 0) {
    throw new Error(`Cannot check Aspire CLI version: ${result.error?.message || result.stderr.trim() || `exit ${result.status}`}`);
  }

  const version = result.stdout.trim();
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) throw new Error(`Cannot parse Aspire CLI version '${version}'. Check aspire --version.`);
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  const supported = major > 13 || (major === 13 &&
    (minor > 6 || (minor === 6 && (patch > 1 || (patch === 1 && !match[4])))));
  if (!supported) {
    throw new Error(`Aspire CLI 13.6.1 or later is required; found ${version}. Check aspire --version and PATH. See ${installUrl}`);
  }
  return { command, version };
}

if (process.argv[1] && existsSync(process.argv[1]) &&
    realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  console.log(`Aspire CLI ${requireAspire().version}`);
}
