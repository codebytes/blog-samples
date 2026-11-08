using Aspire.Hosting.ApplicationModel;
using Aspire.Hosting.Testing;

namespace FieldNotes.Tests;

public sealed class PsqlClientModelTests
{
    [Theory]
    [InlineData("run", true)]
    [InlineData("publish", false)]
    public async Task ClientIsDefaultInRunAndExcludedFromPublish(string operation, bool expected)
    {
        await using var app = await DistributedApplicationTestingBuilder.CreateAsync<Projects.Catalog_AppHost>(
            [$"--AppHost:Operation={operation}", "--Deployment:Target=compose"]);

        Assert.Equal(operation == "run", app.ExecutionContext.IsRunMode);
        Assert.Equal(expected, app.Resources.Any(resource => resource.Name == "psql-client"));
    }

    [Fact]
    public async Task ClientUsesServerImageAndManagedConnectionWithApiReadiness()
    {
        await using var app = await DistributedApplicationTestingBuilder.CreateAsync<Projects.Catalog_AppHost>(
            ["--Diagnostics:EnableRepl=true"]);
        var server = Assert.IsType<PostgresServerResource>(app.Resources.Single(resource => resource.Name == "postgres"));
        var database = Assert.IsType<PostgresDatabaseResource>(app.Resources.Single(resource => resource.Name == "catalogdb"));
        var client = Assert.IsType<ContainerResource>(app.Resources.Single(resource => resource.Name == "psql-client"));
        var serverImage = Assert.Single(server.Annotations.OfType<ContainerImageAnnotation>());
        var clientImage = Assert.Single(client.Annotations.OfType<ContainerImageAnnotation>());
        Assert.Equal(serverImage.Image, clientImage.Image);
        Assert.Equal(serverImage.Registry, clientImage.Registry);
        Assert.Equal(serverImage.Tag, clientImage.Tag);
        Assert.Equal(serverImage.SHA256, clientImage.SHA256);
        Assert.Contains(server.Annotations.OfType<ResourceCommandAnnotation>(), command => command.Name == "repl");
        Assert.Equal("psql", client.Entrypoint);
        Assert.Empty(client.Annotations.OfType<EndpointAnnotation>());
        Assert.Empty(client.Annotations.OfType<ContainerMountAnnotation>());
        var wait = Assert.Single(client.Annotations.OfType<WaitAnnotation>());
        Assert.Same(app.Resources.Single(resource => resource.Name == "api"), wait.Resource);
        Assert.Equal(WaitType.WaitUntilHealthy, wait.WaitType);

        var environment = new Dictionary<string, object>();
        var context = new EnvironmentCallbackContext(app.ExecutionContext, client, environment);
        foreach (var annotation in client.Annotations.OfType<EnvironmentCallbackAnnotation>())
        {
            await annotation.Callback(context);
        }

        static string Expression(object value) => Assert.IsAssignableFrom<IManifestExpressionProvider>(value).ValueExpression;
        Assert.Equal(Expression(server.Host), Expression(environment["PGHOST"]));
        Assert.Equal(Expression(server.Port), Expression(environment["PGPORT"]));
        Assert.Equal(database.DatabaseName, environment["PGDATABASE"]);
        Assert.Equal(Expression(server.UserNameReference), Expression(environment["PGUSER"]));
        Assert.Same(server.PasswordParameter, environment["PGPASSWORD"]);
        Assert.Equal("-c default_transaction_read_only=on -c statement_timeout=5000", environment["PGOPTIONS"]);
        Assert.Equal("/dev/null", environment["PSQL_HISTORY"]);

        var args = new List<object>();
        var argsContext = new CommandLineArgsCallbackContext(args, client) { ExecutionContext = app.ExecutionContext };
        foreach (var annotation in client.Annotations.OfType<CommandLineArgsCallbackAnnotation>())
        {
            await annotation.Callback(argsContext);
        }
        Assert.Equal(["-X", "-w", "-q", "-A", "-t", "-P", "pager=off",
            "-v", "ON_ERROR_STOP=on", "-v", "PROMPT1=CATALOG_READY> ",
            "-v", "PROMPT2=CATALOG_CONTINUE> "], args.Cast<string>());

        // TerminalAnnotation is internal in 13.6.4; inspect its public Options without starting resources.
        var terminal = Assert.Single(client.Annotations, annotation => annotation.GetType().Name == "TerminalAnnotation");
#pragma warning disable ASPIRETERMINAL001 // Match the AppHost's experimental terminal configuration.
        var options = Assert.IsType<TerminalOptions>(terminal.GetType().GetProperty("Options")?.GetValue(terminal));
        Assert.Equal(160, options.Columns);
        Assert.Equal(30, options.Rows);
#pragma warning restore ASPIRETERMINAL001
    }

    [Fact]
    public async Task TapeRegexMatchesAWholePaddedResultLine()
    {
        await using var app = await DistributedApplicationTestingBuilder.CreateAsync<Projects.Catalog_AppHost>();
        var tape = Path.Combine(app.AppHostDirectory, "..", "..", "terminals", "catalog-inspect.tape");
        var wait = File.ReadLines(tape).Last(line => line.StartsWith("Wait+Screen@5s ", StringComparison.Ordinal));
        var pattern = wait[(wait.IndexOf('/') + 1)..^1];
        var marker = "FIELD_NOTES_CATALOG_catalogdb_mug,notebook,sticker_3_PASS";
        Assert.Matches(pattern, $"sql input\r\n{marker}   \r\nCATALOG_READY> ");
        Assert.DoesNotMatch(pattern, $"{marker}_3_FAIL");
        Assert.DoesNotMatch(pattern, $"input echo {marker}");
        Assert.DoesNotMatch(pattern, marker.Replace("_3_PASS", "_4_FAIL", StringComparison.Ordinal));
        Assert.DoesNotMatch(pattern, marker.Replace("mug,notebook,sticker", "mug\r\nnotebook,sticker", StringComparison.Ordinal));
        Assert.DoesNotMatch(pattern, marker.Replace("mug,notebook,sticker", "mug,\u001b[2Jnotebook,sticker", StringComparison.Ordinal));
    }
}
