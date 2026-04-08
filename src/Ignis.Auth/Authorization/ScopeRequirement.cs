using Microsoft.AspNetCore.Authorization;

namespace Ignis.Auth.Authorization;

public sealed class ScopeRequirement : IAuthorizationRequirement
{
    public ScopeRequirement(string scope)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(scope);
        Scope = scope;
    }

    public string Scope { get; }
}
