/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Specification.Source;
using Hl7.Fhir.Specification.Terminology;

using Ignis.Api.Services.Resolution;
using Ignis.Terminology;

namespace Ignis.Api.Extensions;

/// <summary>
/// Wires the terminology expansion service (<c>Ignis.Terminology</c>) into the host, resolving canonicals
/// from the same two sources as <c>$validate</c>: the FHIR packages, then the FHIR store. This is the
/// FHIR-version-specific seam; the expansion service itself is version-agnostic.
/// </summary>
public static class TerminologyExtensions
{
    /// <summary>Registers <see cref="IValueSetExpansionService"/> as a singleton (resolved at startup).</summary>
    public static IServiceCollection AddTerminology(this IServiceCollection services)
    {
        services.AddConformanceSources();

        services.AddSingleton<IValueSetExpansionService>(provider =>
        {
            var packages = provider.GetRequiredService<PackageConformanceSource>();
            var storeResolver = provider.GetRequiredService<StoreCanonicalResolver>();

            // Look in the FHIR packages first, then the store, so a ValueSet saved in the catalog can be
            // expanded by its canonical url.
            IAsyncResourceResolver resolver = new MultiResolver(packages.Resolver, storeResolver);

            // The mime-type and language services return an empty expansion for any url, also ones they do
            // not own, so they must come after the resolver-backed service.
            var local = new TerminologyServiceRoutingSettings(new LocalTerminologyService(resolver));
            var mimeTypes = new TerminologyServiceRoutingSettings(new MimeTypeTerminologyService())
            {
                PreferredValueSets = [MimeTypeTerminologyService.MIMETYPE_VALUESET_R4_AND_UP],
            };
            var languages = new TerminologyServiceRoutingSettings(new LanguageTerminologyService())
            {
                PreferredValueSets = [LanguageTerminologyService.LANGUAGE_VALUESET],
            };

            return new ValueSetExpansionService(new MultiTerminologyService(local, mimeTypes, languages));
        });

        return services;
    }
}
