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

using FluentAssertions;

namespace Ignis.Api.Tests;

/// <summary>
/// The PAR + authorize round trip the server requires of every authorization
/// code request, shared by the tests that exercise it.
/// </summary>
internal static class OAuthTestFlow
{
    public const string ClientId = "test-client";
    public const string ClientSecret = "test-secret";
    public const string RedirectUri = "http://localhost/callback";

    public static (string Verifier, string Challenge) GeneratePkce()
    {
        var verifierBytes = new byte[32];
        RandomNumberGenerator.Fill(verifierBytes);
        var verifier = Base64Url.EncodeToString(verifierBytes);

        var challengeBytes = SHA256.HashData(Encoding.ASCII.GetBytes(verifier));
        return (verifier, Base64Url.EncodeToString(challengeBytes));
    }

    /// <summary>Pushes the request, then calls /connect/authorize with the returned request_uri.</summary>
    public static async Task<HttpResponseMessage> AuthorizeAsync(
        HttpClient client,
        string codeChallenge,
        CancellationToken cancellationToken,
        string? scope = null)
    {
        var form = new Dictionary<string, string>
        {
            ["response_type"] = "code",
            ["client_id"] = ClientId,
            ["client_secret"] = ClientSecret,
            ["redirect_uri"] = RedirectUri,
            ["code_challenge"] = codeChallenge,
            ["code_challenge_method"] = "S256",
        };
        if (scope is not null)
            form["scope"] = scope;

        var parResponse = await client.PostAsync(
            "/connect/par", new FormUrlEncodedContent(form), cancellationToken);
        parResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        using var parJson = JsonDocument.Parse(await parResponse.Content.ReadAsStringAsync(cancellationToken));
        var requestUri = parJson.RootElement.GetProperty("request_uri").GetString();
        requestUri.Should().NotBeNullOrEmpty();

        var response = await client.GetAsync(
            $"/connect/authorize?client_id={ClientId}&request_uri={Uri.EscapeDataString(requestUri!)}",
            cancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Redirect);
        return response;
    }
}
