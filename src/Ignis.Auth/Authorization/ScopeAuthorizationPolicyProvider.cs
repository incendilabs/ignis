/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace Ignis.Auth.Authorization;

/// <summary>
/// Resolves authorization policies whose name starts with <c>scope:</c>
/// into a policy that requires the matching OAuth scope on the principal.
///
/// <para>
/// Letting policies be built on demand means callers can write
/// <c>[Authorize(Policy = "scope:maintenance/database.read")]</c> for
/// any scope at all, without registering each one upfront.
/// </para>
///
/// <para>
/// Policy names without the <c>scope:</c> prefix fall through to the
/// default provider, so existing <c>AddPolicy(...)</c> registrations
/// keep working unchanged.
/// </para>
/// </summary>
public sealed class ScopeAuthorizationPolicyProvider(IOptions<AuthorizationOptions> options)
    : DefaultAuthorizationPolicyProvider(options)
{
    /// <summary>
    /// Marks a policy name as a scope requirement.
    /// Example: <c>scope:maintenance/database.read</c>.
    /// </summary>
    public const string PolicyPrefix = "scope:";

    public override async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (TryGetScopeFromPolicyName(policyName, out var scope))
            return BuildPolicyRequiringScope(scope);

        return await base.GetPolicyAsync(policyName);
    }

    private static bool TryGetScopeFromPolicyName(string policyName, out string scope)
    {
        if (policyName.StartsWith(PolicyPrefix, StringComparison.Ordinal))
        {
            scope = policyName[PolicyPrefix.Length..];
            // Reject "scope:" with an empty/whitespace suffix — let the
            // base provider produce its standard "policy not found" error
            // instead of throwing from ScopeRequirement's constructor.
            if (!string.IsNullOrWhiteSpace(scope))
                return true;
        }

        scope = string.Empty;
        return false;
    }

    private static AuthorizationPolicy BuildPolicyRequiringScope(string scope) =>
        new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .AddRequirements(new ScopeRequirement(scope))
            .Build();
}
