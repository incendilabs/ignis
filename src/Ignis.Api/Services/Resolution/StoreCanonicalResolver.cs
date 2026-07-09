/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;
using Hl7.Fhir.Rest;
using Hl7.Fhir.Specification.Source;

using Spark.Engine.Service;

namespace Ignis.Api.Services.Resolution;

/// <summary>
/// An <see cref="IAsyncResourceResolver"/> that resolves FHIR canonical URLs against the FHIR store (via
/// <see cref="IFhirService"/>), applying latest-active-by-semver selection. Composed with the package
/// source so <c>$validate</c> and terminology can use profiles/ValueSets stored in the catalog — the
/// validation engine resolves canonicals through this interface, not the REST API.
/// </summary>
public sealed class StoreCanonicalResolver : IAsyncResourceResolver
{
    // Canonical URLs don't carry their resource type, so probe these conformance types in order. A url
    // is unique across them in valid FHIR, so the first match wins. Extend as new catalog types appear.
    private static readonly string[] CanonicalTypes =
        ["StructureDefinition", "ValueSet", "CodeSystem", "ConceptMap", "Questionnaire"];

    private const int MaxCandidates = 200;

    private readonly IServiceScopeFactory _scopeFactory;

    public StoreCanonicalResolver(IServiceScopeFactory scopeFactory) =>
        _scopeFactory = scopeFactory ?? throw new ArgumentNullException(nameof(scopeFactory));

    /// <inheritdoc />
    public async Task<Resource?> ResolveByCanonicalUriAsync(string uri)
    {
        if (string.IsNullOrWhiteSpace(uri))
            return null;

        var (url, version) = CanonicalVersion.SplitUrlAndVersion(uri);

        // Singleton resolver reaching per-request Spark services: open a scope per lookup.
        await using var scope = _scopeFactory.CreateAsyncScope();
        // No FHIR store wired (e.g. a minimal host): nothing to resolve from — defer to other resolvers.
        if (scope.ServiceProvider.GetService<IFhirService>() is not { } fhir)
            return null;

        foreach (var type in CanonicalTypes)
        {
            var candidates = await SearchByUrlAsync(fhir, type, url, version).ConfigureAwait(false);
            if (CanonicalVersion.SelectLatestActive(candidates, version) is { } match)
                return match;
        }

        return null;
    }

    /// <inheritdoc />
    public async Task<Resource?> ResolveByUriAsync(string uri)
    {
        // Only relative "Type/id" literal references; canonicals use ResolveByCanonicalUriAsync, and the
        // package source (composed ahead of this resolver) handles everything else.
        if (string.IsNullOrWhiteSpace(uri) || uri.Contains("://"))
            return null;

        var segments = uri.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length != 2 || !ModelInfo.IsKnownResource(segments[0]))
            return null;

        await using var scope = _scopeFactory.CreateAsyncScope();
        // No FHIR store wired (e.g. a minimal host): nothing to resolve from — defer to other resolvers.
        if (scope.ServiceProvider.GetService<IFhirService>() is not { } fhir)
            return null;

        var search = new SearchParams();
        search.Add("_id", segments[1]);
        return (await SearchAsync(fhir, segments[0], search).ConfigureAwait(false)).FirstOrDefault();
    }

    private static async Task<IReadOnlyList<Resource>> SearchByUrlAsync(
        IFhirService fhir, string type, string url, string? version)
    {
        var search = new SearchParams();
        search.Add("url", url);
        if (version is not null)
            search.Add("version", version);
        else
            search.Add("status", "active");
        search.Count = MaxCandidates;

        var results = await SearchAsync(fhir, type, search).ConfigureAwait(false);

        // Guard against loose uri matching: keep only exact canonical-url matches.
        return results
            .Where(r => (r as IVersionableConformanceResource)?.Url == url)
            .ToList();
    }

    private static async Task<IReadOnlyList<Resource>> SearchAsync(
        IFhirService fhir, string type, SearchParams search)
    {
        var response = await fhir.SearchAsync(type, search, 0).ConfigureAwait(false);
        if (response.Resource is not Bundle bundle)
            return [];

        return bundle.Entry
            .Select(entry => entry.Resource)
            .OfType<Resource>()
            .ToList();
    }
}
