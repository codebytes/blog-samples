import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const directory = resolve(process.argv[2] ?? "artifacts/compose");
const result = spawnSync("docker", [
  "compose", "-f", resolve(directory, "docker-compose.yaml"),
  "config", "--no-interpolate", "--format", "json",
], { encoding: "utf8", timeout: 30_000 });
if (result.error || result.status !== 0) {
  console.error(result.stderr);
  throw new Error("Generated Compose could not be parsed. A Docker Compose CLI is required; this command does not start containers.");
}
const model = JSON.parse(result.stdout);
for (const name of ["api", "inventory", "postgres", "web"]) {
  assert.ok(model.services[name], `Missing ${name} Compose service.`);
}
const { api, inventory, postgres, web } = model.services;
assert.equal(api.environment.DATA_PATH, "/data");
assert.ok(api.volumes.some((volume) => volume.type === "volume" && volume.target === "/data"));
assert.ok(postgres.volumes.some((volume) => volume.type === "volume"));
assert.ok(Object.keys(api.environment).some((key) => key.toLowerCase() === "connectionstrings__catalogdb"));
assert.ok(Object.keys(api.environment).some((key) => key.toLowerCase().startsWith("services__inventory__")));
assert.equal(inventory.environment.Inventory__FaultEnabled, "false", "Do not publish an intentionally failing configuration.");
assert.equal(web.environment.REVERSEPROXY__ROUTES__api__MATCH__PATH, "/api/{**catch-all}");
assert.ok(!web.environment.REVERSEPROXY__ROUTES__api__TRANSFORMS__0__PATHREMOVEPREFIX,
  "The API owns /api; the production proxy must preserve that prefix.");
assert.ok(web.ports?.length > 0, "The frontend must have published ingress.");
assert.ok(!api.ports?.length && !inventory.ports?.length && !postgres.ports?.length,
  "Only the frontend (and optional dashboard) should expose published host ports.");
const placeholders = readFileSync(resolve(directory, ".env"), "utf8");
assert.ok(placeholders.split(/\r?\n/).includes("POSTGRES_PASSWORD="),
  "The publish-only exercise requires an empty Postgres secret placeholder, not a saved secret value.");
assert.ok(postgres.environment.POSTGRES_PASSWORD === "${POSTGRES_PASSWORD}",
  "The generated Postgres service must reference its secret placeholder.");
writeFileSync(resolve(directory, "review.json"), JSON.stringify({
  services: Object.keys(model.services),
  apiDataPath: api.environment.DATA_PATH,
  stateVolume: api.volumes.find((volume) => volume.target === "/data"),
  proxyPath: web.environment.REVERSEPROXY__ROUTES__api__MATCH__PATH,
  secretValuesInspected: false,
  deployed: false,
}, null, 2));
console.log("PASS: Compose model has internal dependencies, frontend routing, a secret placeholder, and named application/database storage.");
console.log(`Reviewed artifacts in ${directory}; no images were built and nothing was deployed.`);
