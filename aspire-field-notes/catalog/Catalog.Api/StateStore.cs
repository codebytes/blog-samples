using System.Text.Json;

namespace FieldNotes.Catalog;

public sealed class StateStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly string path;
    private readonly SemaphoreSlim gate = new(1, 1);

    public Guid InstanceId { get; } = Guid.NewGuid();

    public StateStore(string directory)
    {
        if (string.IsNullOrWhiteSpace(directory) || !Path.IsPathFullyQualified(directory))
        {
            throw new InvalidOperationException("DATA_PATH must be an absolute, writable directory.");
        }
        Directory.CreateDirectory(directory);
        path = Path.Combine(directory, "state.json");
        // Fail at startup rather than silently discarding a corrupt retained file.
        if (File.Exists(path))
        {
            Deserialize(File.ReadAllText(path));
        }
    }

    public async Task<RetainedState> ReadAsync(CancellationToken cancellationToken = default)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            return await ReadFileAsync(cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<RetainedState> WriteAsync(string message, CancellationToken cancellationToken = default)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            var previous = await ReadFileAsync(cancellationToken);
            var state = new RetainedState(message, checked(previous.Revision + 1), DateTimeOffset.UtcNow);
            await File.WriteAllTextAsync(path + ".new", JsonSerializer.Serialize(state, JsonOptions), cancellationToken);
            File.Move(path + ".new", path, overwrite: true);
            return state;
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<RetainedState> ReadFileAsync(CancellationToken cancellationToken) =>
        File.Exists(path)
            ? Deserialize(await File.ReadAllTextAsync(path, cancellationToken))
            : new RetainedState(null, 0, null);

    private static RetainedState Deserialize(string json)
    {
        var state = JsonSerializer.Deserialize<RetainedState>(json, JsonOptions);
        if (state is null || state.Revision < 1 || string.IsNullOrWhiteSpace(state.Message) ||
            state.Message.Length > 256 || state.UpdatedUtc is null)
        {
            throw new InvalidDataException("Retained application state is invalid; it has not been reset.");
        }
        return state;
    }
}

public sealed record RetainedState(string? Message, long Revision, DateTimeOffset? UpdatedUtc);
