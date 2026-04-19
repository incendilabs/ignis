/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Collections.Immutable;

namespace Ignis.Auth.Authorization;

/// <summary>
/// Scopes for system administration of the data store.
/// </summary>
public static class MaintenanceScopes
{
    public const string DatabaseRead = "maintenance/database.read";
    public const string DatabaseWrite = "maintenance/database.write";
    public const string DatabaseDestructive = "maintenance/database.destructive";

    public static ImmutableArray<string> All { get; } =
    [
        DatabaseRead,
        DatabaseWrite,
        DatabaseDestructive,
    ];
}

/// <summary>
/// Authorization policy names for maintenance scopes, for use with
/// <c>[Authorize(Policy = ...)]</c>. Resolved on demand by
/// <see cref="ScopeAuthorizationPolicyProvider"/>.
/// </summary>
public static class MaintenancePolicies
{
    public const string DatabaseRead =
        ScopeAuthorizationPolicyProvider.PolicyPrefix + MaintenanceScopes.DatabaseRead;
    public const string DatabaseWrite =
        ScopeAuthorizationPolicyProvider.PolicyPrefix + MaintenanceScopes.DatabaseWrite;
    public const string DatabaseDestructive =
        ScopeAuthorizationPolicyProvider.PolicyPrefix + MaintenanceScopes.DatabaseDestructive;
}
