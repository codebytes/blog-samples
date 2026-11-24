# 5. Portable state and configuration

Prove that a new catalog API process can read the note written by the old one.
Use [the catalog prerequisites](../../README.md#prerequisites) and run the
commands from `aspire-field-notes/` in your own checkout.

The [Aspire 17 AppHost](../../catalog/Catalog.AppHost/AppHost.cs) registers the
API by project path, then gives it the region and a named volume:

```csharp
var api = builder.AddDotnetProject("api", "../Catalog.Api/Catalog.Api.csproj")
    .WithReference(catalogdb)
    .WithReference(inventory)
    .WithHttpHealthCheck("/health")
    .WaitFor(catalogdb)
    .WaitFor(inventory);

api.WithEnvironment("Catalog__Region", region)
    .WithVolume("catalog-state", "/data", env: "DATA_PATH");
```

The API always writes `state.json` inside `DATA_PATH`. When it runs as a native
.NET process, Aspire supplies a host directory scoped to the workload and
volume. In the verified 17.0.0 run, the file was
`catalog/Catalog.AppHost/obj/.aspire/volumes/6eadbb0d02accc0a/3947504a243be719/state.json`.
Read `DATA_PATH`, don't hard-code those hashes. Deleting `obj` deletes that data.
In the [published Compose model](../06-choose-your-deployment/), `catalog-state`
is a writable named volume mounted at `/data`, so the same code writes
`/data/state.json`. Publishing does not copy the local note into a container.

## Prove retention rather than infer it from a volume declaration

Initialize the database credential once, then start the catalog. `aspire wait`
defaults to **healthy**. The smoke check uses the frontend's `/api/state` route:

```bash
node scripts/init-secret.mjs
aspire start --apphost catalog --isolated
aspire wait web --apphost catalog
node scripts/state-smoke.mjs write
```

`write` posts a new note, reads it back, then sends a blank message and requires
HTTP 400 with no change to the state. It saves the note, revision, timestamp,
and API instance ID in `artifacts/state-check.json` as the expected result. This
ignored test file is **not** the API's data file.

Restart **the same checkout** and verify the result:

```bash
aspire stop --apphost catalog
aspire start --apphost catalog --isolated
aspire wait web --apphost catalog
node scripts/state-smoke.mjs verify
aspire stop --apphost catalog
```

`verify` requires **a different API instance ID** and **the exact same note,
revision, and `updatedUtc`**. Running it before the restart fails on purpose.
The final scoped stop preserves the file and the database volume.

In the frontend, **Save note** sends:

```json
{"message":"Retained after a restart"}
```

The message must be non-blank, at most 256 characters. The file is `state.json`
inside `DATA_PATH`. The sample serializes writes within one process and replaces
the file atomically. It does not claim coordination between multiple API replicas.

## Check the container path without deploying

With the AppHost stopped, generate and review the Compose files:

```bash
aspire publish --apphost catalog -o artifacts/compose -- --Deployment:Target=compose
node scripts/review-compose.mjs artifacts/compose
```

In `artifacts/compose/review.json`, look for `apiDataPath: "/data"` and a
`stateVolume` with source `catalog-state` and target `/data`. Nothing is deployed.

## Fail fast and keep credentials stable

With the catalog stopped, `bash scripts/check.sh` builds the services and runs
the tests for missing configuration, corrupt JSON, and retained files.
The API requires `Catalog:Region`, `ConnectionStrings:catalogdb`, the inventory
service reference, and an absolute `DATA_PATH`. The Vite development server
requires `API_HTTP` from the AppHost's API reference. Corrupt retained state throws;
neither component silently substitutes a made-up local dependency.

`init-secret.mjs` stores a generated password with the AppHost's stable
`UserSecretsId`, outside Git, without displaying or rotating an existing value.
The ID did not change in the upgrade. Isolated runs copy those secrets. Replacing the
secret alone does not change a password inside an already initialized PostgreSQL
volume. Keep the pair together; never solve authentication errors by deleting
someone else's volumes or dumping credentials into logs.

This sample consumes the database reference through .NET configuration and
`Aspire.Npgsql`; it does **not** claim that a direct Node/Python environment reader
automatically understands .NET connection-string aliases.

| State | Example here | Surviving restart means |
| --- | --- | --- |
| Diagnostic history | Dashboard runs, spans, and logs | Prior telemetry may still be available; it is not proof that a new API process can read the note |
| Application data | `DATA_PATH/state.json`, PostgreSQL rows | The actual application values remain |
| Deployment state | Target pipeline records and generated artifacts | A separate deployment lifecycle, not app data |

No deployment is needed for this check. Retention across a process restart is
not a backup strategy.
