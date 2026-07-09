/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using FluentAssertions;

using Hl7.Fhir.Model;

using Ignis.Api.Services.Resolution;

namespace Ignis.Api.Tests;

public class CanonicalVersionTests
{
    [Theory]
    [InlineData("1.0.0", "1.2.0", -1)]
    [InlineData("1.2.0", "1.10.0", -1)] // numeric per-segment, not lexical ("10" > "2")
    [InlineData("2.0.0", "2.0.0", 0)]
    [InlineData("1.10.0", "1.2.0", 1)]
    public void CompareVersions_ComparesSegmentsNumerically(string a, string b, int expectedSign) =>
        Math.Sign(CanonicalVersion.CompareVersions(a, b)).Should().Be(expectedSign);

    [Theory]
    [InlineData("2024-01", "2024-02", -1)] // date-style business versions keep their order
    [InlineData("r4", "r5", -1)] // two non-semver versions compare ordinally
    [InlineData("r4", "1.0.0", -1)] // a semver version outranks a non-semver one
    public void CompareVersions_HandlesNonSemverVersions(string a, string b, int expectedSign)
    {
        Math.Sign(CanonicalVersion.CompareVersions(a, b)).Should().Be(expectedSign);
        Math.Sign(CanonicalVersion.CompareVersions(b, a)).Should().Be(-expectedSign);
    }

    [Theory]
    [InlineData("1.0.0-rc.1", "1.0.0", -1)] // release outranks its prereleases
    [InlineData("1.0.0-alpha", "1.0.0-beta", -1)] // prereleases compare among themselves
    [InlineData("1.0.0-rc.2", "1.0.0-rc.10", -1)] // numeric prerelease identifiers compare by value
    [InlineData("1.0.0-rc", "1.0.0-rc.1", -1)] // more identifiers win on a shared prefix
    [InlineData("1.0.0-rc.1", "1.0.1-rc.1", -1)] // the release core decides before prerelease
    [InlineData("1.0.0+build.5", "1.0.0", 0)] // build metadata is ignored
    public void CompareVersions_HonorsSemverPrerelease(string a, string b, int expectedSign)
    {
        Math.Sign(CanonicalVersion.CompareVersions(a, b)).Should().Be(expectedSign);
        Math.Sign(CanonicalVersion.CompareVersions(b, a)).Should().Be(-expectedSign);
    }

    [Fact]
    public void SelectLatestActive_PrefersReleaseOverItsPrerelease()
    {
        var candidates = new Resource[]
        {
            Profile("1.0.0-rc.1", PublicationStatus.Active), Profile("1.0.0", PublicationStatus.Active),
        };

        var chosen = CanonicalVersion.SelectLatestActive(candidates, null) as StructureDefinition;

        chosen!.Version.Should().Be("1.0.0");
    }

    [Theory]
    [InlineData("https://x/vs", "https://x/vs", null)] // no version → caller resolves latest-active
    [InlineData("https://x/vs|1.2.0", "https://x/vs", "1.2.0")] // version pinned with the '|' separator
    [InlineData("https://x/vs|", "https://x/vs", null)] // degenerate trailing '|' → treated as no version
    [InlineData("https://x/vs| 1.2.0 ", "https://x/vs", "1.2.0")] // whitespace around the version is trimmed
    public void SplitUrlAndVersion_SeparatesUrlAndVersion(string input, string url, string? version)
    {
        var (resultUrl, resultVersion) = CanonicalVersion.SplitUrlAndVersion(input);
        resultUrl.Should().Be(url);
        resultVersion.Should().Be(version);
    }

    // '#' is a canonical fragment identifier (an anchor within the target resource), not a version —
    // SplitUrlAndVersion drops it so resolution works on the base url.
    [Fact]
    public void SplitUrlAndVersion_StripsFragment()
    {
        var (url, version) = CanonicalVersion.SplitUrlAndVersion("https://x/vs#frag");
        url.Should().Be("https://x/vs");
        version.Should().BeNull();
    }

    [Fact]
    public void SelectLatestActive_NoVersion_PicksHighestActive()
    {
        var candidates = new Resource[]
        {
            Profile("1.0.0", PublicationStatus.Draft), Profile("2.0.0", PublicationStatus.Active),
            Profile("1.5.0", PublicationStatus.Active),
        };

        var chosen = CanonicalVersion.SelectLatestActive(candidates, null) as StructureDefinition;

        chosen!.Version.Should().Be("2.0.0");
    }

    [Fact]
    public void SelectLatestActive_VersionPinned_ReturnsExactRegardlessOfStatus()
    {
        var candidates = new Resource[]
        {
            Profile("1.0.0", PublicationStatus.Retired), Profile("2.0.0", PublicationStatus.Active),
        };

        var chosen = CanonicalVersion.SelectLatestActive(candidates, "1.0.0") as StructureDefinition;

        chosen!.Version.Should().Be("1.0.0");
    }

    [Fact]
    public void SelectLatestActive_NoActive_ReturnsNull()
    {
        var candidates = new Resource[]
        {
            Profile("1.0.0", PublicationStatus.Draft), Profile("2.0.0", PublicationStatus.Retired),
        };

        CanonicalVersion.SelectLatestActive(candidates, null).Should().BeNull();
    }

    [Fact]
    public void SelectLatestActive_EmptyCandidates_ReturnsNull()
    {
        // Enumerable.MaxBy returns null (it does not throw) for an empty sequence of a reference type.
        var select = () => CanonicalVersion.SelectLatestActive([], null);

        select.Should().NotThrow().Which.Should().BeNull();
    }

    private static StructureDefinition Profile(string version, PublicationStatus status) => new()
    {
        Url = "https://ignis.test/StructureDefinition/x",
        Version = version,
        Status = status,
    };
}
