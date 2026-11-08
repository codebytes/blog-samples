# 4. Agents with evidence

Use a dedicated checkout/worktree and the [sample prerequisites](../../README.md).
Never share another session's checkout or stop unrelated AppHosts.

## Start the catalog

Use Aspire CLI and AppHost SDK **13.6.4**. Run from `aspire-field-notes/`;
initialize the secret only if you have not completed the sample's setup.
Stop only an earlier catalog run you own before starting this one.

```bash
node scripts/init-secret.mjs
apphost=catalog/Catalog.AppHost/Catalog.AppHost.csproj
Inventory__FaultEnabled=true aspire start \
  --apphost "$apphost" --isolated --non-interactive
aspire wait web --apphost "$apphost" --status healthy --timeout 120 --non-interactive
aspire describe --apphost "$apphost" --format Table --non-interactive
```

Wait for `web`, because the request uses its frontend proxy. A startup or
readiness failure is a blocker, not the intended HTTP failure. Keep the table
inventory; JSON environment values can expose database connection credentials.

## Give the agent one request

You do not need to run **Load catalog** yourself first. Give the agent this task:

```text
Work only in this sample's checkout. Use Aspire CLI 13.6.4 and select
catalog/Catalog.AppHost/Catalog.AppHost.csproj explicitly.
The catalog is running with Inventory__FaultEnabled=true.

Inspect resource health with describe --format Table, then run once:
aspire resource web load-catalog \
  --apphost catalog/Catalog.AppHost/Catalog.AppHost.csproj \
  --non-interactive
Report its nonzero exit, HTTP status, problem title, and returned trace ID.

Reject a missing or empty trace ID. Query aspire otel spans and
aspire otel logs with --trace-id set to that ID, the same --apphost path,
--format Json, and --non-interactive. If telemetry is incomplete, repeat
only those queries for the same ID for at most 30 seconds.
Do not rerun the request.

Verify the API server, its successful PostgreSQL query, exactly one
inventory HTTP client, and that client's inventory server child.
Show span IDs, parent IDs, and HTTP statuses. Identify where 503
originated and distinguish inventory's problem title from the API's.
Correlate the fault setting with inventory and API warnings.

Identify the pinned dashboard run retaining this request. If viewing
or pinning needs a human action, report it as pending, not completed.
Stop after the evidence report and name any missing checks.

Do not edit code or configuration, disable the fault, add retries,
fake success, weaken checks, deploy, reset databases, delete volumes,
alter another session's processes, or reveal credentials.
```

**Expected:** one `GET /api/catalog` through `web` returns HTTP 503,
`Inventory unavailable`, and a trace ID, with `dependencyStatus: 503`.
The CLI exits nonzero. A different failure or a missing ID is a blocker;
do not hide it with `|| true`. The command reports the response, not a verified
trace. MCP is optional; select this AppHost before using its tools.

## Check and retain the evidence

To check the agent's report yourself, copy its actual returned trace ID.
Do not create another request:

```bash
trace_id="<trace ID returned by Load catalog>"
: "${trace_id:?Set trace_id to the trace ID returned by Load catalog}" && \
  aspire otel spans --trace-id "$trace_id" --apphost "$apphost" \
    --format Json --non-interactive && \
  aspire otel logs --trace-id "$trace_id" --apphost "$apphost" \
    --format Json --non-interactive
```

Keep the guard and both queries in one `&&` chain. In interactive Bash or zsh,
a failed standalone guard does not stop later pasted commands; an empty
`--trace-id` can return unfiltered telemetry. Export is asynchronous: if the
first result is empty or incomplete, wait a few seconds and repeat these queries
for the **same trace ID**, for at most 30 seconds. Do not invoke **Load catalog**
again to fill in evidence; that creates a different request. After the deadline,
report the missing spans or logs rather than claiming the expected chain was observed.

The PostgreSQL query and inventory HTTP client must be children of the API
server span; the inventory server must be a child of that client span.
The database query succeeds while the three HTTP spans report 503.
Inventory originates the failure with `Intentional inventory outage`;
the API passes it back as `Inventory unavailable` without retrying.
Both services stay healthy because the fault does not affect `/health`.

Before the final handoff or stopping, follow the
[live viewing and pinning steps](../01-keep-the-failing-run/).
Open resource inventory and both API and inventory Console logs, then pin the
failing run. CLI console-log reads do not retain those streams in dashboard
history. If the agent cannot perform the dashboard actions, complete them
yourself or report retained evidence as pending. Record the pinned run ID;
CLI telemetry queries still read the live run, not a browser-selected history.

If you need to locate a recent failure, limit the query:

```bash
aspire otel traces api --apphost "$apphost" --has-error --limit 5 --non-interactive
```

## Repeatable regression checks

After retaining the evidence, stop only this run before optional regression checks:

```bash
aspire stop --apphost "$apphost" --non-interactive
bash scripts/check.sh
```

Node tests cover proxy/configuration and CLI/publication checks. .NET tests
cover configuration, retained state, AppHost models, and tape/terminal mechanics.
Neither replaces the live request and span checks above.
Changing the fault is a separate [recovery exercise](../01-keep-the-failing-run/),
not an agent repairing an unknown bug. For a later authorized code change,
discover resource commands with `aspire resource api --help --apphost "$apphost"`;
`rebuild` recompiles source, while `restart` does not.

## Optional guidance setup

Skip this if the agent already has Aspire guidance. Use the installed CLI;
do not enable remote skill fetching or override `aspireSkillsVersion`.

**Read before running:** `github` scopes skill files to the workspace, but
`agent init` also registers user-level telemetry hooks for supported agents.
`ASPIRE_CLI_TELEMETRY_OPTOUT=true` suppresses transmission while set; it does
not prevent hook registration or disable later hooks. Accept those changes
explicitly or use a disposable user profile.

```bash
ASPIRE_CLI_TELEMETRY_OPTOUT=true aspire agent init \
  --workspace-root "$PWD/catalog" \
  --skill-locations github \
  --skills aspire,aspire-orchestration,aspire-monitoring \
  --mcp=false --non-interactive
```

- Review generated `catalog/.github/skills/` before adoption; they are
  ignored here.
- `standard` also writes `~/.agents/skills`; `github` does not.
- `--mcp=false` skips new MCP setup, not existing connections or deprecated
  workspace configuration migrations.
- Named skills avoid optional tooling selected by `--skills all`; deselecting
  skills or locations is not a general uninstall.

The installed CLI's help and this collection take precedence over historical
repository guidance. Tagged 13.6.4 references:
[locations](https://github.com/microsoft/aspire/blob/v13.6.4/src/Aspire.Cli/Agents/SkillLocation.cs),
[setup](https://github.com/microsoft/aspire/blob/v13.6.4/src/Aspire.Cli/Commands/AgentInitCommand.cs),
[user-level hooks](https://github.com/microsoft/aspire/blob/v13.6.4/src/Aspire.Cli/Agents/Hooks/TelemetryHookConfigurator.cs).
