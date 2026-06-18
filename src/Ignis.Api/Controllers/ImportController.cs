/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.IO.Compression;
using System.Net;

using Hl7.Fhir.Model;

using Ignis.Api.Configuration;
using Ignis.Api.Extensions;
using Ignis.Api.Filters;
using Ignis.Api.Services.BackgroundTasks;
using Ignis.Api.Services.Import;
using Ignis.Auth.Authorization;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

using OpenIddict.Abstractions;
using OpenIddict.Validation.AspNetCore;

using Spark.Engine.Core;

namespace Ignis.Api.Controllers;

[Route("fhir"), ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class ImportController(
    BackgroundTaskQueue backgroundTaskQueue,
    IOptions<FeatureSettings> featureSettings,
    IOptions<ImportSettings> importSettings,
    ILogger<ImportController> logger) : ControllerBase
{
    // One import at a time: the drainer is single-reader and uploads sit in
    // memory until processed, so a second caller gets 429 instead of stacking
    // another buffer.
    private static readonly SemaphoreSlim _importSlot = new(initialCount: 1, maxCount: 1);

    /// <summary>
    /// Imports a zip archive of JSON-serialized FHIR resources. Requires the
    /// <c>operations.import</c> scope and <c>FeatureManagement:AllowImport</c>.
    /// The archive is buffered, queued, and progress/completion/error is reported
    /// via the operations hub; the response body is an <see cref="OperationOutcome"/>
    /// carrying the operation id.
    /// </summary>
    /// <response code="202">Archive structurally valid; ingestion queued.</response>
    /// <response code="400">Uploaded file is not a valid zip archive.</response>
    /// <response code="413">Archive uncompressed size exceeds the configured limit.</response>
    /// <response code="429">Another archive import is already in progress.</response>
    /// <response code="503">Archive import is disabled by feature flag.</response>
    [HttpPost("$archive-import"), Tags("Operations")]
    [Authorize(Policy = OperationsPolicies.Import)]
    [Consumes("multipart/form-data")]
    [ServiceFilter<ImportRequestSizeLimitFilter>]
    public async Task<FhirResponse> ArchiveImport([FromForm] IFormFile file)
    {
        if (!featureSettings.Value.AllowImport)
            return Respond.WithError(
                HttpStatusCode.ServiceUnavailable,
                "Archive import is not enabled on this server.");

        if (!_importSlot.Wait(0))
        {
            logger.LogInformation(
                "Archive import rejected (already in progress) for {Subject}.",
                User.FindFirst(OpenIddictConstants.Claims.Subject)?.Value ?? "unknown");
            return Respond.WithError(
                HttpStatusCode.TooManyRequests,
                "Another archive import is already in progress. Try again when it completes.");
        }

        // Worker takes over the slot and the buffer once queued; until then the controller owns both.
        MemoryStream? buffer = null;
        var handedOffToWorker = false;
        try
        {
            var operationId = Guid.NewGuid();
            logger.LogInformation(
                "Archive import requested by {Subject} (operation {OperationId}, {Bytes} bytes).",
                User.FindFirst(OpenIddictConstants.Claims.Subject)?.Value ?? "unknown",
                operationId,
                file.Length);

            // IFormFile closes with the request scope; worker reads after response.
            buffer = new MemoryStream();
            await using (var stream = file.OpenReadStream())
                await stream.CopyToAsync(buffer, HttpContext.RequestAborted);
            buffer.Position = 0;

            switch (ValidateZipArchive(buffer, operationId))
            {
                case ArchiveValidation.Malformed:
                    return Respond.WithError(HttpStatusCode.BadRequest,
                        "Uploaded file is not a valid zip archive.");
                case ArchiveValidation.TooLarge:
                    return Respond.WithError(HttpStatusCode.RequestEntityTooLarge,
                        "Archive uncompressed size exceeds the configured limit.");
            }
            buffer.Position = 0;

            await backgroundTaskQueue.QueueAsync(async (services, _) =>
            {
                try
                {
                    await using (buffer)
                    {
                        var importer = services.GetRequiredService<IImportService>();
                        await importer.ImportZipArchiveAsync(operationId, buffer);
                    }
                }
                finally
                {
                    _importSlot.Release();
                }
            });
            handedOffToWorker = true;

            var outcome = new OperationOutcome()
                .WithOperationId(operationId)
                .AddInformationIssue("Import accepted; progress will be reported via the operations hub.");

            return Respond.WithResource(StatusCodes.Status202Accepted, outcome);
        }
        finally
        {
            if (!handedOffToWorker)
            {
                _importSlot.Release();
                buffer?.Dispose();
            }
        }
    }

    /// <summary>
    /// Returns the configured archive-import limits so clients can validate an
    /// upload before sending it. Requires the <c>operations.import</c> scope.
    /// </summary>
    /// <response code="200">A <c>Parameters</c> resource with the upload limits.</response>
    [HttpGet("$archive-import"), Tags("Operations")]
    [Authorize(Policy = OperationsPolicies.Import)]
    public FhirResponse ArchiveImportLimits()
    {
        if (!featureSettings.Value.AllowImport)
            return Respond.WithError(
                HttpStatusCode.ServiceUnavailable,
                "Archive import is not enabled on this server.");

        var maxUploadSizeBytes =
            (int)Math.Clamp(importSettings.Value.MaxUploadSizeBytes, 0L, int.MaxValue);
        var parameters = new Parameters();
        parameters.Add("maxUploadSizeBytes", new Integer(maxUploadSizeBytes));
        return Respond.WithResource(parameters);
    }

    private enum ArchiveValidation { Valid, Malformed, TooLarge }

    private ArchiveValidation ValidateZipArchive(Stream archive, Guid operationId)
    {
        var maxUncompressed = importSettings.Value.MaxArchiveUncompressedBytes;
        try
        {
            using var probe = new ZipArchive(archive, ZipArchiveMode.Read, leaveOpen: true);
            long total = 0;
            foreach (var entry in probe.Entries)
            {
                // ZipArchiveMode.Read spec: entry.Length is always >= 0.
                if (entry.Length > maxUncompressed - total)
                {
                    logger.LogWarning(
                        "Rejected archive: uncompressed size exceeds limit {Limit} (operation {OperationId}).",
                        maxUncompressed, operationId);
                    return ArchiveValidation.TooLarge;
                }
                total += entry.Length;
            }
            return ArchiveValidation.Valid;
        }
        catch (Exception ex) when (
            ex is InvalidDataException or
            ArgumentOutOfRangeException or
            EndOfStreamException)
        {
            logger.LogWarning(ex,
                "Rejected malformed archive (operation {OperationId}).", operationId);
            return ArchiveValidation.Malformed;
        }
    }
}
