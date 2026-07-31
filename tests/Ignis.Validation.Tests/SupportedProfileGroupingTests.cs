/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using FluentAssertions;

using Ignis.Validation;

namespace Ignis.Validation.Tests;

public class SupportedProfileGroupingTests
{
    private static ProfileSummary Constraint(string type, string canonical) =>
        new(ConstrainedType: type, IsResourceKind: true, IsConstraint: true, Canonical: canonical);

    [Fact]
    public void Groups_constraint_profiles_by_constrained_type()
    {
        var result = SupportedProfileGrouping.ByType(
        [
            Constraint("Patient", "http://example.org/no-basis-Patient"),
            Constraint("Patient", "http://example.org/eu-Patient"),
            Constraint("Observation", "http://example.org/vitals"),
        ]);

        result.Should().HaveCount(2);
        result["Patient"].Should().BeEquivalentTo(
            "http://example.org/no-basis-Patient", "http://example.org/eu-Patient");
        result["Observation"].Should().ContainSingle().Which.Should().Be("http://example.org/vitals");
    }

    [Fact]
    public void Excludes_base_specializations_and_non_resource_kinds()
    {
        var result = SupportedProfileGrouping.ByType(
        [
            // The base Patient resource definition — a specialization, not a profile.
            new ProfileSummary("Patient", IsResourceKind: true, IsConstraint: false,
                "http://hl7.org/fhir/StructureDefinition/Patient"),
            // A complex-type (e.g. an extension or datatype) constraint — not a resource.
            new ProfileSummary("Extension", IsResourceKind: false, IsConstraint: true,
                "http://example.org/some-extension"),
        ]);

        result.Should().BeEmpty();
    }

    [Fact]
    public void Excludes_cross_version_profiles()
    {
        var result = SupportedProfileGrouping.Browsable(
        [
            // From hl7.fhir.uv.xver-r5.r4 — an R5 shape published for R4 IG authors to reference.
            Constraint("Questionnaire", "http://hl7.org/fhir/5.0/StructureDefinition/profile-Questionnaire"),
            Constraint("Observation", "http://hl7.org/fhir/StructureDefinition/vitalsigns"),
            // Only hl7.org/fhir carries the version segment; elsewhere it is just a path.
            Constraint("Patient", "http://example.org/4.0/StructureDefinition/local"),
        ]);

        result.Select(p => p.Canonical).Should().BeEquivalentTo(
            "http://hl7.org/fhir/StructureDefinition/vitalsigns",
            "http://example.org/4.0/StructureDefinition/local");
    }

    [Fact]
    public void Skips_summaries_missing_a_type_or_canonical_and_dedupes()
    {
        var result = SupportedProfileGrouping.ByType(
        [
            Constraint("Patient", "http://example.org/p"),
            Constraint("Patient", "http://example.org/p"), // duplicate
            new ProfileSummary(null, IsResourceKind: true, IsConstraint: true, "http://example.org/x"),
            Constraint("Patient", ""),
        ]);

        result["Patient"].Should().ContainSingle().Which.Should().Be("http://example.org/p");
    }

    [Fact]
    public void Empty_input_yields_empty_result()
    {
        SupportedProfileGrouping.ByType([]).Should().BeEmpty();
    }

    [Fact]
    public void Browsable_keeps_constraint_profiles_with_metadata_and_dedupes()
    {
        var result = SupportedProfileGrouping.Browsable(
        [
            new ProfileSummary("Patient", IsResourceKind: true, IsConstraint: true,
                "http://example.org/no-basis-Patient",
                Name: "NoBasisPatient", Title: "Norwegian Patient", Version: "2.2.0", Status: "active"),
            new ProfileSummary("Patient", IsResourceKind: true, IsConstraint: true,
                "http://example.org/no-basis-Patient"), // duplicate canonical
            new ProfileSummary("Patient", IsResourceKind: true, IsConstraint: false,
                "http://hl7.org/fhir/StructureDefinition/Patient"), // base specialization, not a constraint
            new ProfileSummary("Extension", IsResourceKind: false, IsConstraint: true,
                "http://example.org/ext"), // not a resource kind
        ]);

        // Value equality on the record struct asserts every field survived, not just a chosen few.
        result.Should().ContainSingle().Which.Should().Be(new ProfileSummary(
            ConstrainedType: "Patient", IsResourceKind: true, IsConstraint: true,
            Canonical: "http://example.org/no-basis-Patient",
            Name: "NoBasisPatient", Title: "Norwegian Patient", Version: "2.2.0", Status: "active"));
    }
}
