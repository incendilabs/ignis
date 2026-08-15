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

/// <summary>RP-initiated logout at <c>/connect/endsession</c>.</summary>
[Collection("IntegrationTests")]
public class EndSessionTests : IClassFixture<IntegrationFixture>
{
    private const string PostLogoutRedirectUri = "http://localhost/signed-out";

    private readonly IntegrationFixture _fixture;

    public EndSessionTests(IntegrationFixture fixture)
    {
        _fixture = fixture;
    }

    private static CancellationToken CT => TestContext.Current.CancellationToken;

    private HttpClient CreateSessionClient() =>
        _fixture.Factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = false,
            HandleCookies = true,
        });

    private static async Task<string?> AuthorizeAndReadCode(HttpClient client)
    {
        var (_, challenge) = OAuthTestFlow.GeneratePkce();
        var response = await OAuthTestFlow.AuthorizeAsync(client, challenge, CT, scope: "openid");
        return HttpUtility.ParseQueryString(response.Headers.Location!.Query)["code"];
    }

    [Fact]
    public async Task DiscoveryDocument_AdvertisesEndSessionEndpoint()
    {
        using var client = _fixture.Factory.CreateClient();

        var response = await client.GetAsync("/.well-known/openid-configuration", CT);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(CT));
        json.RootElement.GetProperty("end_session_endpoint").GetString()
            .Should().EndWith("/connect/endsession");
    }

    [Fact]
    public async Task Logout_EndsSession_SoNextAuthorizeChallengesLogin()
    {
        using var client = CreateSessionClient();
        await client.GetAsync("/test-login", CT);

        (await AuthorizeAndReadCode(client))
            .Should().NotBeNullOrEmpty("a live session issues a code without prompting");

        var logout = await client.GetAsync("/connect/endsession", CT);
        logout.StatusCode.Should().Be(HttpStatusCode.Redirect);

        var (_, challenge) = OAuthTestFlow.GeneratePkce();
        var afterLogout = await OAuthTestFlow.AuthorizeAsync(client, challenge, CT, scope: "openid");
        afterLogout.Headers.Location!.AbsolutePath.Should().Be("/connect/login");
    }

    [Fact]
    public async Task Logout_RedirectsToRegisteredPostLogoutRedirectUri_EchoingState()
    {
        using var client = CreateSessionClient();
        await client.GetAsync("/test-login", CT);

        var response = await client.GetAsync("/connect/endsession?" + string.Join("&",
            $"post_logout_redirect_uri={Uri.EscapeDataString(PostLogoutRedirectUri)}",
            "state=logout-state"), CT);

        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        var location = response.Headers.Location!;
        location.GetLeftPart(UriPartial.Path).Should().Be(PostLogoutRedirectUri);
        HttpUtility.ParseQueryString(location.Query)["state"].Should().Be("logout-state");
    }

    [Fact]
    public async Task Logout_WithUnregisteredPostLogoutRedirectUri_IsRejectedAndKeepsSession()
    {
        using var client = CreateSessionClient();
        await client.GetAsync("/test-login", CT);

        var response = await client.GetAsync(
            $"/connect/endsession?post_logout_redirect_uri={Uri.EscapeDataString("https://attacker.example/steal")}", CT);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // OpenIddict rejects before the handler runs, so the session survives.
        (await AuthorizeAndReadCode(client)).Should().NotBeNullOrEmpty();
    }
}
