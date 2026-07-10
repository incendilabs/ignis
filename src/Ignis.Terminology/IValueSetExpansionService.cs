/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;

namespace Ignis.Terminology;

/// <summary>
/// Expands a FHIR <see cref="ValueSet"/> to its concrete codes (the <c>$expand</c> operation).
/// </summary>
public interface IValueSetExpansionService
{
    /// <summary>
    /// Expands the ValueSet described by <paramref name="parameters"/> (a FHIR <c>$expand</c> input:
    /// <c>url</c>, inline <c>valueSet</c>, <c>filter</c>, <c>count</c>/<c>offset</c>, …) and returns the
    /// expanded ValueSet with its <see cref="ValueSet.Expansion"/> populated.
    /// </summary>
    Task<ValueSet> ExpandAsync(Parameters parameters);
}
