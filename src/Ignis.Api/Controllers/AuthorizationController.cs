/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Text;

using Ignis.Api.Services.Auth;
using Ignis.Auth;

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Ignis.Api.Controllers;

[ApiController]
[Route("connect")]
[AllowAnonymous]
public class AuthorizationController(
    AuthorizationHandler handler,
    IAuthenticationSchemeProvider schemeProvider,
    IOptions<AuthSettings> authSettings) : ControllerBase
{
    /// <summary>Login via external identity provider.</summary>
    [HttpGet("login")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public async Task<IActionResult> Login(string? provider = null, string returnUrl = "/")
    {
        var configured = authSettings.Value.ExternalProviders;

        if (configured.Count == 0)
            return Problem(
                title: "No external identity providers are configured.",
                detail: "AuthSettings:ExternalProviders must include at least one provider.",
                statusCode: StatusCodes.Status503ServiceUnavailable);

        if (string.IsNullOrWhiteSpace(provider))
        {
            if (configured.Count == 1)
            {
                provider = configured[0].Name;
            }
            else
            {
                return Content(
                    LoginPageRenderer.RenderProviderSelection(configured, returnUrl),
                    "text/html",
                    Encoding.UTF8);
            }
        }

        var scheme = await schemeProvider.GetSchemeAsync(provider);
        if (scheme is null)
            return Problem(
                title: $"Unknown authentication provider '{provider}'.",
                statusCode: StatusCodes.Status400BadRequest);

        var redirectUri = GetAllowedReturnUrl(returnUrl);

        return Challenge(new AuthenticationProperties
        {
            RedirectUri = redirectUri,
        }, provider);
    }

    private static bool HostMatchesAny(string url, IEnumerable<string> allowedUris)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return false;

        foreach (var allowed in allowedUris)
        {
            if (Uri.TryCreate(allowed, UriKind.Absolute, out var allowedUri)
                && string.Equals(uri.Host, allowedUri.Host, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    /// <summary>
    /// Prevents open redirects by allowing only local paths and absolute URLs
    /// whose host matches a configured client RedirectUri. Returns "/" if not allowed.
    /// </summary>
    private string GetAllowedReturnUrl(string url)
    {
        // Collect all configured client redirect URIs as the set of trusted hosts.
        var allowedUris = authSettings.Value.Clients.SelectMany(c => c.RedirectUris);
        if (Url.IsLocalUrl(url) || HostMatchesAny(url, allowedUris))
            return url;

        return "/";
    }

    /// <summary>Authorization endpoint.</summary>
    [HttpGet("authorize")]
    [HttpPost("authorize")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public Task<IActionResult> Authorize() => handler.AuthorizeAsync(HttpContext);

    /// <summary>Exchange credentials for an access token (OAuth 2.0 client_credentials or authorization_code grant).</summary>
    [HttpPost("token")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public Task<IActionResult> Exchange() => handler.ExchangeAsync(HttpContext);

    /// <summary>Logout endpoint.</summary>
    [HttpGet("logout")]
    [HttpPost("logout")]
    [ApiExplorerSettings(IgnoreApi = true)]
    public Task<IActionResult> Logout() => handler.LogoutAsync(HttpContext);
}
