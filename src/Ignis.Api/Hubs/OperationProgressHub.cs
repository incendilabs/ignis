using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Ignis.Api.Hubs;

/// <summary>
/// SignalR hub for real-time operation progress updates.
/// Clients subscribe to receive progress, completion, and error
/// events for long-running server operations.
/// </summary>
[Authorize]
public sealed class OperationProgressHub : Hub;

/// <summary>SignalR method names sent by the operation progress hub.</summary>
public static class OperationProgressHubMethods
{
    public const string Progress = "Progress";
    public const string Completed = "Completed";
    public const string Error = "Error";
}
