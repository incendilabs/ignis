/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;

namespace Ignis.Codegen.TypeScript;

/// <summary>One interface for a resource or datatype, plus one per backbone element.</summary>
internal sealed class CoreTypeRenderer : TypeScriptRenderer
{
    private readonly List<ElementDefinition> _snapshotElements;
    private readonly Queue<ElementDefinition> _pendingBackboneElements = new();

    private CoreTypeRenderer(StructureDefinition definition, Func<string, string> mapType) : base(mapType)
    {
        _snapshotElements = definition.Snapshot!.Element;
    }

    public static string Render(StructureDefinition definition, string typeName, Func<string, string> mapType)
    {
        var renderer = new CoreTypeRenderer(definition, mapType);
        var rootElement = renderer._snapshotElements[0];
        renderer.AppendInterface(typeName, rootElement.Path ?? typeName, rootElement.Short, ResourceTypeOf(definition, typeName));

        while (renderer._pendingBackboneElements.TryDequeue(out var backboneElement))
            renderer.AppendInterface(TypeScriptNames.BackboneInterfaceName(backboneElement.Path!), backboneElement.Path!, backboneElement.Short, resourceType: null);

        return renderer.Output.ToString();
    }

    private static string? ResourceTypeOf(StructureDefinition definition, string typeName)
    {
        if (!definition.IsResource()) return null;
        return definition.IsConcreteResource() ? StringLiteral(typeName) : "string";
    }

    private void AppendInterface(string interfaceName, string ownerPath, string? description, string? resourceType)
    {
        AppendDocComment(indent: "", description);
        Output.Append("export interface ").Append(interfaceName).Append(" {\n");
        if (resourceType is not null) AppendProperty("resourceType", resourceType, isRequired: true);

        foreach (var element in DirectChildrenOf(ownerPath))
        {
            var elementName = element.Path![(ownerPath.Length + 1)..];
            if (TypeScriptNames.IsChoiceElement(elementName))
                AppendChoiceProperties(element, elementName);
            else
                AppendElementProperty(element, elementName);
        }

        Output.Append("}\n");
    }

    private void AppendChoiceProperties(ElementDefinition choiceElement, string elementName)
    {
        AppendDocComment(PropertyIndent, choiceElement.Short);
        foreach (var typeCode in choiceElement.TypeCodes())
        {
            var propertyName = TypeScriptNames.ChoicePropertyName(elementName, typeCode);
            AppendProperty(propertyName, MapType(typeCode), isRequired: false, choiceElement.IsRepeating());
            if (FhirPrimitiveTypes.IsPrimitive(typeCode)) AppendPrimitiveSibling(propertyName, choiceElement.IsRepeating());
        }
    }

    private void AppendElementProperty(ElementDefinition element, string propertyName)
    {
        var typeScriptType = TypeScriptTypeOf(element);
        AppendDocComment(PropertyIndent, element.Short);
        AppendProperty(propertyName, typeScriptType, element.IsRequired(), element.IsRepeating());
        if (element.Type is [{ Code: { } typeCode }] && FhirPrimitiveTypes.IsPrimitive(typeCode))
            AppendPrimitiveSibling(propertyName, element.IsRepeating());
    }

    private string TypeScriptTypeOf(ElementDefinition element)
    {
        if (element.ContentReference is not null)
            return TypeScriptNames.BackboneInterfaceName(element.ContentReference.TrimStart('#'));

        if (HasChildElements(element))
        {
            _pendingBackboneElements.Enqueue(element);
            return TypeScriptNames.BackboneInterfaceName(element.Path!);
        }

        var typeCode = element.Type.FirstOrDefault()?.Code ?? throw new InvalidOperationException($"no type: {element.Path}");
        return MapType(typeCode);
    }

    // The `_name` sibling carries id and extensions for a primitive value.
    private void AppendPrimitiveSibling(string propertyName, bool isRepeating) =>
        AppendProperty("_" + propertyName, isRepeating ? "(Element | null)[]" : "Element", isRequired: false);

    private bool HasChildElements(ElementDefinition element)
    {
        var childPathPrefix = element.Path + ".";
        return _snapshotElements.Any(other => other.Path?.StartsWith(childPathPrefix, StringComparison.Ordinal) == true);
    }

    private IEnumerable<ElementDefinition> DirectChildrenOf(string path)
    {
        var childPathPrefix = path + ".";
        return _snapshotElements.Where(element =>
            element.SliceName is null &&
            element.ElementId?.Contains(':') != true &&
            element.Path is { } childPath &&
            childPath.StartsWith(childPathPrefix, StringComparison.Ordinal) &&
            !childPath[childPathPrefix.Length..].Contains('.'));
    }
}
