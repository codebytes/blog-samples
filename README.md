# Blog Samples

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Code samples accompanying blog posts at [chris-ayers.com](https://chris-ayers.com).

Each subdirectory contains a self-contained sample with its own README, prerequisites, and getting started instructions.

## Aspire CLI Series

A three-part series on the .NET Aspire CLI for building, deploying, and debugging distributed applications.

| Part | Blog Post | Topics |
|------|-----------|--------|
| 1 | [Getting Started](https://chris-ayers.com/posts/aspire-cli-getting-started/) | `aspire new`, `aspire init`, `aspire run`, `aspire add`, `aspire update` |
| 2 | [Deployment and Pipelines](https://chris-ayers.com/posts/aspire-cli-part-2/) | `aspire publish`, `aspire deploy`, `aspire exec`, CI/CD |
| 3 | [MCP for AI Coding Agents](https://chris-ayers.com/posts/aspire-cli-part-3-mcp/) | `aspire mcp`, AI agent integration, observability |

### Samples

| Sample | Series Part | Description |
|--------|-------------|-------------|
| [aspire-docker-compose](aspire-cli/aspire-docker-compose/) | Part 2 | Single-file AppHost with Docker Compose deployment |
| [aspire-container-apps](aspire-cli/aspire-container-apps/) | Part 2 | Azure Container Apps deployment with Bicep |
| [aspire-kubernetes](aspire-cli/aspire-kubernetes/) | Part 2 | Single-file AppHost with Kubernetes manifests |
| [aspire-exec](aspire-cli/aspire-exec/) | Part 2 | EF Core migrations with `aspire exec`, Postgres, and Redis |
| [aspire-mcp](aspire-cli/aspire-mcp/) | Part 3 | AI coding agent integration with MCP, Postgres, and Redis |

### Prerequisites

All Aspire CLI samples require:

- [.NET SDK 10.0.100+](https://dotnet.microsoft.com/download)
- [Aspire CLI](https://aspire.dev/get-started/install-cli/)
- [Docker](https://www.docker.com/get-started)

See each sample's README for additional requirements.

## Contributing

Found an issue or have a suggestion? [Open an issue](https://github.com/codebytes/blog-samples/issues) or submit a pull request.

## License

This project is licensed under the MIT License.
