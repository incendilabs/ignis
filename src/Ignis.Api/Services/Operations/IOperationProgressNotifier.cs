/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Api.Services.Operations;

/// <summary>Progress state for a long-running operation.</summary>
public record OperationProgress(int Current, int Total);

/// <summary>Counts for an operation that categorises its work.</summary>
public record OperationStatistics(int Total, int Succeeded, int Skipped, int Failed);

/// <summary>Completion report — narrative plus optional <see cref="OperationStatistics"/>.</summary>
public record OperationSummary(string Message, OperationStatistics? Statistics = null)
{
    public static implicit operator OperationSummary(string message) => new(message);
}

/// <summary>Notifies subscribers of operation events, keyed by operation id.</summary>
public interface IOperationProgressNotifier
{
    /// <summary>Reports an in-progress status update for the given operation.</summary>
    Task ProgressAsync(Guid operationId, string message, OperationProgress? progress = null);

    /// <summary>Reports successful completion of the given operation.</summary>
    Task CompletedAsync(Guid operationId, OperationSummary summary);

    /// <summary>Reports an error within the given operation.</summary>
    Task ErrorAsync(Guid operationId, string message);
}
