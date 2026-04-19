/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Security.Claims;

using Microsoft.AspNetCore.Authorization;

namespace Ignis.Auth.Authorization;

/// <summary>
/// Verifies the principal carries the required OAuth 2.0 scope.
///
/// Reads scopes from claim types used across major auth servers. Each
/// claim type may appear once with a space-separated value, or repeated
/// with one value per claim — both shapes are handled:
/// <list type="bullet">
///   <item><c>scope</c> — RFC 6749 / 9068 form. Used by Keycloak, Auth0, Azure AD v2.</item>
///   <item><c>scp</c> — Microsoft identity platform.</item>
///   <item><c>oi_scp</c> — OpenIddict (typically one claim per scope).</item>
/// </list>
/// </summary>
public sealed class ScopeAuthorizationHandler : AuthorizationHandler<ScopeRequirement>
{
    private static readonly string[] ScopeClaimTypes = ["scope", "scp", "oi_scp"];
    private static readonly char[] ScopeSeparators = [' '];

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ScopeRequirement requirement)
    {
        if (HasScope(context.User, requirement.Scope))
            context.Succeed(requirement);

        return Task.CompletedTask;
    }

    private static bool HasScope(ClaimsPrincipal principal, string scope)
    {
        foreach (var claimType in ScopeClaimTypes)
        {
            foreach (var claim in principal.FindAll(claimType))
            {
                var values = claim.Value.Split(
                    ScopeSeparators, StringSplitOptions.RemoveEmptyEntries);
                foreach (var value in values)
                {
                    if (string.Equals(value, scope, StringComparison.Ordinal))
                        return true;
                }
            }
        }

        return false;
    }
}
