using Aspire.Hosting.Testing;
using Hex1b.Automation;

namespace FieldNotes.Tests;

public sealed class PsqlTapeTests
{
    private static async Task<string> ReadTape(string name)
    {
        await using var app = await DistributedApplicationTestingBuilder.CreateAsync<Projects.Catalog_AppHost>();
        return await File.ReadAllTextAsync(Path.Combine(app.AppHostDirectory, "..", "..", "terminals", name));
    }

    [Theory]
    [InlineData("catalog-inspect.tape")]
    [InlineData("catalog-inspect-negative.tape")]
    public async Task CheckedInTapePassesRealParserAndPreflight(string name)
    {
        var source = await ReadTape(name);
        var tape = new TapeParser().Parse(source);
        var validation = await new TapePlayer().ValidateAsync(tape, new TapePlaybackOptions { DefaultShell = "bash" });
        Assert.True(validation.CanExecute);
    }

    [Theory]
    [InlineData("catalog-inspect.tape")]
    [InlineData("catalog-inspect-negative.tape")]
    public async Task TapeRequiresClearedScreenBeforeReadOnlySql(string name)
    {
        var tape = await ReadTape(name);
        Assert.Contains("Enter\nWait+Line /CATALOG_READY> *$/\nCtrl+L\nWait+Screen /^CATALOG_READY>[ \\t\\r\\n]*$/", tape);
        Assert.True(tape.IndexOf("Ctrl+L", StringComparison.Ordinal) < tape.IndexOf("BEGIN READ ONLY;", StringComparison.Ordinal));
        Assert.True(tape.IndexOf("ROLLBACK;", StringComparison.Ordinal) < tape.IndexOf("Wait+Screen@5s", StringComparison.Ordinal));
        Assert.Contains("Set WaitTimeout 5s", tape);
        Assert.Contains("current_database()='catalogdb'", tape);
        Assert.Contains("array_agg(sku ORDER BY sku)=ARRAY['mug','notebook','sticker']::text[]", tape);
        Assert.Contains("THEN concat('catalogdb_','mug,notebook,sticker_','3_',CASE WHEN count(*)=", tape);
        Assert.Contains("ELSE 'UNEXPECTED_DATABASE_OR_ROWS_FAIL' END)", tape);
        Assert.DoesNotContain("string_agg", tape);
        Assert.DoesNotContain("current_database(),", tape);
        Assert.DoesNotMatch(@"\b(?:INSERT|UPDATE|DELETE|DROP|CREATE|TRUNCATE)\b", tape);
        Assert.DoesNotContain("RUN_NONCE", tape);
        Assert.DoesNotContain("EXPECTED_COUNT", tape);
        Assert.DoesNotContain("\\q", tape);
        foreach (var input in tape.Split('\n').Where(line => line.StartsWith("Type ", StringComparison.Ordinal)))
        {
            Assert.DoesNotContain("FIELD_NOTES_CATALOG", input);
        }

        var reset = tape.Split('\n').Single(line => line.StartsWith("Wait+Screen /", StringComparison.Ordinal));
        var pattern = reset[(reset.IndexOf('/') + 1)..^1];
        Assert.Matches(pattern, "CATALOG_READY>   \r\n    \r\n");
        Assert.DoesNotMatch(pattern, "FIELD_NOTES_CATALOG_catalogdb_mug,notebook,sticker_3_PASS\nCATALOG_READY> ");
        Assert.DoesNotMatch(pattern, "CATALOG_READY> partially typed input");
        Assert.DoesNotMatch(pattern, "CATALOG_READY> \nERROR: connection failed");
    }

    [Fact]
    public async Task NegativeControlChangesOnlyExpectedCountAndObservesFailBeforeDeliberateTimeout()
    {
        var positive = (await ReadTape("catalog-inspect.tape")).Split('\n')[1..];
        var negative = (await ReadTape("catalog-inspect-negative.tape")).Split('\n')[1..];
        var failureWait = "Wait+Screen@5s /(?m)^FIELD_NOTES_CATALOG_catalogdb_mug,notebook,sticker_3_FAIL[ \\t]*\\r?$/";
        Assert.Contains(failureWait, negative);
        Assert.Equal(positive.Select(line => line.Replace("CASE WHEN count(*)=3", "CASE WHEN count(*)=4", StringComparison.Ordinal)),
            negative.Where(line => line != failureWait));
    }

    [Theory]
    [InlineData("positive")]
    [InlineData("missing-result")]
    [InlineData("wrong-data")]
    [InlineData("negative")]
    public async Task RealTerminalResetPreventsPreviousRunFromSatisfyingANewWait(string scenario)
    {
        var positive = await ReadTape("catalog-inspect.tape");
        var second = scenario == "negative" ? await ReadTape("catalog-inspect-negative.tape") : positive;
        // A shell stands in for query output; this tests the PTY/reset/waits, not PostgreSQL.
        static string Simulate(string tape, string result) => string.Join('\n', tape.Split('\n').Select(line =>
            line.StartsWith("Type \"SELECT ", StringComparison.Ordinal)
                ? result.Length == 0 ? "Type \":\"" : $"Type \"echo FIELD_NOTES_CATALOG_'{result}'\""
                : line.Replace("BEGIN READ ONLY;", ":", StringComparison.Ordinal)
                    .Replace("ROLLBACK;", ":", StringComparison.Ordinal)))
            .Replace("Set WaitTimeout 5s", "", StringComparison.Ordinal)
            .Replace("@5s", "@500ms", StringComparison.Ordinal);
        var output = scenario switch
        {
            "missing-result" => "",
            "wrong-data" => "UNEXPECTED_DATABASE_OR_ROWS_FAIL",
            "negative" => "catalogdb_mug,notebook,sticker_3_FAIL",
            _ => "catalogdb_mug,notebook,sticker_3_PASS"
        };
        var tape = new TapeParser().Parse(
            "Set WaitTimeout 1s\nSet TypingSpeed 0\nType \"PS1='CATALOG_READY> '\"\nEnter\n" +
            Simulate(positive, "catalogdb_mug,notebook,sticker_3_PASS") + Simulate(second, output));
        var player = new TapePlayer();
        var options = new TapePlaybackOptions { DefaultShell = "bash" };
        if (scenario != "positive")
        {
            var error = await Assert.ThrowsAsync<TapePlaybackException>(() => player.PlayAsync(tape, options));
            var wait = Assert.IsType<TapeWaitCommand>(error.Command);
            Assert.Contains("_3_PASS", wait.Pattern);
            Assert.DoesNotContain("FIELD_NOTES_CATALOG_catalogdb_mug,notebook,sticker_3_PASS", error.TerminalText);
            if (scenario == "negative")
            {
                Assert.Contains("FIELD_NOTES_CATALOG_catalogdb_mug,notebook,sticker_3_FAIL", error.TerminalText);
                Assert.Equal(tape.Commands.OfType<TapeWaitCommand>().Last().Span, wait.Span);
            }
        }
        else
        {
            using var result = await player.PlayAsync(tape, options);
            Assert.Contains("FIELD_NOTES_CATALOG_catalogdb_mug,notebook,sticker_3_PASS", result.FinalSnapshot.GetScreenText());
        }
    }
}
