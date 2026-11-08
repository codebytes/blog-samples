import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { root } from "../scripts/apphost.mjs";

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "field-notes-cli-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function executable(directory, name, source) {
  const path = join(directory, name);
  writeFileSync(path, `#!/usr/bin/env node\n${source}`, { mode: 0o755 });
  return path;
}

function run(command, args, environment = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, {
      cwd: root, env: { ...process.env, ...environment }, timeout: 25_000,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.stdin.end();
    child.on("error", reject);
    child.on("close", (status, signal) => resolveResult({ status, signal, stdout, stderr }));
  });
}

for (const output of ["", { resources: [] }]) {
  test(`empty resource discovery has an actionable error (${typeof output})`, async t => {
    const cli = executable(fixture(t), "aspire", `
      const args = process.argv.slice(2);
      if (args[0] !== "describe") throw new Error("Unexpected mock CLI command: " + args.join(" "));
      process.stdout.write(${JSON.stringify(typeof output === "string" ? output : JSON.stringify(output))});
    `);
    const result = await run(process.execPath, ["scripts/state-smoke.mjs", "write"], { ASPIRE_BIN: cli });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No running catalog AppHost/);
    assert.doesNotMatch(result.stderr, /Unexpected end of JSON/);
  });
}

test("failed standalone Compose review clears a previous success", async t => {
  const directory = fixture(t);
  const review = join(directory, "review.json");
  writeFileSync(review, '{"deployed":false}');
  writeFileSync(join(directory, "docker-compose.yaml"), "services: {}");
  executable(directory, "docker", 'console.error("Invalid Compose model"); process.exitCode = 1;');
  const result = await run(process.execPath, ["scripts/review-compose.mjs", directory], {
    PATH: `${directory}:${process.env.PATH}`,
  });
  assert.equal(result.status, 1);
  assert.ok(!existsSync(review));
});
