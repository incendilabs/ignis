namespace Ignis.Api.Services.Operations;

/// <summary>Notifies subscribers of operation events, keyed by operation id.</summary>
public interface IOperationProgressNotifier
{
    /// <summary>Reports an in-progress status update for the given operation.</summary>
    Task ProgressAsync(Guid operationId, string message);

    /// <summary>Reports an in-progress status update with a percentage (0-100) completion value.</summary>
    Task ProgressAsync(Guid operationId, string message, int progressPercent);

    /// <summary>Reports successful completion of the given operation.</summary>
    Task CompletedAsync(Guid operationId, string message);

    /// <summary>Reports an error within the given operation.</summary>
    Task ErrorAsync(Guid operationId, string message);
}
