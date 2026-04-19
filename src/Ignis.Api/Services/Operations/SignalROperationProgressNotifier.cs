/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Ignis.Api.Hubs;

using Microsoft.AspNetCore.SignalR;

namespace Ignis.Api.Services.Operations;

/// <summary>
/// Pushes operation progress events to connected SignalR clients.
/// </summary>
public sealed class SignalROperationProgressNotifier(
    IHubContext<OperationProgressHub> hub) : IOperationProgressNotifier
{
    public Task ProgressAsync(Guid operationId, string message, OperationProgress? progress = null) =>
        hub.Clients.All.SendAsync(OperationProgressHubMethods.Progress, operationId, message, progress);

    public Task CompletedAsync(Guid operationId, string message) =>
        hub.Clients.All.SendAsync(OperationProgressHubMethods.Completed, operationId, message);

    public Task ErrorAsync(Guid operationId, string message) =>
        hub.Clients.All.SendAsync(OperationProgressHubMethods.Error, operationId, message);
}
