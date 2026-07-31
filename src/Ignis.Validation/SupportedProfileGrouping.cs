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
    /// Base specializations, non-resource StructureDefinitions and cross-version profiles are excluded.
    /// </summary>
    public static IReadOnlyList<ProfileSummary> Browsable(IEnumerable<ProfileSummary> summaries)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var result = new List<ProfileSummary>();
        foreach (var summary in summaries)
        {
            if (!summary.IsResourceKind || !summary.IsConstraint) continue;
            if (string.IsNullOrEmpty(summary.ConstrainedType) || string.IsNullOrEmpty(summary.Canonical)) continue;
            if (IsCrossVersion(summary.Canonical)) continue;
            if (seen.Add(summary.Canonical))
                result.Add(summary);
        }

        return result.ToArray();
    }

    /// <summary>
    /// Whether the canonical is a cross-version profile such as
    /// <c>http://hl7.org/fhir/5.0/StructureDefinition/profile-Questionnaire</c>. Those describe another
    /// FHIR version's shape for IG authors to reference; validating against one pulls in that version's
    /// dependencies, which the loaded packages generally do not carry.
    /// </summary>
    private static bool IsCrossVersion(string canonical)
    {
        const string CoreBase = "http://hl7.org/fhir/";
        if (!canonical.StartsWith(CoreBase, StringComparison.Ordinal)) return false;

        // The segment after the base is the FHIR version ("5.0") rather than "StructureDefinition".
        var rest = canonical.AsSpan(CoreBase.Length);
        var end = rest.IndexOf('/');
        if (end <= 0) return false;

        var segment = rest[..end];
        foreach (var character in segment)
            if (!char.IsAsciiDigit(character) && character != '.') return false;

        return segment.Contains('.');
    }

    /// <summary>The <see cref="Browsable"/> profiles' canonicals, grouped by constrained type.</summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<string>> ByType(IEnumerable<ProfileSummary> summaries)
    {
        var byType = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        foreach (var summary in Browsable(summaries))
        {
            if (!byType.TryGetValue(summary.ConstrainedType!, out var order))
                byType[summary.ConstrainedType!] = order = [];
            order.Add(summary.Canonical!);
        }

        var result = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
        foreach (var (type, canonicals) in byType)
            result[type] = canonicals.ToArray();

        return result;
    }
}
