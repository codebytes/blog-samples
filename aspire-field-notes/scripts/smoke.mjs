import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { aspire, endpoints, jsonRequest, root } from "./apphost.mjs";

export function assertTrace(spans, traceId, status) {
  assert.ok(spans.length > 0, "The request's trace has not arrived.");
  assert.ok(spans.every((span) => span.traceId === traceId), "Unexpected trace in evidence.");
  const api = spans.find((span) => span.source === "api" && span.kind === "Server" &&
    span.attributes["http.route"] === "/api/catalog");
  const clients = spans.filter((span) => span.source === "api" && span.kind === "Client" &&
    span.attributes["url.full"]?.endsWith("/inventory"));
  const inventory = spans.find((span) => span.source === "inventory" && span.kind === "Server" &&
    span.attributes["http.route"] === "/inventory");
  const database = spans.find((span) => span.source === "api" && span.attributes["db.namespace"] === "catalogdb");
  assert.ok(api && inventory && database, "Need API, inventory, and database spans, not just a frontend error.");
  assert.equal(clients.length, 1, "Exactly one downstream HTTP attempt is required; retries hide this exercise.");
  assert.equal(clients[0].parentSpanId, api.spanId);
  assert.equal(inventory.parentSpanId, clients[0].spanId);
  for (const span of [api, clients[0], inventory]) {
    assert.equal(Number.parseInt(span.attributes["http.response.status_code"], 10), status);
  }
}

async function smoke(mode) {
  assert.ok(["healthy", "fault", "recovery"].includes(mode), "Usage: node scripts/smoke.mjs healthy|fault|recovery");
  for (const resource of ["catalogdb", "inventory", "api", "web"]) {
    aspire(["wait", resource, "--status", "healthy", "--timeout", "120"], 135_000);
  }
  const urls = endpoints();
  for (const url of Object.values(urls)) {
    const health = await fetch(new URL("/health", url), { signal: AbortSignal.timeout(10_000) });
    assert.equal(health.status, 200, "Health must stay green, including during the business-request fault.");
    assert.equal(await health.text(), "Healthy");
  }

  const { response, body } = await jsonRequest(urls.web, "/api/catalog");
  const status = mode === "fault" ? 503 : 200;
  assert.equal(response.status, status);
  assert.match(body.traceId, /^[a-f0-9]{32}$/);
  if (mode === "fault") {
    assert.equal(body.dependencyStatus, 503);
    assert.equal(body.title, "Inventory unavailable");
  } else {
    assert.equal(body.items.length, 3);
    assert.deepEqual(body.items.map((item) => item.sku), ["mug", "notebook", "sticker"]);
    assert.deepEqual(body.items.map((item) => item.quantity), [8, 12, 30]);
    assert.ok(body.items.every((item) => typeof item.price === "number" && item.price > 0));
    assert.ok(body.region.length > 0);
  }

  let spans = [];
  // Wait only for asynchronous telemetry export; never retry the business request.
  for (let attempt = 0; attempt < 10; attempt++) {
    spans = JSON.parse(aspire(["otel", "spans", "--trace-id", body.traceId, "--format", "Json"]));
    if (spans.some((span) => span.source === "inventory" && span.kind === "Server") &&
        spans.some((span) => span.source === "api" && span.kind === "Server")) break;
    await setTimeout(1_000);
  }
  assertTrace(spans, body.traceId, status);
  const directory = resolve(root, "artifacts", `${mode}-${body.traceId}`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "request.json"), JSON.stringify({ mode, status, body }, null, 2));
  writeFileSync(resolve(directory, "spans.json"), JSON.stringify(spans, null, 2));
  for (const resource of ["api", "inventory"]) {
    writeFileSync(resolve(directory, `${resource}-console.json`),
      aspire(["logs", resource, "--tail", "40", "--format", "Json"]));
  }
  writeFileSync(resolve(directory, "structured-logs.json"),
    aspire(["otel", "logs", "--trace-id", body.traceId, "--format", "Json"]));
  console.log(`PASS ${mode}: HTTP ${status}, healthy resources, Postgres read, one correlated inventory call.`);
  console.log(`Trace ${body.traceId}; evidence: artifacts/${mode}-${body.traceId}/`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await smoke(process.argv[2]);
}
