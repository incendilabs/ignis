using MongoDB.Driver;

using Testcontainers.MongoDb;

using Xunit;

namespace Ignis.Api.Tests;

public sealed class IntegrationFixture : IAsyncLifetime
{
    private readonly MongoDbContainer _mongo = new MongoDbBuilder()
        .WithImage("mongo:8")
        .Build();

    public IgnisApiFactory Factory { get; private set; } = null!;

    private static string BuildConnectionString(string raw)
    {
        var parsedUrl = new MongoUrl(raw);
        var mongoUrl = new MongoUrlBuilder(raw)
        {
            DatabaseName = string.IsNullOrWhiteSpace(parsedUrl.DatabaseName)
                ? "ignis_test"
                : parsedUrl.DatabaseName,
        };

        if (string.IsNullOrWhiteSpace(mongoUrl.AuthenticationSource))
            mongoUrl.AuthenticationSource = "admin";

        return mongoUrl.ToString();
    }

    public async ValueTask InitializeAsync()
    {
        await _mongo.StartAsync();
        var connectionString = BuildConnectionString(_mongo.GetConnectionString());

        Environment.SetEnvironmentVariable("StoreSettings__ConnectionString", connectionString);
        Environment.SetEnvironmentVariable("AuthSettings__Enabled", "true");
        Environment.SetEnvironmentVariable("AuthSettings__ConnectionString", connectionString);
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__ClientId", "test-client");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__ClientSecret", "test-secret");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__DisplayName", "Test Client");

        Factory = new IgnisApiFactory(connectionString);
    }

    public async ValueTask DisposeAsync()
    {
        Environment.SetEnvironmentVariable("StoreSettings__ConnectionString", null);
        Environment.SetEnvironmentVariable("AuthSettings__Enabled", null);
        Environment.SetEnvironmentVariable("AuthSettings__ConnectionString", null);
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__ClientId", null);
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__ClientSecret", null);
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__DisplayName", null);
        Factory.Dispose();
        await _mongo.DisposeAsync();
    }
}
