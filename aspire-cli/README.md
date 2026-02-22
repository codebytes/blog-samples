# Aspire CLI Blog Series Samples

Companion samples for the [Aspire CLI blog series](https://chris-ayers.com/tags/aspire/) on [chris-ayers.com](https://chris-ayers.com).

## Blog Series

A three-part series on the .NET Aspire CLI for building, deploying, and debugging distributed applications.

| Part | Blog Post | Topics |
|------|-----------|--------|
| 1 | [Getting Started](https://chris-ayers.com/posts/aspire-cli-getting-started/) | `aspire new`, `aspire init`, `aspire run`, `aspire add`, `aspire update` |
| 2 | [Deployment and Pipelines](https://chris-ayers.com/posts/aspire-cli-part-2/) | `aspire publish`, `aspire deploy`, `aspire exec`, CI/CD |
| 3 | [MCP for AI Coding Agents](https://chris-ayers.com/posts/aspire-cli-part-3-mcp/) | `aspire mcp`, AI agent integration, observability |

## Samples

| Sample | Series Part | Description |
|--------|-------------|-------------|
| [aspire-docker-compose](aspire-docker-compose/) | Part 2 | Single-file AppHost with Docker Compose deployment |
| [aspire-container-apps](aspire-container-apps/) | Part 2 | Azure Container Apps deployment with Bicep |
| [aspire-kubernetes](aspire-kubernetes/) | Part 2 | Single-file AppHost with Kubernetes manifests |
| [aspire-exec](aspire-exec/) | Part 2 | EF Core migrations with `aspire exec`, Postgres, and Redis |
| [aspire-mcp](aspire-mcp/) | Part 3 | AI coding agent integration with MCP, Postgres, and Redis |

## Prerequisites

All samples require:

- [.NET SDK 10.0.100+](https://dotnet.microsoft.com/download)
- [Aspire CLI](https://aspire.dev/get-started/install-cli/)
- [Docker](https://www.docker.com/get-started)

See each sample's README for additional requirements.

## Quick Start

```bash
# Pick a sample and navigate to it
cd aspire-docker-compose

# Run locally with the Aspire dashboard
aspire run

# Publish deployment artifacts
aspire publish -o ./artifacts

# Deploy
aspire deploy
```
