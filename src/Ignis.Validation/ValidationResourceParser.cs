/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Text.Json;
using System.Xml;

using Hl7.Fhir.Introspection;
using Hl7.Fhir.Model;
using Hl7.Fhir.Serialization;

namespace Ignis.Validation;

/// <summary>
/// Outcome of parsing a validation request body. Exactly one of three shapes:
/// rejected (<see cref="RejectionMessage"/>), parsed clean (<see cref="Resource"/>),
/// or parsed with findings (<see cref="OperationOutcome"/>, and <see cref="Resource"/> when
/// a partial resource could be read).
/// </summary>
public sealed record ResourceParseResult
{
    public Resource? Resource { get; init; }
    public OperationOutcome? OperationOutcome { get; init; }
    public string? RejectionMessage { get; init; }
}

public interface IValidationResourceParser
{
    ResourceParseResult Parse(string body, string? contentType);
}

/// <summary>
/// Parses request bodies for <c>$validate</c>, decoupled from the host's strict
/// store parsing. In <see cref="ResourceParsingMode.Permissive"/> mode (default),
/// parse problems become issues and validation can proceed on the partial
/// resource; <see cref="ResourceParsingMode.Strict"/> restores rejection.
/// </summary>
public sealed class ValidationResourceParser(ModelInspector inspector, ResourceParsingMode parsing)
    : IValidationResourceParser
{
    private readonly ModelInspector _inspector =
        inspector ?? throw new ArgumentNullException(nameof(inspector));
    private readonly ResourceParsingMode _parsing = parsing;

    public ResourceParseResult Parse(string body, string? contentType)
    {
        try
        {
            var resource = IsXml(contentType)
                ? new BaseFhirXmlDeserializer(_inspector).DeserializeResource(body)
                : new BaseFhirJsonDeserializer(_inspector).DeserializeResource(body);
            return new ResourceParseResult { Resource = resource };
        }
        catch (DeserializationFailedException parseError)
            when (_parsing == ResourceParsingMode.Permissive)
        {
            return new ResourceParseResult
            {
                Resource = parseError.PartialResult as Resource,
                OperationOutcome = parseError.ToOperationOutcome(),
            };
        }
        catch (DeserializationFailedException parseError)
        {
            return new ResourceParseResult
            {
                RejectionMessage = $"The resource could not be parsed: {parseError.Message}",
            };
        }
        catch (Exception e) when (e is JsonException or XmlException or FormatException)
        {
            // Not even parseable syntax — there is nothing to report findings on.
            return new ResourceParseResult { RejectionMessage = "The request body is not parseable." };
        }
    }

    private static bool IsXml(string? contentType) =>
        contentType?.Contains("xml", StringComparison.OrdinalIgnoreCase) == true;
}
