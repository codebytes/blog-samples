# 2. Model the whole app

Use the [shared catalog setup](../../README.md), then:

```bash
apphost=catalog/Catalog.AppHost/Catalog.AppHost.csproj
aspire start --apphost "$apphost" --isolated --non-interactive
aspire wait catalogdb --apphost "$apphost" --status healthy --timeout 120 --non-interactive
aspire wait api --apphost "$apphost" --status healthy --timeout 120 --non-interactive
aspire wait web --apphost "$apphost" --status healthy --timeout 120 --non-interactive
node scripts/smoke.mjs healthy
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
a hard-coded API port. Open the smoke check's `spans.json`: the trace begins at
the instrumented API and includes inventory and the database; Vite does not emit
application spans in this sample.

Now run the [503 walkthrough](../01-keep-the-failing-run/). Its unchanged green health
checks prove why configuration, readiness, and successful requests are different
claims.

Java/Rust preview integrations and Project V2 are optional article comparisons,
not prerequisites or unimplemented required resources in this app.
