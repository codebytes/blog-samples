var builder = DistributedApplication.CreateBuilder(args);

#pragma warning disable ASPIRETERMINAL001 // Resource terminals are experimental in 13.6.
builder.AddExecutable("node-repl", "node", ".", "--interactive")
    .WithEnvironment("NODE_REPL_HISTORY", "")
    .WithTerminal(options =>
    {
        options.Columns = 160;
        options.Rows = 30;
    });
#pragma warning restore ASPIRETERMINAL001

builder.Build().Run();
