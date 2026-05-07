/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Net;

using Hl7.Fhir.Model;

using Ignis.Api.Configuration;
using Ignis.Api.Extensions;
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
    IImportService importService,
    IOptions<FeatureSettings> featureSettings,
    ILogger<ImportController> logger) : ControllerBase
{
    /// <summary>
    /// Imports an archive (zip) of JSON-serialized FHIR resources.
    /// Requires the <c>operations.import</c> scope and the
    /// <c>FeatureManagement:AllowImport</c> flag to be enabled — otherwise the
    /// endpoint responds with <c>503 Service Unavailable</c>.
    /// Returns <c>202 Accepted</c> with an <see cref="OperationOutcome"/>
    /// carrying the operation id; subsequent progress, completion, or error is
    /// reported via the operations hub. Archive parsing and ingestion are not
    /// yet implemented — the service stub publishes an error event on the hub.
    /// </summary>
    [HttpPost("$archive-import"), Tags("Operations")]
    [Authorize(Policy = OperationsPolicies.Import)]
    [Consumes("multipart/form-data")]
    public async Task<FhirResponse> ArchiveImport([FromForm] IFormFile file)
    {
        if (!featureSettings.Value.AllowImport)
            return Respond.WithError(
                HttpStatusCode.ServiceUnavailable,
                "Archive import is not enabled on this server.");

        var operationId = Guid.NewGuid();
        logger.LogInformation(
            "Archive import requested by {Subject} (operation {OperationId}, {Bytes} bytes).",
            User.FindFirst(OpenIddictConstants.Claims.Subject)?.Value ?? "unknown",
            operationId,
            file.Length);

        await importService.ImportArchiveAsync(operationId);

        var outcome = new OperationOutcome()
            .WithOperationId(operationId)
            .AddInformationIssue("Import accepted; progress will be reported via the operations hub.");

        return Respond.WithResource(StatusCodes.Status202Accepted, outcome);
    }
}
