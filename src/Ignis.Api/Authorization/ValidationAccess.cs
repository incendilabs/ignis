/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Ignis.Api.Configuration;

using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace Ignis.Api.Authorization;

/// <summary>Named policies that replace the require-sign-in fallback.</summary>
public static class ValidationPolicies
{
    /// <summary>Signed-in users, or anyone if <see cref="FeatureSettings.AllowAnonymousValidation"/>.</summary>
    public const string Validate = "validation";
}

/// <summary>Marker for <see cref="ValidationAccessHandler"/>; carries no data.</summary>
public sealed class ValidationAccessRequirement : IAuthorizationRequirement;

/// <summary>Checks the flag per request.</summary>
public sealed class ValidationAccessHandler(IOptionsMonitor<FeatureSettings> features)
    : AuthorizationHandler<ValidationAccessRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        ValidationAccessRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated == true || features.CurrentValue.AllowAnonymousValidation)
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
