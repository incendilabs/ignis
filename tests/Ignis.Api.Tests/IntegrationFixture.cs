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

    private static readonly string[] EnvVarKeys =
    [
        "StoreSettings__ConnectionString",
        "AuthSettings__Enabled",
        "AuthSettings__ConnectionString",
        "AuthSettings__Clients__0__ClientId",
        "AuthSettings__Clients__0__ClientSecret",
        "AuthSettings__Clients__0__DisplayName",
        "AuthSettings__Clients__0__AllowedGrantTypes__0",
        "AuthSettings__Clients__0__AllowedGrantTypes__1",
        "AuthSettings__Clients__0__RedirectUris__0",
    ];

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
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__AllowedGrantTypes__0", "client_credentials");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__RedirectUris__0", "http://localhost/callback");

        Factory = new IgnisApiFactory(connectionString);
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var key in EnvVarKeys)
            Environment.SetEnvironmentVariable(key, null);
        Factory.Dispose();
        await _mongo.DisposeAsync();
    }
}
