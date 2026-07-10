/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;
using Hl7.Fhir.Specification.Terminology;

namespace Ignis.Terminology;

/// <summary>
/// Thin wrapper over Firely's <see cref="ITerminologyService"/> that exposes ValueSet expansion. Version
/// agnostic (works on the conformance model, not a specific FHIR release); the terminology service is built
/// with a version-specific resolver at wiring time. Expensive to build, so register as a singleton.
/// </summary>
public sealed class ValueSetExpansionService(ITerminologyService terminology) : IValueSetExpansionService
{
    private readonly ITerminologyService _terminology =
        terminology ?? throw new ArgumentNullException(nameof(terminology));

    /// <inheritdoc />
    public async Task<ValueSet> ExpandAsync(Parameters parameters)
    {
        // Firely's Expand returns a Resource that is always a ValueSet (with Expansion populated) on success;
        // failures surface as a thrown FhirOperationException carrying an OperationOutcome.
        var result = await _terminology.Expand(parameters).ConfigureAwait(false);
        return result as ValueSet
            ?? throw new InvalidOperationException(
                $"$expand returned '{result?.TypeName ?? "null"}', expected a ValueSet.");
    }
}
