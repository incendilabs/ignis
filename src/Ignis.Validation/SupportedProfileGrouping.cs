/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Validation;

/// <summary>
/// A StructureDefinition reduced to what deciding "is this a browsable profile"
/// needs: the type it constrains, its kind and derivation, and its canonical.
/// </summary>
public readonly record struct ProfileSummary(
    string? ConstrainedType,
    bool IsResourceKind,
    bool IsConstraint,
    string? Canonical);

/// <summary>Version-agnostic grouping of profiles by the resource type they constrain.</summary>
public static class SupportedProfileGrouping
{
    /// <summary>
    /// Keeps resource-kind <em>constraint</em> profiles and groups their canonicals by constrained
    /// type. Base specializations (the resource types themselves) and non-resource StructureDefinitions
    /// are dropped, so the result is what a client can validate a resource against.
    /// </summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<string>> ByType(IEnumerable<ProfileSummary> summaries)
    {
        var byType = new Dictionary<string, (List<string> Order, HashSet<string> Seen)>(StringComparer.Ordinal);
        foreach (var s in summaries)
        {
            if (!s.IsResourceKind || !s.IsConstraint) continue;
            if (string.IsNullOrEmpty(s.ConstrainedType) || string.IsNullOrEmpty(s.Canonical)) continue;

            if (!byType.TryGetValue(s.ConstrainedType, out var entry))
                byType[s.ConstrainedType] = entry = ([], new HashSet<string>(StringComparer.Ordinal));
            // O(1) dedupe, preserving first-seen order; frozen to arrays below.
            if (entry.Seen.Add(s.Canonical))
                entry.Order.Add(s.Canonical);
        }

        // ToArray so callers get a truly immutable list, not a downcastable List<string>.
        return byType.ToDictionary(
            kv => kv.Key,
            kv => (IReadOnlyList<string>)kv.Value.Order.ToArray(),
            StringComparer.Ordinal);
    }
}
