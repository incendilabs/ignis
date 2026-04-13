/*
 * Copyright (c) 2014-2018, Firely <info@fire.ly>
 * Copyright (c) 2019-2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Ignis.Api.Services.Operations;

using Spark.Core;
using Spark.Engine.Interfaces;
using Spark.Engine.Service.FhirServiceExtensions;

namespace Ignis.Api.Services.Maintenance;

public sealed class MaintenanceService(
    IFhirStoreAdministration storeAdministration,
    IFhirIndex fhirIndex,
    IIndexRebuildService indexRebuildService,
    IOperationProgressNotifier notifier,
    ILogger<MaintenanceService> logger) : IMaintenanceService
{
    public async Task ClearStoreAsync(Guid operationId)
    {
        try
        {
            await notifier.ProgressAsync(operationId, "Clearing store...").ConfigureAwait(false);
            await storeAdministration.CleanAsync().ConfigureAwait(false);

            await notifier.ProgressAsync(operationId, "Cleaning indexes...").ConfigureAwait(false);
            await fhirIndex.CleanAsync().ConfigureAwait(false);

            await notifier.CompletedAsync(operationId, "Store cleared.").ConfigureAwait(false);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to clear store (operation {OperationId}).", operationId);
            await notifier.ErrorAsync(operationId, $"Failed to clear store: {e.Message}").ConfigureAwait(false);
            throw;
        }
    }

    public async Task RebuildIndexAsync(Guid operationId)
    {
        try
        {
            await notifier.ProgressAsync(operationId, "Rebuilding index...").ConfigureAwait(false);

            var reporter = new IndexBuildProgressAdapter(operationId, notifier);
            await indexRebuildService.RebuildIndexAsync(reporter).ConfigureAwait(false);

            await notifier.CompletedAsync(operationId, "Index rebuilt.").ConfigureAwait(false);
        }
        catch (Exception e)
        {
            logger.LogError(e, "Failed to rebuild index (operation {OperationId}).", operationId);
            await notifier.ErrorAsync(operationId, $"Failed to rebuild index: {e.Message}").ConfigureAwait(false);
            throw;
        }
    }

    /// <summary>
    /// Bridges Spark's per-rebuild progress callbacks to our transport-agnostic
    /// notifier, scoped to a single operation.
    /// </summary>
    private sealed class IndexBuildProgressAdapter(
        Guid operationId,
        IOperationProgressNotifier notifier) : IIndexBuildProgressReporter
    {
        // Spark reports progress as a percentage (0-100).
        public Task ReportProgressAsync(int progress, string message) =>
            notifier.ProgressAsync(operationId, message, new OperationProgress(progress, 100));

        public Task ReportErrorAsync(string message) =>
            notifier.ErrorAsync(operationId, message);
    }
}
