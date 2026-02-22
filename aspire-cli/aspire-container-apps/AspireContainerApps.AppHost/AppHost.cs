var builder = DistributedApplication.CreateBuilder(args);

// Add Azure Container Apps as the compute environment for publishing/deploying
builder.AddAzureContainerAppEnvironment("env");

var apiService = builder.AddProject<Projects.AspireContainerApps_ApiService>("apiservice")
    .WithHttpHealthCheck("/health");

builder.AddProject<Projects.AspireContainerApps_Web>("webfrontend")
    .WithExternalHttpEndpoints()
    .WithHttpHealthCheck("/health")
    .WithReference(apiService)
    .WaitFor(apiService);

builder.Build().Run();
