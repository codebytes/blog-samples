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
        throw new InvalidOperationException("Select Deployment:Target=compose explicitly.");
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

#pragma warning disable ASPIREJAVASCRIPT001 // PublishAsStaticWebsite is still experimental in 13.6.
web.PublishAsStaticWebsite("/api", api, options => options.StripPrefix = false);
#pragma warning restore ASPIREJAVASCRIPT001

web.WithHttpCommand(
    path: "/api/catalog",
    displayName: "Load catalog",
    endpointName: "http",
    commandName: "load-catalog",
    commandOptions: new HttpCommandOptions
    {
        Method = HttpMethod.Get,
        IsHighlighted = true,
        IconName = "ArrowDownload",
        PrepareRequest = context =>
        {
            context.HttpClient.Timeout = TimeSpan.FromSeconds(10);
            return Task.CompletedTask;
        },
        GetCommandResult = async context =>
        {
            var response = context.Response;
            var status = (int)response.StatusCode;
            var body = await response.Content.ReadAsStringAsync(context.CancellationToken);
            try
            {
                using var document = System.Text.Json.JsonDocument.Parse(body);
                var json = document.RootElement;
                if (json.ValueKind != System.Text.Json.JsonValueKind.Object ||
                    !json.TryGetProperty("traceId", out var trace) ||
                    trace.ValueKind != System.Text.Json.JsonValueKind.String ||
                    string.IsNullOrWhiteSpace(trace.GetString()))
                {
                    return CommandResults.Failure(
                        $"HTTP {status}: catalog response has no trace ID.", body, CommandResultFormat.Json);
                }

                var title = response.IsSuccessStatusCode
                    ? "Catalog loaded"
                    : json.TryGetProperty("title", out var problemTitle) &&
                        problemTitle.ValueKind == System.Text.Json.JsonValueKind.String
                        ? problemTitle.GetString()
                        : response.ReasonPhrase;
                var traceId = trace.GetString();
                var message = $"HTTP {status}: {title}. Trace ID: {traceId}";
                var result = System.Text.Json.JsonSerializer.Serialize(new { status, traceId, response = json });
                return response.IsSuccessStatusCode
                    ? CommandResults.Success(message, result, CommandResultFormat.Json)
                    : CommandResults.Failure(message, result, CommandResultFormat.Json);
            }
            catch (System.Text.Json.JsonException)
            {
                return CommandResults.Failure(
                    $"HTTP {status}: response was not valid JSON; trace ID unavailable.",
                    body, CommandResultFormat.Text);
            }
        }
    });

builder.Build().Run();
