# 5. Portable state and configuration

Use the [catalog quick start](../../README.md). The relevant AppHost call is:

```csharp
var api = builder.AddProject<Projects.Catalog_Api>("api")
    .WithReference(catalogdb)
    .WithReference(inventory)
    .WithEnvironment("Catalog__Region", region)
    .WithVolume("catalog-state", "/data", env: "DATA_PATH")
    .WithHttpHealthCheck("/health")
    .WaitFor(catalogdb)
    .WaitFor(inventory);
```

In run mode, `DATA_PATH` is a workload-scoped host directory under
`catalog/Catalog.AppHost/obj/.aspire/volumes/`. The retained file is
`.../state.json` beneath that directory. Deleting `obj` or running
`git clean -fdX` wipes this ignored application data. In the published container
model, the path is `/data`. The API uses that one key, not separate "developer"
and "production" path branches.

## Prove retention rather than infer it from a volume declaration

```bash
apphost=catalog/Catalog.AppHost/Catalog.AppHost.csproj
aspire start --apphost "$apphost" --isolated --non-interactive
node scripts/smoke.mjs healthy
node scripts/state-smoke.mjs write

aspire stop --apphost "$apphost" --non-interactive
aspire start --apphost "$apphost" --isolated --non-interactive
node scripts/smoke.mjs healthy
node scripts/state-smoke.mjs verify
```

The write check posts a fresh benign note to `/api/state`, reads it back, and
checks that a rejected blank write does not mutate state. It records the expected
note, revision, timestamp, and instance ID in ignored `artifacts/state-check.json`.
The verification requires **a different API instance ID** and the **exact same
retained state**. Checking without restarting is intentionally a failure.

In the frontend, **Save note** sends:

```json
{"message":"Retained after a restart"}
```

The message must be non-blank, at most 256 characters. The file is `state.json`
inside `DATA_PATH`. The sample serializes writes within one process and replaces
the file atomically. It does not claim coordination between multiple API replicas.

## Fail fast and keep credentials stable

```bash
# Does not rotate or display an existing credential.
node scripts/init-secret.mjs

# No live services needed: corrupt state, missing config, and retained-file tests.
aspire stop --apphost "$apphost" --non-interactive
dotnet test tests/Catalog.Tests/Catalog.Tests.csproj --no-restore
node --test tests/*.test.mjs
```

The Node fail-fast tests launch the already-built API without `Catalog:Region`
and inventory with `Inventory__FaultEnabled=invalid`. Both must terminate before
listening, with the specific configuration error; a generic crash or timeout is
not enough. Run `scripts/check.sh` first if those binaries are not built.
The API requires `Catalog:Region`, `ConnectionStrings:catalogdb`, the inventory
service reference, and an absolute `DATA_PATH`. The Vite development server
requires an endpoint-derived `API_BASE_URL`. Corrupt retained state throws;
neither component silently substitutes a made-up local dependency.

`init-secret.mjs` stores a generated password with the AppHost's stable
`UserSecretsId`, outside Git. Isolated runs copy those secrets. Replacing the
secret alone does not change a password inside an already initialized PostgreSQL
volume. Keep the pair together; never solve authentication errors by deleting
someone else's volumes or dumping credentials into logs.

This sample consumes the database reference through .NET configuration and
`Aspire.Npgsql`; it does **not** claim that a direct Node/Python environment reader
automatically understands .NET connection-string aliases.

| State | Example here | Surviving restart means |
| --- | --- | --- |
| Diagnostic history | `~/.aspire/dashboard/runs`, keyed by **Catalog** | Spans and structured logs remain; the latest resource snapshot requires opening the dashboard in a browser, and console logs require live viewing or export there |
| Application data | `DATA_PATH/state.json`, PostgreSQL rows | The actual application values remain |
| Deployment state | Target pipeline records and generated artifacts | A separate deployment lifecycle, not app data |

No cloud deployment state is created by this walkthrough. Finish with the scoped
`stop` command; retention is not a backup strategy. Unlike the project-local file
store, dashboard runs are shared across Catalog checkouts and count toward the
same 10-unpinned-run limit. A headless run may retain telemetry without a resource
snapshot. CLI log exports do not activate dashboard console retention; follow the
[live-viewing step](../01-keep-the-failing-run/) before stopping a run whose
resource snapshot and console output you want retained there.
