/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Collections.Immutable;

namespace Ignis.Auth.Authorization;

/// <summary>
/// Scopes for observing long-running server operations.
/// </summary>
public static class OperationsScopes
{
    public const string Read = "operations.read";

    public static ImmutableArray<string> All { get; } = [Read];
}

/// <summary>
/// Authorization policy names for operations scopes, for use with
/// <c>[Authorize(Policy = ...)]</c>. Resolved on demand by
/// <see cref="ScopeAuthorizationPolicyProvider"/>.
/// </summary>
public static class OperationsPolicies
{
    public const string Read =
        ScopeAuthorizationPolicyProvider.PolicyPrefix + OperationsScopes.Read;
}
