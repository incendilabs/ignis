/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Ignis.Api.Services.Operations;

namespace Ignis.Api.Services.Import;

public sealed class ImportService(
    IOperationProgressNotifier notifier,
    ILogger<ImportService> logger) : IImportService
{
    public async Task ImportArchiveAsync(Guid operationId)
    {
        logger.LogInformation(
            "Archive import requested but not yet implemented (operation {OperationId}).",
            operationId);

        await notifier
            .ErrorAsync(operationId, "Archive import is not yet implemented.")
            .ConfigureAwait(false);
    }
}
