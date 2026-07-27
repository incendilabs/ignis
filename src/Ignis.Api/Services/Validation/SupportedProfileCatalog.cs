/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;
using Hl7.Fhir.Specification.Source;
using Hl7.Fhir.Utility;

using Ignis.Validation;

namespace Ignis.Api.Services.Validation;

/// <summary>
/// The resource-constraint profiles the server knows from its FHIR packages — as a flat list with
/// metadata (<see cref="ProfilesAsync"/>) and grouped by the resource type each one constrains
/// (<see cref="ProfilesByTypeAsync"/>, the data behind <c>CapabilityStatement.rest.resource.supportedProfile</c>).
/// Store-authored profiles are not included; those stay discoverable via a normal
/// <c>StructureDefinition</c> search.
/// </summary>
public interface ISupportedProfileCatalog
{
    /// <summary>Every browsable profile with its metadata.</summary>
    Task<IReadOnlyList<ProfileSummary>> ProfilesAsync();

    /// <summary>Resource type name → canonical URLs of its profiles. Types with none are absent.</summary>
    Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> ProfilesByTypeAsync();
}

/// <summary>
/// Resolves each package StructureDefinition once and keeps the browsable constraint profiles.
/// Built lazily and cached: package contents are fixed at startup, so the first request pays the cost.
/// </summary>
public sealed class SupportedProfileCatalog : ISupportedProfileCatalog
{
    private readonly Lazy<Task<IReadOnlyList<ProfileSummary>>> _profiles;

    public SupportedProfileCatalog(IAsyncResourceResolver resolver, IEnumerable<string> structureDefinitionCanonicals)
    {
        ArgumentNullException.ThrowIfNull(resolver);
        ArgumentNullException.ThrowIfNull(structureDefinitionCanonicals);
        _profiles = new Lazy<Task<IReadOnlyList<ProfileSummary>>>(
            () => BuildAsync(resolver, structureDefinitionCanonicals));
    }

    public Task<IReadOnlyList<ProfileSummary>> ProfilesAsync() => _profiles.Value;

    public async Task<IReadOnlyDictionary<string, IReadOnlyList<string>>> ProfilesByTypeAsync() =>
        SupportedProfileGrouping.ByType(await _profiles.Value.ConfigureAwait(false));

    private static async Task<IReadOnlyList<ProfileSummary>> BuildAsync(
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
                Canonical: definition.Url,
                Name: definition.Name,
                Title: definition.Title,
                Version: definition.Version,
                Status: definition.Status.GetLiteral()));
        }

        return SupportedProfileGrouping.Browsable(summaries);
    }
}
