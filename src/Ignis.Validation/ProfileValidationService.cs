/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Firely.Fhir.Validation;
using Firely.Fhir.Validation.Compilation;

using Hl7.Fhir.ElementModel;
using Hl7.Fhir.Model;
using Hl7.Fhir.Specification.Source;
using Hl7.Fhir.Specification.Terminology;

using Canonical = Firely.Fhir.Validation.Canonical;

namespace Ignis.Validation;

/// <summary>
/// Structural profile validator built on the Firely SDK validation engine. Expensive to construct
/// (compiles and caches schemas), so register it as a singleton. Thread-safe: validation is serialized.
/// </summary>
public sealed class ProfileValidationService : IProfileValidationService
{
    private const string CoreProfileBase = "http://hl7.org/fhir/StructureDefinition/";

    private readonly IElementSchemaResolver _schemaResolver;
    private readonly ValidationSettings _settings;
    private readonly Lock _gate = new();

    public ProfileValidationService(IAsyncResourceResolver resolver, ICodeValidationTerminologyService terminology)
    {
        // Cache the expensive schema compilation; add the system-namespace resolver for FHIRPath System.* types.
        _schemaResolver = new MultiElementSchemaResolver(
            StructureDefinitionToElementSchemaResolver.CreatedCached(resolver),
            new SystemNamespaceElementSchemaResolver());

        _settings = new ValidationSettings(_schemaResolver, terminology);
    }

    /// <inheritdoc />
    public OperationOutcome Validate(Resource resource, string? profile = null)
    {
        // The validator is not thread-safe, so serialize validation.
        lock (_gate)
        {
            // Treat null or blank (e.g. an empty ?profile= query value) as "no explicit profile".
            var canonical = string.IsNullOrWhiteSpace(profile) ? CoreProfileBase + resource.TypeName : profile;

            var schema = _schemaResolver.GetSchema(new Canonical(canonical));
            if (schema is null)
                return ProfileNotResolved(canonical);

            // ToPocoNode derives the model metadata from the resource instance, so the library stays
            // FHIR-version agnostic with no compile-time reference to Hl7.Fhir.R4.
            ITypedElement node = resource.ToPocoNode();

            ResultReport report = schema.Validate(node, _settings);
            var outcome = report.ToOperationOutcome();

            // OperationOutcome.issue is 1..*; a clean result has none, so report success explicitly.
            if (outcome.Issue.Count == 0)
                outcome.Issue.Add(new OperationOutcome.IssueComponent
                {
                    Severity = OperationOutcome.IssueSeverity.Information,
                    Code = OperationOutcome.IssueType.Informational,
                    Details = new CodeableConcept { Text = "Validation successful; no issues detected." },
                });

            return outcome;
        }
    }

    private static OperationOutcome ProfileNotResolved(string canonical) => new()
    {
        Issue =
        {
            new OperationOutcome.IssueComponent
            {
                Severity = OperationOutcome.IssueSeverity.Error,
                Code = OperationOutcome.IssueType.NotFound,
                Details = new CodeableConcept { Text = $"Profile '{canonical}' could not be resolved." },
            },
        },
    };
}
