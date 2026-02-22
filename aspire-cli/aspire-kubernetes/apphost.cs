#:package Aspire.Hosting.Kubernetes@13.3.0-preview.1.26121.1
#:sdk Aspire.AppHost.Sdk@13.3.0-preview.1.26121.1
#:property NoWarn=ASPIRECSHARPAPPS001

var builder = DistributedApplication.CreateBuilder(args);

// Add Kubernetes as the compute environment for publishing/deploying
builder.AddKubernetesEnvironment("k8s");

var apiService = builder.AddCSharpApp("apiservice", "./AspireKubernetes.ApiService")
    .WithHttpHealthCheck("/health");

builder.AddCSharpApp("webfrontend", "./AspireKubernetes.Web")
    .WithExternalHttpEndpoints()
    .WithHttpHealthCheck("/health")
    .WithReference(apiService)
    .WaitFor(apiService);

builder.Build().Run();
