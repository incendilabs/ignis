/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Collections.Immutable;
using System.Security.Claims;

using FluentAssertions;

using Ignis.Auth;

using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Ignis.Api.Tests;

public class AuthorizationHandlerTests
{
    private static ClaimsPrincipal Principal(params (string Type, string Value)[] claims) =>
        new(new ClaimsIdentity(claims.Select(c => new Claim(c.Type, c.Value))));

    [Fact]
    public void AddIdentityClaims_WithProfileScope_AddsNameAndPicture()
    {
        var source = Principal(
            (Claims.Subject, "skodde-123"),
            (Claims.Name, "Skodde"),
            (Claims.Picture, "https://avatar/skodde"),
            (Claims.Email, "skodde@example.com"));
        var target = new ClaimsIdentity();

        AuthorizationHandler.AddIdentityClaims(target, source,
            [Scopes.OpenId, Scopes.Profile]);

        target.FindFirst(Claims.Subject)?.Value.Should().Be("skodde-123");
        target.FindFirst(Claims.Name)?.Value.Should().Be("Skodde");
        target.FindFirst(Claims.Picture)?.Value.Should().Be("https://avatar/skodde");
        target.FindFirst(Claims.Email).Should().BeNull();
    }

    [Fact]
    public void AddIdentityClaims_WithEmailScope_AddsEmailButNotProfileFields()
    {
        var source = Principal(
            (Claims.Subject, "marsh-123"),
            (Claims.Name, "Marsh"),
            (Claims.Picture, "https://avatar/marsh"),
            (Claims.Email, "marsh@example.com"));
        var target = new ClaimsIdentity();

        AuthorizationHandler.AddIdentityClaims(target, source,
            [Scopes.OpenId, Scopes.Email]);

        target.FindFirst(Claims.Subject)?.Value.Should().Be("marsh-123");
        target.FindFirst(Claims.Email)?.Value.Should().Be("marsh@example.com");
        target.FindFirst(Claims.Name).Should().BeNull();
        target.FindFirst(Claims.Picture).Should().BeNull();
    }

    [Fact]
    public void AddIdentityClaims_WithOnlyOpenIdScope_AddsOnlySubject()
    {
        var source = Principal(
            (Claims.Subject, "user-123"),
            (Claims.Name, "Ada Lovelace"),
            (Claims.Email, "ada@example.com"));
        var target = new ClaimsIdentity();

        AuthorizationHandler.AddIdentityClaims(target, source,
            [Scopes.OpenId]);

        target.FindFirst(Claims.Subject)?.Value.Should().Be("user-123");
        target.FindFirst(Claims.Name).Should().BeNull();
        target.FindFirst(Claims.Picture).Should().BeNull();
        target.FindFirst(Claims.Email).Should().BeNull();
    }

    [Fact]
    public void AddIdentityClaims_FallsBackToClaimTypesUriWhenStandardClaimMissing()
    {
        var source = Principal(
            (ClaimTypes.NameIdentifier, "user-123"),
            (ClaimTypes.Name, "Ada"),
            (ClaimTypes.Email, "ada@example.com"));
        var target = new ClaimsIdentity();

        AuthorizationHandler.AddIdentityClaims(target, source,
            [Scopes.OpenId, Scopes.Profile, Scopes.Email]);

        target.FindFirst(Claims.Subject)?.Value.Should().Be("user-123");
        target.FindFirst(Claims.Name)?.Value.Should().Be("Ada");
        target.FindFirst(Claims.Email)?.Value.Should().Be("ada@example.com");
    }

    [Fact]
    public void AddIdentityClaims_WithoutSubjectInPrincipal_DoesNotAddSubject()
    {
        // Subject is required for the auth flow but the loop itself is
        // unaware — it only copies what's there. The required-check
        // lives in AuthorizeAsync.
        var source = Principal((Claims.Name, "Ada"));
        var target = new ClaimsIdentity();

        AuthorizationHandler.AddIdentityClaims(target, source,
            [Scopes.OpenId, Scopes.Profile]);

        target.FindFirst(Claims.Subject).Should().BeNull();
        target.FindFirst(Claims.Name)?.Value.Should().Be("Ada");
    }

    [Theory]
    [InlineData(Claims.Subject, new[] { Destinations.AccessToken, Destinations.IdentityToken })]
    [InlineData(Claims.Name, new[] { Destinations.IdentityToken })]
    [InlineData(Claims.Picture, new[] { Destinations.IdentityToken })]
    [InlineData(Claims.Email, new[] { Destinations.IdentityToken })]
    [InlineData("custom_resource_claim", new[] { Destinations.AccessToken })]
    public void GetDestinationsFor_ReturnsExpectedDestinations(
        string claimType,
        string[] expected)
    {
        AuthorizationHandler.GetDestinationsFor(claimType)
            .Should().BeEquivalentTo(expected);
    }
}
