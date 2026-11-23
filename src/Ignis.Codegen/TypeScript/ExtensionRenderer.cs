/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;

namespace Ignis.Codegen.TypeScript;

/// <summary>
/// A typed interface for an extension (one per sub-extension slice when complex) and an
/// <c>ExtensionDefinition</c> constant with its url, context and allowed value types.
/// </summary>
internal sealed class ExtensionRenderer : TypeScriptRenderer
{
    private readonly StructureDefinition _definition;
    private readonly List<ElementDefinition> _snapshotElements;
    private readonly string _typeScriptName;
    private readonly string _url;

    private ExtensionRenderer(StructureDefinition definition, string definitionName, Func<string, string> mapType) : base(mapType)
    {
        _definition = definition;
        _snapshotElements = definition.Snapshot!.Element;
        _typeScriptName = TypeScriptNames.PascalCase(definitionName);
        _url = definition.Url ?? throw new InvalidOperationException($"extension without url: {definitionName}");
    }

    public static string Render(StructureDefinition definition, string definitionName, Func<string, string> mapType)
    {
        var renderer = new ExtensionRenderer(definition, definitionName, mapType);
        var valueElement = renderer.AllowedValueElement(renderer._snapshotElements.FirstOrDefault(element => element.Path == "Extension.value[x]"));
        var sliceElements = renderer._snapshotElements.Where(element => element.Path == "Extension.extension" && element.SliceName is not null).ToList();

        renderer.AppendExtensionInterface(definitionName, valueElement, sliceElements);
        foreach (var slice in sliceElements)
            renderer.AppendSliceInterface(slice);
        renderer.AppendDefinitionConstant(valueElement);
        return renderer.Output.ToString();
    }

    private void AppendExtensionInterface(string definitionName, ElementDefinition? valueElement, List<ElementDefinition> sliceElements)
    {
        AppendDocComment(indent: "", _definition.Title ?? _definition.Description ?? definitionName);
        Output.Append("export interface ").Append(_typeScriptName).Append("Extension extends Extension {\n");
        AppendProperty("url", StringLiteral(_url), isRequired: true);
        if (valueElement is not null) AppendValueProperties(valueElement, valueElement.IsRequired());
        if (sliceElements.Count > 0) AppendProperty("extension", $"({string.Join(" | ", sliceElements.Select(SliceInterfaceName))})", isRequired: true, isRepeating: true);
        Output.Append("}\n");
    }

    private void AppendSliceInterface(ElementDefinition slice)
    {
        var fixedUrl = (_snapshotElements.First(element => element.ElementId == slice.ElementId + ".url").Fixed as FhirUri)?.Value
            ?? throw new InvalidOperationException($"slice without fixed url: {slice.ElementId}");

        AppendDocComment(indent: "", slice.Short);
        Output.Append("export interface ").Append(SliceInterfaceName(slice)).Append(" extends Extension {\n");
        AppendProperty("url", StringLiteral(fixedUrl), isRequired: true);
        if (AllowedValueElement(_snapshotElements.FirstOrDefault(element => element.ElementId == slice.ElementId + ".value[x]")) is { } sliceValueElement)
            AppendValueProperties(sliceValueElement, slice.IsRequired());
        Output.Append("}\n");
    }

    private void AppendDefinitionConstant(ElementDefinition? valueElement)
    {
        var contextExpressions = _definition.Context.Select(context => context.Expression).OfType<string>();
        var valueTypeCodes = valueElement?.TypeCodes() ?? [];

        Output.Append("export const ").Append(_typeScriptName).Append(": ExtensionDefinition<").Append(_typeScriptName).Append("Extension> = {\n");
        Output.Append(PropertyIndent).Append("url: ").Append(StringLiteral(_url)).Append(",\n");
        Output.Append(PropertyIndent).Append("context: [").Append(StringLiterals(contextExpressions)).Append("],\n");
        Output.Append(PropertyIndent).Append("valueTypes: [").Append(StringLiterals(valueTypeCodes)).Append("],\n");
        Output.Append("};\n");
    }

    // A value is only required as a property when it allows a single type.
    private void AppendValueProperties(ElementDefinition valueElement, bool isValueRequired)
    {
        foreach (var typeCode in valueElement.TypeCodes())
            AppendProperty(TypeScriptNames.ChoicePropertyName("value[x]", typeCode), MapType(typeCode), isValueRequired && valueElement.Type.Count == 1);
    }

    private ElementDefinition? AllowedValueElement(ElementDefinition? valueElement) => valueElement is null || valueElement.IsProhibited() ? null : valueElement;

    private string SliceInterfaceName(ElementDefinition slice) => _typeScriptName + TypeScriptNames.PascalCase(slice.SliceName!);

    private static string StringLiterals(IEnumerable<string> values) => string.Join(", ", values.Select(StringLiteral));
}
