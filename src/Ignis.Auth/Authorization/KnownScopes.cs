using System.Collections.Immutable;

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
        ..MaintenanceScopes.All,
        ..OperationsScopes.All,
    ];
}
