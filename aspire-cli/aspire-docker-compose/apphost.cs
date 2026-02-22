#:package Aspire.Hosting.Docker@13.3.0-preview.1.26121.1
#:sdk Aspire.AppHost.Sdk@13.3.0-preview.1.26121.1
#:property NoWarn=ASPIRECSHARPAPPS001

var builder = DistributedApplication.CreateBuilder(args);

// Add Docker Compose as the compute environment for publishing/deploying
builder.AddDockerComposeEnvironment("dc");

var apiService = builder.AddCSharpApp("apiservice", "./AspireDockerCompose.ApiService")
    .WithHttpHealthCheck("/health");

builder.AddCSharpApp("webfrontend", "./AspireDockerCompose.Web")
    .WithExternalHttpEndpoints()
    .WithHttpHealthCheck("/health")
    .WithReference(apiService)
    .WaitFor(apiService);

builder.Build().Run();
