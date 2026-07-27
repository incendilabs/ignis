/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Validation;

/// <summary>
/// StructureDefinition summary.
/// </summary>
public readonly record struct ProfileSummary(
    string? ConstrainedType,
    bool IsResourceKind,
    bool IsConstraint,
    string? Canonical,
    string? Name = null,
    string? Title = null,
    string? Version = null,
    string? Status = null);

/// <summary>Version-agnostic grouping of profiles by the resource type they constrain.</summary>
public static class SupportedProfileGrouping
{
    /// <summary>
    /// The constraint profiles a resource can be validated against, deduped by canonical.
    /// Base specializations and non-resource StructureDefinitions are excluded.
    /// </summary>
    public static IReadOnlyList<ProfileSummary> Browsable(IEnumerable<ProfileSummary> summaries)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<ProfileSummary>();
        foreach (var s in summaries)
        {
            if (!s.IsResourceKind || !s.IsConstraint) continue;
            if (string.IsNullOrEmpty(s.ConstrainedType) || string.IsNullOrEmpty(s.Canonical)) continue;
            if (seen.Add(s.Canonical))
                result.Add(s);
        }

        return result.ToArray();
    }

    /// <summary>The <see cref="Browsable"/> profiles' canonicals, grouped by constrained type.</summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<string>> ByType(IEnumerable<ProfileSummary> summaries)
    {
        var byType = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var s in Browsable(summaries))
        {
            if (!byType.TryGetValue(s.ConstrainedType!, out var order))
                byType[s.ConstrainedType!] = order = [];
            order.Add(s.Canonical!);
        }

        return byType.ToDictionary(
            kv => kv.Key,
            kv => (IReadOnlyList<string>)kv.Value.ToArray(),
            StringComparer.Ordinal);
    }
}
