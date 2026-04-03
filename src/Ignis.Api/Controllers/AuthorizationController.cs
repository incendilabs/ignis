using Ignis.Auth;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Ignis.Api.Controllers;

[ApiController]
[Route("connect")]
public class AuthorizationController(AuthorizationHandler handler) : ControllerBase
{
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
