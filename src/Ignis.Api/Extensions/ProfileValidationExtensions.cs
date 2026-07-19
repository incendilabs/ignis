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
using Ignis.Api.Services.Resolution;
using Ignis.Validation;

using Microsoft.Extensions.Options;

using Task = System.Threading.Tasks.Task;

namespace Ignis.Api.Extensions;

/// <summary>
/// Wires the profile validator into the host. Conformance is resolved from two sources: FHIR packages in
/// <see cref="ValidationSettings.PackageDirectory"/> (default: build-staged <c>fhir-packages</c>),
/// and — for catalog-authored profiles/ValueSets — the FHIR store.
/// </summary>
public static class ProfileValidationExtensions
{
    /// <summary>Registers <see cref="IProfileValidationService"/> as a singleton (resolved at startup).</summary>
    public static IServiceCollection AddProfileValidation(this IServiceCollection services)
    {
        // Store-backed canonical resolver: lets $validate and terminology use profiles/ValueSets stored in
        // the catalog. Singleton, but reaches per-request Spark services via IServiceScopeFactory.
        services.AddSingleton<StoreCanonicalResolver>();

        services.AddSingleton<IValidationResourceParser>(provider =>
            new ValidationResourceParser(
                ModelInfo.ModelInspector,
                provider.GetRequiredService<IOptions<ValidationSettings>>().Value.Parsing));

        services.AddSingleton<IProfileValidationService>(provider =>
        {
            var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger("Ignis.ProfileValidation");
            var settings = provider.GetRequiredService<IOptions<ValidationSettings>>().Value;

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

            // Validation is additive: no packages is not fatal — package resolution just falls back to the store.
            if (packages.Length == 0)
                logger.LogWarning("No FHIR packages available in {Directory}; $validate can resolve only catalog-stored profiles.", directory);
            else
                logger.LogInformation("Profile validator loaded {Count} FHIR package(s) from {Directory}: {Packages}",
                    packages.Length, directory, packages.Select(Path.GetFileName).ToArray());

            IAsyncResourceResolver packageSource = packages.Length == 0
                ? new EmptyResolver()
                : new FhirPackageSource(ModelInfo.ModelInspector, packages);
            var storeResolver = provider.GetRequiredService<StoreCanonicalResolver>();

            // Package-first, store-fallback: core/base canonicals resolve from the packages (fast, never hit
            // the store); only catalog-authored canonicals fall through to Mongo.
            IAsyncResourceResolver resolver = new MultiResolver(packageSource, storeResolver);
            ICodeValidationTerminologyService terminology = LocalTerminologyService.CreateDefaultForCore(resolver);

            return new ProfileValidationService(resolver, terminology);
        });

        return services;
    }
}

/// <summary>Resolves nothing — used when no packages are present, so package resolution defers to the store.</summary>
internal sealed class EmptyResolver : IAsyncResourceResolver
{
    public Task<Resource?> ResolveByUriAsync(string uri) => Task.FromResult<Resource?>(null);
    public Task<Resource?> ResolveByCanonicalUriAsync(string uri) => Task.FromResult<Resource?>(null);
}
