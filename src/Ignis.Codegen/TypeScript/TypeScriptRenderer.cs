/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace Ignis.Codegen.TypeScript;

/// <summary>Output helpers shared by the renderers. Text from definitions is escaped before it is written.</summary>
internal abstract class TypeScriptRenderer(Func<string, string> mapType)
{
    protected const string PropertyIndent = "  ";

    // Keeps non-ASCII readable; quotes, backslashes and control characters are still escaped.
    private static readonly JsonSerializerOptions LiteralOptions = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    protected StringBuilder Output { get; } = new();

    /// <summary>A double-quoted TypeScript string literal.</summary>
    public static string StringLiteral(string value) => JsonSerializer.Serialize(value, LiteralOptions);

    /// <summary>Maps a FHIR type code to TypeScript and schedules its definition when it is generated.</summary>
    protected string MapType(string fhirTypeCode) => mapType(fhirTypeCode);

    protected void AppendDocComment(string indent, string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return;
        Output.Append(indent).Append("/** ").Append(text.Trim().Replace("*/", "*\\/")).Append(" */\n");
    }

    protected void AppendProperty(string propertyName, string typeScriptType, bool isRequired, bool isRepeating = false)
    {
        Output.Append(PropertyIndent).Append(propertyName).Append(isRequired ? ": " : "?: ")
            .Append(typeScriptType).Append(isRepeating ? "[]" : "").Append(";\n");
    }
}
