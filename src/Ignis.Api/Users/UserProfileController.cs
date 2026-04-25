/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Security.Claims;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using OpenIddict.Abstractions;
using OpenIddict.Validation.AspNetCore;

namespace Ignis.Api.Users;

[Route("userprofile"), ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class UserProfileController : ControllerBase
{
    /// <summary>
    /// Returns the authenticated principal's profile. A subject is
    /// required and read from the <c>sub</c> claim (falling back to
    /// <see cref="ClaimTypes.NameIdentifier"/>); if absent the request
    /// is rejected with <see cref="ControllerBase.Unauthorized()"/>.
    /// Identity fields (<c>Name</c>, <c>Email</c>, <c>AvatarUrl</c>)
    /// currently read from the access token and will return <c>null</c>
    /// until a server-side user is added.
    /// </summary>
    [HttpGet, Tags("User")]
    public ActionResult<UserProfile> Get()
    {
        var subject = User.FindFirst(OpenIddictConstants.Claims.Subject)?.Value
            ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (subject is null)
            return Unauthorized();

        // OpenIddict may expose scopes as one claim per scope, or as a
        // single claim whose value is space-separated — cover both.
        var scopes = User.FindAll(OpenIddictConstants.Claims.Scope)
            .SelectMany(c => c.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries))
            .Distinct()
            .ToArray();

        // Name/Email/AvatarUrl will be null until identity is sourced
        // from a server-side user store; access tokens intentionally
        // don't carry these claims
        return new UserProfile(
            Subject: subject,
            Name: User.FindFirst(OpenIddictConstants.Claims.Name)?.Value
                ?? User.FindFirst(ClaimTypes.Name)?.Value,
            Email: User.FindFirst(OpenIddictConstants.Claims.Email)?.Value
                ?? User.FindFirst(ClaimTypes.Email)?.Value,
            AvatarUrl: User.FindFirst(OpenIddictConstants.Claims.Picture)?.Value,
            Scopes: scopes);
    }
}
