import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { endpoints, jsonRequest, root } from "./apphost.mjs";

const mode = process.argv[2];
assert.ok(["write", "verify"].includes(mode), "Usage: node scripts/state-smoke.mjs write|verify");
const { web } = endpoints();
const artifact = resolve(root, "artifacts/state-check.json");
if (mode === "write") {
  const message = `Retained field note ${randomUUID()}`;
  const { response, body } = await jsonRequest(web, "/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  assert.equal(response.status, 200);
  assert.equal(body.state.message, message);
  assert.ok(body.state.revision > 0);
  const read = await jsonRequest(web, "/api/state");
  assert.equal(read.response.status, 200);
  assert.deepEqual(read.body, body);
  const invalid = await jsonRequest(web, "/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: " " }),
  });
  assert.equal(invalid.response.status, 400);
  assert.deepEqual((await jsonRequest(web, "/api/state")).body, body, "Rejected writes must not mutate state.");
  mkdirSync(resolve(root, "artifacts"), { recursive: true });
  writeFileSync(artifact, JSON.stringify(body, null, 2));
  console.log(`PASS: state revision ${body.state.revision} written and read; invalid input rejected without mutation.`);
  console.log("Restart this same AppHost, then run: node scripts/state-smoke.mjs verify");
} else {
  const before = JSON.parse(readFileSync(artifact, "utf8"));
  const { response, body } = await jsonRequest(web, "/api/state");
  assert.equal(response.status, 200);
  assert.notEqual(body.instanceId, before.instanceId, "The API has not restarted.");
  assert.deepEqual(body.state, before.state, "Application state did not survive the restart.");
  console.log(`PASS: a new API instance retained state revision ${body.state.revision} and the exact note.`);
}
