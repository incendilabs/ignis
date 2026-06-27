/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Firely.Fhir.Packages;

using Hl7.Fhir.Model;
using Hl7.Fhir.Specification.Source;
using Hl7.Fhir.Specification.Terminology;

using Ignis.Validation;

namespace Ignis.Api.Extensions;

/// <summary>
/// Wires the structural profile validator (<c>Ignis.Validation</c>) into the host. Conformance packages
/// are loaded from the <c>fhir-packages</c> folder staged next to the app at build time by
/// <c>fhir-packages.targets</c>; terminology is validated in-process against those packages.
/// </summary>
public static class ProfileValidationExtensions
{
    /// <summary>Registers <see cref="IProfileValidationService"/> as a singleton.</summary>
    public static IServiceCollection AddProfileValidation(this IServiceCollection services)
    {
        // Built lazily on first use (not at startup): compiling schemas is expensive and the resolver
        // and terminology service are constructed once for the singleton's lifetime.
        services.AddSingleton<IProfileValidationService>(_ =>
        {
            var directory = Path.Combine(AppContext.BaseDirectory, "fhir-packages");
            var packages = Directory.Exists(directory) ? Directory.GetFiles(directory, "*.tgz") : [];
            if (packages.Length == 0)
                throw new InvalidOperationException(
                    $"No FHIR packages found in '{directory}'. They are staged at build time by fhir-packages.targets.");

            IAsyncResourceResolver resolver = new FhirPackageSource(ModelInfo.ModelInspector, packages);
            ICodeValidationTerminologyService terminology = LocalTerminologyService.CreateDefaultForCore(resolver);

            return new ProfileValidationService(resolver, terminology);
        });

        return services;
    }
}
