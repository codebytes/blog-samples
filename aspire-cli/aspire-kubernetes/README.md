# Aspire Kubernetes Sample

This sample demonstrates deploying an Aspire application to Kubernetes, with a single-file AppHost.

## Blog Post

[Aspire CLI Part 2 - Deployment and Pipelines](https://chris-ayers.com/posts/aspire-cli-part-2/)

## Prerequisites

- [.NET SDK 10.0.100+](https://dotnet.microsoft.com/download)
- [Aspire CLI](https://aspire.dev/get-started/install-cli/)
- [Docker](https://www.docker.com/get-started) (for building container images)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) (for applying manifests)
- A Kubernetes cluster (local or remote)

## Getting Started

```bash
# Run locally with the Aspire dashboard
aspire run

# Publish Kubernetes manifests
aspire publish -o ./k8s-output

# Apply manifests to your cluster
kubectl apply -f ./k8s-output
```

## Project Structure

- **apphost.cs** - Single-file AppHost with Kubernetes compute environment
- **AspireKubernetes.ApiService** - Weather API backend
- **AspireKubernetes.Web** - Blazor frontend
- **AspireKubernetes.ServiceDefaults** - Shared service discovery, resilience, and observability
