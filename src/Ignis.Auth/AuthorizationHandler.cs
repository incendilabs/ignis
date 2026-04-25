/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Collections.Immutable;
using System.Security.Claims;

using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;

using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Ignis.Auth;

/// <summary>
/// Contains the OpenIddict authorization, token and logout endpoint logic.
/// Designed to be called from a thin controller in the host application.
/// </summary>
public class AuthorizationHandler
{
    private readonly IOpenIddictApplicationManager _applicationManager;

    private sealed record ScopeClaimMapping(
        string? Scope,    // null = always emitted, not gated by a scope
        string Claim,
        string[] Sources,
        string[] Destinations);

    /// <summary>
    /// Claim mappings for identity claims emitted by the authorization
    /// endpoint. To add a new scope/claim: append a row here.
    /// </summary>
    private static readonly ScopeClaimMapping[] IdentityClaimMappings =
    [
        new(null,           Claims.Subject, [Claims.Subject, ClaimTypes.NameIdentifier], [Destinations.AccessToken, Destinations.IdentityToken]),
        new(Scopes.Profile, Claims.Name,    [Claims.Name, ClaimTypes.Name],              [Destinations.IdentityToken]),
        new(Scopes.Profile, Claims.Picture, [Claims.Picture],                            [Destinations.IdentityToken]),
        new(Scopes.Email,   Claims.Email,   [Claims.Email, ClaimTypes.Email],            [Destinations.IdentityToken]),
    ];

    private static readonly Dictionary<string, string[]> ClaimDestinations =
        IdentityClaimMappings.ToDictionary(m => m.Claim, m => m.Destinations);

    public AuthorizationHandler(IOpenIddictApplicationManager applicationManager)
    {
        _applicationManager = applicationManager;
    }

    public async Task<IActionResult> AuthorizeAsync(HttpContext httpContext)
    {
        var request = httpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

        var result = await httpContext.AuthenticateAsync(AuthConstants.SessionScheme);
        if (!result.Succeeded || result.Principal?.Identity?.IsAuthenticated != true)
        {
            var httpRequest = httpContext.Request;
            var parameters = httpRequest.HasFormContentType
                ? httpRequest.Form.Where(p => p.Key != "__RequestVerificationToken").ToList()
                : httpRequest.Query.ToList();

            return new ChallengeResult(
                [AuthConstants.SessionScheme],
                new AuthenticationProperties
                {
                    RedirectUri = $"{httpRequest.PathBase}{httpRequest.Path}{QueryString.Create(parameters)}",
                });
        }

        var identity = new ClaimsIdentity(
            OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            Claims.Name, Claims.Role);

        var requestedScopes = request.GetScopes();
        identity.SetScopes(requestedScopes);

        AddIdentityClaims(identity, result.Principal, requestedScopes);

        // sub is required — bail if the session principal didn't supply it.
        if (string.IsNullOrEmpty(identity.FindFirst(Claims.Subject)?.Value))
        {
            return ForbidWithError(Errors.InvalidRequest,
                "The authenticated session is missing the required subject claim.");
        }

        identity.SetDestinations(claim => GetDestinationsFor(claim.Type));

        return new SignInResult(
            OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity));
    }

    public async Task<IActionResult> ExchangeAsync(HttpContext httpContext)
    {
        var request = httpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

        if (request.IsAuthorizationCodeGrantType())
        {
            var principal = (await httpContext.AuthenticateAsync(
                OpenIddictServerAspNetCoreDefaults.AuthenticationScheme)).Principal
                ?? throw new InvalidOperationException("The authorization code principal cannot be retrieved.");

            return new SignInResult(
                OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
                principal);
        }

        if (request.IsClientCredentialsGrantType())
        {
            return await ExchangeClientCredentialsAsync(request);
        }

        return ForbidWithError(Errors.UnsupportedGrantType, "The specified grant type is not supported.");
    }

    public async Task<IActionResult> LogoutAsync(HttpContext httpContext)
    {
        await httpContext.SignOutAsync(AuthConstants.SessionScheme);
        return new RedirectResult("/");
    }

    private async Task<IActionResult> ExchangeClientCredentialsAsync(OpenIddictRequest request)
    {
        if (string.IsNullOrEmpty(request.ClientId))
        {
            return ForbidWithError(Errors.InvalidClient, "The client identifier is missing.");
        }

        var application = await _applicationManager.FindByClientIdAsync(request.ClientId);
        if (application is null)
        {
            return ForbidWithError(Errors.InvalidClient, "The specified client application was not found.");
        }

        var identity = new ClaimsIdentity(
            OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            Claims.Name, Claims.Role);

        identity.SetClaim(Claims.Subject, await _applicationManager.GetClientIdAsync(application));
        identity.SetClaim(Claims.Name, await _applicationManager.GetDisplayNameAsync(application));

        identity.SetScopes(request.GetScopes());
        identity.SetDestinations(_ => [Destinations.AccessToken]);

        return new SignInResult(
            OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity));
    }

    /// <summary>
    /// Copies scope-gated identity claims from the session principal
    /// onto the OpenIddict identity. See <see cref="IdentityClaimMappings"/>
    /// for the full mapping. Exposed as internal for unit tests.
    /// </summary>
    internal static void AddIdentityClaims(
        ClaimsIdentity target,
        ClaimsPrincipal source,
        ImmutableArray<string> requestedScopes)
    {
        foreach (var mapping in IdentityClaimMappings)
        {
            var scope = mapping.Scope;
            var alwaysEmitted = scope is null;
            var scopeRequested = scope is not null && requestedScopes.Contains(scope);
            if (!alwaysEmitted && !scopeRequested) continue;

            var value = mapping.Sources
                .Select(s => source.FindFirst(s)?.Value)
                .FirstOrDefault(v => !string.IsNullOrEmpty(v));
            if (!string.IsNullOrEmpty(value))
                target.SetClaim(mapping.Claim, value);
        }
    }

    /// <summary>
    /// Returns the destinations a claim should be emitted to, derived
    /// from <see cref="IdentityClaimMappings"/>. Anything not in the table
    /// (roles, custom resource claims) stays in the access token only.
    /// </summary>
    internal static string[] GetDestinationsFor(string claimType) =>
        ClaimDestinations.GetValueOrDefault(claimType, [Destinations.AccessToken]);

    private static ForbidResult ForbidWithError(string error, string description) =>
        new([OpenIddictServerAspNetCoreDefaults.AuthenticationScheme],
            new AuthenticationProperties(new Dictionary<string, string?>
            {
                [OpenIddictServerAspNetCoreConstants.Properties.Error] = error,
                [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] = description,
            }));
}
