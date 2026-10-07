# Aspire Field Notes: runnable companions

One small catalog app, six exercises, **Aspire 13.6.0**. These samples are separate
from the older [`aspire-cli`](../aspire-cli/) collection.

| Article | Runnable exercise |
| --- | --- |
| 1. Keep the failing run | [A real downstream 503, correlated evidence, and recovery](exercises/01-keep-the-failing-run/) |
| 2. Model the whole app | [Configuration, readiness, and telemetry in a polyglot graph](exercises/02-model-the-whole-app/) |
| 3. Terminals and REPLs | [PostgreSQL diagnostics and a bounded Node terminal tape](exercises/03-terminals-and-repls/) |
| 4. Agents with evidence | [Pinned guidance, explicit AppHost selection, and repeatable checks](exercises/04-agents-with-evidence/) |
| 5. Portable state and config | [A retained file, fail-fast configuration, and stable credentials](exercises/05-portable-state-and-config/) |
| 6. Choose your deployment | [Explicit Docker Compose publication and artifact assertions](exercises/06-choose-your-deployment/) |

## Prerequisites

- .NET 10 SDK. `global.json` allows newer .NET 10 feature bands.
- Node.js 20.19+ or 22.12+ and npm; Node 22 or 24 LTS is recommended.
- Docker with a running Linux container engine and Docker Compose v2. Aspire's
  PostgreSQL integration supplies its own database client; no host `psql` is needed.
- Bash, `curl`, and `tar` for the Mac/Linux scripts. Windows users can run these
  commands in a WSL environment with the same prerequisites.
- Aspire CLI **13.6.0**, matching the pinned AppHost SDK and integrations.

All commands below run from `aspire-field-notes/`. Ports are discovered, not fixed.
The sample uses local HTTP and deliberately has no authentication. Do not expose
the dashboard, REPL, or application to untrusted users.

## Quick start

```bash
cd aspire-field-notes

# Optional when 13.6.0 is already installed. This verifies the release SHA-512 and
# installs into ignored .tools/, without upgrading a global CLI.
bash scripts/install-cli.sh

# Generate a local secret once, or preserve the existing secret without printing it.
node scripts/init-secret.mjs

# Stop this sample's AppHosts before building their assemblies.
bash scripts/check.sh

bash scripts/aspire.sh start \
  --apphost catalog/Catalog.AppHost/Catalog.AppHost.csproj \
  --isolated --non-interactive

node scripts/smoke.mjs healthy
```

`scripts/aspire.sh` rejects a mismatched CLI. It uses `.tools/aspire`, then an
installed `aspire`, or an explicit executable path in `ASPIRE_BIN`.
`check.sh` builds both AppHosts and the services, runs .NET and Node tests, restores
the committed npm lockfile, and builds the frontend. It does not start services.

Open **web** using the dashboard URL printed by `start`, or inspect its current URL:

```bash
bash scripts/aspire.sh describe \
  --apphost catalog/Catalog.AppHost/Catalog.AppHost.csproj \
  --format Json --non-interactive
```

In 13.6, `aspire ps` lists running **AppHosts**; `aspire describe` lists their
**resources**. Always select the AppHost explicitly in this multi-AppHost repository.
Do not share raw `describe` output without reviewing its configuration fields.

The smoke script waits for actual health, calls the browser's same-origin
`/api/catalog` route once, checks the response shape, and asserts a PostgreSQL span
plus exactly one correlated API-to-inventory HTTP call. It saves console logs,
structured logs, spans, and the request result under ignored `artifacts/`.
Its short telemetry-export wait does **not** retry the business request.

### If nuget.org is unreachable

Do not disable certificate validation. An optional configuration uses Microsoft's
public `dotnet-public` mirror, scoped to these commands:

```bash
export RestoreConfigFile="$PWD/NuGet.public-mirror.config"
dotnet restore AspireFieldNotes.slnx --configfile "$RestoreConfigFile" --disable-parallel
bash scripts/check.sh
```

