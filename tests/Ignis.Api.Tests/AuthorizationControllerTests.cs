/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Buffers.Text;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Web;

using FluentAssertions;

using Microsoft.AspNetCore.Mvc.Testing;

namespace Ignis.Api.Tests;

[Collection("IntegrationTests")]
public class AuthorizationControllerTests : IClassFixture<IntegrationFixture>
{
    private readonly IntegrationFixture _fixture;

    public AuthorizationControllerTests(IntegrationFixture fixture)
    {
        _fixture = fixture;
    }

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Token_WithValidClientCredentials_ReturnsAccessToken()
    {
        using var client = _fixture.Factory.CreateClient();

        var response = await client.PostAsync("/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = "test-client",
                ["client_secret"] = "test-secret",
            }), CT);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(CT));
        json.RootElement.GetProperty("access_token").GetString().Should().NotBeNullOrEmpty();
        json.RootElement.GetProperty("token_type").GetString().Should().Be("Bearer");
    }

    [Fact]
    public async Task Token_WithInvalidClient_ReturnsUnauthorized()
    {
        using var client = _fixture.Factory.CreateClient();

        var response = await client.PostAsync("/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = "nonexistent",
                ["client_secret"] = "wrong",
            }), CT);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Token_WithWrongSecret_ReturnsUnauthorized()
    {
        using var client = _fixture.Factory.CreateClient();

        var response = await client.PostAsync("/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = "test-client",
                ["client_secret"] = "wrong-secret",
            }), CT);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Token_WithUnsupportedGrantType_ReturnsBadRequest()
    {
        using var client = _fixture.Factory.CreateClient();

        var response = await client.PostAsync("/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "password",
                ["client_id"] = "test-client",
                ["client_secret"] = "test-secret",
            }), CT);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Authorize_WithoutSession_RedirectsToLogin()
    {
        using var client = _fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
        });

        var (_, codeChallenge) = GeneratePkce();

        // Push the authorization request via PAR.
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
        var parJson = JsonDocument.Parse(await parResponse.Content.ReadAsStringAsync(CT));
        var requestUri = parJson.RootElement.GetProperty("request_uri").GetString();
        requestUri.Should().NotBeNullOrEmpty();

        // Redirect to authorize with the request_uri — should redirect to login.
        var authorizeUrl = $"/connect/authorize?client_id=test-client&request_uri={Uri.EscapeDataString(requestUri!)}";
        var response = await client.GetAsync(authorizeUrl, CT);

        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        response.Headers.Location!.AbsolutePath.Should().Be("/connect/login");
    }

    [Fact]
    public async Task AuthCodeFlow_WithPkce_ReturnsAccessToken()
    {
        using var client = _fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true,
        });

        // 1. Sign in as a test user to establish a session cookie.
        var loginResponse = await client.GetAsync("/test-login", CT);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // 2. Push the authorization request via PAR.
        var (codeVerifier, codeChallenge) = GeneratePkce();
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
        var parJson = JsonDocument.Parse(await parResponse.Content.ReadAsStringAsync(CT));
        var requestUri = parJson.RootElement.GetProperty("request_uri").GetString();
        requestUri.Should().NotBeNullOrEmpty();

        // 3. Redirect to authorize with the request_uri.
        var authorizeUrl = $"/connect/authorize?client_id=test-client&request_uri={Uri.EscapeDataString(requestUri!)}";
        var authorizeResponse = await client.GetAsync(authorizeUrl, CT);

        authorizeResponse.StatusCode.Should().Be(HttpStatusCode.Redirect);
        var location = authorizeResponse.Headers.Location!;
        var queryParams = HttpUtility.ParseQueryString(location.Query);
        var code = queryParams["code"];
        code.Should().NotBeNullOrEmpty("the authorization endpoint should issue a code");

        // 4. Exchange the authorization code + client_secret for an access token.
        var tokenResponse = await client.PostAsync("/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = code!,
                ["redirect_uri"] = "http://localhost/callback",
                ["client_id"] = "test-client",
                ["client_secret"] = "test-secret",
                ["code_verifier"] = codeVerifier,
            }), CT);

        tokenResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var json = JsonDocument.Parse(await tokenResponse.Content.ReadAsStringAsync(CT));
        json.RootElement.GetProperty("access_token").GetString().Should().NotBeNullOrEmpty();
        json.RootElement.GetProperty("token_type").GetString().Should().Be("Bearer");
    }

    [Fact]
    public async Task AuthCodeFlow_WithoutPkce_ReturnsBadRequest()
    {
        using var client = _fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true,
        });

        // Sign in first
        await client.GetAsync("/test-login", CT);

        // Push authorization request without code_challenge => should fail
        var parResponse = await client.PostAsync("/connect/par",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["response_type"] = "code",
                ["client_id"] = "test-client",
                ["client_secret"] = "test-secret",
                ["redirect_uri"] = "http://localhost/callback",
            }), CT);

        parResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Authorize_WithoutPar_ReturnsBadRequest()
    {
        using var client = _fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true,
        });

        await client.GetAsync("/test-login", CT);

        var (_, codeChallenge) = GeneratePkce();

        // Direct authorize request without using PAR => should be rejected
        var authorizeUrl = "/connect/authorize?" + string.Join("&",
            "response_type=code",
            "client_id=test-client",
            $"redirect_uri={Uri.EscapeDataString("http://localhost/callback")}",
            $"code_challenge={codeChallenge}",
            "code_challenge_method=S256");

        var response = await client.GetAsync(authorizeUrl, CT);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private static (string codeVerifier, string codeChallenge) GeneratePkce()
    {
        var verifierBytes = new byte[32];
        RandomNumberGenerator.Fill(verifierBytes);
        var codeVerifier = Base64Url.EncodeToString(verifierBytes);

        var challengeBytes = SHA256.HashData(Encoding.ASCII.GetBytes(codeVerifier));
        var codeChallenge = Base64Url.EncodeToString(challengeBytes);

        return (codeVerifier, codeChallenge);
    }
}
