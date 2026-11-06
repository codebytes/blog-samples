import assert from "node:assert/strict";
import test from "node:test";
import { apiTarget } from "../catalog/web/proxy-config.mjs";
import { makeTape } from "../scripts/terminal-smoke.mjs";

test("Vite reads the API_HTTP endpoint supplied by the Aspire reference", () => {
  assert.equal(apiTarget({ API_HTTP: "http://localhost:43210/" }), "http://localhost:43210");
  assert.equal(apiTarget({ API_HTTP: "https://api.example.test/" }), "https://api.example.test");
});

test("Vite requires API_HTTP rather than using a localhost or legacy fallback", () => {
  for (const environment of [{}, { API_HTTP: "" }, { API_BASE_URL: "http://localhost:43210/" }]) {
    assert.throws(() => apiTarget(environment), /API_HTTP is required/);
  }
});

test("Vite rejects invalid API_HTTP origins", () => {
  for (const value of ["relative", "ftp://api", "http://user:secret@api", "http://api/path", "http://api/?key=secret"]) {
    assert.throws(() => apiTarget({ API_HTTP: value }), /API_HTTP must/);
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
