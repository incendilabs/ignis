/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Collections.Immutable;

using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Ignis.Auth.Authorization;

/// <summary>
/// Aggregated view of all scopes recognized by the Ignis auth server.
/// Add new scope domains here so they are registered with the token
/// issuer in a single place.
/// </summary>
public static class KnownScopes
{
    public static ImmutableArray<string> All { get; } =
    [
        Scopes.OpenId,
        Scopes.Profile,
        Scopes.Email,
        ..MaintenanceScopes.All,
        ..OperationsScopes.All,
    ];
}
