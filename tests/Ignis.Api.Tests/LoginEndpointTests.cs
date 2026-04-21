/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Net;

using FluentAssertions;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

using MongoDB.Driver;

using Testcontainers.MongoDb;

namespace Ignis.Api.Tests;

[Collection("IntegrationTests")]
public class LoginEndpointTests : IAsyncLifetime
{
    private readonly MongoDbContainer _mongo = new MongoDbBuilder("mongo:8").Build();
    private readonly HashSet<string> _setEnvVars = new();

    private string _connectionString = "";

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await _mongo.StartAsync();
        var raw = _mongo.GetConnectionString();
        var mongoUrl = new MongoUrlBuilder(raw) { DatabaseName = "ignis_login_test" };
        if (string.IsNullOrWhiteSpace(mongoUrl.AuthenticationSource))
            mongoUrl.AuthenticationSource = "admin";
        _connectionString = mongoUrl.ToString();
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var key in _setEnvVars)
            Environment.SetEnvironmentVariable(key, null);
        await _mongo.DisposeAsync();
    }

    private void SetEnv(string key, string? value)
    {
        Environment.SetEnvironmentVariable(key, value);
        _setEnvVars.Add(key);
    }

    private WebApplicationFactory<Program> CreateFactory(
        IEnumerable<KeyValuePair<string, string?>>? extraEnvVars = null)
    {
        // WebApplicationFactory binds config via env vars before ConfigureAppConfiguration
        // runs, so external providers must be set as real environment variables.
        SetEnv("StoreSettings__ConnectionString", _connectionString);
        SetEnv("AuthSettings__ConnectionString", _connectionString);
        SetEnv("AuthSettings__Clients__0__ClientId", "test-client");
        SetEnv("AuthSettings__Clients__0__ClientSecret", "test-secret");
        SetEnv("AuthSettings__Clients__0__DisplayName", "Test Client");
        SetEnv("AuthSettings__Clients__0__AllowedGrantTypes__0", "client_credentials");

        if (extraEnvVars is not null)
            foreach (var (key, value) in extraEnvVars)
                SetEnv(key, value);

        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Test");
        });
    }

    private static KeyValuePair<string, string?>[] GitHubProvider(
        int index, string name, string clientId, string clientSecret) =>
        [
            new($"AuthSettings__ExternalProviders__{index}__Name", name),
            new($"AuthSettings__ExternalProviders__{index}__Type", "GitHub"),
            new($"AuthSettings__ExternalProviders__{index}__ClientId", clientId),
            new($"AuthSettings__ExternalProviders__{index}__ClientSecret", clientSecret),
        ];

    private static HttpClient CreateNonFollowingClient(WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

    [Fact]
    public async Task Login_WithNoProvidersConfigured_ReturnsServiceUnavailable()
    {
        await using var factory = CreateFactory();
        using var client = CreateNonFollowingClient(factory);

        var response = await client.GetAsync("/connect/login", CT);

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        var body = await response.Content.ReadAsStringAsync(CT);
        body.Should().Contain("No external identity providers");
    }

    [Fact]
    public async Task Login_WithSingleProvider_ChallengesThatProviderAutomatically()
    {
        await using var factory = CreateFactory(
            GitHubProvider(0, "GitHub", "fake-github-id", "fake-github-secret"));
        using var client = CreateNonFollowingClient(factory);

        var response = await client.GetAsync("/connect/login", CT);

        // Expect a redirect to GitHub's authorize endpoint (the challenge result).
        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        var location = response.Headers.Location;
        Assert.NotNull(location);
        location.Host.Should().Be("github.com");
    }

    [Fact]
    public async Task Login_WithMultipleProviders_RendersSelectionPage()
    {
        await using var factory = CreateFactory(
        [
            ..GitHubProvider(0, "GitHub", "gh-id-1", "gh-secret-1"),
            ..GitHubProvider(1, "GitHub-Enterprise", "gh-id-2", "gh-secret-2"),
        ]);
        using var client = CreateNonFollowingClient(factory);

        var response = await client.GetAsync("/connect/login?returnUrl=/home", CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("text/html");
        var body = await response.Content.ReadAsStringAsync(CT);
        body.Should().Contain("Continue with GitHub")
            .And.Contain("Continue with GitHub-Enterprise")
            .And.Contain("?provider=GitHub&amp;returnUrl=%2Fhome")
            .And.Contain("?provider=GitHub-Enterprise&amp;returnUrl=%2Fhome");
    }

    [Fact]
    public async Task Login_WithMultipleProvidersAndExplicitProvider_Challenges()
    {
        await using var factory = CreateFactory(
        [
            ..GitHubProvider(0, "GitHub", "gh-id-1", "gh-secret-1"),
            ..GitHubProvider(1, "GitHub-Enterprise", "gh-id-2", "gh-secret-2"),
        ]);
        using var client = CreateNonFollowingClient(factory);

        var response = await client.GetAsync("/connect/login?provider=GitHub-Enterprise", CT);

        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        var location = response.Headers.Location;
        Assert.NotNull(location);
        location.Host.Should().Be("github.com");
        location.Query.Should().Contain("client_id=gh-id-2");
    }

    [Fact]
    public async Task Login_WithUnknownProvider_Returns400()
    {
        await using var factory = CreateFactory(
            GitHubProvider(0, "GitHub", "gh-id", "gh-secret"));
        using var client = CreateNonFollowingClient(factory);

        var response = await client.GetAsync("/connect/login?provider=Bogus", CT);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var body = await response.Content.ReadAsStringAsync(CT);
        body.Should().Contain("Bogus");
    }
}
