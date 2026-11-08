# 3. Inspect the catalog database with a REPL

**The practical goal is to inspect the catalog's database without finding a
port, installing a local database client, or copying connection credentials.**
This walkthrough opens an authenticated PostgreSQL client beside the dashboard
and checks which database that client reached and which products are stored there.

This is a **known-seed baseline**, not a deliberately reproduced catalog failure.
The API seeds three products during startup; this exercise inspects those rows.
It does not prove which database an API request used. API/frontend validation is
a separate step.

The collection uses Aspire **13.6.4**, native .NET and Vite app resources, and
containerized PostgreSQL. Complete the prerequisites and one-time secret setup
in the [sample README](../../README.md). Run commands from `aspire-field-notes/`.

## Open the diagnostic client

Use this when you want to answer: **am I connected to `catalogdb`, and are its
three seeded products present?** The REPL uses the resource's connection settings;
you do not need to copy a password or discover a database port.

If your catalog AppHost is already running, stop only that run before changing
its startup setting. Then enable the opt-in REPL:

```bash
apphost=catalog/Catalog.AppHost/Catalog.AppHost.csproj
Diagnostics__EnableRepl=true aspire start \
  --apphost "$apphost" --isolated
```

The AppHost applies `WithRepl()` to **`postgres`**, not `catalogdb`. The CLI prints
the dashboard URL when the AppHost starts. Wait for **api** to become **Healthy**
in the dashboard, then choose **postgres > Actions > REPL**. This opens the
container's bundled `psql` client in the **dashboard dock**, initially connected
to the `postgres` database.

If the terminal dock is hidden, press the unmodified **backtick** key (physical
**Backquote**) in the dashboard to toggle the dock. If focus is in terminal input,
press **F6** first to move focus to the terminal controls, then press backtick.

## Inspect the stored products

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

Expect `current_database()` to return `catalogdb`, the rows with SKUs `mug`,
`notebook`, and `sticker`, and `products` to be `3`.
Present rows establish the expected stored-data baseline for this client.
Missing rows or a different database name mean this inspection did not match
that baseline; check the selected database and the API's startup/seeding logs.
Do not repair data or reset volumes just to make the example pass.

