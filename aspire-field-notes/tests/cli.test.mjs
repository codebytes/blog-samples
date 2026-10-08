import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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

function mockAspire(directory, replies) {
  const path = join(directory, "replies.json");
  writeFileSync(path, JSON.stringify(replies));
  return executable(directory, "aspire", `
    import { readFileSync } from "node:fs";
    const replies = JSON.parse(readFileSync(${JSON.stringify(path)}, "utf8"));
    const args = process.argv.slice(2);
    const key = [args.slice(0, 3).join(" "), args.slice(0, 2).join(" "), args[0]]
      .find(key => Object.hasOwn(replies, key));
    if (!key) throw new Error("Unexpected mock CLI command: " + args.join(" "));
    const reply = replies[key];
    process.stdout.write(typeof reply.stdout === "string" ? reply.stdout : JSON.stringify(reply.stdout ?? ""));
    process.stderr.write(reply.stderr ?? "");
    process.exitCode = reply.status ?? 0;
  `);
}

function run(command, args, environment = {}, input = "") {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, {
      cwd: root, env: { ...process.env, ...environment }, timeout: 25_000,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.stdin.end(input);
    child.on("error", reject);
    child.on("close", (status, signal) => resolveResult({ status, signal, stdout, stderr }));
  });
}

test("the symlinked terminal entrypoint executes instead of silently succeeding", async t => {
  const directory = fixture(t);
  const alias = join(directory, "sample");
  symlinkSync(root, alias, "dir");
  const result = await run(process.execPath, [join(alias, "scripts/terminal-smoke.mjs"), "invalid-mode"]);
  assert.equal(result.status, 1, "The terminal helper skipped its main-module guard.");
  assert.match(result.stderr, /Usage: node scripts\//);
});

test("helpers can still be imported from stdin without treating '-' as a file", async () => {
  const result = await run(process.execPath, ["--input-type=module", "-"], {}, `
    import { makeTape } from "./scripts/terminal-smoke.mjs";
    if (typeof makeTape !== "function") throw new Error("Missing helper export.");
    console.log("Imported helpers without running a smoke check.");
  `);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Imported helpers without running/);
});

for (const output of ["", { resources: [] }]) {
  test(`empty resource discovery has an actionable error (${typeof output})`, async t => {
    const cli = mockAspire(fixture(t), { describe: { stdout: output } });
    const result = await run(process.execPath, ["scripts/state-smoke.mjs", "write"], { ASPIRE_BIN: cli });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /No running catalog AppHost/);
    assert.doesNotMatch(result.stderr, /Unexpected end of JSON/);
  });
}

test("terminal negative control reports a missing AppHost before the assertion", async t => {
  const cli = mockAspire(fixture(t), {
    "terminal tape play": { status: 7, stderr: "No running AppHost found.\n" },
  });
  const result = await run(process.execPath, ["scripts/terminal-smoke.mjs", "--negative-control"], { ASPIRE_BIN: cli });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Negative control expected CLI exit 16, observed 7/);
  assert.ok(result.stderr.indexOf("No running AppHost found.") < result.stderr.indexOf("AssertionError"));
  const nonce = result.stderr.match(/artifacts\/terminals\/([a-f0-9]{16})/)?.[1];
  assert.ok(nonce);
  for (const extension of ["tape", "screen.txt", "diagnostics.txt"]) {
    rmSync(resolve(root, "artifacts/terminals", `${nonce}.${extension}`));
  }
});

for (const scenario of ["expected", "no-computation", "echoed-success"]) {
  test(`exit-16 terminal diagnostics stay in artifacts without weakening assertions (${scenario})`, async t => {
    const directory = fixture(t);
    const usedTape = join(directory, "used-tape.txt");
    const cli = executable(directory, "aspire", `
      import { readFileSync, writeFileSync } from "node:fs";
      const args = process.argv.slice(2);
      const path = args[args.indexOf("--tape-file") + 1];
      writeFileSync(${JSON.stringify(usedTape)}, path);
      const nonce = readFileSync(path, "utf8").match(/FIELD_NOTES_42_([a-f0-9]{16})/)[1];
      if (${JSON.stringify(scenario)} !== "no-computation") console.log("FIELD_NOTES_48_" + nonce);
      if (${JSON.stringify(scenario)} === "echoed-success") console.log("FIELD_NOTES_42_" + nonce);
      console.error("Tape playback failed: expected-42 output not found.");
      process.exitCode = 16;
    `);
    const result = await run(process.execPath, ["scripts/terminal-smoke.mjs", "--negative-control"], { ASPIRE_BIN: cli });
    const path = readFileSync(usedTape, "utf8");
    t.after(() => {
      for (const extension of ["tape", "screen.txt", "diagnostics.txt"]) {
        rmSync(path.replace(/\.tape$/, `.${extension}`));
      }
    });
    assert.doesNotMatch(result.stderr, /Tape playback failed/);
    assert.match(readFileSync(path.replace(/\.tape$/, ".diagnostics.txt"), "utf8"), /Tape playback failed/);
    if (scenario === "expected") {
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /PASS negative control/);
      assert.equal(result.stderr, "");
    } else {
      assert.equal(result.status, 1, "Expected exit 16 alone does not prove the negative control.");
      assert.match(result.stderr, scenario === "no-computation" ? /actually compute 48/ : /incorrectly satisfied/);
    }
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
