import assert from "node:assert/strict";
import test from "node:test";
import { apiTarget } from "../catalog/web/proxy-config.mjs";
import { makeTape } from "../scripts/terminal-smoke.mjs";
import { assertTrace } from "../scripts/smoke.mjs";

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

test("evidence rejects a UI-only failure, broken propagation, and concealed retries", () => {
  const spans = [
    { traceId: "trace", spanId: "api", source: "api", kind: "Server",
      attributes: { "http.route": "/api/catalog", "http.response.status_code": "503 Service Unavailable" } },
    { traceId: "trace", spanId: "client", parentSpanId: "api", source: "api", kind: "Client",
      attributes: { "url.full": "http://inventory/inventory", "http.response.status_code": "503 Service Unavailable" } },
    { traceId: "trace", spanId: "inventory", parentSpanId: "client", source: "inventory", kind: "Server",
      attributes: { "http.route": "/inventory", "http.response.status_code": "503 Service Unavailable" } },
    { traceId: "trace", source: "api", kind: "Client", attributes: { "db.namespace": "catalogdb" } },
  ];
  assert.doesNotThrow(() => assertTrace(spans, "trace", 503));
  assert.throws(() => assertTrace(spans.slice(0, 1), "trace", 503), /Need API, inventory, and database spans/);
  assert.throws(() => assertTrace([...spans, spans[1]], "trace", 503), /Exactly one downstream/);
  assert.throws(() => assertTrace(spans, "trace", 200), /Assertion/);
  const broken = structuredClone(spans);
  broken[2].parentSpanId = "unrelated";
  assert.throws(() => assertTrace(broken, "trace", 503), /Assertion/);
});
