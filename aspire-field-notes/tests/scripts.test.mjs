import assert from "node:assert/strict";
import test from "node:test";
import { apiTarget } from "../catalog/web/proxy-config.mjs";
import { makeTape } from "../scripts/terminal-smoke.mjs";

test("Vite requires a server-side endpoint rather than silently assuming localhost", () => {
  assert.throws(() => apiTarget({}), /API_BASE_URL is required/);
  assert.equal(apiTarget({ API_BASE_URL: "http://localhost:43210/" }), "http://localhost:43210");
  for (const value of ["relative", "ftp://api", "http://user:secret@api", "http://api/path", "http://api/?key=secret"]) {
    assert.throws(() => apiTarget({ API_BASE_URL: value }), /API_BASE_URL must/);
  }
});

test("terminal assertions require computed output, not input echo or an old marker", () => {
  const first = makeTape("0123456789abcdef");
  const second = makeTape("fedcba9876543210");
  const input = first.tape.split("\n").find((line) => line.startsWith("Type "));
  assert.ok(!input.includes(first.marker));
  assert.ok(first.tape.includes(`Wait+Screen@5s /${first.marker}/`));
  assert.notEqual(first.marker, second.marker);
  assert.ok(!first.tape.includes(second.marker));
  assert.throws(() => makeTape('"\nEnter'), /Assertion/);
});
