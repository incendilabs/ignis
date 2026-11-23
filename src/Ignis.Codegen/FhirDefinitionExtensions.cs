/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;

namespace Ignis.Codegen;

internal static class FhirDefinitionExtensions
{
    public static bool IsExtensionDefinition(this StructureDefinition definition) =>
        definition.Type == "Extension" && definition.IsConstraint();

    public static bool IsProfile(this StructureDefinition definition) =>
        definition.IsConstraint() && !definition.IsExtensionDefinition();

    public static bool IsPrimitiveType(this StructureDefinition definition) =>
        definition.Kind == StructureDefinition.StructureDefinitionKind.PrimitiveType;

    public static bool IsResource(this StructureDefinition definition) =>
        definition.Kind == StructureDefinition.StructureDefinitionKind.Resource;

    public static bool IsConcreteResource(this StructureDefinition definition) =>
        definition.IsResource() && definition.Abstract != true;

    public static bool IsResourceSpecialization(this StructureDefinition definition) =>
        definition.IsResource() && definition.Derivation == StructureDefinition.TypeDerivationRule.Specialization;

    public static bool IsRepeating(this ElementDefinition element) =>
        element.Max == "*" || (int.TryParse(element.Max, out var maxOccurrences) && maxOccurrences > 1);

    public static bool IsRequired(this ElementDefinition element) => element.Min is > 0;

    public static bool IsProhibited(this ElementDefinition element) => element.Max == "0";

    public static IEnumerable<string> TypeCodes(this ElementDefinition element) =>
        element.Type.Select(type => type.Code).OfType<string>();

    private static bool IsConstraint(this StructureDefinition definition) =>
        definition.Derivation == StructureDefinition.TypeDerivationRule.Constraint;
}
