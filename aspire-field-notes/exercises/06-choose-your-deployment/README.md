# 6. Choose your deployment: publish-only Docker Compose

This companion implements **one target: Docker Compose**. It demonstrates target
selection and generated-artifact review without becoming a multi-cloud framework.
Azure Container Apps, AKS, Kubernetes, App Service, and preview Azure environments
remain article comparisons; none is provisioned or exercised by this sample.

After [setup](../../README.md), stop the catalog AppHost you started so the publish
build does not conflict with live assemblies. Then select the target explicitly:

```bash
apphost=catalog/Catalog.AppHost/Catalog.AppHost.csproj
bash scripts/aspire.sh stop --apphost "$apphost" --non-interactive
bash scripts/publish.sh compose
```

Calling `publish.sh` without a target or with `azure`/`kubernetes` exits with a
usage error. In publish mode, the AppHost itself also rejects a missing or unknown
`Deployment:Target`. The script's underlying commands are:

```bash
Deployment__Target=compose bash scripts/aspire.sh publish \
  --apphost "$apphost" --list-steps --non-interactive
Deployment__Target=compose bash scripts/aspire.sh publish \
  --apphost "$apphost" --output-path "$PWD/artifacts/compose" --non-interactive
node scripts/review-compose.mjs artifacts/compose
```

The script never calls `aspire deploy`, `aspire do prepare-*`, `docker compose up`,
`kubectl`, `az`, or a cloud API. Listing steps previews the pipeline; it does not
execute them. Publication is not deployment.

## Review actual output

Open `artifacts/compose/docker-compose.yaml`, `.env`, and the generated build
artifacts. `review-compose.mjs` runs **only** `docker compose config
--no-interpolate --format json` and asserts:

- `api`, `inventory`, `postgres`, and `web` exist.
- API service discovery and a database reference are present.
- API state is a named volume at `/data`, with `DATA_PATH=/data`; PostgreSQL also
  has named storage.
- Only the frontend and optional dashboard have public host ports.
- The production proxy routes `/api/{**catch-all}` without stripping `/api`.
- The intentional inventory fault is disabled and a database-secret placeholder exists.

It writes a small `review.json` with no secret values and `deployed: false`.
It does not fill `.env` with user secrets or resolve image placeholders. Treat
environment-specific files produced by a future prepare/deploy step as sensitive.

| Concern | Local run | Published Compose model |
| --- | --- | --- |
| Browser routing | Vite's server-side proxy uses an endpoint-derived URL | YARP serves built static assets and proxies the same `/api` paths |
| API addressing | Aspire-managed loopback ports and service discovery | Internal service endpoints; no baked browser API URL |
| Application storage | Host directory supplied by `WithVolume` | Named volume mounted at `/data` |
| PostgreSQL | Local container, stable secret, named data | Container and named volume, secret input represented in generated configuration |
| Lifecycle | `aspire start` / scoped `stop` | Reviewed publication only; applying it is a separate explicit decision |

`AddDockerComposeEnvironment` is the supported target integration.
`PublishAsStaticWebsite` is still experimental in 13.6; the call's
`ASPIREJAVASCRIPT001` diagnostic is acknowledged in the AppHost. Vite's development
or preview server is not used as a production server.

Before any real deployment, decide image build/registry handling, secrets,
authentication/TLS, backups, and writable-volume ownership for the chosen
container user. `WithVolume` models a path; it does not supply a production backup
or shared-writer policy. Do not mistake these reviewed artifacts for a hardened
or cloud-tested application.

Reference: [Aspire Docker deployment](https://aspire.dev/deployment/docker-compose/).
