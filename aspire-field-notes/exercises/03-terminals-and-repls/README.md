# 3. Terminals and REPLs

These are **two different terminal experiences**. A PostgreSQL REPL opens an
additional client in the dashboard dock. The separate Node sample makes the
resource's own process interactive and is the target for tape playback.

## PostgreSQL: an opt-in diagnostic client

After [setup](../../README.md), stop any catalog run you started, then enable the
REPL explicitly:

```bash
apphost=catalog/Catalog.AppHost/Catalog.AppHost.csproj
Diagnostics__EnableRepl=true bash scripts/aspire.sh start \
  --apphost "$apphost" --isolated --non-interactive
bash scripts/aspire.sh wait api --apphost "$apphost" --status healthy --timeout 120 --non-interactive
bash scripts/aspire.sh resource postgres repl --apphost "$apphost" --non-interactive
```

The AppHost applies `WithRepl()` to **`postgres`**, not `catalogdb`. The CLI prints
`Command 'repl' executed successfully` and opens the container's bundled `psql`
in the **dashboard dock**; it does not attach your current shell. The client
initially connects to the `postgres` database.

Use **postgres > Actions > REPL** in the dashboard as an **alternative** to the
CLI command, not an additional step. Doing both creates two clients, and each
needs its own `\q`.

In the docked client:

```sql
\connect catalogdb
BEGIN READ ONLY;
SELECT current_database(), current_user;
SELECT sku, name, price FROM catalog_items ORDER BY sku;
SELECT count(*) AS products FROM catalog_items;
ROLLBACK;
\q
```

Expect `catalogdb` and three seeded products. `\q` ends the client; closing its
viewer alone is not a substitute. The client has the configured database user's
privileges, so keep dashboard access trusted and queries read-only.

Do **not** target this docked client with `aspire terminal tape play`. It is not
a `WithTerminal()` resource.

## Node: a terminal-enabled process and a bounded tape

The independent [`Terminal.AppHost`](../../terminals/Terminal.AppHost/AppHost.cs)
needs Node but no database or container engine. `WithTerminal()` is experimental
in 13.6 and has a narrowly scoped `ASPIRETERMINAL001` acknowledgement.

```bash
terminal_apphost=terminals/Terminal.AppHost/Terminal.AppHost.csproj
bash scripts/aspire.sh start --apphost "$terminal_apphost" --isolated --non-interactive
bash scripts/aspire.sh wait node-repl --apphost "$terminal_apphost" --status up --timeout 90 --non-interactive
bash scripts/aspire.sh terminal ps --apphost "$terminal_apphost" --non-interactive
node scripts/terminal-smoke.mjs
node scripts/terminal-smoke.mjs
node scripts/terminal-smoke.mjs --negative-control
```

The first two executions must pass with **different markers**. The helper materializes
[`node-smoke.tape`](../../terminals/node-smoke.tape) into an ignored `.tape` file
with a fresh nonce. Its typed expression computes `6*7` and joins separate pieces
of the marker. Therefore input echo cannot satisfy the expected
`FIELD_NOTES_42_<nonce>` result, and old output cannot satisfy a new run.
It uses five-second output waits, a 20-second playback deadline, and a 35-second
outer process deadline. The first prompt wait tolerates trimmed trailing spaces.

The actual playback command is:

```bash
bash scripts/aspire.sh terminal tape play node-repl \
  --apphost "$terminal_apphost" \
  --tape-file artifacts/terminals/REPLACE_WITH_GENERATED_NONCE.tape \
  --timeout 20 --non-interactive
```

The template's `RUN_NONCE` is replaced by the helper, not by Aspire. Do not reuse
a generated nonce for a meaningful repeatability check. To inspect a session,
use `bash scripts/aspire.sh terminal attach node-repl --apphost "$terminal_apphost"` and detach
with **Ctrl+B D**; the process remains running.

A peer attaching from a tiny window can resize the shared PTY. The fresh marker
needs about 32 columns (the default is 160); wrapping can break the output match.
Detach the small viewer and restart this resource before retrying:

```bash
bash scripts/aspire.sh resource node-repl restart --apphost "$terminal_apphost" --non-interactive
bash scripts/aspire.sh wait node-repl --apphost "$terminal_apphost" --status up --timeout 90 --non-interactive
```

Playback success means the tape finished, not that arbitrary code or an entire
application succeeded. Here success additionally requires the fresh, computed
result on the screen. Changing `6*7` to `6*8` while keeping the expected result
must fail with a bounded wait (CLI exit 16). The `--negative-control` helper does
exactly that and only passes if the screen actually contains the fresh computed
48 and the expected-42 wait fails. A missing prompt is not an acceptable negative result.
Startup or connection failures print the CLI's diagnostics before the assertion;
an absent AppHost is not a successful negative control.

```bash
bash scripts/aspire.sh stop --apphost "$terminal_apphost" --non-interactive
bash scripts/aspire.sh stop --apphost "$apphost" --non-interactive
```

Reference: [terminal tape semantics and limitations](https://aspire.dev/dashboard/terminal-tape-playback/).
