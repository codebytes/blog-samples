import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

export function makeTape(nonce) {
  assert.match(nonce, /^[a-f0-9]{16}$/);
  const template = readFileSync(new URL("../terminals/node-smoke.tape", import.meta.url), "utf8");
  const tape = template.replaceAll("RUN_NONCE", nonce);
  const marker = `FIELD_NOTES_42_${nonce}`;
  const typed = tape.split("\n").find((line) => line.startsWith("Type "));
  assert.ok(typed && !typed.includes(marker), "Input echo must not contain the expected output.");
  return { tape, marker };
}

if (process.argv[1] && existsSync(process.argv[1]) &&
    realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  assert.ok(process.argv.length === 2 ||
    (process.argv.length === 3 && process.argv[2] === "--negative-control"),
  "Usage: node scripts/terminal-smoke.mjs [--negative-control]");
  const negativeControl = process.argv[2] === "--negative-control";
  const nonce = randomBytes(8).toString("hex");
  const { tape: template, marker } = makeTape(nonce);
  const tape = negativeControl ? template.replace("6*7", "6*8") : template;
  const directory = resolve(root, "artifacts", "terminals");
  mkdirSync(directory, { recursive: true });
  const path = resolve(directory, `${nonce}.tape`);
  writeFileSync(path, tape, { flag: "wx" });
  const result = spawnSync("bash", [
    resolve(root, "scripts/aspire.sh"),
    "terminal", "tape", "play", "node-repl",
    "--apphost", resolve(root, "terminals/Terminal.AppHost/Terminal.AppHost.csproj"),
    "--tape-file", path, "--timeout", "20", "--non-interactive", "--nologo",
  ], { cwd: root, encoding: "utf8", timeout: 35_000 });
  writeFileSync(resolve(directory, `${nonce}.screen.txt`), result.stdout ?? "", { flag: "wx" });
  writeFileSync(resolve(directory, `${nonce}.diagnostics.txt`), result.stderr ?? "", { flag: "wx" });
  if (negativeControl && !result.error) {
    if (result.stderr && result.status !== 16) console.error(result.stderr);
    assert.equal(result.status, 16,
      `Negative control expected CLI exit 16, observed ${result.status}. Inspect artifacts/terminals/${nonce}.diagnostics.txt for startup or connection errors.`);
    assert.ok(result.stdout.includes(`FIELD_NOTES_48_${nonce}`),
      "The negative control must actually compute 48, not just fail to find a prompt.");
    assert.ok(!result.stdout.includes(marker), "Input echo or stale output incorrectly satisfied the assertion.");
    console.log("PASS negative control: Node computed 48; the expected-42 wait correctly failed (CLI exit 16).");
  } else if (result.error || result.status !== 0) {
    console.error(result.stderr);
    throw new Error(`Tape failed (exit ${result.status}). Inspect artifacts/terminals/${nonce}.*`);
  } else {
    assert.ok(result.stdout.includes(marker), "Playback exited successfully without the computed output.");
    console.log(`PASS: Node computed 6*7=42 and emitted fresh marker ${marker}.`);
  }
  console.log(`Evidence: artifacts/terminals/${nonce}.tape and .screen.txt. The REPL is still running.`);
}
