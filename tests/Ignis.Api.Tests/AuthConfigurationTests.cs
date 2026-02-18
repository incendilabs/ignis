using System.Net;

using FluentAssertions;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

using MongoDB.Driver;

using Testcontainers.MongoDb;

namespace Ignis.Api.Tests;

[Collection("IntegrationTests")]
public class AuthConfigurationTests : IAsyncLifetime
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
        var mongoUrl = new MongoUrlBuilder(raw) { DatabaseName = "ignis_auth_test" };
        if (string.IsNullOrWhiteSpace(mongoUrl.AuthenticationSource))
            mongoUrl.AuthenticationSource = "admin";
        _connectionString = mongoUrl.ToString();
    }

    public async ValueTask DisposeAsync()
    {
        await _mongo.DisposeAsync();
    }

    private void SetEnvVars(Dictionary<string, string?> vars)
    {
        foreach (var (key, value) in vars)
            Environment.SetEnvironmentVariable(key, value);
    }

    private void ClearEnvVars(Dictionary<string, string?> vars)
    {
        foreach (var key in vars.Keys)
            Environment.SetEnvironmentVariable(key, null);
    }

    private WebApplicationFactory<Program> CreateFactory(Dictionary<string, string?> config)
    {
        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration((_, c) => c.AddInMemoryCollection(config));
            builder.UseEnvironment("Development");
        });
    }

    [Fact]
    public async Task TokenEndpoint_NotAvailable_WhenAuthDisabled()
    {
        var envVars = new Dictionary<string, string?>
        {
            ["AuthSettings__Enabled"] = "false",
            ["AuthSettings__ConnectionString"] = _connectionString,
            ["StoreSettings__ConnectionString"] = _connectionString,
        };
        SetEnvVars(envVars);
        try
        {
            await using var factory = CreateFactory(new Dictionary<string, string?>
            {
                ["StoreSettings:ConnectionString"] = _connectionString,
                ["SparkSettings:Endpoint"] = "https://localhost/fhir",
                ["SparkSettings:FhirRelease"] = "R4",
                ["SparkSettings:UseAsynchronousIO"] = "true",
                ["AuthSettings:Enabled"] = "false",
                ["AuthSettings:ConnectionString"] = _connectionString,
            });
            using var client = factory.CreateClient();

            var response = await client.PostAsync("/connect/token",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"] = "client_credentials",
                    ["client_id"] = "test-client",
                    ["client_secret"] = "test-secret",
                }), CT);

            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }
        finally
        {
            ClearEnvVars(envVars);
        }
    }

    [Fact]
    public async Task TokenEndpoint_Available_WhenAuthEnabled()
    {
        var envVars = new Dictionary<string, string?>
        {
            ["AuthSettings__Enabled"] = "true",
            ["AuthSettings__ConnectionString"] = _connectionString,
            ["AuthSettings__Clients__0__ClientId"] = "config-client",
            ["AuthSettings__Clients__0__ClientSecret"] = "config-secret",
            ["AuthSettings__Clients__0__DisplayName"] = "Config Client",
            ["StoreSettings__ConnectionString"] = _connectionString,
        };
        SetEnvVars(envVars);
        try
        {
            await using var factory = CreateFactory(new Dictionary<string, string?>
            {
                ["StoreSettings:ConnectionString"] = _connectionString,
                ["SparkSettings:Endpoint"] = "https://localhost/fhir",
                ["SparkSettings:FhirRelease"] = "R4",
                ["SparkSettings:UseAsynchronousIO"] = "true",
                ["AuthSettings:Enabled"] = "true",
                ["AuthSettings:ConnectionString"] = _connectionString,
                ["AuthSettings:Clients:0:ClientId"] = "config-client",
                ["AuthSettings:Clients:0:ClientSecret"] = "config-secret",
                ["AuthSettings:Clients:0:DisplayName"] = "Config Client",
            });
            using var client = factory.CreateClient();

            var response = await client.PostAsync("/connect/token",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"] = "client_credentials",
                    ["client_id"] = "config-client",
                    ["client_secret"] = "config-secret",
                }), CT);

            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }
        finally
        {
            ClearEnvVars(envVars);
        }
    }
}
