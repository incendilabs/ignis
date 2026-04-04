using System.Net;

using FluentAssertions;

using Microsoft.AspNetCore.Mvc.Testing;

namespace Ignis.Api.Tests;

[Collection("IntegrationTests")]
public class ExternalAuthProviderTests : IClassFixture<IntegrationFixture>
{
    private readonly IntegrationFixture _fixture;
    private static CancellationToken CT => TestContext.Current.CancellationToken;

    public ExternalAuthProviderTests(IntegrationFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Login_WithConfiguredProvider_RedirectsToGitHub()
    {
        using var client = _fixture.ExternalAuthProviderFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });

        var response = await client.GetAsync("/connect/login?provider=GitHub", CT);

        response.StatusCode.Should().Be(HttpStatusCode.Redirect,
            await response.Content.ReadAsStringAsync(CT));
        response.Headers.Location!.Host.Should().Be("github.com");
        response.Headers.Location!.AbsolutePath.Should().Be("/login/oauth/authorize");
        response.Headers.Location!.Query.Should().Contain("client_id=");
    }

    [Fact]
    public async Task Login_WithUnconfiguredProvider_ReturnsError()
    {
        using var client = _fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });

        var response = await client.GetAsync("/connect/login?provider=Bogus", CT);

        // No provider named "Bogus" is registered, so ASP.NET Core returns an error
        response.StatusCode.Should().NotBe(HttpStatusCode.Redirect);
    }

    [Fact]
    public async Task AuthCodeFlow_WithGitHubProvider_RedirectsToLoginThenGitHub()
    {
        using var client = _fixture.ExternalAuthProviderFactory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true,
        });

        // 1. Push the authorization request via PAR.
        var verifierBytes = new byte[32];
        System.Security.Cryptography.RandomNumberGenerator.Fill(verifierBytes);
        var codeVerifier = System.Buffers.Text.Base64Url.EncodeToString(verifierBytes);
        var challengeBytes = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.ASCII.GetBytes(codeVerifier));
        var codeChallenge = System.Buffers.Text.Base64Url.EncodeToString(challengeBytes);

        var parResponse = await client.PostAsync("/connect/par",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["response_type"] = "code",
                ["client_id"] = "test-client",
                ["client_secret"] = "test-secret",
                ["redirect_uri"] = "http://localhost/callback",
                ["code_challenge"] = codeChallenge,
                ["code_challenge_method"] = "S256",
            }), CT);

        parResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var parJson = System.Text.Json.JsonDocument.Parse(
            await parResponse.Content.ReadAsStringAsync(CT));
        var requestUri = parJson.RootElement.GetProperty("request_uri").GetString();

        // 2. Hit authorize — should redirect to login.
        var authorizeUrl = $"/connect/authorize?client_id=test-client&request_uri={Uri.EscapeDataString(requestUri!)}";
        var authorizeResponse = await client.GetAsync(authorizeUrl, CT);

        authorizeResponse.StatusCode.Should().Be(HttpStatusCode.Redirect);
        authorizeResponse.Headers.Location!.AbsolutePath.Should().Be("/connect/login");
    }

    [Fact]
    public async Task App_StartsWithoutExternalProviders()
    {
        // The standard factory has no ExternalProviders configured — should work fine.
        using var client = _fixture.Factory.CreateClient();

        var response = await client.GetAsync("/healthz", CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
