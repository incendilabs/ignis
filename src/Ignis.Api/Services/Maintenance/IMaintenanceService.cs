namespace Ignis.Api.Services.Maintenance;

/// <summary>
/// Administrative operations against the FHIR store. Each method takes
/// an opaque <c>operationId</c> that progress notifications are tagged with so callers
/// (and downstream subscribers) can correlate updates to a specific run.
/// </summary>
public interface IMaintenanceService
{
    /// <summary>Wipes the FHIR store and the search index.</summary>
    Task ClearStoreAsync(Guid operationId);

    /// <summary>Rebuilds the search index from current store contents.</summary>
    Task RebuildIndexAsync(Guid operationId);
}
