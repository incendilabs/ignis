/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Firely.Fhir.Packages;

using Hl7.Fhir.Model;
using Hl7.Fhir.Specification.Source;
using Hl7.Fhir.Specification.Terminology;

using Ignis.Api.Configuration;
using Ignis.Terminology;

using Microsoft.Extensions.Options;

namespace Ignis.Api.Extensions;

/// <summary>
/// Wires the terminology expansion service (<c>Ignis.Terminology</c>) into the host. Builds a Firely
/// terminology service from the FHIR packages in <see cref="ProfileValidationSettings.PackageDirectory"/>
/// (shared with profile validation). This is the FHIR-version-specific seam (uses R4's
/// <see cref="ModelInfo.ModelInspector"/>); the expansion service itself is version-agnostic.
/// </summary>
public static class TerminologyExtensions
{
    /// <summary>Registers <see cref="IValueSetExpansionService"/> as a singleton (resolved at startup).</summary>
    public static IServiceCollection AddTerminology(this IServiceCollection services)
    {
        services.AddSingleton<IValueSetExpansionService>(provider =>
        {
            var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger("Ignis.Terminology");
            var settings = provider.GetRequiredService<IOptions<ProfileValidationSettings>>().Value;

            var directory = Path.Combine(AppContext.BaseDirectory,
                string.IsNullOrWhiteSpace(settings.PackageDirectory) ? "fhir-packages" : settings.PackageDirectory);

            string[] packages;
            try
            {
                packages = Directory.Exists(directory) ? Directory.GetFiles(directory, "*.tgz") : [];
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                logger.LogWarning(ex, "Could not read FHIR package directory {Directory}.", directory);
                packages = [];
            }

            if (packages.Length == 0)
                logger.LogWarning("No FHIR packages available in {Directory}; $expand can only expand inline ValueSets.", directory);

            // EmptyResolver (from ProfileValidationExtensions, same assembly) resolves nothing, so with no
            // packages $expand still works for inline ValueSets and degrades gracefully otherwise.
            IAsyncResourceResolver resolver = packages.Length == 0
                ? new EmptyResolver()
                : new FhirPackageSource(ModelInfo.ModelInspector, packages);
            ITerminologyService terminology = LocalTerminologyService.CreateDefaultForCore(resolver);

            return new ValueSetExpansionService(terminology);
        });

        return services;
    }
}
