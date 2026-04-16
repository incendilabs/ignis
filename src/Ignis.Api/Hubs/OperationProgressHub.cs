using Ignis.Auth.Authorization;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

using OpenIddict.Validation.AspNetCore;

namespace Ignis.Api.Hubs;

/// <summary>
/// SignalR hub for real-time operation progress updates.
/// Clients subscribe to receive progress, completion, and error
/// events for long-running server operations.
/// </summary>
[Authorize(
    AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme,
    Policy = OperationsPolicies.Read)]
public sealed class OperationProgressHub : Hub;

/// <summary>SignalR method names sent by the operation progress hub.</summary>
public static class OperationProgressHubMethods
{
    public const string Progress = "Progress";
    public const string Completed = "Completed";
    public const string Error = "Error";
}
