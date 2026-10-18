/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Spark.Engine;
using Spark.Store.MongoDB.Extensions;

namespace Ignis.Api.Extensions;

/// <summary>
/// Registers the Spark FHIR store. 
/// </summary>
public static class FhirStoreExtensions
{
    /// <summary>Binds <see cref="StoreSettings"/> from the <c>StoreSettings</c> section and registers the MongoDB store.</summary>
    public static IServiceCollection AddFhirStore(this IServiceCollection services, IConfiguration configuration)
    {
        var storeSettings = new StoreSettings();
        configuration.Bind("StoreSettings", storeSettings);

        services.AddMongoFhirStore(storeSettings);
        return services;
    }
}
