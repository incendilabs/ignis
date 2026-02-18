using System.Security.Claims;

using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;

using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Ignis.Auth.Controllers;

[ApiController]
public class AuthorizationController : ControllerBase
{
    private readonly IOpenIddictApplicationManager _applicationManager;

    public AuthorizationController(IOpenIddictApplicationManager applicationManager)
    {
        _applicationManager = applicationManager;
    }

    [HttpPost("~/connect/token")]
    [EndpointDescription("Exchange client credentials for an access token (OAuth 2.0 client_credentials grant).")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Exchange()
    {
        var request = HttpContext.GetOpenIddictServerRequest()
            ?? throw new InvalidOperationException("The OpenID Connect request cannot be retrieved.");

        if (!request.IsClientCredentialsGrantType())
        {
            return Forbid(
                authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
                properties: new(new Dictionary<string, string?>
                {
                    [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.UnsupportedGrantType,
                    [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] =
                        "The specified grant type is not supported.",
                }));
        }

        if (string.IsNullOrEmpty(request.ClientId))
        {
            return Forbid(
                authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
                properties: new(new Dictionary<string, string?>
                {
                    [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.InvalidClient,
                    [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] =
                        "The client identifier is missing.",
                }));
        }

        var application = await _applicationManager.FindByClientIdAsync(request.ClientId);
        if (application is null)
        {
            return Forbid(
                authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
                properties: new(new Dictionary<string, string?>
                {
                    [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.InvalidClient,
                    [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] =
                        "The specified client application was not found.",
                }));
        }

        var identity = new ClaimsIdentity(
            OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            Claims.Name, Claims.Role);

        identity.SetClaim(Claims.Subject, await _applicationManager.GetClientIdAsync(application));
        identity.SetClaim(Claims.Name, await _applicationManager.GetDisplayNameAsync(application));

        identity.SetScopes(request.GetScopes());
        identity.SetDestinations(static claim => [Destinations.AccessToken]);

        return SignIn(new ClaimsPrincipal(identity), OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }
}
