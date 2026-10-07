# 4. Agents with evidence

Use a dedicated checkout/worktree and the [pinned sample tooling](../../README.md).
Never share another session's checkout or stop unrelated AppHosts.

## Optional, version-pinned guidance setup

The wrapper requires CLI 13.6.1. That release normally uses its embedded, verified
Aspire workflow-skill snapshot; do not turn on remote skill fetching or set a
different `aspireSkillsVersion` for this exercise.

**Read before running:** `github` installs skill files into the selected workspace,
whereas 13.6's `standard` location also writes `~/.agents/skills`. In addition,
13.6 `agent init` registers user-level telemetry hooks for detected supported
agents. `ASPIRE_CLI_TELEMETRY_OPTOUT=true` disables telemetry transmission while
set; it **does not prevent hook registration**. Run this optional setup only if
you accept those user-level configuration changes, or use an environment with a
disposable user profile. It is not required for the smoke checks.

```bash
ASPIRE_CLI_TELEMETRY_OPTOUT=true bash scripts/aspire.sh agent init \
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
13.6 CLI's help and the commands verified in this collection. In particular,
`describe --apphost ...` inspects resources; `ps` lists AppHosts.

Tagged implementation references:
[locations](https://github.com/microsoft/aspire/blob/v13.6.1/src/Aspire.Cli/Agents/SkillLocation.cs),
[setup and hook registration](https://github.com/microsoft/aspire/blob/v13.6.1/src/Aspire.Cli/Commands/AgentInitCommand.cs).

## A bounded investigation

```bash
node scripts/init-secret.mjs
apphost=catalog/Catalog.AppHost/Catalog.AppHost.csproj
Inventory__FaultEnabled=true bash scripts/aspire.sh start \
  --apphost "$apphost" --isolated --non-interactive
node scripts/smoke.mjs fault
```

Give an agent this bounded task:

> Work only in this sample's checkout and select
> `catalog/Catalog.AppHost/Catalog.AppHost.csproj` explicitly. Explain the
> configured `/api/catalog` failure using resource health, console/structured logs,
> and the request's trace. Identify which HTTP server first returned 503 and show
> the parent-child span chain. Run `node scripts/smoke.mjs fault` and report the
> trace ID and evidence directory. Do not remove the fault, add retries, fake a
> success response, weaken the assertions, provision cloud resources, or alter
> another session's processes. Stop after the evidence report.

The check proves that processes are healthy **and** the expected business request
fails. A report saying only "the app started" or "all resources are green" is
incomplete. With MCP enabled separately, select this AppHost before using resource,
console-log, structured-log, trace, and trace-log tools.

## Repeatable regression checks

Stop this sample's AppHosts before rebuilding:

```bash
bash scripts/aspire.sh stop --apphost "$apphost" --non-interactive
bash scripts/check.sh
```

The Node tests reject missing proxy configuration, terminal input-echo matches,
broken trace propagation, UI-only failures, and concealed downstream retries.
They also exercise symlinked script paths, failed-smoke evidence capture,
missing-AppHost errors, pinned-checksum rejection, and stale publication reviews.
The .NET tests cover retained state, concurrent single-process writes, corrupt
state, and missing configuration. Follow the separate [recovery exercise](../01-keep-the-failing-run/)
to verify recovery explicitly; do not mislabel it as an agent repairing an unknown bug.
