using System.Diagnostics;
using System.Net;
using FieldNotes;
using FieldNotes.Catalog;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();
var region = builder.Configuration.Require("Catalog:Region");
builder.Configuration.Require("ConnectionStrings:catalogdb");
builder.Configuration.Require("services:inventory:http:0");
var state = new StateStore(builder.Configuration.Require("DATA_PATH"));
builder.Services.AddSingleton(state);
builder.AddNpgsqlDataSource("catalogdb");
builder.Services.AddHttpClient("inventory", client =>
{
    client.BaseAddress = new Uri("http://inventory");
    client.Timeout = TimeSpan.FromSeconds(5);
});
builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = context =>
        context.ProblemDetails.Extensions["traceId"] = Activity.Current?.TraceId.ToString());

var app = builder.Build();
app.UseExceptionHandler();
app.MapDefaultEndpoints();
await CatalogDatabase.InitializeAsync(app.Services.GetRequiredService<NpgsqlDataSource>(), app.Lifetime.ApplicationStopping);

app.MapGet("/api/catalog", async (
    NpgsqlDataSource database, IHttpClientFactory clients, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    var products = await CatalogDatabase.ReadAsync(database, cancellationToken);
    var traceId = Activity.Current?.TraceId.ToString();
    HttpResponseMessage response;
    try
    {
        response = await clients.CreateClient("inventory").GetAsync("/inventory", cancellationToken);
    }
    catch (HttpRequestException exception)
    {
        logger.LogError(exception, "Inventory transport failed. TraceId {TraceId}", traceId);
        return Results.Problem(statusCode: 503, title: "Inventory unreachable");
    }
    catch (OperationCanceledException exception) when (!cancellationToken.IsCancellationRequested)
    {
        logger.LogError(exception, "Inventory request timed out. TraceId {TraceId}", traceId);
        return Results.Problem(statusCode: 504, title: "Inventory timed out");
    }

    using (response)
    {
        if (!response.IsSuccessStatusCode)
        {
            logger.LogWarning("Inventory returned HTTP {StatusCode}; no retry. TraceId {TraceId}", (int)response.StatusCode, traceId);
            return Results.Problem(
                statusCode: response.StatusCode == HttpStatusCode.ServiceUnavailable ? 503 : 502,
                title: "Inventory unavailable",
                detail: "The downstream inventory request failed. Inspect this trace; health is a separate signal.",
                extensions: new Dictionary<string, object?>
                {
                    ["traceId"] = traceId,
                    ["dependencyStatus"] = (int)response.StatusCode
                });
        }

        var stock = await response.Content.ReadFromJsonAsync<Stock[]>(cancellationToken)
            ?? throw new InvalidOperationException("Inventory returned an empty response.");
        var quantities = stock.ToDictionary(item => item.Sku, item => item.Quantity);
        var items = products.Select(product => new
        {
            product.Sku,
            product.Name,
            product.Price,
            quantity = quantities[product.Sku]
        });
        logger.LogInformation("Catalog returned {Count} products for {Region}. TraceId {TraceId}", products.Count, region, traceId);
        return Results.Ok(new { items, region, traceId });
    }
});

app.MapGet("/api/state", async (StateStore store, CancellationToken cancellationToken) =>
    Results.Ok(new { store.InstanceId, state = await store.ReadAsync(cancellationToken) }));
app.MapPost("/api/state", async (
    StateWrite request, StateStore store, ILogger<Program> logger, CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Message) || request.Message.Length > 256)
    {
        logger.LogWarning("Rejected state write: message must contain 1-256 non-blank characters.");
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            ["message"] = ["Supply 1-256 non-blank characters."]
        });
    }

    var updated = await store.WriteAsync(request.Message, cancellationToken);
    logger.LogInformation("Saved application state revision {Revision}; message contents are not logged.", updated.Revision);
    return Results.Ok(new { store.InstanceId, state = updated });
});
app.Run();

internal sealed record Stock(string Sku, int Quantity);
internal sealed record StateWrite(string? Message);
