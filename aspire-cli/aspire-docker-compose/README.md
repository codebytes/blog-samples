# Aspire Docker Compose Sample

This sample demonstrates deploying an Aspire application using Docker Compose as the compute environment, with a single-file AppHost.

## Blog Post

[Aspire CLI Part 2 - Deployment and Pipelines](https://chris-ayers.com/posts/aspire-cli-part-2/)

## Prerequisites

- [.NET SDK 10.0.100+](https://dotnet.microsoft.com/download)
- [Aspire CLI](https://aspire.dev/get-started/install-cli/)
- [Docker](https://www.docker.com/get-started)

## Getting Started

```bash
# Run locally with the Aspire dashboard
aspire run

# Publish Docker Compose artifacts
aspire publish -o ./artifacts

# Deploy to Docker Compose
aspire deploy

# Tear down
aspire do docker-compose-down-dc
```

## Project Structure

- **apphost.cs** - Single-file AppHost with Docker Compose compute environment
- **AspireDockerCompose.ApiService** - Weather API backend
- **AspireDockerCompose.Web** - Blazor frontend
- **AspireDockerCompose.ServiceDefaults** - Shared service discovery, resilience, and observability
