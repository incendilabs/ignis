/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

namespace Ignis.Codegen.TypeScript;

internal static class TypeScriptNames
{
    private const string ChoiceSuffix = "[x]";
    private static readonly char[] WordSeparators = ['-', '_', ' ', '.'];

    /// <summary><c>Questionnaire.item.enableWhen</c> becomes <c>QuestionnaireItemEnableWhen</c>.</summary>
    public static string BackboneInterfaceName(string elementPath) =>
        string.Concat(elementPath.Split('.').Select(Capitalize));

    public static string PascalCase(string value) =>
        string.Concat(value.Split(WordSeparators, StringSplitOptions.RemoveEmptyEntries).Select(Capitalize));

    public static bool IsChoiceElement(string elementName) => elementName.EndsWith(ChoiceSuffix, StringComparison.Ordinal);

    /// <summary><c>value[x]</c> and <c>dateTime</c> become <c>valueDateTime</c>.</summary>
    public static string ChoicePropertyName(string elementName, string typeCode) =>
        elementName[..^ChoiceSuffix.Length] + Capitalize(typeCode);

    private static string Capitalize(string value) => char.ToUpperInvariant(value[0]) + value[1..];
}
