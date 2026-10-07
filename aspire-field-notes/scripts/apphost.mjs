import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requireAspire } from "./require-aspire.mjs";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const catalogAppHost = resolve(root, "catalog/Catalog.AppHost/Catalog.AppHost.csproj");

export function aspire(args, timeout = 40_000) {
  const result = spawnSync(requireAspire().command, [
    ...args,
    "--apphost", catalogAppHost, "--non-interactive", "--nologo",
  ], { cwd: root, encoding: "utf8", timeout, maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    console.error(result.stderr);
    throw new Error(`Aspire ${args[0]} failed (exit ${result.status}): ${result.error?.message ?? result.stdout}`);
  }
  return result.stdout;
}

export function endpoints() {
  const output = aspire(["describe", "--format", "Json"]);
  if (!output.trim()) throw new Error("No running catalog AppHost");
  const { resources } = JSON.parse(output);
  if (!resources?.length) throw new Error("No running catalog AppHost");
  const result = {};
  for (const name of ["api", "inventory", "web"]) {
    const resource = resources.find((item) => item.displayName === name);
    assert.ok(resource, `Missing ${name} resource in the selected AppHost.`);
    assert.equal(resource.state, "Running", `${name} is not running.`);
    assert.equal(resource.healthStatus, "Healthy", `${name} is not healthy.`);
    const url = resource.urls.find((item) => item.name === "http")?.url;
    assert.ok(url && URL.canParse(url), `Missing ${name} HTTP endpoint.`);
    result[name] = url;
  }
  return result;
}

export async function jsonRequest(origin, path, options = {}) {
  const response = await fetch(new URL(path, origin), { ...options, signal: AbortSignal.timeout(10_000) });
  return { response, body: await response.json() };
}
