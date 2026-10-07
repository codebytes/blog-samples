using Microsoft.Extensions.Configuration;

var builder = DistributedApplication.CreateBuilder(args);

var target = builder.Configuration["Deployment:Target"];
if (target is not null && target != "compose")
{
    throw new InvalidOperationException("Deployment:Target must be 'compose'. This sample does not deploy to cloud targets.");
}

if (builder.ExecutionContext.IsPublishMode)
{
    if (target != "compose")
    {
        throw new InvalidOperationException("Select Deployment:Target=compose explicitly, or use scripts/publish.sh compose.");
    }

    builder.AddDockerComposeEnvironment("compose");
}

var password = builder.AddParameter("postgres-password", secret: true);
var region = builder.AddParameter("catalog-region", "local");
var postgres = builder.AddPostgres("postgres", password: password)
    .WithDataVolume();

if (builder.ExecutionContext.IsRunMode && builder.Configuration.GetValue<bool>("Diagnostics:EnableRepl"))
{
    postgres.WithRepl();
}

var catalogdb = postgres.AddDatabase("catalogdb");
var faultEnabled = builder.Configuration.GetValue<bool>("Inventory:FaultEnabled");
var inventory = builder.AddProject<Projects.Inventory_Api>("inventory")
    .WithEnvironment("Inventory__FaultEnabled", faultEnabled ? "true" : "false")
    .WithHttpHealthCheck("/health");

var api = builder.AddProject<Projects.Catalog_Api>("api")
    .WithReference(catalogdb)
    .WithReference(inventory)
    .WithEnvironment("Catalog__Region", region)
    .WithVolume("catalog-state", "/data", env: "DATA_PATH")
    .WithHttpHealthCheck("/health")
    .WaitFor(catalogdb)
    .WaitFor(inventory);

var web = builder.AddViteApp("web", "../web")
    .WithNpm(installCommand: "ci")
    .WithEnvironment("API_BASE_URL", api.GetEndpoint("http"))
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints()
    .WaitFor(api);

#pragma warning disable ASPIREJAVASCRIPT001 // The 13.6 static website publisher is experimental.
web.PublishAsStaticWebsite("/api", api, options => options.StripPrefix = false);
#pragma warning restore ASPIREJAVASCRIPT001

builder.Build().Run();
