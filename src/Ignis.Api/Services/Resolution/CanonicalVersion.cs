/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;

using Semver;

namespace Ignis.Api.Services.Resolution;

/// <summary>
/// Pure helpers for canonical URLs: splitting <c>url|version</c> and picking the "latest-active"
/// resource among candidates. No store or IO dependencies, so unit-testable in isolation.
/// </summary>
internal static class CanonicalVersion
{
    /// <summary>Splits a canonical into (url, version?), stripping any <c>#fragment</c> and whitespace.</summary>
    public static (string Url, string? Version) SplitUrlAndVersion(string canonical)
    {
        var value = canonical.Trim();

        var hash = value.IndexOf('#');
        if (hash >= 0)
            value = value[..hash];

        var bar = value.IndexOf('|');
        var url = (bar < 0 ? value : value[..bar]).Trim();
        var version = bar < 0 ? null : value[(bar + 1)..].Trim();

        return (url, string.IsNullOrWhiteSpace(version) ? null : version);
    }

    /// <summary>
    /// Picks the resource to use for a canonical: the exact <paramref name="version"/> when given (any
    /// status — explicit pinning wins), otherwise the highest <see cref="CompareVersions"/> among
    /// <see cref="PublicationStatus.Active"/>. Returns null when nothing matches.
    /// </summary>
    public static Resource? SelectLatestActive(IEnumerable<Resource> candidates, string? version) =>
        version is not null
            ? candidates.FirstOrDefault(r => Conformance(r)?.Version == version)
            : candidates
                .Where(r => Conformance(r)?.Status == PublicationStatus.Active)
                // MaxBy returns null on an empty sequence (Resource is a reference type): no active match.
                .MaxBy(r => Conformance(r)?.Version, Comparer<string?>.Create(CompareVersions));

    /// <summary>
    /// Orders by semver precedence when both sides parse as (loose) semver: prerelease below its
    /// release (<c>1.0.0-rc.1 &lt; 1.0.0</c>), numeric segments by value (<c>1.10.0 &gt; 1.2.0</c>),
    /// build metadata ignored. A semver version outranks a non-semver one, and two non-semver
    /// versions compare ordinally — three tiers that keep the order total and transitive.
    /// </summary>
    public static int CompareVersions(string? left, string? right)
    {
        var leftIsSemver = SemVersion.TryParse(left ?? string.Empty, SemVersionStyles.Any, out var leftSemver);
        var rightIsSemver = SemVersion.TryParse(right ?? string.Empty, SemVersionStyles.Any, out var rightSemver);

        if (leftIsSemver && rightIsSemver)
            return SemVersion.ComparePrecedence(leftSemver, rightSemver);

        // If comparing a semver string with a non-semver string, the semver string is considered greater.
        if (leftIsSemver != rightIsSemver)
            return leftIsSemver ? 1 : -1;

        // Neither side is semver: no meaningful order exists, so ordinal comparison is used to keep the order total and transitive.
        return string.CompareOrdinal(left ?? string.Empty, right ?? string.Empty);
    }

    private static IVersionableConformanceResource? Conformance(Resource resource) =>
        resource as IVersionableConformanceResource;
}
