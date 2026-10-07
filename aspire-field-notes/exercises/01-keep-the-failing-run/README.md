# 1. Keep the failing run

Start with the [collection prerequisites and setup](../../README.md). Run these
commands from `aspire-field-notes/`.

## Baseline, then a real failing request

```bash
apphost=catalog/Catalog.AppHost/Catalog.AppHost.csproj
aspire start --apphost "$apphost" --isolated --non-interactive
node scripts/smoke.mjs healthy

aspire stop --apphost "$apphost" --non-interactive
Inventory__FaultEnabled=true aspire start \
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
It captures console logs, structured logs, and spans even if a response assertion
fails. These exported files are separate from dashboard persistence.
To explore manually:

```bash
aspire describe --apphost "$apphost" --format Table --non-interactive
aspire logs api --apphost "$apphost" --tail 40 --non-interactive
aspire logs inventory --apphost "$apphost" --tail 40 --non-interactive
aspire otel traces api --apphost "$apphost" --has-error --non-interactive

# Assign the printed trace ID to trace_id in your shell before these commands.
: "${trace_id:?Set trace_id to the trace ID printed by the fault smoke check}" && \
  aspire otel spans --apphost "$apphost" --trace-id "$trace_id" --format Json --non-interactive && \
  aspire otel logs --apphost "$apphost" --trace-id "$trace_id" --format Json --non-interactive
```

Keep that guard and both telemetry commands as one `&&` chain. In interactive
Bash or zsh, a failing standalone guard does not prevent subsequently pasted
commands from running; an empty `--trace-id` can return unfiltered telemetry.

Before pinning or stopping, open the dashboard's **Console logs** page for **api**
and then for **inventory** while the failing run is live, and check that each
shows its 503 message. Console-log persistence starts when that resource is
viewed in the dashboard. `aspire logs` and the smoke artifact export do **not**
activate it.

Open the run selector in the dashboard header, which shows **Live run**, and
select **Pin run** on the failing run. Spans and structured logs are retained for
every run, within telemetry retention limits. The latest resource snapshot exists
only if the dashboard was opened in a browser during that run. Console logs are
retained only for resources viewed or exported live in the dashboard, as described
above. A headless run can have traces and structured logs but show **No resources
found** when reopened. Aspire 13.6 **run mode retains old runs by default**;
pinning is a retention choice, not the switch that turns history on.

History lives in `~/.aspire/dashboard/runs` and is keyed by application name
**Catalog**, not by checkout path. Other Catalog checkouts count toward the same
10 unpinned runs. Do not clean that shared history between these steps. This is
separate from application files under the AppHost's `obj/.aspire/volumes/`.

## Recover, then compare

```bash
aspire stop --apphost "$apphost" --non-interactive
Inventory__FaultEnabled=false aspire start \
  --apphost "$apphost" --isolated --non-interactive
node scripts/smoke.mjs recovery
```

Open the new dashboard URL. Use the header's run selector to compare the pinned
failure with **Live run**. Verify the old trace and structured logs, plus the
**api** and **inventory** console logs you viewed before stopping. The same call
path now has 200 responses and three products; the old failure remains
inspectable. Historical resources are evidence, not live processes that can be
restarted.

This is a controlled recovery experiment: disabling an intentional configuration
fault demonstrates recovery, not diagnosis of an unknown bug. Finish with the
collection's scoped `stop` command.

Reference: [Aspire dashboard data persistence](https://aspire.dev/dashboard/data-persistence/).
