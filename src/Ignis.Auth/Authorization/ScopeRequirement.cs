/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

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
