using System.Diagnostics;
using FieldNotes;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();
if (!bool.TryParse(builder.Configuration.Require("Inventory:FaultEnabled"), out var faultEnabled))
{
    throw new InvalidOperationException("Inventory:FaultEnabled must be true or false.");
}

var app = builder.Build();
app.MapDefaultEndpoints();
app.MapGet("/inventory", (ILogger<Program> logger) =>
{
    var traceId = Activity.Current?.TraceId.ToString();
    if (faultEnabled)
    {
        logger.LogWarning("Intentional inventory failure: returning HTTP 503. TraceId {TraceId}", traceId);
        return Results.Problem(
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Intentional inventory outage",
            detail: "The configured walkthrough fault affects this request, not /health.",
            extensions: new Dictionary<string, object?> { ["traceId"] = traceId });
    }

    logger.LogInformation("Inventory returned stock for 3 products. TraceId {TraceId}", traceId);
    return Results.Ok(new[]
    {
        new { sku = "notebook", quantity = 12 },
        new { sku = "mug", quantity = 8 },
        new { sku = "sticker", quantity = 30 }
    });
});
app.Run();
