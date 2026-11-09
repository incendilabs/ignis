/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Codegen.TypeScript;

internal static class FhirPrimitiveTypes
{
    private static readonly Dictionary<string, string> TypeScriptTypeByFhirPrimitive = new()
    {
        ["boolean"] = "boolean",
        ["integer"] = "number",
        ["positiveInt"] = "number",
        ["unsignedInt"] = "number",
        ["decimal"] = "number",
        ["integer64"] = "string",
        ["string"] = "string",
        ["code"] = "string",
        ["id"] = "string",
        ["uri"] = "string",
        ["url"] = "string",
        ["canonical"] = "string",
        ["oid"] = "string",
        ["uuid"] = "string",
        ["markdown"] = "string",
        ["base64Binary"] = "string",
        ["date"] = "string",
        ["dateTime"] = "string",
        ["instant"] = "string",
        ["time"] = "string",
        ["xhtml"] = "string",
    };

    public static bool IsPrimitive(string fhirTypeCode) => TypeScriptTypeByFhirPrimitive.ContainsKey(fhirTypeCode);

    public static bool TryGetTypeScriptType(string fhirTypeCode, out string typeScriptType) =>
        TypeScriptTypeByFhirPrimitive.TryGetValue(fhirTypeCode, out typeScriptType!);
}
