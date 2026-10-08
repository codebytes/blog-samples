import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import { root } from "../scripts/apphost.mjs";

const cleanEnvironment = { ...process.env };
for (const key of Object.keys(cleanEnvironment)) {
  if (/^(Catalog__|Inventory__|ConnectionStrings__|services__|DATA_PATH)/i.test(key)) {
    delete cleanEnvironment[key];
  }
}

for (const [project, environment, expected] of [
  ["Catalog.Api", {}, /Missing required configuration 'Catalog:Region'/],
  ["Inventory.Api", { Inventory__FaultEnabled: "invalid" }, /Inventory:FaultEnabled must be true or false/],
]) {
  test(`${project} fails before listening when required configuration is invalid`, () => {
    const dll = resolve(root, "catalog", project, "bin/Debug/net10.0", `${project}.dll`);
    const result = spawnSync("dotnet", [dll], {
      cwd: root,
      env: { ...cleanEnvironment, ...environment },
      encoding: "utf8",
      timeout: 20_000,
    });
    assert.ok(!result.error, `Expected a prompt startup failure, not a timeout: ${result.error?.message}`);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, expected,
      "Build the services with scripts/check.sh; an unrelated launch error is not proof of fail-fast configuration.");
  });
}
