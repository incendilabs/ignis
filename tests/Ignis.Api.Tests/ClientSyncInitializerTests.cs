using System.Net;

using FluentAssertions;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

using MongoDB.Driver;

using Testcontainers.MongoDb;

namespace Ignis.Api.Tests;

[Collection("IntegrationTests")]
public class ClientSyncInitializerTests : IAsyncLifetime
{
    private readonly MongoDbContainer _mongo = new MongoDbBuilder()
        .WithImage("mongo:8")
        .Build();

    private string _connectionString = "";

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await _mongo.StartAsync();
        var raw = _mongo.GetConnectionString();
        var mongoUrl = new MongoUrlBuilder(raw) { DatabaseName = "ignis_sync_test" };
        if (string.IsNullOrWhiteSpace(mongoUrl.AuthenticationSource))
            mongoUrl.AuthenticationSource = "admin";
        _connectionString = mongoUrl.ToString();
    }

    public async ValueTask DisposeAsync()
    {
        await _mongo.DisposeAsync();
    }

    private (WebApplicationFactory<Program> factory, Dictionary<string, string?> envVars) CreateApp(
        Dictionary<string, string?> authConfig)
    {
        var baseConfig = new Dictionary<string, string?>
        {
            ["StoreSettings:ConnectionString"] = _connectionString,
            ["SparkSettings:Endpoint"] = "https://localhost/fhir",
            ["SparkSettings:FhirRelease"] = "R4",
            ["SparkSettings:UseAsynchronousIO"] = "true",
            ["AuthSettings:Enabled"] = "true",
            ["AuthSettings:ConnectionString"] = _connectionString,
        };

        var envVars = new Dictionary<string, string?>
        {
            ["StoreSettings__ConnectionString"] = _connectionString,
            ["AuthSettings__Enabled"] = "true",
            ["AuthSettings__ConnectionString"] = _connectionString,
        };

        foreach (var (key, value) in authConfig)
        {
            baseConfig[key] = value;
            envVars[key.Replace(":", "__")] = value;
        }

        foreach (var (key, value) in envVars)
            Environment.SetEnvironmentVariable(key, value);

        var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(baseConfig));
            builder.UseEnvironment("Development");
        });

        return (factory, envVars);
    }

    private static void ClearEnvVars(Dictionary<string, string?> envVars)
    {
        foreach (var key in envVars.Keys)
            Environment.SetEnvironmentVariable(key, null);
    }

    private static async Task<HttpStatusCode> RequestToken(
        HttpClient client, string clientId, string clientSecret)
    {
        var response = await client.PostAsync("/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = clientId,
                ["client_secret"] = clientSecret,
            }), CT);

        return response.StatusCode;
    }

    [Fact]
    public async Task Sync_CreatesClientsFromConfig()
    {
        var (factory, envVars) = CreateApp(new Dictionary<string, string?>
        {
            ["AuthSettings:Clients:0:ClientId"] = "sync-client-a",
            ["AuthSettings:Clients:0:ClientSecret"] = "secret-a",
            ["AuthSettings:Clients:0:AllowedGrantTypes:0"] = "client_credentials",
        });
        try
        {
            await using (factory)
            {
                using var client = factory.CreateClient();
                var status = await RequestToken(client, "sync-client-a", "secret-a");
                status.Should().Be(HttpStatusCode.OK);
            }
        }
        finally
        {
            ClearEnvVars(envVars);
        }
    }

    [Fact]
    public async Task Sync_UpdatesExistingClientSecret()
    {
        // First boot: create client with original secret
        var (factory1, envVars1) = CreateApp(new Dictionary<string, string?>
        {
            ["AuthSettings:Clients:0:ClientId"] = "sync-update",
            ["AuthSettings:Clients:0:ClientSecret"] = "old-secret",
            ["AuthSettings:Clients:0:AllowedGrantTypes:0"] = "client_credentials",
        });
        try
        {
            await using (factory1)
            {
                using var client1 = factory1.CreateClient();
                var status = await RequestToken(client1, "sync-update", "old-secret");
                status.Should().Be(HttpStatusCode.OK);
            }
        }
        finally
        {
            ClearEnvVars(envVars1);
        }

        // Second boot: same client ID, new secret
        var (factory2, envVars2) = CreateApp(new Dictionary<string, string?>
        {
            ["AuthSettings:Clients:0:ClientId"] = "sync-update",
            ["AuthSettings:Clients:0:ClientSecret"] = "new-secret",
            ["AuthSettings:Clients:0:AllowedGrantTypes:0"] = "client_credentials",
        });
        try
        {
            await using (factory2)
            {
                using var client2 = factory2.CreateClient();

                // Old secret should fail
                var oldStatus = await RequestToken(client2, "sync-update", "old-secret");
                oldStatus.Should().Be(HttpStatusCode.Unauthorized);

                // New secret should work
                var newStatus = await RequestToken(client2, "sync-update", "new-secret");
                newStatus.Should().Be(HttpStatusCode.OK);
            }
        }
        finally
        {
            ClearEnvVars(envVars2);
        }
    }

    [Fact]
    public async Task Sync_RemovesClientsNotInConfig()
    {
        // First boot: create two clients
        var (factory1, envVars1) = CreateApp(new Dictionary<string, string?>
        {
            ["AuthSettings:Clients:0:ClientId"] = "sync-keep",
            ["AuthSettings:Clients:0:ClientSecret"] = "secret-keep",
            ["AuthSettings:Clients:0:AllowedGrantTypes:0"] = "client_credentials",
            ["AuthSettings:Clients:1:ClientId"] = "sync-remove",
            ["AuthSettings:Clients:1:ClientSecret"] = "secret-remove",
            ["AuthSettings:Clients:1:AllowedGrantTypes:0"] = "client_credentials",
        });
        try
        {
            await using (factory1)
            {
                using var client1 = factory1.CreateClient();
                (await RequestToken(client1, "sync-keep", "secret-keep")).Should().Be(HttpStatusCode.OK);
                (await RequestToken(client1, "sync-remove", "secret-remove")).Should().Be(HttpStatusCode.OK);
            }
        }
        finally
        {
            ClearEnvVars(envVars1);
        }

        // Second boot: only one client in config
        var (factory2, envVars2) = CreateApp(new Dictionary<string, string?>
        {
            ["AuthSettings:Clients:0:ClientId"] = "sync-keep",
            ["AuthSettings:Clients:0:ClientSecret"] = "secret-keep",
            ["AuthSettings:Clients:0:AllowedGrantTypes:0"] = "client_credentials",
        });
        try
        {
            await using (factory2)
            {
                using var client2 = factory2.CreateClient();

                // Kept client still works
                (await RequestToken(client2, "sync-keep", "secret-keep")).Should().Be(HttpStatusCode.OK);

                // Removed client should fail
                (await RequestToken(client2, "sync-remove", "secret-remove")).Should().Be(HttpStatusCode.Unauthorized);
            }
        }
        finally
        {
            ClearEnvVars(envVars2);
        }
    }
}
