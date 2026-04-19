/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Security.Claims;

using FluentAssertions;

using Ignis.Auth.Authorization;

using Microsoft.AspNetCore.Authorization;

namespace Ignis.Api.Tests.Authorization;

public class ScopeAuthorizationHandlerTests
{
    private const string TargetScope = "maintenance/database.read";

    [Theory]
    // RFC 6749 / 9068 form: single claim, space-separated values (Keycloak, Auth0, Azure AD v2)
    [InlineData("scope", "maintenance/database.read", true)]
    [InlineData("scope", "openid email maintenance/database.read", true)]
    [InlineData("scope", "openid email", false)]
    [InlineData("scope", "", false)]
    // Microsoft identity platform form
    [InlineData("scp", "maintenance/database.read", true)]
    [InlineData("scp", "openid maintenance/database.read profile", true)]
    [InlineData("scp", "user.read", false)]
    // OpenIddict form: one claim per scope
    [InlineData("oi_scp", "maintenance/database.read", true)]
    // Substring traps must not match
    [InlineData("scope", "maintenance/database.read.extra", false)]
    [InlineData("scope", "prefix-maintenance/database.read", false)]
    // Unknown claim types are ignored
    [InlineData("permissions", "maintenance/database.read", false)]
    public async Task SingleClaim_GrantsAccessOnlyForExactScopeMatch(
        string claimType, string claimValue, bool shouldSucceed)
    {
        var principal = PrincipalWith((claimType, claimValue));

        var succeeded = await RunHandlerAsync(principal, TargetScope);

        succeeded.Should().Be(shouldSucceed);
    }

    [Fact]
    public async Task MultipleOpenIddictClaims_GrantAccessWhenAnyMatches()
    {
        // OpenIddict emits one oi_scp claim per scope.
        var principal = PrincipalWith(
            ("oi_scp", "openid"),
            ("oi_scp", "email"),
            ("oi_scp", "maintenance/database.read"));

        var succeeded = await RunHandlerAsync(principal, TargetScope);

        succeeded.Should().BeTrue();
    }

    [Fact]
    public async Task MultipleOpenIddictClaims_DenyAccessWhenNoneMatches()
    {
        var principal = PrincipalWith(
            ("oi_scp", "openid"),
            ("oi_scp", "email"));

        var succeeded = await RunHandlerAsync(principal, TargetScope);

        succeeded.Should().BeFalse();
    }

    [Fact]
    public async Task NoClaims_DeniesAccess()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity());

        var succeeded = await RunHandlerAsync(principal, TargetScope);

        succeeded.Should().BeFalse();
    }

    private static ClaimsPrincipal PrincipalWith(params (string Type, string Value)[] claims)
    {
        var identity = new ClaimsIdentity("Test");
        foreach (var (type, value) in claims)
            identity.AddClaim(new Claim(type, value));
        return new ClaimsPrincipal(identity);
    }

    private static async Task<bool> RunHandlerAsync(ClaimsPrincipal principal, string requiredScope)
    {
        var requirement = new ScopeRequirement(requiredScope);
        var context = new AuthorizationHandlerContext([requirement], principal, resource: null);

        var handler = new ScopeAuthorizationHandler();
        await handler.HandleAsync(context);

        return context.HasSucceeded;
    }
}
