/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;

using Spark.Engine.Service.FhirServiceExtensions;

namespace Ignis.Api.Services.Validation;

/// <summary>
/// Extends <see cref="CapabilityStatementService"/> with <c>supportedProfile</c> 
/// from the loaded FHIR packages. 
/// </summary>
public sealed class ProfileAwareCapabilityStatementService : ICapabilityStatementService
{
    private readonly CapabilityStatementService _inner;
    private readonly ISupportedProfileCatalog _catalog;
    private readonly Lazy<CapabilityStatement> _enriched;

    public ProfileAwareCapabilityStatementService(
        CapabilityStatementService inner,
        ISupportedProfileCatalog catalog)
    {
        _inner = inner ?? throw new ArgumentNullException(nameof(inner));
        _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
        _enriched = new Lazy<CapabilityStatement>(Build);
    }

    public CapabilityStatement GetSparkCapabilityStatement() => _enriched.Value;

    private CapabilityStatement Build()
    {
        // We own the inner exclusively and build once behind the Lazy
        var statement = _inner.GetSparkCapabilityStatement();

        // The catalog resolves package StructureDefinitions asynchronously; block once here.
        // It runs a single time, and the work is in-memory after packages load at startup.
        var byType = _catalog.ProfilesByTypeAsync().GetAwaiter().GetResult();
        if (byType.Count == 0)
            return statement;

        foreach (var resource in statement.Rest.SelectMany(rest => rest.Resource))
        {
            var type = resource.Type?.ToString();
            if (type is not null && byType.TryGetValue(type, out var canonicals))
                resource.SupportedProfileElement = canonicals.Select(c => new Canonical(c)).ToList();
        }

        return statement;
    }
}
