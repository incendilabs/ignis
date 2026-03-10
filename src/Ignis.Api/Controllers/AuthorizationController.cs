using Ignis.Auth;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Ignis.Api.Controllers;

[ApiController]
public class AuthorizationController(AuthorizationHandler handler) : ControllerBase
{
    /// <summary>Exchange credentials for an access token (OAuth 2.0 client_credentials grant).</summary>
    [HttpPost("~/connect/token")]
    [ProducesResponseType(typeof(object), StatusCodes.Status200OK, "application/json")]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public Task<IActionResult> Exchange() => handler.ExchangeAsync(HttpContext);
}
