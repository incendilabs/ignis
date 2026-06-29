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
using Ignis.Validation;

using Microsoft.Extensions.Options;

using Task = System.Threading.Tasks.Task;

namespace Ignis.Api.Extensions;

/// <summary>
/// Wires the profile validator into the host, loading conformance packages from
/// <see cref="ProfileValidationSettings.PackageDirectory"/> (default: build-staged <c>fhir-packages</c>).
/// </summary>
public static class ProfileValidationExtensions
{
    /// <summary>Registers <see cref="IProfileValidationService"/> as a singleton (resolved at startup).</summary>
    public static IServiceCollection AddProfileValidation(this IServiceCollection services)
    {
        services.AddSingleton<IProfileValidationService>(provider =>
        {
            var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger("Ignis.ProfileValidation");
            var settings = provider.GetRequiredService<IOptions<ProfileValidationSettings>>().Value;

            // Relative paths resolve under the app base; Path.Combine keeps an absolute PackageDirectory as-is.
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

            // Validation is additive: no packages is not fatal — $validate just resolves nothing.
            if (packages.Length == 0)
                logger.LogWarning("No FHIR packages available in {Directory}; $validate cannot resolve any profile.", directory);
            else
                logger.LogInformation("Profile validator loaded {Count} FHIR package(s) from {Directory}: {Packages}",
                    packages.Length, directory, packages.Select(Path.GetFileName).ToArray());

            IAsyncResourceResolver resolver = packages.Length == 0
                ? new EmptyResolver()
                : new FhirPackageSource(ModelInfo.ModelInspector, packages);
            ICodeValidationTerminologyService terminology = LocalTerminologyService.CreateDefaultForCore(resolver);

            return new ProfileValidationService(resolver, terminology);
        });

        return services;
    }
}

/// <summary>Resolves nothing — used when no packages are present so $validate degrades to NotFound instead of throwing.</summary>
internal sealed class EmptyResolver : IAsyncResourceResolver
{
    public Task<Resource?> ResolveByUriAsync(string uri) => Task.FromResult<Resource?>(null);
    public Task<Resource?> ResolveByCanonicalUriAsync(string uri) => Task.FromResult<Resource?>(null);
}
