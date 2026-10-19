/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;

namespace Ignis.Terminology;

/// <summary>
/// Narrows an expansion to what <c>$expand</c>'s <c>filter</c>, <c>offset</c> and <c>count</c> ask for.
/// Firely's local terminology service accepts those inputs but expands the whole ValueSet regardless.
/// </summary>
internal static class ExpansionSubset
{
    public static void Apply(ValueSet valueSet, Parameters parameters)
    {
        var expansion = valueSet.Expansion;
        if (expansion is null) return;

        var filter = parameters.GetSingleValue<FhirString>("filter")?.Value;
        var offset = parameters.GetSingleValue<Integer>("offset")?.Value;
        var count = parameters.GetSingleValue<Integer>("count")?.Value;
        if (string.IsNullOrWhiteSpace(filter) && offset is null && count is null) return;

        IEnumerable<ValueSet.ContainsComponent> codes = expansion.Contains;
        if (!string.IsNullOrWhiteSpace(filter))
        {
            codes = codes.Where(code => Matches(code, filter));
            AddParameter(expansion, "filter", new FhirString(filter));
        }

        // Total counts the matches, so a client paging past this page knows how far there is to go.
        var matched = codes.ToList();
        expansion.Total = matched.Count;

        // Paging applies to the flat list; count = 0 asks for the total only.
        if (offset is not null)
        {
            var skip = Math.Max(0, offset.Value);
            matched = matched.Skip(skip).ToList();
            expansion.Offset = skip;
            AddParameter(expansion, "offset", new Integer(skip));
        }
        if (count is >= 0)
        {
            matched = matched.Take(count.Value).ToList();
            AddParameter(expansion, "count", new Integer(count.Value));
        }

        expansion.Contains = matched;
    }

    /// <summary>The spec leaves the text filter to the server; this one matches code or display, any case.</summary>
    private static bool Matches(ValueSet.ContainsComponent code, string filter) =>
        (code.Display?.Contains(filter, StringComparison.OrdinalIgnoreCase) ?? false)
        || (code.Code?.Contains(filter, StringComparison.OrdinalIgnoreCase) ?? false);

    private static void AddParameter(ValueSet.ExpansionComponent expansion, string name, DataType value) =>
        expansion.Parameter.Add(new ValueSet.ParameterComponent { Name = name, Value = value });
}
