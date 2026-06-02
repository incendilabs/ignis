/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.IO.Compression;

using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;

using Ignis.Api.Configuration;
using Ignis.Api.Services.Operations;

using Microsoft.Extensions.Options;

using Spark.Engine.Core;
using Spark.Engine.Service;

// Avoid clash with Hl7.Fhir.Model.Task
using Task = System.Threading.Tasks.Task;

namespace Ignis.Api.Services.Import;

public sealed class ImportService(
    IFhirService fhirService,
    IOptions<ImportSettings> settings,
    IOperationProgressNotifier notifier,
    ILogger<ImportService> logger) : IImportService
{
    private enum IngestResult
    {
        Succeeded,
        Skipped,
        Failed,
    }

    private static readonly FhirJsonDeserializer Parser = new();

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

            var succeeded = 0;
            var skipped = 0;
            var failed = 0;
            var current = 0;
            foreach (var entry in zip.Entries)
            {
                current++;
                switch (await IngestEntryAsync(operationId, entry).ConfigureAwait(false))
                {
                    case IngestResult.Succeeded:
                        succeeded++;
                        break;

                    case IngestResult.Skipped:
                        skipped++;
                        break;

                    case IngestResult.Failed:
                        failed++;
                        break;
                }
                await notifier.ProgressAsync(
                    operationId,
                    $"Processed {TruncateName(entry.FullName)}",
                    new OperationProgress(Current: current, Total: entryCount))
                    .ConfigureAwait(false);
            }

            await notifier
                .CompletedAsync(operationId, new OperationSummary(
                    $"Imported {succeeded}, skipped {skipped}, failed {failed} of {entryCount} entries.",
                    new OperationStatistics(entryCount, succeeded, skipped, failed)))
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

    private async Task<IngestResult> IngestEntryAsync(Guid operationId, ZipArchiveEntry entry)
    {
        if (entry.FullName.EndsWith('/'))
            return IngestResult.Skipped;

        // Check for suspect paths before any file I/O.
        var name = entry.FullName;
        if (name.Contains("..", StringComparison.Ordinal) ||
            Path.IsPathRooted(name) ||
            (name.Length >= 2 && char.IsLetter(name[0]) && name[1] == ':'))
        {
            logger.LogWarning(
                "Skipping entry with suspect path (operation {OperationId}): {Name}.",
                operationId, TruncateName(name));
            return IngestResult.Skipped;
        }

        if (entry.Length > settings.Value.MaxEntryUncompressedBytes)
        {
            logger.LogWarning(
                "Skipping oversize entry (operation {OperationId}, {Bytes} bytes): {Name}.",
                operationId, entry.Length, TruncateName(entry.FullName));
            return IngestResult.Skipped;
        }

        var ext = Path.GetExtension(entry.FullName).ToLowerInvariant();
        try
        {
            switch (ext)
            {
                case ".json":
                    {
                        await using var raw = entry.Open();
                        await using var bounded = new BoundedStream(raw, settings.Value.MaxEntryUncompressedBytes);
                        return await IngestJsonResourceAsync(operationId, entry, bounded).ConfigureAwait(false);
                    }
                default:
                    logger.LogDebug(
                        "Skipping non-resource entry (operation {OperationId}): {Name}.",
                        operationId, TruncateName(entry.FullName));
                    return IngestResult.Skipped;
            }
        }
        catch (Exception ex)
        {
            // Per-entry failure: log and move on so one bad file doesn't kill the import.
            logger.LogWarning(
                ex,
                "Failed to ingest entry (operation {OperationId}, entry {Name}).",
                operationId, TruncateName(entry.FullName));
            return IngestResult.Failed;
        }
    }

    private async Task<IngestResult> IngestJsonResourceAsync(
        Guid operationId, ZipArchiveEntry entry, Stream content)
    {
        using var reader = new StreamReader(content);
        var json = await reader.ReadToEndAsync().ConfigureAwait(false);

        return await UpsertAsync(operationId, entry, Parser.Deserialize<Resource>(json))
            .ConfigureAwait(false);
    }

    private async Task<IngestResult> UpsertAsync(
        Guid operationId, ZipArchiveEntry entry, Resource resource)
    {
        if (string.IsNullOrEmpty(resource.Id))
        {
            logger.LogWarning(
                "Skipping resource without id (operation {OperationId}, entry {Name}).",
                operationId, TruncateName(entry.FullName));
            return IngestResult.Skipped;
        }

        var key = Key.Create(resource.TypeName, resource.Id);
        await fhirService.UpdateAsync(key, resource).ConfigureAwait(false);

        logger.LogDebug(
            "Imported {ResourceType}/{ResourceId} (operation {OperationId}).",
            resource.TypeName, resource.Id, operationId);
        return IngestResult.Succeeded;
    }

    // Cap names before they hit logs or hub events — zip permits arbitrarily long names.
    private static string TruncateName(string name) =>
        name.Length > 200 ? name[..200] + "…" : name;
}