Keep that environment variable for subsequent Aspire builds in this shell if
necessary. This does not alter machine-wide NuGet configuration. The CLI installer
uses the official tagged GitHub release, not an unofficial package mirror.

## Shared app contract

| Resource | Role and endpoints |
| --- | --- |
| `postgres` | PostgreSQL 18.3, selected by the pinned integration; named data volume; optional `WithRepl()` |
| `catalogdb` | Actual database containing three seeded `catalog_items` rows |
| `inventory` | .NET service; `GET /inventory`, `/health`, `/alive`; opt-in request fault |
| `api` | .NET API; `GET /api/catalog`, `GET/POST /api/state`, `/health`, `/alive` |
| `web` | Vite frontend; `/health`; server-side development proxy for `/api` |

The API queries PostgreSQL, then makes one instrumented HTTP request to inventory.
The `Inventory__FaultEnabled=true` AppHost setting makes inventory return a real
503 without killing the process or failing its self-health check. The API propagates
that business failure. No HTTP resilience/retry handler conceals it.

`web` receives an endpoint-derived `API_BASE_URL`; the browser only sees relative
`/api/*` URLs. No connection strings or `VITE_*` infrastructure addresses are baked
into the browser bundle. The .NET services explicitly configure OpenTelemetry;
Vite does not magically acquire application spans from being in the resource graph.

The stable `Projects.Catalog_Api` and `Projects.Inventory_Api` metadata types come
from the AppHost's project references. No Project V2, Java, Rust, or AI-provider
preview is needed to run this core sample.

## Configuration and data

| Input | Owner and behavior |
| --- | --- |
| `Parameters:postgres-password` | Secret AppHost parameter stored by `init-secret.mjs` in .NET user secrets, never in Git |
| `Parameters:catalog-region` | Non-secret AppHost parameter; default `local`, supplied to the API as `Catalog__Region` |
| `Inventory:FaultEnabled` | AppHost Boolean, default `false`; shell form `Inventory__FaultEnabled` |
| `Diagnostics:EnableRepl` | AppHost Boolean, default `false`; only enables the server REPL in run mode |
| `DATA_PATH` | Injected by `WithVolume("catalog-state", "/data", env: "DATA_PATH")`, not manually invented by the API |
| `Deployment:Target` | Must explicitly be `compose` in publish mode; other targets are rejected |

The API fails at startup when its region, database reference, inventory reference,
or absolute data directory is missing. Malformed retained JSON is an error, not a
silent reset. Note writes accept `{"message":"a benign note"}` (1-256 non-blank
characters). They return `{ "instanceId": "...", "state": { "message": "...",
"revision": 1, "updatedUtc": "..." } }`.

This is intentionally a single-writer teaching file store, not a multi-replica
database or production cache. PostgreSQL initialization is idempotent and preserves
existing rows. Do not rotate the password while reusing an initialized database
volume unless you also change the database user's password.

`--isolated` randomizes ports and copies user secrets for the run. It does not mean
"erase all storage." Reuse the same AppHost path and resource/volume names for the
retention exercise; different worktree paths have their own workload storage.

## Cleanup

```bash
bash scripts/aspire.sh stop \
  --apphost catalog/Catalog.AppHost/Catalog.AppHost.csproj --non-interactive
bash scripts/aspire.sh stop \
  --apphost terminals/Terminal.AppHost/Terminal.AppHost.csproj --non-interactive
```

Stop only an AppHost you started; do not use `--all` on a shared machine. Ordinary
stop preserves diagnostic history, the application file store, and named database
storage. Removing these is a separate, destructive choice; no exercise deletes them.

## Version and deployment boundaries

The Node resource's `WithTerminal()` and the frontend's
`PublishAsStaticWebsite()` are experimental 13.6 APIs; their diagnostics are
acknowledged narrowly at the call sites. PostgreSQL's `WithRepl()` is opt-in.
Docker Compose is the only modeled deployment target. `publish.sh compose` emits
and reviews artifacts; it does not build images, run Compose, provision cloud
resources, or change access permissions. See the deployment exercise before
treating published files as a production deployment.
