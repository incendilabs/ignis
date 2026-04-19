/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Api.Services.Operations;

/// <summary>Progress state for a long-running operation.</summary>
public record OperationProgress(int Current, int Total);

/// <summary>Notifies subscribers of operation events, keyed by operation id.</summary>
public interface IOperationProgressNotifier
{
    /// <summary>Reports an in-progress status update for the given operation.</summary>
    Task ProgressAsync(Guid operationId, string message, OperationProgress? progress = null);

    /// <summary>Reports successful completion of the given operation.</summary>
    Task CompletedAsync(Guid operationId, string message);

    /// <summary>Reports an error within the given operation.</summary>
    Task ErrorAsync(Guid operationId, string message);
}
