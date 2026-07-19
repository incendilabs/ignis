/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;

using Ignis.Api.Services.Validation;

using Microsoft.Extensions.DependencyInjection.Extensions;

using Spark.Engine;
using Spark.Engine.Core;
using Spark.Engine.Service.FhirServiceExtensions;

namespace Ignis.Api.Extensions;

public static class CapabilityStatementExtensions
{
    /// <summary>
    /// Replaces Spark's capability-statement service with one that advertises package profiles under
    /// <c>supportedProfile</c>, delegating to Spark's builder for everything else. Call <em>after</em>
    /// <c>AddFhirWithMvc</c>, which registers Spark's default.
    /// </summary>
    public static IServiceCollection AddProfileAwareCapabilityStatement(this IServiceCollection services)
    {
        services.RemoveAll<ICapabilityStatementService>();

        // FIXME: we rebuild Spark's CapabilityStatementService just to wrap it, which couples us to its
        // constructor. Spark has no hook to enrich the statement while keeping its built-in service. 
        // Drop this and register a contributor once that exists.
        services.AddSingleton<ICapabilityStatementService>(provider =>
            new ProfileAwareCapabilityStatementService(
                new CapabilityStatementService(
                    provider.GetRequiredService<ILocalhost>(),
                    provider.GetRequiredService<IFhirModel>(),
                    provider.GetRequiredService<ServerVersion>(),
                    FHIRVersion.N4_0_1),
                provider.GetRequiredService<ISupportedProfileCatalog>()));

        return services;
    }
}
