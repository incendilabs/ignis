/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using FluentAssertions;

using Ignis.Api.Extensions;

using Xunit;

namespace Ignis.Api.Tests;

/// <summary>Parsing of a staged <c>{id}-{version}.tgz</c> file name into id + version.</summary>
public class PackageRefTests
{
    [Fact]
    public void FromFileName_ParsesDottedIdAndSemverVersion()
    {
        PackageRef.FromFileName("/pkgs/hl7.fhir.no.basis-2.2.0.tgz")
            .Should().Be(new PackageRef("hl7.fhir.no.basis", "2.2.0"));
    }

    [Fact]
    public void FromFileName_KeepsHyphensInTheId()
    {
        PackageRef.FromFileName("some-vendor.pkg-1.4.0.tgz")
            .Should().Be(new PackageRef("some-vendor.pkg", "1.4.0"));
    }

    [Fact]
    public void FromFileName_KeepsPreReleaseVersionSuffix()
    {
        PackageRef.FromFileName("acme.core-1.0.0-beta.1.tgz")
            .Should().Be(new PackageRef("acme.core", "1.0.0-beta.1"));
    }

    [Fact]
    public void FromFileName_WithoutAVersion_KeepsWholeNameAndNullVersion()
    {
        PackageRef.FromFileName("/pkgs/mystery.tgz")
            .Should().Be(new PackageRef("mystery", null));
    }
}
