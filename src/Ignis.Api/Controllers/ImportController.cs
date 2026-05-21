/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

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
    ILogger<ImportController> logger) : ControllerBase
{
    // One import at a time: the drainer is single-reader and uploads sit in
    // memory until processed, so a second caller gets 429 instead of stacking
    // another buffer.
    private static readonly SemaphoreSlim _importSlot = new(initialCount: 1, maxCount: 1);

    /// <summary>
    /// Imports a zip archive of JSON-serialized FHIR resources. Requires the
    /// <c>operations.import</c> scope and <c>FeatureManagement:AllowImport</c>;
    /// otherwise responds with <c>503</c>. Returns <c>202</c> with an
    /// <see cref="OperationOutcome"/> carrying the operation id; the archive
    /// is buffered, queued, and progress/completion/error is reported via the
    /// operations hub.
    /// </summary>
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
}
