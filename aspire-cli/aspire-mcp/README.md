# Aspire MCP Sample

This sample demonstrates connecting AI coding agents to a running Aspire application using MCP (Model Context Protocol). It includes Postgres, Redis, and EF Core to showcase real debugging scenarios.

## Blog Post

[Aspire CLI Part 3 - MCP for AI Coding Agents](https://chris-ayers.com/posts/aspire-cli-part-3-mcp/)

## Prerequisites

- [.NET SDK 10.0.100+](https://dotnet.microsoft.com/download)
- [Aspire CLI](https://aspire.dev/get-started/install-cli/)
- [Docker](https://www.docker.com/get-started) (for Postgres and Redis containers)
- An AI assistant with MCP support (VS Code Copilot, GitHub Copilot CLI, Claude Code, etc.)

## Getting Started

### 1. Configure MCP for your AI assistant

The MCP configuration files are already included in this sample:

- `.vscode/mcp.json` - VS Code Copilot
- `.mcp.json` - GitHub Copilot CLI
- `.claude/` - Claude Code

To regenerate for your environment:

```bash
aspire mcp init
```

> **Note:** The `aspire mcp` commands are being renamed to `aspire agent` in a future release. The generated configs already use `aspire agent mcp`.

### 2. Run the application

```bash
aspire run
```

### 3. Ask your AI assistant questions

With MCP connected, try prompts like:

- *"Are all my resources running and healthy?"*
- *"Show me the last 20 log entries from the apiservice"*
- *"What traces show errors?"*
- *"What is the connection string for appdb?"*
- *"Restart the apiservice"*
- *"What Aspire integrations are available for MongoDB?"*

## Resources

- **Postgres** with PgAdmin - database for the API
- **Redis** with RedisInsight - cache
- **ApiService** - Weather API with EF Core and Postgres (`/weatherforecast/db`)
- **Web** - Blazor frontend

## MCP Tools Available

Once connected, your AI assistant can use these tools:

| Tool | Description |
|------|-------------|
| `list_resources` | List all resources with state, health, endpoints |
| `execute_resource_command` | Run commands on resources |
| `list_console_logs` | Get console logs for a resource |
| `list_structured_logs` | Query structured logs |
| `list_traces` | List distributed traces |
| `list_integrations` | Show available Aspire integrations |
| `get_integration_docs` | Get docs for an integration package |

## Project Structure

- **AspireExec.AppHost** - Orchestrator with Postgres, Redis, API, and Web
- **AspireExec.ApiService** - Weather API with EF Core and Postgres
- **AspireExec.Web** - Blazor frontend
- **AspireExec.ServiceDefaults** - Shared service discovery, resilience, and observability
- **.vscode/mcp.json** - VS Code MCP configuration
- **.mcp.json** - GitHub Copilot CLI MCP configuration
- **.claude/** - Claude Code MCP configuration
- **.github/skills/aspire/** - Aspire skill file for GitHub Copilot
