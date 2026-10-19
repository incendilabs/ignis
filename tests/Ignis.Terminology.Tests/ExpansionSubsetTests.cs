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
        var valueSet = Expanded(Genders);

        ExpansionSubset.Apply(valueSet, new Parameters());

        CodesOf(valueSet).Should().Equal("male", "female", "other", "unknown");
        valueSet.Expansion.Total.Should().BeNull();
        valueSet.Expansion.Parameter.Should().BeEmpty();
    }

    [Fact]
    public void Apply_Filter_MatchesCodeOrDisplayIgnoringCase()
    {
        var valueSet = Expanded(Genders);

        ExpansionSubset.Apply(valueSet, Inputs(filter: "MALE"));

        CodesOf(valueSet).Should().Equal("male", "female");
        valueSet.Expansion.Total.Should().Be(2);
        ParametersOf(valueSet).Should().Equal(("filter", "MALE"));
    }

    [Fact]
    public void Apply_OffsetAndCount_PageTheFilteredCodes()
    {
        var valueSet = Expanded(Genders);

        ExpansionSubset.Apply(valueSet, Inputs(filter: "e", offset: 1, count: 2));

        // "e" matches male, female, other — the page is the middle two.
        CodesOf(valueSet).Should().Equal("female", "other");
        valueSet.Expansion.Total.Should().Be(3);
        valueSet.Expansion.Offset.Should().Be(1);
        ParametersOf(valueSet).Should().Equal(("filter", "e"), ("offset", "1"), ("count", "2"));
    }

    [Fact]
    public void Apply_CountZero_ReturnsOnlyTheTotal()
    {
        var valueSet = Expanded(Genders);

        ExpansionSubset.Apply(valueSet, Inputs(count: 0));

        CodesOf(valueSet).Should().BeEmpty();
        valueSet.Expansion.Total.Should().Be(4);
    }

    [Fact]
    public void Apply_OffsetPastTheEnd_ReturnsNoCodesButTheTotal()
    {
        var valueSet = Expanded(Genders);

        ExpansionSubset.Apply(valueSet, Inputs(offset: 10));

        CodesOf(valueSet).Should().BeEmpty();
        valueSet.Expansion.Total.Should().Be(4);
        valueSet.Expansion.Offset.Should().Be(10);
    }

    [Fact]
    public void Apply_NegativeInputs_AreTreatedAsAbsent()
    {
        var valueSet = Expanded(Genders);

        ExpansionSubset.Apply(valueSet, Inputs(offset: -3, count: -1));

        CodesOf(valueSet).Should().HaveCount(4);
        valueSet.Expansion.Offset.Should().Be(0);
        ParametersOf(valueSet).Should().Equal(("offset", "0"));
    }

    private static ValueSet Expanded(IEnumerable<(string Code, string Display)> codes)
    {
        var expansion = new ValueSet.ExpansionComponent();
        foreach (var (code, display) in codes)
        {
            expansion.Contains.Add(new ValueSet.ContainsComponent { Code = code, Display = display });
        }
        return new ValueSet { Expansion = expansion };
    }

    private static Parameters Inputs(string? filter = null, int? offset = null, int? count = null)
    {
        var parameters = new Parameters();
        if (filter is not null) parameters.Add("filter", new FhirString(filter));
        if (offset is not null) parameters.Add("offset", new Integer(offset));
        if (count is not null) parameters.Add("count", new Integer(count));
        return parameters;
    }

    private static IEnumerable<string> CodesOf(ValueSet valueSet) =>
        valueSet.Expansion.Contains.Select(code => code.Code);

    private static IEnumerable<(string, string)> ParametersOf(ValueSet valueSet) =>
        valueSet.Expansion.Parameter.Select(parameter => (parameter.Name, parameter.Value.ToString()!));
}
