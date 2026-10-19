/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using FluentAssertions;

using Hl7.Fhir.Model;

using Xunit;

namespace Ignis.Terminology.Tests;

public class ExpansionSubsetTests
{
    private static readonly (string Code, string Display)[] Genders =
    [
        ("male", "Male"), ("female", "Female"), ("other", "Other"), ("unknown", "Unknown"),
    ];

    [Fact]
    public void Apply_WithoutInputs_LeavesExpansionUntouched()
    {
        var (valueSet, expansion) = Expanded(Genders);

        ExpansionSubset.Apply(valueSet, new Parameters());

        CodesOf(expansion).Should().Equal("male", "female", "other", "unknown");
        expansion.Total.Should().BeNull();
        expansion.Parameter.Should().BeEmpty();
    }

    [Fact]
    public void Apply_Filter_MatchesCodeOrDisplayIgnoringCase()
    {
        var (valueSet, expansion) = Expanded(Genders);

        ExpansionSubset.Apply(valueSet, Inputs(filter: "MALE"));

        CodesOf(expansion).Should().Equal("male", "female");
        expansion.Total.Should().Be(2);
        ParametersOf(expansion).Should().Equal(("filter", "MALE"));
    }

    [Fact]
    public void Apply_OffsetAndCount_PageTheFilteredCodes()
    {
        var (valueSet, expansion) = Expanded(Genders);

        ExpansionSubset.Apply(valueSet, Inputs(filter: "e", offset: 1, count: 2));

        // "e" matches male, female, other — the page is the middle two.
        CodesOf(expansion).Should().Equal("female", "other");
        expansion.Total.Should().Be(3);
        expansion.Offset.Should().Be(1);
        ParametersOf(expansion).Should().Equal(("filter", "e"), ("offset", "1"), ("count", "2"));
    }

    [Fact]
    public void Apply_CountZero_ReturnsOnlyTheTotal()
    {
        var (valueSet, expansion) = Expanded(Genders);

        ExpansionSubset.Apply(valueSet, Inputs(count: 0));

        CodesOf(expansion).Should().BeEmpty();
        expansion.Total.Should().Be(4);
    }

    [Fact]
    public void Apply_OffsetPastTheEnd_ReturnsNoCodesButTheTotal()
    {
        var (valueSet, expansion) = Expanded(Genders);

        ExpansionSubset.Apply(valueSet, Inputs(offset: 10));

        CodesOf(expansion).Should().BeEmpty();
        expansion.Total.Should().Be(4);
        expansion.Offset.Should().Be(10);
    }

    [Fact]
    public void Apply_NegativeInputs_AreTreatedAsAbsent()
    {
        var (valueSet, expansion) = Expanded(Genders);

        ExpansionSubset.Apply(valueSet, Inputs(offset: -3, count: -1));

        CodesOf(expansion).Should().HaveCount(4);
        expansion.Offset.Should().Be(0);
        ParametersOf(expansion).Should().Equal(("offset", "0"));
    }

    /// <summary>A ValueSet with the given expansion; Apply narrows that same component in place.</summary>
    private static (ValueSet ValueSet, ValueSet.ExpansionComponent Expansion) Expanded(
        IEnumerable<(string Code, string Display)> codes)
    {
        var expansion = new ValueSet.ExpansionComponent();
        foreach (var (code, display) in codes)
        {
            expansion.Contains.Add(new ValueSet.ContainsComponent { Code = code, Display = display });
        }
        return (new ValueSet { Expansion = expansion }, expansion);
    }

    private static Parameters Inputs(string? filter = null, int? offset = null, int? count = null)
    {
        var parameters = new Parameters();
        if (filter is not null) parameters.Add("filter", new FhirString(filter));
        if (offset is not null) parameters.Add("offset", new Integer(offset));
        if (count is not null) parameters.Add("count", new Integer(count));
        return parameters;
    }

    private static IEnumerable<string?> CodesOf(ValueSet.ExpansionComponent expansion) =>
        expansion.Contains.Select(code => code.Code);

    private static IEnumerable<(string?, string?)> ParametersOf(ValueSet.ExpansionComponent expansion) =>
        expansion.Parameter.Select(parameter => (parameter.Name, parameter.Value?.ToString()));
}
