/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Net;

using Hl7.Fhir.Model;
using Hl7.Fhir.Rest;
using Hl7.Fhir.Specification.Terminology;

using Ignis.Api.Extensions;
using Ignis.Terminology;

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

using OpenIddict.Validation.AspNetCore;

using Spark.Engine.Core;
using Spark.Engine.Service;

namespace Ignis.Api.Controllers;

/// <summary>
/// Terminology operations. Currently ValueSet <c>$expand</c> (by canonical <c>url</c>, by stored <c>{id}</c>,
/// or an inline <c>valueSet</c>). Canonical <c>url</c> resolves against the loaded FHIR packages.
/// </summary>
[Route("fhir"), ApiController]
[Authorize(AuthenticationSchemes = OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme)]
public class TerminologyController(IValueSetExpansionService expansion, IFhirService fhirService) : ControllerBase
{
    /// <summary>Expand a ValueSet by canonical <c>url</c> (GET query parameters).</summary>
    [HttpGet("ValueSet/$expand"), Tags("Terminology")]
    public Task<FhirResponse> ExpandByUrl() => RunExpandAsync(BuildFromQuery());

    /// <summary>Expand a ValueSet from a POSTed <c>Parameters</c> body (<c>url</c> or inline <c>valueSet</c>).</summary>
    [HttpPost("ValueSet/$expand"), Tags("Terminology")]
    public Task<FhirResponse> ExpandFromBody(Parameters parameters) => RunExpandAsync(parameters);

    /// <summary>Expand a stored ValueSet by id, with optional <c>filter</c>/paging from the query.</summary>
    [HttpGet("ValueSet/{id}/$expand"), Tags("Terminology")]
    public Task<FhirResponse> ExpandById(string id) => ExpandStoredAsync(id, BuildFromQuery());

    /// <summary>Expand a stored ValueSet by id, with modifier parameters from a POSTed <c>Parameters</c> body.</summary>
    [HttpPost("ValueSet/{id}/$expand"), Tags("Terminology")]
    public Task<FhirResponse> ExpandByIdFromBody(string id, Parameters parameters) => ExpandStoredAsync(id, parameters);

    private async Task<FhirResponse> ExpandStoredAsync(string id, Parameters parameters)
    {
        // {id} in the path identifies the target ValueSet; a competing url/valueSet in the
        // request is malformed or conflicting client input. Modifier params (filter, count, …) are fine.
        if (parameters.Parameter.Any(p => p.Name is "url" or "valueSet"))
            return new FhirResponse(HttpStatusCode.BadRequest, new OperationOutcome().AddInvalidIssue(
                "Do not provide 'url' or 'valueSet' when invoking $expand on a stored ValueSet; the id in the URL identifies the ValueSet to expand."));

        var read = await fhirService.ReadAsync(Key.Create("ValueSet", id), new ConditionalHeaderParameters(Request))
            .ConfigureAwait(false);
        if (read.Resource is not ValueSet valueSet)
            return read; // propagate the store's 404 / Gone response

        parameters.Parameter.Add(new Parameters.ParameterComponent { Name = "valueSet", Resource = valueSet });
        return await RunExpandAsync(parameters).ConfigureAwait(false);
    }

    private async Task<FhirResponse> RunExpandAsync(Parameters parameters)
    {
        try
        {
            var expanded = await expansion.ExpandAsync(parameters).ConfigureAwait(false);
            return Respond.WithResource(expanded);
        }
        catch (FhirOperationException ex)
        {
            // Unresolvable url, unknown code system, expansion too large, etc. — report as an outcome.
            return new FhirResponse(ex.Status, ex.Outcome);
        }
    }

    private ExpandParameters BuildFromQuery()
    {
        var parameters = new ExpandParameters();

        var url = Request.Query["url"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(url))
            parameters.WithValueSet(url, null, Request.Query["valueSetVersion"].FirstOrDefault(), null, null);

        ApplyQueryFilters(parameters);
        return parameters;
    }

    private void ApplyQueryFilters(ExpandParameters parameters)
    {
        var filter = Request.Query["filter"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(filter))
            parameters.WithFilter(filter);

        int? offset = int.TryParse(Request.Query["offset"].ToString(), out var o) ? o : null;
        int? count = int.TryParse(Request.Query["count"].ToString(), out var c) ? c : null;
        if (offset is not null || count is not null)
            parameters.WithPaging(offset, count);
    }
}