The query does **not** prove which database an API request used, or that the API
or frontend can successfully serve a request. Use the
[catalog request checks](../../README.md#optional-cli-verification) for that
separate validation.

`\q` ends the client; closing its viewer alone is not a substitute. The read-only
transaction limits these queries, not the client's permissions. Keep dashboard
access trusted: the same credentials may be able to modify or delete data.

## Optional CLI route to the same REPL

Instead of the dashboard menu action, use:

```bash
aspire wait api --apphost "$apphost" --status healthy --timeout 120 --non-interactive
aspire resource postgres repl --apphost "$apphost" --non-interactive
```

The CLI prints `Command 'repl' executed successfully`, but the client opens in the
dashboard dock; it does not attach your current shell. Use the menu or the command,
not both: each invocation starts another client that needs its own `\q`.

## Optional: automate the same inspection with a resource terminal

The docked `WithRepl()` client cannot be a tape target. The separate
**`psql-client`** resource runs with the other catalog resources in every local
run, without an opt-in flag. It uses
the same PostgreSQL image version as the server, but runs `psql` as its main
process with `WithTerminal()`. No host `psql` install or Node playback script is needed.

If the catalog is not already running, start it normally; otherwise keep that
run. A run started before this AppHost revision needs its owner to restart it
before `psql-client` appears:

```bash
apphost=catalog/Catalog.AppHost/Catalog.AppHost.csproj
aspire start --apphost "$apphost" --isolated
aspire wait api --apphost "$apphost" --status healthy --timeout 120 --non-interactive
aspire wait psql-client --apphost "$apphost" --status up --timeout 90 --non-interactive
```

The AppHost's `WaitFor(api)` prevents the client from starting before the API is
healthy; seeding completes before the API starts listening. Aspire supplies
`PGHOST`, `PGPORT`, `PGUSER`, and `PGPASSWORD` from the server's managed expressions,
and `PGDATABASE` from `catalogdb`. No password or published host port is copied
into a command or tape. This is a separate client container, not another database
server; it has no data volume or published endpoint.

In the dashboard, **psql-client > Console logs** now has terminal input. Its prompt
is `CATALOG_READY>` followed by a space, and it is already connected to `catalogdb`.
Unlike the docked client, this resource terminal can be driven by the CLI. Keep it at a fresh, idle
prompt with no partially typed input before playback, and coordinate with other
viewers: input is shared, not exclusively owned by the tape.

Do not send `\q` before playback. Once that main process exits, the client must
be started again: have the run's owner stop/start only this AppHost normally, then
wait for the API and client again before running another tape. The tape never
quits the client, and playback success or failure does not stop it. There is no
watchdog or reconnect loop.

```bash
aspire terminal tape play psql-client --apphost "$apphost" \
  --tape-file terminals/catalog-inspect.tape --timeout 20 --non-interactive --nologo
aspire terminal tape play psql-client --apphost "$apphost" \
  --tape-file terminals/catalog-inspect.tape --timeout 20 --non-interactive --nologo
aspire terminal tape play psql-client --apphost "$apphost" \
  --tape-file terminals/catalog-inspect-negative.tape --timeout 20 --non-interactive --nologo
```

[`terminals/catalog-inspect.tape`](../../terminals/catalog-inspect.tape) is a
self-contained tape, used directly without substitution or an external nonce.
From that idle/no-partial-input state, it first sends an empty Enter to regenerate
the prompt: container startup output can precede terminal attachment and be missed.
It then sends **Ctrl+L** through psql's default line editor and requires the
**entire visible screen** to contain only `CATALOG_READY>` and whitespace:

```text
Enter
Wait+Line /CATALOG_READY> *$/
Ctrl+L
Wait+Screen /^CATALOG_READY>[ \t\r\n]*$/
```

[Readline's Ctrl+L](https://www.gnu.org/software/bash/manual/html_node/Commands-For-Moving.html)
clears the screen and redraws the current line at the top.
[psql uses line editing by default](https://www.postgresql.org/docs/18/app-psql.html#APP-PSQL-READLINE);
the AppHost no longer disables it with `-n`. If clearing does not work or input
is not idle, the bounded screen wait fails **before SQL is sent**. Old PASS/FAIL
lines therefore cannot satisfy a new run. This clears the visible terminal,
not database rows, saved recordings, or diagnostic history.

The tape then begins a read-only transaction and checks the current database,
exact ordered SKU array, and count. SQL emits a fixed baseline marker only when
all three match; otherwise it emits `FIELD_NOTES_CATALOG_UNEXPECTED_DATABASE_OR_ROWS_FAIL`.
It does not echo raw stored values into its result, so unexpected SKUs containing
newlines, terminal controls, or text that looks like PASS cannot impersonate an
assertion. It rolls back **before** the final screen assertion. The expected output is:

```text
FIELD_NOTES_CATALOG_catalogdb_mug,notebook,sticker_3_PASS
```

SQL constructs the prefix from separate pieces and gates the marker on actual query values,
so typing or echoing the SQL cannot satisfy the expected marker. The tape matches
the entire result line, not a substring of different data. Both positive runs
must finish with CLI exit **0** and that exact result.

[`terminals/catalog-inspect-negative.tape`](../../terminals/catalog-inspect-negative.tape)
changes only the final expected-count assertion from `3` to `4`, retaining the
outer guard for the real three-row baseline. It does **not** insert,
update, or delete data. After rollback, it first requires the exact unchanged-data
result `FIELD_NOTES_CATALOG_catalogdb_mug,notebook,sticker_3_FAIL`, then deliberately
times out waiting for PASS. The **raw CLI exits 16**, not zero: this is the expected
failure. Confirm that exact FAIL line on stdout and that stderr identifies the
**last PASS wait** as the failed command. Exit 16 alone is not evidence of the
negative control; wrong data, missing output, SQL errors, failed clearing, and
connection/startup failures are not successful controls.

Both tapes use five-second output waits; these commands impose a 20-second CLI
connection/playback deadline. Missing `aspire` is a shell error, not a successful
check; nothing installs a CLI automatically. To retain evidence, create the
ignored directory once and redirect stdout/stderr separately, using distinct
filenames for each run:

```bash
mkdir -p artifacts/psql
aspire terminal tape play psql-client --apphost "$apphost" \
  --tape-file terminals/catalog-inspect.tape --timeout 20 --non-interactive --nologo \
  > artifacts/psql/positive-1.screen.txt 2> artifacts/psql/positive-1.diagnostics.txt
```

This saves the final plain-text screen, not video or a full output stream.
Shell redirection overwrites existing files; choose new filenames to preserve
earlier evidence. Use `positive-2` and `negative` for the other commands, and
inspect the CLI exit status immediately (`echo $?` in Bash) before another command.

These are stored-data assertions for this client, **not API routing or frontend
proof**. Missing or different data still calls for inspecting the selected database
and startup/seeding logs, not resetting volumes.

### Safety, sizing, and verification boundaries

The client starts with session-default read-only transactions and a five-second
statement timeout, ignores personal `psql` startup files, and disables history.
These settings are **not a restricted database role**: the same credentials can
change settings and modify data. Keep dashboard access and recordings trusted,
do not paste secrets, and limit this exercise to the read-only queries.

The AppHost configures 160 columns by 30 rows. A primary CLI attach can resize the
shared terminal; an undersized viewer can wrap the result marker and break its
match. Use a secondary viewer to observe without resizing:

```bash
aspire terminal attach psql-client --apphost "$apphost" --viewer
```

Detach with **Ctrl+B D**; that leaves the client running. If a small primary viewer
already shrank it, detach that viewer and attach normally from a terminal at least
100 columns wide, then detach again. `--viewer` cannot repair the size. An exact
AppHost stop/start also restores the configured dimensions.

Source checks from the sample root are independent of a running database:

```bash
node --test tests/*.test.mjs
```

With your AppHost stopped, `dotnet test tests/Catalog.Tests/Catalog.Tests.csproj`
also evaluates the actual AppHost model without starting resources. It checks the
default-local/publish boundary, image and managed connection references, API
health dependency, terminal dimensions, and preserved manual REPL command. It
also parses and preflights both tapes with the restored Hex1b engine, checks
clear-before-SQL and rollback-before-assert ordering, and exercises repeated
screen clearing and stale-result rejection in a shell PTY standing in for query
output.

Those are model/terminal-mechanics checks, not database execution. Separately,
live PostgreSQL validation with CLI 13.6.4 and Podman 6.1.4 passed both consecutive
positive playbacks on the same client. The negative control returned raw exit 16
at its final PASS wait, after rollback and the exact unchanged-data FAIL result.
A read-only `VALUES` relation containing a malformed SKU with CR/LF, an ANSI
control, and PASS-like text emitted only the fixed unexpected-data failure
marker; it did not modify stored rows. Another positive playback then confirmed
the real catalog baseline still matched. The terminal remained alive at 160x30
with no restarts after all playbacks. Only the task-owned AppHost was stopped
afterward, without deleting data or volumes. No new dashboard screenshots were
captured for these CLI checks.

## Cleanup

Use `\q` in each client you opened (including the default `psql-client`), then stop
only the catalog AppHost you started:

```bash
aspire stop --apphost "$apphost" --non-interactive
```

This does not remove retained catalog data. Do not stop unrelated AppHosts or
use broad process-name cleanup on a shared machine.

For a container-independent input/output reference, use the separate
[Node terminal tape lab](../../../aspire-terminal-tape-lab/).
