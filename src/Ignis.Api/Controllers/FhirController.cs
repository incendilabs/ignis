/*
 * Copyright (c) 2014-2018, Firely <info@fire.ly>
 * Copyright (c) 2019-2025, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;
using Hl7.Fhir.Rest;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Spark.Engine;
using Spark.Engine.Core;
using Spark.Engine.Extensions;
using Spark.Engine.Service;
using System.Net;

namespace Ignis.Api.Controllers;

[Route("fhir"), ApiController, EnableCors]
public class FhirController : ControllerBase
{
    private readonly IFhirService _fhirService;
    private readonly SparkSettings _settings;

    public FhirController(IFhirService fhirService, SparkSettings settings)
    {
        _fhirService = fhirService ?? throw new ArgumentNullException(nameof(fhirService));
        _settings = settings ?? throw new ArgumentNullException(nameof(settings));
    }

    // ============= Instance Level Interactions

    /// <summary>Read a resource by type and id.</summary>
    [HttpGet("{type}/{id}"), Tags("Instance")]
    public async Task<ActionResult<FhirResponse>> Read(string type, string id)
    {
        var parameters = new ConditionalHeaderParameters(Request);
        var key = Key.Create(type, id);
        var response = await _fhirService.ReadAsync(key, parameters).ConfigureAwait(false);
        return new ActionResult<FhirResponse>(response);
    }

    /// <summary>Read a specific version of a resource.</summary>
    [HttpGet("{type}/{id}/_history/{vid}"), Tags("Instance")]
    public async Task<ActionResult<FhirResponse>> VRead(string type, string id, string vid)
    {
        var key = Key.Create(type, id, vid);
        return new ActionResult<FhirResponse>(
            await _fhirService.VersionReadAsync(key).ConfigureAwait(false));
    }

    /// <summary>Update a resource, or conditionally update if no id is provided.</summary>
    [HttpPut("{type}/{id?}"), Tags("Instance")]
    public async Task<ActionResult<FhirResponse>> Update(string type, Resource resource, string? id = null)
    {
        if (resource.TypeName != type)
            return new ActionResult<FhirResponse>(
                Respond.WithError(HttpStatusCode.BadRequest, "Resource type does not match endpoint."));

        string? versionId = Request.IfMatchVersionId();
        var key = Key.Create(type, id, versionId);
        if (key.HasResourceId())
        {
            Request.TransferResourceIdIfRawBinary(resource, id);
            return new ActionResult<FhirResponse>(
                await _fhirService.UpdateAsync(key, resource).ConfigureAwait(false));
        }
        else
        {
            return new ActionResult<FhirResponse>(
                await _fhirService.ConditionalUpdateAsync(key, resource,
                    SearchParams.FromUriParamList(Request.TupledParameters())).ConfigureAwait(false));
        }
    }

    /// <summary>Create a new resource.</summary>
    [HttpPost("{type}"), Tags("Instance")]
    public async Task<ActionResult<FhirResponse>> Create(string type, Resource resource)
    {
        if (resource.TypeName != type)
            return new ActionResult<FhirResponse>(
                Respond.WithError(HttpStatusCode.BadRequest, "Resource type does not match endpoint."));

        var key = Key.Create(type, resource.Id);
        return new ActionResult<FhirResponse>(
            await _fhirService.CreateAsync(key, resource).ConfigureAwait(false));
    }

    /// <summary>Patch a resource using FHIR Parameters.</summary>
    [HttpPatch("{type}/{id}"), Tags("Instance")]
    public async Task<FhirResponse> Patch(string type, string id, Parameters patch)
    {
        var key = Key.Create(type, id, Request.IfMatchVersionId());
        return await _fhirService.PatchAsync(key, patch).ConfigureAwait(false);
    }

    /// <summary>Delete a resource by type and id.</summary>
    [HttpDelete("{type}/{id}"), Tags("Instance")]
    public async Task<FhirResponse> Delete(string type, string id)
    {
        var key = Key.Create(type, id);
        return await _fhirService.DeleteAsync(key).ConfigureAwait(false);
    }

    /// <summary>Conditionally delete resources matching query parameters.</summary>
    [HttpDelete("{type}"), Tags("Instance")]
    public async Task<ActionResult<FhirResponse>> ConditionalDelete(string type)
    {
        var parameters = Request.TupledParameters();
        if (parameters == null || !parameters.Any())
            return new ActionResult<FhirResponse>(
                Respond.WithError(HttpStatusCode.BadRequest, "Conditional delete requires at least one search parameter."));

        var key = Key.Create(type);
        return new ActionResult<FhirResponse>(
            await _fhirService.ConditionalDeleteAsync(key, parameters).ConfigureAwait(false));
    }

    /// <summary>Get the version history of a specific resource.</summary>
    [HttpGet("{type}/{id}/_history"), Tags("History")]
    public async Task<FhirResponse> History(string type, string id)
    {
        var key = Key.Create(type, id);
        var parameters = new HistoryParameters(Request);
        return await _fhirService.HistoryAsync(key, parameters).ConfigureAwait(false);
    }

    // ============= Validate

    /// <summary>Validate a specific resource instance.</summary>
    [HttpPost("{type}/{id}/$validate"), Tags("Validation")]
    public async Task<ActionResult<FhirResponse>> Validate(string type, string id, Resource resource)
    {
        if (resource.TypeName != type)
            return new ActionResult<FhirResponse>(
                Respond.WithError(HttpStatusCode.BadRequest, "Resource type does not match endpoint."));

        var key = Key.Create(type, id);
        return new ActionResult<FhirResponse>(
            await _fhirService.ValidateOperationAsync(key, resource).ConfigureAwait(false));
    }

    /// <summary>Validate a resource against its type definition.</summary>
    [HttpPost("{type}/$validate"), Tags("Validation")]
    public async Task<ActionResult<FhirResponse>> Validate(string type, Resource resource)
    {
        if (resource.TypeName != type)
            return new ActionResult<FhirResponse>(
                Respond.WithError(HttpStatusCode.BadRequest, "Resource type does not match endpoint."));

        var key = Key.Create(type);
        return new ActionResult<FhirResponse>(
            await _fhirService.ValidateOperationAsync(key, resource).ConfigureAwait(false));
    }

    // ============= Type Level Interactions

    /// <summary>Search for resources of a given type using query parameters.</summary>
    [HttpGet("{type}"), Tags("Search")]
    public async Task<FhirResponse> Search(string type)
    {
        var offset = Request.GetPagingOffsetParameter();
        var searchparams = Request.GetSearchParams();
        return await _fhirService.SearchAsync(type, searchparams, offset).ConfigureAwait(false);
    }

    /// <summary>Search for resources using POST-based search (form body).</summary>
    [HttpPost("{type}/_search"), Tags("Search")]
    public async Task<FhirResponse> SearchWithOperator(string type)
    {
        var offset = Request.GetPagingOffsetParameter();
        var searchparams = Request.GetSearchParamsFromBody();
        return await _fhirService.SearchAsync(type, searchparams, offset).ConfigureAwait(false);
    }

    /// <summary>Get the version history of all resources of a given type.</summary>
    [HttpGet("{type}/_history"), Tags("History")]
    public async Task<FhirResponse> TypeHistory(string type)
    {
        var parameters = new HistoryParameters(Request);
        return await _fhirService.HistoryAsync(type, parameters).ConfigureAwait(false);
    }

    // ============= Whole System Interactions

    /// <summary>Get the server's CapabilityStatement (conformance metadata).</summary>
    [HttpGet, Route("metadata"), Tags("System")]
    public async Task<FhirResponse> Metadata()
    {
        return await _fhirService.CapabilityStatementAsync(_settings.Version).ConfigureAwait(false);
    }

    /// <summary>Get the server's CapabilityStatement via HTTP OPTIONS.</summary>
    [HttpOptions, Route(""), Tags("System")]
    public async Task<FhirResponse> Options()
    {
        return await _fhirService.CapabilityStatementAsync(_settings.Version).ConfigureAwait(false);
    }

    /// <summary>Execute a transaction or batch Bundle.</summary>
    [HttpPost, Route(""), Tags("System")]
    public async Task<ActionResult<FhirResponse>> Transaction(Bundle bundle)
    {
        if (bundle.Type is not (Bundle.BundleType.Transaction or Bundle.BundleType.Batch))
            return new ActionResult<FhirResponse>(
                Respond.WithError(HttpStatusCode.BadRequest, "Bundle type must be 'transaction' or 'batch'."));

        return new ActionResult<FhirResponse>(
            await _fhirService.TransactionAsync(bundle).ConfigureAwait(false));
    }

    /// <summary>Get the version history across all resource types on the server.</summary>
    [HttpGet, Route("_history"), Tags("History")]
    public async Task<FhirResponse> SystemHistory()
    {
        var parameters = new HistoryParameters(Request);
        return await _fhirService.HistoryAsync(parameters).ConfigureAwait(false);
    }

    /// <summary>Retrieve a page from a previously created snapshot.</summary>
    [HttpGet, Route("_snapshot"), Tags("System")]
    public async Task<FhirResponse> Snapshot()
    {
        string snapshot = Request.GetParameter(FhirParameter.SNAPSHOT_ID);
        var offset = Request.GetPagingOffsetParameter();
        return await _fhirService.GetPageAsync(snapshot, offset).ConfigureAwait(false);
    }

    // ============= Operations

    /// <summary>Execute a server-level operation by name.</summary>
    [HttpPost, Route("${operation}"), Tags("Operations")]
    public FhirResponse ServerOperation(string operation)
    {
        return Respond.WithError(HttpStatusCode.NotFound, $"Operation '${operation}' is not supported.");
    }

    /// <summary>Execute an instance-level operation (e.g. $meta, $meta-add).</summary>
    [HttpPost, Route("{type}/{id}/${operation}"), Tags("Operations")]
    public async Task<FhirResponse> InstanceOperation(string type, string id, string operation, Parameters parameters)
    {
        var key = Key.Create(type, id);
        switch (operation.ToLower())
        {
            case "meta": return await _fhirService.ReadMetaAsync(key).ConfigureAwait(false);
            case "meta-add": return await _fhirService.AddMetaAsync(key, parameters).ConfigureAwait(false);
            default: return Respond.WithError(HttpStatusCode.NotFound, "Unknown operation");
        }
    }

    /// <summary>Return all resources related to a specific resource instance ($everything).</summary>
    [HttpPost, HttpGet, Route("{type}/{id}/$everything"), Tags("Operations")]
    public async Task<FhirResponse> Everything(string type, string id)
    {
        var key = Key.Create(type, id);
        return await _fhirService.EverythingAsync(key).ConfigureAwait(false);
    }

    /// <summary>Return all resources related to a resource type ($everything).</summary>
    [HttpPost, HttpGet, Route("{type}/$everything"), Tags("Operations")]
    public async Task<FhirResponse> EverythingType(string type)
    {
        var key = Key.Create(type);
        return await _fhirService.EverythingAsync(key).ConfigureAwait(false);
    }

    /// <summary>Generate a document Bundle from a Composition resource ($document).</summary>
    [HttpPost, HttpGet, Route("Composition/{id}/$document"), Tags("Operations")]
    public async Task<FhirResponse> Document(string id)
    {
        var key = Key.Create("Composition", id);
        return await _fhirService.DocumentAsync(key).ConfigureAwait(false);
    }
}