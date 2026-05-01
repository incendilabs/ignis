/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Text.Json;

using Ignis.Auth.Authorization;

using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.SignalR.Client;

using MongoDB.Driver;

using Testcontainers.MongoDb;

using Xunit;

namespace Ignis.Api.Tests;

public sealed class IntegrationFixture : IAsyncLifetime
{
    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:8").Build();

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
        "AuthSettings__Clients__0__AllowedScopes__1",
        "AuthSettings__Clients__0__AllowedScopes__2",
        "AuthSettings__Clients__0__AllowedScopes__3",
        "AuthSettings__Clients__0__AllowedScopes__4",
        "AuthSettings__Users__0__Subject",
        "AuthSettings__Users__0__Scopes__0",
        "AuthSettings__Users__0__Scopes__1",
        "AuthSettings__Users__0__Scopes__2",
        "AuthSettings__ExternalProviders__0__Name",
        "AuthSettings__ExternalProviders__0__Type",
        "AuthSettings__ExternalProviders__0__ClientId",
        "AuthSettings__ExternalProviders__0__ClientSecret",
        "FeatureManagement__AllowClearStore",
    ];

    public async ValueTask InitializeAsync()
    {
        await _mongo.StartAsync();
        var connectionString = BuildConnectionString(_mongo.GetConnectionString());

        Environment.SetEnvironmentVariable("StoreSettings__ConnectionString", connectionString);
        Environment.SetEnvironmentVariable("AuthSettings__ConnectionString", connectionString);
        Environment.SetEnvironmentVariable("FeatureManagement__AllowClearStore", "true");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__ClientId", "test-client");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__ClientSecret", "test-secret");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__DisplayName", "Test Client");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__AllowedGrantTypes__0", "client_credentials");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__AllowedGrantTypes__1", "authorization_code");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__RedirectUris__0", "http://localhost/callback");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__AllowedScopes__0", "maintenance/database.destructive");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__AllowedScopes__1", OperationsScopes.Read);
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__AllowedScopes__2", "openid");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__AllowedScopes__3", "profile");
        Environment.SetEnvironmentVariable("AuthSettings__Clients__0__AllowedScopes__4", "email");

        Environment.SetEnvironmentVariable("AuthSettings__Users__0__Subject", "test-user-id");
        Environment.SetEnvironmentVariable("AuthSettings__Users__0__Scopes__0", "openid");
        Environment.SetEnvironmentVariable("AuthSettings__Users__0__Scopes__1", "profile");
        Environment.SetEnvironmentVariable("AuthSettings__Users__0__Scopes__2", "email");

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

    public async Task<string> GetClientCredentialsTokenAsync(
        CancellationToken cancellationToken,
        string? scope = null)
    {
        var form = new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["client_id"] = "test-client",
            ["client_secret"] = "test-secret",
        };

        if (scope is not null)
            form["scope"] = scope;

        using var client = Factory.CreateClient();
        var response = await client.PostAsync("/connect/token",
            new FormUrlEncodedContent(form), cancellationToken);

        response.EnsureSuccessStatusCode();

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
        return json.RootElement.GetProperty("access_token").GetString()
            ?? throw new InvalidOperationException("No access_token in response.");
    }

    public HubConnection BuildHubConnection(string relativePath, string token) =>
        new HubConnectionBuilder()
            .WithUrl(
                new Uri(Factory.Server.BaseAddress, relativePath),
                options =>
                {
                    options.HttpMessageHandlerFactory = _ => Factory.Server.CreateHandler();
                    options.Transports = HttpTransportType.LongPolling;
                    options.AccessTokenProvider = () => Task.FromResult<string?>(token);
                })
            .Build();

    public async ValueTask DisposeAsync()
    {
        foreach (var key in EnvVarKeys)
            Environment.SetEnvironmentVariable(key, null);
        _factory?.Dispose();
        _externalAuthProviderFactory?.Dispose();
        await _mongo.DisposeAsync();
    }
}
