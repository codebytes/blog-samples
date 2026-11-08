# Aspire terminal tape lab

Drive an interactive Node process and verify the output it actually computes.
This standalone lab teaches Aspire's `WithTerminal()` and tape playback:
input goes to a live process, output waits replace fixed sleeps, and fresh
markers keep old output from passing a new check.

`6 * 7` is deliberately simple: the point is reliable terminal input/output,
not arithmetic or catalog validation. This sample does not call an API or
connect to a database. For database inspection, use the separate
[PostgreSQL REPL walkthrough](../aspire-field-notes/walkthroughs/03-terminals-and-repls/).

## Prerequisites

- .NET 10 SDK; `global.json` allows newer .NET 10 feature bands.
- Aspire CLI **13.6.4** on `PATH`; the AppHost SDK is pinned to the same version.
- Node.js 20.19+ or 22.12+; Node 22 or 24 LTS is recommended.

No Dockerfile, container runtime, database, npm install, or secret setup is needed.
The AppHost starts the installed Node interpreter directly. Resource terminals
are experimental in 13.6; the AppHost acknowledges `ASPIRETERMINAL001` narrowly.

Run all commands below from `aspire-terminal-tape-lab/`:

```bash
git clone https://github.com/codebytes/blog-samples.git
cd blog-samples/aspire-terminal-tape-lab
```

## First, try the terminal manually

```bash
apphost=Terminal.AppHost/Terminal.AppHost.csproj
aspire start --apphost "$apphost" --isolated
```

In the dashboard, wait for **node-repl** to be **Running**, then open its
**Console logs** page. Because the resource has `WithTerminal()`, this view is
an interactive Node prompt, not just a log viewer. Enter:

```javascript
6 * 7
```

Expect `42`. You have sent input to the AppHost's native Node process and observed
its computed result. `NODE_REPL_HISTORY` is empty so this does not write to your
personal Node REPL history. Keep dashboard access trusted: terminal input executes
with the resource's permissions.

## Then, make the interaction repeatable

Begin at a fresh, idle prompt with no partially typed input. Coordinate with
other viewers: terminal input and dimensions are shared, and playback does not
take exclusive ownership.

```bash
aspire wait node-repl --apphost "$apphost" --status up --timeout 90 --non-interactive
aspire terminal ps --apphost "$apphost" --non-interactive
node scripts/terminal-smoke.mjs
node scripts/terminal-smoke.mjs
node scripts/terminal-smoke.mjs --negative-control
```

The first two runs must pass with **different markers**. The helper materializes
[`node-smoke.tape`](node-smoke.tape) with a fresh nonce, then plays it against
`node-repl`. The marker retains its original `FIELD_NOTES_42_<nonce>` prefix.
Its typed expression computes `6*7` and joins separate pieces, so input echo
does not contain the full expected result. A new nonce prevents old output
from satisfying the new run's `Wait+Screen`.

The negative control computes `6*8` while still waiting for 42. It passes only
when the CLI exits with code 16, the screen contains the fresh computed 48, and
the expected-42 marker is absent. A missing prompt, connection failure, or missing
Aspire executable is not a successful negative control.

These checks prove terminal interaction and assertion behavior, not that
arbitrary programs or a business application succeeded. Pair terminal automation
with an independent API/state check when adapting it to an application.

## Tape and diagnostic files

[`scripts/terminal-smoke.mjs`](scripts/terminal-smoke.mjs) replaces `RUN_NONCE`;
Aspire does not substitute it. Do not reuse a generated nonce for repeatability.
The actual playback command is:

```bash
aspire terminal tape play node-repl \
  --apphost "$apphost" \
  --tape-file artifacts/terminals/REPLACE_WITH_GENERATED_NONCE.tape \
  --timeout 20 --non-interactive
```

The helper uses five-second output waits, a 20-second playback deadline, and a
35-second outer process deadline. It saves the generated `.tape`, final
`.screen.txt`, and `.diagnostics.txt` under ignored `artifacts/terminals/`.
Startup/connection failures are surfaced; operating-system spawn errors are
saved too. Expected exit-16 diagnostics stay in the evidence file during a
successful negative control. For CLI test fixtures only, `ASPIRE_BIN` overrides
the executable; no helper installs or upgrades Aspire.

Tape playback targets an existing `WithTerminal()` resource. It does not create
a shell, resize the terminal, stop the process, or target a docked `WithRepl()`
database client. The CLI emits text screens, not video/GIF/asciicast recordings.
Keep recordings free of secrets.

## Shared terminal size and recovery

The AppHost configures a 160x30 terminal. To watch without controlling its
dimensions, use:

```bash
aspire terminal attach node-repl --apphost "$apphost" --viewer
```

Detach with **Ctrl+B D**; the process remains running. A default attach takes the
primary role and drives shared terminal dimensions. A tiny primary viewer can
shrink the terminal enough to wrap the marker and break an output match.

Detach the small viewer, attach from a normal-size terminal (at least 32 columns),
then detach with **Ctrl+B D**:

```bash
aspire terminal attach node-repl --apphost "$apphost"
# After detaching:
node scripts/terminal-smoke.mjs
```

Do not use `--viewer` for this recovery attach: it does not resize the terminal.
Restarting only `node-repl` can preserve the reduced size. Alternatively, stop
and start this exact AppHost to restore 160x30:

```bash
aspire stop --apphost "$apphost" --non-interactive
aspire start --apphost "$apphost" --isolated --non-interactive
aspire wait node-repl --apphost "$apphost" --status up --timeout 90 --non-interactive
node scripts/terminal-smoke.mjs
```

## Source checks and cleanup

Stop only a lab AppHost you started before building:

```bash
aspire stop --apphost "$apphost" --non-interactive
dotnet build Terminal.AppHost/Terminal.AppHost.csproj --verbosity minimal
node --test tests/*.test.mjs
```

The Node tests need no running AppHost and cover fresh markers, input-echo
resistance, negative controls, missing executables, and helper entrypoint behavior.
Do not stop unrelated AppHosts or use broad process-name cleanup.

For a deliberate version upgrade, stop this AppHost, run
`aspire update --apphost "$apphost" --yes --non-interactive`, review the SDK change,
then repeat the build, tests, and live tape checks. Upgrading the installed CLI
alone does not update the project's pinned SDK.

Reference: [terminal tape semantics and limitations](https://aspire.dev/dashboard/terminal-tape-playback/).
