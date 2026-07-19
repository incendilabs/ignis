/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;
using Hl7.Fhir.Specification.Source;

using Ignis.Validation;

namespace Ignis.Api.Services.Validation;

/// <summary>
/// The resource-constraint profiles the server knows from its FHIR packages,
/// grouped by the resource type each one constrains — the data behind
/// <c>CapabilityStatement.rest.resource.supportedProfile</c>. Store-authored
/// profiles are not included; those stay discoverable via a normal
/// <c>StructureDefinition</c> search.
/// </summary>
public interface ISupportedProfileCatalog
{
    /// <summary>Resource type name → canonical URLs of its profiles. Types with none are absent.</summary>
    Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> ProfilesByTypeAsync();
}

/// <summary>
/// Resolves each package StructureDefinition once and groups the constraint
/// profiles by type. Built lazily and cached: package contents are fixed at
/// startup, so the first CapabilityStatement request pays the cost.
/// </summary>
public sealed class SupportedProfileCatalog : ISupportedProfileCatalog
{
    private readonly Lazy<Task<IReadOnlyDictionary<string, IReadOnlyList<string>>>> _byType;

    public SupportedProfileCatalog(IAsyncResourceResolver resolver, IEnumerable<string> structureDefinitionCanonicals)
    {
        ArgumentNullException.ThrowIfNull(resolver);
        ArgumentNullException.ThrowIfNull(structureDefinitionCanonicals);
        _byType = new Lazy<Task<IReadOnlyDictionary<string, IReadOnlyList<string>>>>(
            () => BuildAsync(resolver, structureDefinitionCanonicals));
    }

    public Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> ProfilesByTypeAsync() => _byType.Value;

    private static async Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> BuildAsync(
        IAsyncResourceResolver resolver,
        IEnumerable<string> canonicals)
    {
        var summaries = new List<ProfileSummary>();
        foreach (var canonical in canonicals)
        {
            var resolved = await resolver.TryResolveByCanonicalUriAsync(canonical).ConfigureAwait(false);
            if (resolved.Value is not StructureDefinition definition)
                continue;

            summaries.Add(new ProfileSummary(
                ConstrainedType: definition.Type,
                IsResourceKind: definition.Kind == StructureDefinition.StructureDefinitionKind.Resource,
                IsConstraint: definition.Derivation == StructureDefinition.TypeDerivationRule.Constraint,
                Canonical: definition.Url));
        }

        return SupportedProfileGrouping.ByType(summaries);
    }
}
