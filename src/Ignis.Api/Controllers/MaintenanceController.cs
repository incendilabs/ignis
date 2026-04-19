/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Net;

using Hl7.Fhir.Model;

using Ignis.Api.Configuration;
using Ignis.Api.Extensions;
using Ignis.Api.Services.Maintenance;
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
public class MaintenanceController(
    IMaintenanceService maintenanceService,
    IOptions<FeatureSettings> featureSettings,
    ILogger<MaintenanceController> logger) : ControllerBase
{
    /// <summary>
    /// Wipes the FHIR store and search index.
    /// Requires the <c>maintenance/database.destructive</c> scope and the
    /// <c>FeatureManagement:AllowClearStore</c> flag to be enabled — otherwise
    /// the endpoint responds as an unknown operation with <c>404 Not Found</c>.
    /// </summary>
    [HttpPost("$clear-store"), Tags("Operations")]
    [Authorize(Policy = MaintenancePolicies.DatabaseDestructive)]
    public async Task<FhirResponse> ClearStore()
    {
        if (!featureSettings.Value.AllowClearStore)
            return Respond.WithError(HttpStatusCode.NotFound, "Unknown operation");

        var operationId = Guid.NewGuid();
        logger.LogInformation(
            "Store clear requested by {Subject} (operation {OperationId}).",
            User.FindFirst(OpenIddictConstants.Claims.Subject)?.Value ?? "unknown",
            operationId);

        await maintenanceService.ClearStoreAsync(operationId);

        var outcome = new OperationOutcome()
            .WithOperationId(operationId)
            .AddInformationIssue("Store cleared.");

        return Respond.WithResource(outcome);
    }
}
