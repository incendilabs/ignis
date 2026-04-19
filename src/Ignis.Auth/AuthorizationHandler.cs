/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

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

        var subject = result.Principal.FindFirst(Claims.Subject)?.Value ??
            result.Principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrEmpty(subject))
        {
            return ForbidWithError(Errors.InvalidRequest,
                "The authenticated session is missing the required subject claim.");
        }

        var identity = new ClaimsIdentity(
            OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            Claims.Name, Claims.Role);

        identity.SetClaim(Claims.Subject, subject);
        identity.SetClaim(Claims.Name,
            result.Principal.FindFirst(Claims.Name)?.Value ??
            result.Principal.Identity?.Name);

        identity.SetScopes(request.GetScopes());
        identity.SetDestinations(_ => [Destinations.AccessToken]);

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

    private static ForbidResult ForbidWithError(string error, string description) =>
        new([OpenIddictServerAspNetCoreDefaults.AuthenticationScheme],
            new AuthenticationProperties(new Dictionary<string, string?>
            {
                [OpenIddictServerAspNetCoreConstants.Properties.Error] = error,
                [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] = description,
            }));
}
