/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using FluentAssertions;

using Hl7.Fhir.Model;

using Xunit;

namespace Ignis.Validation.Tests;

public class ValidationResourceParserTests
{
    private static ValidationResourceParser Parser(ResourceParsingMode mode) =>
        new(ModelInfo.ModelInspector, mode);

    [Fact]
    public void Permissive_InvalidCodedValue_ReturnsPartialResourceWithIssues()
    {
        var result = Parser(ResourceParsingMode.Permissive)
            .Parse("""{ "resourceType": "Practitioner", "gender": "mann" }""", "application/fhir+json");

        result.RejectionMessage.Should().BeNull();
        result.Resource.Should().BeOfType<Practitioner>();

        var errorExpressions = result.OperationOutcome.Should().BeOfType<OperationOutcome>()
            .Which.Issue
            .Where(issue => issue.Severity == OperationOutcome.IssueSeverity.Error)
            .SelectMany(issue => issue.Expression ?? Enumerable.Empty<string>())
            .OfType<string>();
        errorExpressions.Should().Contain(e => e.Contains("gender"));
    }

    [Fact]
    public void Strict_InvalidCodedValue_Rejects()
    {
        var result = Parser(ResourceParsingMode.Strict)
            .Parse("""{ "resourceType": "Practitioner", "gender": "mann" }""", "application/fhir+json");

        result.RejectionMessage.Should().NotBeNullOrEmpty();
        result.Resource.Should().BeNull();
    }

    [Fact]
    public void UnparseableSyntax_Rejects_InBothModes()
    {
        foreach (var mode in new[] { ResourceParsingMode.Permissive, ResourceParsingMode.Strict })
        {
            var result = Parser(mode).Parse("this is not json at all", "application/fhir+json");
            result.RejectionMessage.Should().NotBeNullOrEmpty();
        }
    }

    [Fact]
    public void ValidJson_ParsesClean()
    {
        var result = Parser(ResourceParsingMode.Permissive)
            .Parse("""{ "resourceType": "Practitioner", "gender": "male" }""", "application/fhir+json");

        result.Resource.Should().BeOfType<Practitioner>();
        result.OperationOutcome.Should().BeNull();
        result.RejectionMessage.Should().BeNull();
    }

    [Fact]
    public void ValidXml_ParsesClean()
    {
        var result = Parser(ResourceParsingMode.Permissive)
            .Parse("""<Practitioner xmlns="http://hl7.org/fhir"><gender value="male"/></Practitioner>""", "application/fhir+xml");

        result.Resource.Should().BeOfType<Practitioner>();
        result.OperationOutcome.Should().BeNull();
    }
}
