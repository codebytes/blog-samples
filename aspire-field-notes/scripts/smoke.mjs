import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { aspire, endpoints, root } from "./apphost.mjs";

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
  const expectedStatus = mode === "fault" ? 503 : 200;
  const request = { mode, expectedStatus, status: null, traceId: null, body: null };
  let directory = resolve(root, "artifacts", `${mode}-no-trace-${randomUUID()}`);
  let spans = [];
  const failures = [];
  const saveRequest = () => {
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, "request.json"), JSON.stringify(request, null, 2));
    writeFileSync(resolve(directory, "spans.json"), JSON.stringify(spans, null, 2));
  };

  try {
    for (const resource of ["catalogdb", "inventory", "api", "web"]) {
      aspire(["wait", resource, "--status", "healthy", "--timeout", "120"], 135_000);
    }
    const urls = endpoints();
    for (const url of Object.values(urls)) {
      const health = await fetch(new URL("/health", url), { signal: AbortSignal.timeout(10_000) });
      assert.equal(health.status, 200, "Health must stay green, including during the business-request fault.");
      assert.equal(await health.text(), "Healthy");
    }

    const response = await fetch(new URL("/api/catalog", urls.web), { signal: AbortSignal.timeout(10_000) });
    request.status = response.status;
    request.body = await response.text();
    const body = JSON.parse(request.body);
    request.body = body;
    if (typeof body?.traceId === "string" && /^[a-f0-9]{32}$/.test(body.traceId)) {
      request.traceId = body.traceId;
      directory = resolve(root, "artifacts", `${mode}-${request.traceId}`);
    }
    saveRequest();

    if (request.traceId) {
      // Wait only for asynchronous telemetry export; never retry the business request.
      for (let attempt = 0; attempt < 10; attempt++) {
        spans = JSON.parse(aspire(["otel", "spans", "--trace-id", request.traceId, "--format", "Json"]));
        saveRequest();
        if (spans.some((span) => span.source === "inventory" && span.kind === "Server") &&
            spans.some((span) => span.source === "api" && span.kind === "Server")) break;
        await setTimeout(1_000);
      }
    }

    assert.equal(response.status, expectedStatus,
      `${mode}: expected HTTP ${expectedStatus}, observed HTTP ${response.status}.`);
    assert.ok(request.traceId, "The catalog response must include a valid trace ID.");
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
    assertTrace(spans, request.traceId, expectedStatus);
  } catch (error) {
    failures.push(error);
  } finally {
    saveRequest();
    const captures = ["api", "inventory"].map(resource =>
      [`${resource}-console`, ["logs", resource, "--tail", "40", "--format", "Json"]]);
    if (request.traceId) {
      captures.push(["structured-logs", ["otel", "logs", "--trace-id", request.traceId, "--format", "Json"]]);
    }
    for (const [name, args] of captures) {
      try {
        writeFileSync(resolve(directory, `${name}.json`), aspire(args));
      } catch (error) {
        writeFileSync(resolve(directory, `${name}.error.txt`), error.message);
        failures.push(new Error(`Could not capture ${name}; see ${name}.error.txt.`, { cause: error }));
      }
    }
  }

  const evidence = relative(root, directory);
  if (failures.length) {
    throw new AggregateError(failures,
      `FAIL ${mode}: expected HTTP ${expectedStatus}, observed ${request.status ?? "no response"}; trace ${request.traceId ?? "unavailable"}; evidence: ${evidence}/`);
  }
  console.log(`PASS ${mode}: HTTP ${expectedStatus}, healthy resources, Postgres read, one correlated inventory call.`);
  console.log(`Trace ${request.traceId}; evidence: ${evidence}/`);
}

if (process.argv[1] && existsSync(process.argv[1]) &&
    realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  await smoke(process.argv[2]);
}
