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
using Ignis.Api.Services.Validation;
using Ignis.Validation;

using Microsoft.Extensions.Options;

using Task = System.Threading.Tasks.Task;

namespace Ignis.Api.Extensions;

/// <summary>
/// Wires the profile validator into the host. Conformance is resolved from two sources: FHIR packages in
/// <see cref="ProfileValidationSettings.PackageDirectory"/> (default: build-staged <c>fhir-packages</c>),
/// and — for catalog-authored profiles/ValueSets — the FHIR store.
/// </summary>
public static class ProfileValidationExtensions
{
    /// <summary>
    /// Registers <see cref="IProfileValidationService"/> and <see cref="ISupportedProfileCatalog"/> as
    /// singletons, sharing one package load (resolved at startup).
    /// </summary>
    public static IServiceCollection AddProfileValidation(this IServiceCollection services)
    {
        // Store-backed canonical resolver: lets $validate and terminology use profiles/ValueSets stored in
        // the catalog. Singleton, but reaches per-request Spark services via IServiceScopeFactory.
        services.AddSingleton<StoreCanonicalResolver>();

        // The FHIR packages, loaded once and shared: as a resolver (for validation) and as a summary
        // source (for the supported-profile catalog).
        services.AddSingleton(provider =>
        {
            var logger = provider.GetRequiredService<ILoggerFactory>().CreateLogger("Ignis.ProfileValidation");
            var settings = provider.GetRequiredService<IOptions<ProfileValidationSettings>>().Value;
            return PackageConformanceSource.Load(settings, logger);
        });

        services.AddSingleton<ISupportedProfileCatalog>(provider =>
        {
            var packages = provider.GetRequiredService<PackageConformanceSource>();
            return new SupportedProfileCatalog(packages.Resolver, packages.StructureDefinitionCanonicals);
        });

        services.AddSingleton<IProfileValidationService>(provider =>
        {
            var packages = provider.GetRequiredService<PackageConformanceSource>();
            var storeResolver = provider.GetRequiredService<StoreCanonicalResolver>();

            // Package-first, store-fallback: core/base canonicals resolve from the packages (fast, never hit
            // the store); only catalog-authored canonicals fall through to Mongo.
            IAsyncResourceResolver resolver = new MultiResolver(packages.Resolver, storeResolver);
            ICodeValidationTerminologyService terminology = LocalTerminologyService.CreateDefaultForCore(resolver);

            return new ProfileValidationService(resolver, terminology);
        });

        return services;
    }
}

/// <summary>
/// The FHIR packages loaded from disk, exposed both as an <see cref="IAsyncResourceResolver"/> (for
/// validation) and an <see cref="ISummarySource"/> (for listing supported profiles) — one load, two views.
/// </summary>
internal sealed class PackageConformanceSource
{
    public IAsyncResourceResolver Resolver { get; }

    /// <summary>Canonical URLs of every StructureDefinition in the packages — the catalog resolves these.</summary>
    public IReadOnlyList<string> StructureDefinitionCanonicals { get; }

    private PackageConformanceSource(IAsyncResourceResolver resolver, IReadOnlyList<string> structureDefinitionCanonicals)
    {
        Resolver = resolver;
        StructureDefinitionCanonicals = structureDefinitionCanonicals;
    }

    public static PackageConformanceSource Load(ProfileValidationSettings settings, ILogger logger)
    {
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
        {
            logger.LogWarning("No FHIR packages available in {Directory}; $validate can resolve only catalog-stored profiles.", directory);
            return new PackageConformanceSource(new EmptyResolver(), []);
        }

        logger.LogInformation("Profile validator loaded {Count} FHIR package(s) from {Directory}: {Packages}",
            packages.Length, directory, packages.Select(Path.GetFileName).ToArray());

        var source = new FhirPackageSource(ModelInfo.ModelInspector, packages);
        var structureDefinitions = source.ListCanonicalUris("StructureDefinition").ToList();
        return new PackageConformanceSource(source, structureDefinitions);
    }
}

/// <summary>Resolves nothing — used when no packages are present, so package resolution defers to the store.</summary>
internal sealed class EmptyResolver : IAsyncResourceResolver
{
    public Task<Resource?> ResolveByUriAsync(string uri) => Task.FromResult<Resource?>(null);
    public Task<Resource?> ResolveByCanonicalUriAsync(string uri) => Task.FromResult<Resource?>(null);
}
