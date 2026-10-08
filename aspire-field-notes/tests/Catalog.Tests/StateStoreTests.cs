using System.Text.Json;
using FieldNotes;
using FieldNotes.Catalog;
using Microsoft.Extensions.Configuration;

namespace Catalog.Tests;

public sealed class StateStoreTests : IDisposable
{
    private readonly string directory = Path.Combine(Path.GetTempPath(), "field-notes-tests-" + Guid.NewGuid());

    [Fact]
    public async Task RetainsStateButNotInstanceIdentity()
    {
        var first = new StateStore(directory);
        Assert.Equal(0, (await first.ReadAsync()).Revision);
        var written = await first.WriteAsync("retained note");
        var restarted = new StateStore(directory);

        Assert.NotEqual(first.InstanceId, restarted.InstanceId);
        Assert.Equal(written, await restarted.ReadAsync());
        Assert.Equal(2, (await restarted.WriteAsync("second note")).Revision);
    }

    [Fact]
    public async Task SerializesConcurrentWrites()
    {
        var store = new StateStore(directory);
        var writes = await Task.WhenAll(Enumerable.Range(1, 20).Select(index => store.WriteAsync($"note {index}")));
        Assert.Equal(Enumerable.Range(1, 20).Select(value => (long)value), writes.Select(state => state.Revision).Order());
        Assert.Equal(20, (await store.ReadAsync()).Revision);
    }

    [Theory]
    [InlineData("")]
    [InlineData("relative/path")]
    public void RejectsNonPortablePaths(string path)
    {
        Assert.Throws<InvalidOperationException>(() => new StateStore(path));
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("null")]
    [InlineData("{\"message\":\"note\",\"revision\":0,\"updatedUtc\":\"2026-01-01T00:00:00Z\"}")]
    public void DoesNotResetInvalidRetainedState(string content)
    {
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, "state.json");
        File.WriteAllText(path, content);
        Assert.Throws<InvalidDataException>(() => new StateStore(directory));
        Assert.Equal(content, File.ReadAllText(path));
    }

    [Fact]
    public void DoesNotResetMalformedJson()
    {
        Directory.CreateDirectory(directory);
        File.WriteAllText(Path.Combine(directory, "state.json"), "{");
        Assert.Throws<JsonException>(() => new StateStore(directory));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void MissingRequiredConfigurationNamesOnlyTheKey(string? value)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Catalog:Region"] = value })
            .Build();
        var exception = Assert.Throws<InvalidOperationException>(() => configuration.Require("Catalog:Region"));
        Assert.Contains("Catalog:Region", exception.Message);
    }

    public void Dispose()
    {
        if (Directory.Exists(directory))
        {
            Directory.Delete(directory, recursive: true);
        }
    }
}
