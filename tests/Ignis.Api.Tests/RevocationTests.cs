/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Net;
using System.Text.Json;
using System.Web;

using FluentAssertions;

using Microsoft.AspNetCore.Mvc.Testing;

namespace Ignis.Api.Tests;

/// <summary>Token revocation (RFC 7009) at <c>/connect/revocation</c>.</summary>
[Collection("IntegrationTests")]
public class RevocationTests : IClassFixture<IntegrationFixture>
{
    private readonly IntegrationFixture _fixture;

    public RevocationTests(IntegrationFixture fixture)
    {
        _fixture = fixture;
    }

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    [Fact]
    public async Task DiscoveryDocument_AdvertisesRevocationEndpoint()
    {
        using var client = _fixture.Factory.CreateClient();

        var response = await client.GetAsync("/.well-known/openid-configuration", CT);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(CT));
        json.RootElement.GetProperty("revocation_endpoint").GetString()
            .Should().EndWith("/connect/revocation");
    }

    [Fact]
    public async Task Revocation_MakesRefreshTokenUnusable()
    {
        using var client = CreateSessionClient();
        var refreshToken = await IssueRefreshToken(client);

        var revokeResponse = await Revoke(client, refreshToken, OAuthTestFlow.ClientSecret);
        revokeResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // The grant is gone, so redeeming the revoked token must fail.
        var reuseResponse = await RedeemRefreshToken(client, refreshToken);
        reuseResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Revocation_WithWrongClientSecret_IsRejectedAndKeepsTokenUsable()
    {
        using var client = CreateSessionClient();
        var refreshToken = await IssueRefreshToken(client);

        var revokeResponse = await Revoke(client, refreshToken, "wrong-secret");
        revokeResponse.StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        // Rejected before anything was revoked, so the token still works.
        var refreshResponse = await RedeemRefreshToken(client, refreshToken);
        refreshResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Revocation_OfUnknownToken_ReturnsOk()
    {
        using var client = _fixture.Factory.CreateClient();

        // RFC 7009 §2.2: an invalid token is not an error — the client's goal is
        // already met, and reporting it would leak whether the token existed.
        var response = await Revoke(client, "not-a-real-token", OAuthTestFlow.ClientSecret);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private HttpClient CreateSessionClient() =>
        _fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true,
        });

    private static Task<HttpResponseMessage> Revoke(HttpClient client, string token, string clientSecret) =>
        client.PostAsync("/connect/revocation",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["token"] = token,
                ["token_type_hint"] = "refresh_token",
                ["client_id"] = OAuthTestFlow.ClientId,
                ["client_secret"] = clientSecret,
            }), CT);

    private static Task<HttpResponseMessage> RedeemRefreshToken(HttpClient client, string refreshToken) =>
        client.PostAsync("/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "refresh_token",
                ["refresh_token"] = refreshToken,
                ["client_id"] = OAuthTestFlow.ClientId,
                ["client_secret"] = OAuthTestFlow.ClientSecret,
            }), CT);

    /// <summary>Runs the auth code flow with offline_access and returns the refresh token.</summary>
    private static async Task<string> IssueRefreshToken(HttpClient client)
    {
        var loginResponse = await client.GetAsync("/test-login", CT);
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var (codeVerifier, codeChallenge) = OAuthTestFlow.GeneratePkce();
        var authorizeResponse = await OAuthTestFlow.AuthorizeAsync(
            client, codeChallenge, CT, scope: "openid offline_access");
        var code = HttpUtility.ParseQueryString(authorizeResponse.Headers.Location!.Query)["code"];
        code.Should().NotBeNullOrEmpty();

        var tokenResponse = await client.PostAsync("/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["code"] = code!,
                ["redirect_uri"] = OAuthTestFlow.RedirectUri,
                ["client_id"] = OAuthTestFlow.ClientId,
                ["client_secret"] = OAuthTestFlow.ClientSecret,
                ["code_verifier"] = codeVerifier,
            }), CT);
        tokenResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using var json = JsonDocument.Parse(await tokenResponse.Content.ReadAsStringAsync(CT));
        var refreshToken = json.RootElement.GetProperty("refresh_token").GetString();
        refreshToken.Should().NotBeNullOrEmpty("offline_access was requested and granted");
        return refreshToken!;
    }
}
