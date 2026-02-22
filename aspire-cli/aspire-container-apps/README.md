# Aspire Azure Container Apps Sample

This sample demonstrates deploying an Aspire application to Azure Container Apps.

## Blog Post

[Aspire CLI Part 2 - Deployment and Pipelines](https://chris-ayers.com/posts/aspire-cli-part-2/)

## Prerequisites

- [.NET SDK 10.0.100+](https://dotnet.microsoft.com/download)
- [Aspire CLI](https://aspire.dev/get-started/install-cli/)
- [Azure subscription](https://azure.microsoft.com/free/)
- [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) (for authentication)

## Getting Started

```bash
# Run locally with the Aspire dashboard
aspire run

# Publish Bicep artifacts
aspire publish -o ./artifacts

# Deploy to Azure Container Apps (interactive - prompts for subscription, location, resource group)
aspire deploy

# Non-interactive deployment (CI/CD)
Azure__SubscriptionId=<sub-id> Azure__Location=<region> Azure__ResourceGroup=<rg> aspire deploy
```

## Project Structure

- **AspireContainerApps.AppHost** - Orchestrator with Azure Container Apps compute environment
- **AspireContainerApps.ApiService** - Weather API backend
- **AspireContainerApps.Web** - Blazor frontend
- **AspireContainerApps.ServiceDefaults** - Shared observability configuration
