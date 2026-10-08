# 2. Model the whole app

Use the [shared catalog setup](../../README.md), then:

```bash
apphost=catalog/Catalog.AppHost/Catalog.AppHost.csproj
aspire start --apphost "$apphost" --isolated --non-interactive
aspire wait catalogdb --apphost "$apphost" --status healthy --timeout 120 --non-interactive
aspire wait api --apphost "$apphost" --status healthy --timeout 120 --non-interactive
aspire wait web --apphost "$apphost" --status healthy --timeout 120 --non-interactive
aspire resource web load-catalog --apphost "$apphost" --non-interactive
```

Inspect [`AppHost.cs`](../../catalog/Catalog.AppHost/AppHost.cs), then open the
dashboard's resource graph. Trace three independent concerns:

| Concern | Actual sample code | What it does not imply |
| --- | --- | --- |
| Configuration | API `.WithReference(catalogdb)` and `.WithReference(inventory)` | Does not wait for startup or instrument a client |
| Readiness | `.WaitFor(catalogdb)`, `.WaitFor(inventory)`, `.WaitFor(api)`, and real `/health` probes | Does not guarantee every later business request succeeds |
| Telemetry | [`ServiceDefaults`](../../catalog/ServiceDefaults/Extensions.cs), `Aspire.Npgsql`, ASP.NET Core and HTTP instrumentation | Not automatically added to every language merely by hosting it |

`api` waits for an actual, healthy `catalogdb`, not just a running server process.
It creates and seeds `catalog_items` before it accepts traffic; its database health
check participates in `/health`. Vite has an explicit `/health` middleware, not
a catch-all HTML page mistaken for a readiness probe.

## Follow the frontend route

The AppHost derives `API_BASE_URL` from `api.GetEndpoint("http")`. The Vite config
uses that value **on the Node server** as the `/api` proxy target. The browser
only calls `/api/catalog` and `/api/state`.
The dashboard's **web > Load catalog** action also uses the web endpoint and
returns the HTTP status, trace ID, and JSON response; it does not bypass Vite.

```bash
# Demonstrate the fail-fast proxy contract without starting another server.
node --test tests/scripts.test.mjs

aspire describe --apphost "$apphost" --format Table --non-interactive
```

Compare the current API URL with the `API_BASE_URL` environment entry for **web**
in the dashboard. Do not copy secrets or the entire environment into a report.
Raw `describe --format Json` can expose the password embedded in the API's
`ConnectionStrings__catalogdb` and `CATALOGDB_URI`; parameter redaction does not
make those fields safe. Use the table inventory above.
In the browser's Network panel, a catalog request goes to the **web origin**, not
a hard-coded API port. Find the command's trace ID in the dashboard, or query it:

```bash
: "${trace_id:?Set trace_id to the trace ID returned by Load catalog}" && \
  aspire otel spans --trace-id "$trace_id" --apphost "$apphost" --format Json --non-interactive
```

Verify the API server span, exactly one HTTP client span to inventory, its
inventory server child, and the PostgreSQL query. Vite does not emit application
spans in this sample. Follow [Walkthrough 01](../01-keep-the-failing-run/) to pin
the run and retain the diagnostic evidence.

Now run the [503 walkthrough](../01-keep-the-failing-run/). Its unchanged green health
checks prove why configuration, readiness, and successful requests are different
claims.

Java/Rust preview integrations and Project V2 are optional article comparisons,
not prerequisites or unimplemented required resources in this app.
