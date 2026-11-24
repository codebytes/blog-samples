import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { endpoints, root } from "../scripts/apphost.mjs";

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "field-notes-cli-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

for (const output of ["", { resources: [] }]) {
  test(`empty resource discovery has an actionable error (${typeof output})`, () => {
    assert.throws(() => endpoints(typeof output === "string" ? output : JSON.stringify(output)), /No running catalog AppHost/);
  });
}

test("malformed resource discovery does not echo resource environment data", () => {
  assert.throws(() => endpoints('{"private-value":broken}'), error =>
    error.message.includes("invalid JSON") && !error.message.includes("private-value"));
});

test("failed standalone Compose review clears a previous success", t => {
  const directory = fixture(t);
  const review = join(directory, "review.json");
  writeFileSync(review, '{"deployed":false}');
  writeFileSync(join(directory, "docker-compose.yaml"), "services: {}");
  const result = spawnSync(process.execPath, ["scripts/review-compose.mjs", directory], {
    cwd: root, env: { ...process.env, PATH: directory }, timeout: 25_000,
  });
  assert.equal(result.status, 1);
  assert.ok(!existsSync(review));
});
