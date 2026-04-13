using MongoDB.Driver;

using Testcontainers.MongoDb;

using Xunit;

namespace Ignis.Api.Tests;

public sealed class IntegrationFixture : IAsyncLifetime
{
    private readonly MongoDbContainer _mongo = new MongoDbBuilder()
        .WithImage("mongo:8")
        .Build();

    private IgnisApiFactory? _factory;
    private IgnisApiFactory? _externalAuthProviderFactory;

    public IgnisApiFactory Factory => _factory
        ?? throw new InvalidOperationException("Fixture not initialized. Ensure InitializeAsync has run.");
    public IgnisApiFactory ExternalAuthProviderFactory => _externalAuthProviderFactory
        ?? throw new InvalidOperationException("Fixture not initialized. Ensure InitializeAsync has run.");

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
        "AuthSettings__ConnectionString",
        "AuthSettings__Clients__0__ClientId",
        "AuthSettings__Clients__0__ClientSecret",
        "AuthSettings__Clients__0__DisplayName",
        "AuthSettings__Clients__0__AllowedGrantTypes__0",
        "AuthSettings__Clients__0__AllowedGrantTypes__1",
        "AuthSettings__Clients__0__RedirectUris__0",
        "AuthSettings__Clients__0__AllowedScopes__0",
        "AuthSettings__ExternalProviders__0__Name",
        "AuthSettings__ExternalProviders__0__Type",
        "AuthSettings__ExternalProviders__0__ClientId",
        "AuthSettings__ExternalProviders__0__ClientSecret",
    ];

    public async ValueTask InitializeAsync()
    {
        await _mongo.StartAsync();
        var connectionString = BuildConnectionString(_mongo.GetConnectionString());

        Environment.SetEnvironmentVariable("StoreSettings__ConnectionString", connectionString);
        Environment.SetEnvironmentVariable("AuthSettings__ConnectionString", connectionString);
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__ClientId", "test-client");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__ClientSecret", "test-secret");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__DisplayName", "Test Client");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__AllowedGrantTypes__0", "client_credentials");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__AllowedGrantTypes__1", "authorization_code");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__RedirectUris__0", "http://localhost/callback");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__AllowedScopes__0", "maintenance/database.destructive");

        // Create Factory without ExternalProviders.
        _factory = new IgnisApiFactory(connectionString);
        _ = _factory.Server; // Force initialization before changing env vars.

        // WebApplicationFactory + minimal hosting: env vars are the only config source
        // that builder.Configuration.Bind() sees, since ConfigureAppConfiguration runs
        // too late. See https://github.com/dotnet/aspnetcore/issues/37680
        Environment.SetEnvironmentVariable("AuthSettings__ExternalProviders__0__Name", "GitHub");
        Environment.SetEnvironmentVariable("AuthSettings__ExternalProviders__0__Type", "GitHub");
        Environment.SetEnvironmentVariable("AuthSettings__ExternalProviders__0__ClientId", "test-github-id");
        Environment.SetEnvironmentVariable("AuthSettings__ExternalProviders__0__ClientSecret", "test-github-secret");
        _externalAuthProviderFactory = new IgnisApiFactory(connectionString);
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var key in EnvVarKeys)
            Environment.SetEnvironmentVariable(key, null);
        _factory?.Dispose();
        _externalAuthProviderFactory?.Dispose();
        await _mongo.DisposeAsync();
    }
}
