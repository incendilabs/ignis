/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;

using Ignis.Api.Configuration;

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
    private readonly CapabilityStatementSettings _settings;
    private readonly Lazy<CapabilityStatement> _enriched;

    public ProfileAwareCapabilityStatementService(
        CapabilityStatementService inner,
        ISupportedProfileCatalog catalog,
        CapabilityStatementSettings settings)
    {
        _inner = inner ?? throw new ArgumentNullException(nameof(inner));
        _catalog = catalog ?? throw new ArgumentNullException(nameof(catalog));
        _settings = settings ?? throw new ArgumentNullException(nameof(settings));
        _enriched = new Lazy<CapabilityStatement>(Build);
    }

    public CapabilityStatement GetSparkCapabilityStatement() => _enriched.Value;

    // Fixed canonical namespace for Ignis's built-in operations.
    private const string OperationBase = "http://incendi.com/fhir/OperationDefinition/";

    private CapabilityStatement Build()
    {
        // We own the inner exclusively and build once behind the Lazy
        var statement = _inner.GetSparkCapabilityStatement();

        DescribeImplementation(statement);

        foreach (var rest in statement.Rest)
            AdvertiseOperations(rest);

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

    /// <summary>
    /// Adds a description of the deployment to <c>CapabilityStatement.implementation.description</c> if configured.
    /// </summary>
    private void DescribeImplementation(CapabilityStatement statement)
    {
        if (string.IsNullOrWhiteSpace(_settings.ImplementationDescription))
            return;

        // description is 1..1 once implementation is present
        statement.Implementation ??= new CapabilityStatement.ImplementationComponent();
        statement.Implementation.Description = _settings.ImplementationDescription;
    }

    private static void AdvertiseOperations(CapabilityStatement.RestComponent rest)
    {
        rest.Operation.Add(new CapabilityStatement.OperationComponent
        {
            Name = "packages",
            Definition = OperationBase + "packages",
        });

        var structureDefinition = rest.Resource.FirstOrDefault(r => r.Type?.ToString() == "StructureDefinition");
        structureDefinition?.Operation.Add(new CapabilityStatement.OperationComponent
        {
            Name = "profiles",
            Definition = OperationBase + "profiles",
        });
    }
}
