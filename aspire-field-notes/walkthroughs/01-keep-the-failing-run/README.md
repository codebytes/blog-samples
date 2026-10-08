# 1. Keep the failing run

Start with the [collection prerequisites and setup](../../README.md). Run these
commands from `aspire-field-notes/`.

## Baseline, then a real failing request

```bash
apphost=catalog/Catalog.AppHost/Catalog.AppHost.csproj
aspire start --apphost "$apphost" --isolated --non-interactive
aspire wait web --apphost "$apphost" --status healthy --timeout 120 --non-interactive
aspire resource web load-catalog --apphost "$apphost" --non-interactive

aspire stop --apphost "$apphost" --non-interactive
Inventory__FaultEnabled=true aspire start \
  --apphost "$apphost" --isolated --non-interactive
aspire wait web --apphost "$apphost" --status healthy --timeout 120 --non-interactive
aspire resource web load-catalog --apphost "$apphost" --non-interactive
```

The healthy command succeeds with JSON containing `status: 200`, `traceId`, and
`response.items` with three products. The second command deliberately **fails with HTTP 503**: its
message includes **Inventory unavailable** and the trace ID, and its JSON body
contains the problem details. The CLI exits nonzero for that expected failure;
do not hide it or retry the request to force success.

In the dashboard, the **web** row has a highlighted **Load catalog** action.
Selecting it sends the same one-shot request through the frontend's `/api` proxy.
The notification reports success or failure; **View response** opens the JSON
result (`status`, `traceId`, and the API JSON under `response`); open
**Notifications** if the toast has disappeared. Each click or
CLI invocation creates a new request and trace. The frontend
page's own **Load catalog** button remains available, but is a separate caller.

## Keep the evidence before recovery

Use the failed command's trace ID to locate the request in the dashboard's
**Traces** page. The command does not export an evidence folder or automatically
assert the span chain. Check the resource health and correlate the logs and spans:

```bash
aspire describe --apphost "$apphost" --format Table --non-interactive
aspire logs api --apphost "$apphost" --tail 40 --non-interactive
aspire logs inventory --apphost "$apphost" --tail 40 --non-interactive
aspire otel traces api --apphost "$apphost" --has-error --non-interactive

# Assign the trace ID returned by Load catalog to trace_id before these commands.
: "${trace_id:?Set trace_id to the trace ID returned by Load catalog}" && \
  aspire otel spans --apphost "$apphost" --trace-id "$trace_id" --format Json --non-interactive && \
  aspire otel logs --apphost "$apphost" --trace-id "$trace_id" --format Json --non-interactive
```

Confirm all four parts of the same trace:

| Span | What to verify |
| --- | --- |
| API server, `GET /api/catalog` | The returned trace ID and HTTP 503 |
| API HTTP client, `GET` with `url.full` ending in `/inventory` | Exactly one attempt; its `parentSpanId` matches the API server's `spanId`; HTTP 503 |
| Inventory server, `GET /inventory` | Its `parentSpanId` matches that HTTP client's `spanId`; HTTP 503 |
| PostgreSQL client query | `db.namespace=catalogdb` and the `SELECT ... FROM catalog_items` query |

`aspire describe` should still show **Healthy** for API, inventory, web, and the
database. Health and successful business requests are different claims. Telemetry
export is asynchronous: if the spans have not arrived yet, repeat the telemetry
query, not **Load catalog**, so you keep inspecting the same request.

Keep that guard and both telemetry commands as one `&&` chain. In interactive
Bash or zsh, a failing standalone guard does not prevent subsequently pasted
commands from running; an empty `--trace-id` can return unfiltered telemetry.

Before pinning or stopping, open the dashboard's **Console logs** page for **api**
and then for **inventory** while the failing run is live, and check that each
shows its 503 message. Console-log persistence starts when that resource is
viewed in the dashboard. CLI `aspire logs` does **not** activate it.

Open the run selector in the dashboard header, which shows **Live run**, and
select **Pin run** on the failing run. Spans and structured logs are retained for
every run, within telemetry retention limits. The latest resource snapshot exists
only if the dashboard was opened in a browser during that run. Console logs are
retained only for resources viewed or exported live in the dashboard, as described
above. A headless run can have traces and structured logs but show **No resources
found** when reopened. Aspire 13.6 **run mode retains old runs by default**;
pinning is a retention choice, not the switch that turns history on.
The pinned run is the walkthrough's evidence record.

History lives in `~/.aspire/dashboard/runs` and is keyed by application name
**Catalog**, not by checkout path. Other Catalog checkouts count toward the same
10 unpinned runs. Do not clean that shared history between these steps. This is
separate from application files under the AppHost's `obj/.aspire/volumes/`.

## Recover, then compare

```bash
aspire stop --apphost "$apphost" --non-interactive
Inventory__FaultEnabled=false aspire start \
  --apphost "$apphost" --isolated --non-interactive
aspire wait web --apphost "$apphost" --status healthy --timeout 120 --non-interactive
aspire resource web load-catalog --apphost "$apphost" --non-interactive
```

Open the new dashboard URL. Use the header's run selector to compare the pinned
failure with **Live run**. Verify the old trace and structured logs, plus the
**api** and **inventory** console logs you viewed before stopping. The same call
path now has 200 responses and three products. Verify its new trace has the same
four-part call chain and exactly one inventory HTTP attempt; the old failure remains
inspectable. Historical resources are evidence, not live processes that can be
restarted.

This is a controlled recovery experiment: disabling an intentional configuration
fault demonstrates recovery, not diagnosis of an unknown bug. Finish with the
collection's scoped `stop` command.

Reference: [Aspire dashboard data persistence](https://aspire.dev/dashboard/data-persistence/).
