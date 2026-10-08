using Npgsql;

namespace FieldNotes.Catalog;

public static class CatalogDatabase
{
    public static async Task InitializeAsync(NpgsqlDataSource database, CancellationToken cancellationToken)
    {
        await using var command = database.CreateCommand("""
            CREATE TABLE IF NOT EXISTS catalog_items (
                sku text PRIMARY KEY,
                name text NOT NULL,
                price numeric(10, 2) NOT NULL CHECK (price >= 0)
            );
            INSERT INTO catalog_items (sku, name, price) VALUES
                ('notebook', 'Field notebook', 12.00),
                ('mug', 'Debugging mug', 15.00),
                ('sticker', 'Trace sticker', 3.00)
            ON CONFLICT (sku) DO NOTHING;
            """);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public static async Task<List<Product>> ReadAsync(NpgsqlDataSource database, CancellationToken cancellationToken)
    {
        await using var command = database.CreateCommand("SELECT sku, name, price FROM catalog_items ORDER BY sku");
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var items = new List<Product>();
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(new Product(reader.GetString(0), reader.GetString(1), reader.GetDecimal(2)));
        }
        return items;
    }
}

public sealed record Product(string Sku, string Name, decimal Price);
