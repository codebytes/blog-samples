# Aspire Exec Sample

This sample demonstrates `aspire exec` for running commands in the context of Aspire resources with correct connection strings and environment variables. It includes EF Core with Postgres to showcase database migrations via `aspire exec`.

## Blog Post

[Aspire CLI Part 2 - Deployment and Pipelines](https://chris-ayers.com/posts/aspire-cli-part-2/)

## Prerequisites

- [.NET SDK 10.0.100+](https://dotnet.microsoft.com/download)
- [Aspire CLI](https://aspire.dev/get-started/install-cli/)
- [Docker](https://www.docker.com/get-started) (for Postgres and Redis containers)
- [dotnet-ef tool](https://learn.microsoft.com/ef/core/cli/dotnet) (`dotnet tool install --global dotnet-ef`)

## Resources

- **Postgres** with PgAdmin - database for the API
- **Redis** with RedisInsight - cache for the API
- **ApiService** - Weather API backend with EF Core, database, and cache references
- **Web** - Blazor frontend

## Getting Started

```bash
# Enable the exec feature (one-time)
aspire config set features.execCommandEnabled true

# Run locally with the Aspire dashboard
aspire run
```

The app auto-applies pending migrations on startup via `db.Database.Migrate()`.

## EF Core Migration Workflow

### Create a new migration

This runs offline and does not need a running database:

```bash
dotnet ef migrations add <MigrationName> --project AspireExec.ApiService
```

### Apply migrations with aspire exec

The key benefit of `aspire exec` is that it injects the correct `ConnectionStrings__appdb` environment variable so `dotnet ef` connects to the Aspire-managed Postgres container automatically - no hardcoded connection strings needed.

```bash
# Start Aspire in one terminal
aspire run

# In another terminal, apply migrations against the running database
aspire exec --start-resource appdb -- dotnet ef database update --project AspireExec.ApiService
```

### Other aspire exec examples

```bash
# Run psql against the Postgres container
aspire exec --resource postgres -- psql -c "SELECT version();"

# List tables in the appdb database
aspire exec --start-resource appdb -- psql -c "\dt"

# Ping the Redis cache
aspire exec --resource cache -- redis-cli PING
```

## API Endpoints

- `GET /` - Health check message
- `GET /weatherforecast` - Random in-memory weather data
- `GET /weatherforecast/db` - Weather data from Postgres

## Project Structure

- **AspireExec.AppHost** - Orchestrator with Postgres, Redis, API, and Web
- **AspireExec.ApiService** - Weather API with EF Core and Postgres
- **AspireExec.Web** - Blazor frontend
- **AspireExec.ServiceDefaults** - Shared service discovery, resilience, and observability
