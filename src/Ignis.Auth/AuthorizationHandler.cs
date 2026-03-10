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
/// Contains the OpenIddict token endpoint logic.
/// Designed to be called from a thin controller in the host application.
/// </summary>
public class AuthorizationHandler
{
    private readonly IOpenIddictApplicationManager _applicationManager;

    public AuthorizationHandler(IOpenIddictApplicationManager applicationManager)
    {
        _applicationManager = applicationManager;
    }

    public async Task<IActionResult> ExchangeAsync(HttpContext httpContext)
    {
        var request = httpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

        if (request.IsClientCredentialsGrantType())
        {
            return await ExchangeClientCredentialsAsync(request);
        }

        return ForbidWithError(Errors.UnsupportedGrantType, "The specified grant type is not supported.");
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
        identity.SetDestinations(static claim => [Destinations.AccessToken]);

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
