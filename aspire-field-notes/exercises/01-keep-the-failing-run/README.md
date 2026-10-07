# 1. Keep the failing run

Start with the [collection prerequisites and setup](../../README.md). Run these
commands from `aspire-field-notes/`.

## Baseline, then a real failing request

```bash
apphost=catalog/Catalog.AppHost/Catalog.AppHost.csproj
bash scripts/aspire.sh start --apphost "$apphost" --isolated --non-interactive
node scripts/smoke.mjs healthy

bash scripts/aspire.sh stop --apphost "$apphost" --non-interactive
Inventory__FaultEnabled=true bash scripts/aspire.sh start \
  --apphost "$apphost" --isolated --non-interactive
node scripts/smoke.mjs fault
```

The second check expects **HTTP 503**, not 200. It first verifies the API, web, and
inventory `/health` endpoints remain healthy. Then it verifies that the catalog
request read PostgreSQL and made exactly one downstream HTTP request: the API
server span parents an HTTP client span, which parents inventory's server span.
All three HTTP spans report 503. Removing the call, changing the expected status,
or adding retries is not a fix for this exercise.

Open the current **web** URL from the dashboard and select **Load catalog**. The
page shows the failure and its trace ID, not a made-up frontend error. There are no
stale successful rows left on screen after a failed load.

## Keep the evidence before recovery

The smoke script prints a trace ID and an `artifacts/fault-<trace-id>/` directory.
It already captures console logs, structured logs, and spans. To explore manually:

```bash
bash scripts/aspire.sh describe --apphost "$apphost" --format Json --non-interactive
bash scripts/aspire.sh logs api --apphost "$apphost" --tail 40 --non-interactive
bash scripts/aspire.sh logs inventory --apphost "$apphost" --tail 40 --non-interactive
bash scripts/aspire.sh otel traces api --apphost "$apphost" --has-error --non-interactive

# Substitute the trace ID printed by the smoke check.
trace_id=REPLACE_WITH_TRACE_ID
bash scripts/aspire.sh otel spans --apphost "$apphost" --trace-id "$trace_id" --format Json --non-interactive
bash scripts/aspire.sh otel logs --apphost "$apphost" --trace-id "$trace_id" --format Json --non-interactive
```

In the dashboard, open **Select run**, then **Pin run** on the failing live run.
The run contains the failure logs, spans, and resource history. Aspire 13.6 **run
mode retains old runs by default**; pinning is a retention choice, not the switch
that turns history on. Avoid cleaning the AppHost store between these steps.

## Recover, then compare

```bash
bash scripts/aspire.sh stop --apphost "$apphost" --non-interactive
Inventory__FaultEnabled=false bash scripts/aspire.sh start \
  --apphost "$apphost" --isolated --non-interactive
node scripts/smoke.mjs recovery
```

Open the new dashboard URL. Use **Select run** to compare the pinned failure with
the new live run. The same call path now has 200 responses and three products;
the old failure is still inspectable. Historical resources are evidence, not live
processes that can be restarted.

This is a controlled recovery experiment: disabling an intentional configuration
fault demonstrates recovery, not diagnosis of an unknown bug. Finish with the
collection's scoped `stop` command.

Reference: [Aspire dashboard data persistence](https://aspire.dev/dashboard/data-persistence/).
