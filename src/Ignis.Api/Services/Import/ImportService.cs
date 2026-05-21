/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.IO.Compression;

using Ignis.Api.Services.Operations;

namespace Ignis.Api.Services.Import;

public sealed class ImportService(
    IOperationProgressNotifier notifier,
    ILogger<ImportService> logger) : IImportService
{
    public async Task ImportZipArchiveAsync(Guid operationId, Stream archive)
    {
        try
        {
            using var zip = new ZipArchive(archive, ZipArchiveMode.Read, leaveOpen: true);
            var entryCount = zip.Entries.Count;

            logger.LogInformation(
                "Archive opened (operation {OperationId}, {EntryCount} entries).",
                operationId, entryCount);

            await notifier.ProgressAsync(
                operationId,
                $"Found {entryCount} entries in archive.",
                new OperationProgress(Current: 0, Total: entryCount))
                .ConfigureAwait(false);

            var current = 0;
            foreach (var entry in zip.Entries)
            {
                current++;
                await IngestEntryAsync(operationId, entry).ConfigureAwait(false);
                await notifier.ProgressAsync(
                    operationId,
                    $"Processed {TruncateName(entry.FullName)}",
                    new OperationProgress(Current: current, Total: entryCount))
                    .ConfigureAwait(false);
            }

            await notifier
                .CompletedAsync(operationId, $"Enumerated {entryCount} entries.")
                .ConfigureAwait(false);
        }
        catch (Exception ex) when (
            ex is InvalidDataException or
            ArgumentOutOfRangeException or
            EndOfStreamException)
        {
            logger.LogWarning(
                ex,
                "Archive could not be opened (operation {OperationId}).",
                operationId);

            await notifier
                .ErrorAsync(operationId, "Not able to parse uploaded zip archive.")
                .ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            // Catch-all so the hub always emits an Error event; otherwise the client waits indefinitely.
            logger.LogError(
                ex,
                "Unexpected error during archive import (operation {OperationId}).",
                operationId);

            await notifier
                .ErrorAsync(operationId, "Unexpected error while importing archive.")
                .ConfigureAwait(false);
        }
    }

    // Stub — will be replaced by FHIR parsing + write in a later slice.
    private Task IngestEntryAsync(Guid operationId, ZipArchiveEntry entry)
    {
        logger.LogDebug(
            "Entry stub (operation {OperationId}): {Name} ({Size} bytes).",
            operationId, TruncateName(entry.FullName), entry.Length);
        return Task.CompletedTask;
    }

    // Cap names before they hit logs or hub events — zip permits arbitrarily long names.
    private static string TruncateName(string name) =>
        name.Length > 200 ? name[..200] + "…" : name;
}
