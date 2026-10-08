# 4. Agents with evidence

Use a dedicated checkout/worktree and the [sample prerequisites](../../README.md).
Never share another session's checkout or stop unrelated AppHosts.

## Optional guidance setup

Use the installed Aspire CLI directly. Setup installs the Aspire workflow skills;
inspect the generated guidance before adopting it. Do not turn on remote skill
fetching or override `aspireSkillsVersion` for this walkthrough.

**Read before running:** `github` installs skill files into the selected workspace,
whereas `standard` also writes `~/.agents/skills`. In addition,
`agent init` registers user-level telemetry hooks for detected supported
agents. `ASPIRE_CLI_TELEMETRY_OPTOUT=true` disables telemetry transmission while
set; it **does not prevent hook registration**. Run this optional setup only if
you accept those user-level configuration changes, or use an environment with a
disposable user profile. It is not required to run the resource command or checks.

```bash
ASPIRE_CLI_TELEMETRY_OPTOUT=true aspire agent init \
  --workspace-root "$PWD/catalog" \
  --skill-locations github \
  --skills aspire,aspire-init,aspireify,aspire-orchestration,aspire-monitoring,aspire-deployment,aspire-project-v2-migration \
  --mcp=false --non-interactive
```

Explicit skill names avoid the unrelated optional tooling installs triggered by
`--skills all`. `--mcp=false` skips new MCP configuration and does not remove
existing connections. Setup can still rewrite deprecated `aspire mcp start`
entries in the workspace's MCP files to `aspire agent mcp`.
Inspect generated `catalog/.github/skills/` before adopting it; these files are
ignored here. Re-running setup does not remove workflow skills from locations
you later deselect. Playwright's same-run temporary-folder cleanup is not a
general skill uninstall mechanism.
Existing repository-wide guidance is historical: where examples differ, use the
installed CLI's help and the commands verified in this collection. In particular,
`describe --apphost ...` inspects resources; `ps` lists AppHosts.

Tagged implementation references:
[locations](https://github.com/microsoft/aspire/blob/v13.6.1/src/Aspire.Cli/Agents/SkillLocation.cs),
[setup and hook registration](https://github.com/microsoft/aspire/blob/v13.6.1/src/Aspire.Cli/Commands/AgentInitCommand.cs).

## A bounded investigation

```bash
node scripts/init-secret.mjs
apphost=catalog/Catalog.AppHost/Catalog.AppHost.csproj
Inventory__FaultEnabled=true aspire start \
  --apphost "$apphost" --isolated --non-interactive
aspire wait web --apphost "$apphost" --status healthy --timeout 120 --non-interactive
aspire resource web load-catalog --apphost "$apphost" --non-interactive
```

Give an agent this bounded task:

> Work only in this sample's checkout and select
> `catalog/Catalog.AppHost/Catalog.AppHost.csproj` explicitly. Explain the
> configured `/api/catalog` failure using resource health, console/structured logs,
> and the request's trace. Identify which HTTP server first returned 503 and show
> the parent-child span chain. Run `aspire resource web load-catalog --apphost
> catalog/Catalog.AppHost/Catalog.AppHost.csproj --non-interactive` and report the
> expected command failure, HTTP status, problem title, and trace ID. Use
> `aspire otel spans --trace-id <returned-id> --apphost
> catalog/Catalog.AppHost/Catalog.AppHost.csproj --format Json` and
> `aspire otel logs --trace-id <returned-id> --apphost
> catalog/Catalog.AppHost/Catalog.AppHost.csproj --format Json` to verify the API
> server, exactly one inventory HTTP client, its inventory server child, and the
> PostgreSQL query. Identify the pinned dashboard run that retains the evidence.
> Do not remove the fault, add retries, fake a success response, skip the span
> checks, provision cloud resources, or alter another session's processes.
> Stop after the evidence report.

The command makes one request; it does not verify the trace for the agent.
Its intentional **503** is a nonzero CLI exit, not an infrastructure startup
failure. Use `aspire describe --apphost "$apphost" --format Table` to check health
separately. A report saying only "the app started" or "all resources are green" is
incomplete. Use the [live viewing and pinning steps](../01-keep-the-failing-run/)
to retain resources and console logs along with the trace. With MCP enabled
separately, select this AppHost before using the resource and telemetry tools.

## Repeatable regression checks

Stop this sample's AppHosts before rebuilding:

```bash
aspire stop --apphost "$apphost" --non-interactive
bash scripts/check.sh
```

The Node tests reject missing proxy configuration and terminal input-echo matches.
They also check the terminal's symlinked entrypoint, missing-AppHost errors, and
stale publication reviews. Request-level success and the no-retry trace chain are
checked using **Load catalog** and `aspire otel`, not inferred from unit tests.
The .NET tests cover retained state, concurrent single-process writes, corrupt
state, and missing configuration. Follow the separate [recovery walkthrough](../01-keep-the-failing-run/)
to verify recovery explicitly; do not mislabel it as an agent repairing an unknown bug.
