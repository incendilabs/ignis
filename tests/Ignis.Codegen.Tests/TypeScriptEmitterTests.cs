/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using FluentAssertions;

using Ignis.Codegen;
using Ignis.Codegen.TypeScript;

namespace Ignis.Codegen.Tests;

/// <summary>Generates from the R4 core package staged by <c>fhir-packages.targets</c>.</summary>
public sealed class TypeScriptEmitterTests
{
    private static readonly PackageFolder Folder = PackageFolder.Open(Path.Combine(AppContext.BaseDirectory, "fhir-packages"));

    private static async Task<Dictionary<string, string>> GenerateFilesByNameAsync(params string[] typeNamesOrCanonicals)
    {
        var emitter = new TypeScriptEmitter(Folder.CreateSnapshotResolver());
        foreach (var typeNameOrCanonical in typeNamesOrCanonicals)
            await emitter.AddDefinitionAsync(typeNameOrCanonical);
        return emitter.RenderFiles(Folder.ReadFhirVersion()).ToDictionary(file => file.Name, file => file.Content);
    }

    private static string InterfaceSource(string source, string name)
    {
        var start = source.IndexOf($"export interface {name} {{", StringComparison.Ordinal);
        start.Should().BeGreaterThanOrEqualTo(0, $"interface {name} should be generated");
        return source[start..source.IndexOf("\n}\n", start, StringComparison.Ordinal)];
    }

    [Fact]
    public async Task Resource_gets_literal_resourceType_and_primitive_siblings()
    {
        var files = await GenerateFilesByNameAsync("Patient");
        var patient = InterfaceSource(files["types.ts"], "Patient");

        patient.Should().Contain("resourceType: \"Patient\";");
        patient.Should().Contain("birthDate?: string;").And.Contain("_birthDate?: Element;");
        patient.Should().Contain("name?: HumanName[];");
        patient.Should().Contain("deceasedBoolean?: boolean;").And.Contain("deceasedDateTime?: string;");
        patient.Should().Contain("contact?: PatientContact[];");
        files["types.ts"].Should().Contain("export interface PatientContact {");
    }

    [Fact]
    public async Task Referenced_datatypes_and_abstract_resources_are_included()
    {
        var files = await GenerateFilesByNameAsync("Patient");
        var types = files["types.ts"];

        types.Should().Contain("export interface HumanName {").And.Contain("export interface Element {");
        InterfaceSource(types, "Resource").Should().Contain("resourceType: string;");
    }

    [Fact]
    public async Task Backbone_elements_recurse_and_min_one_is_required()
    {
        var files = await GenerateFilesByNameAsync("Questionnaire");
        var item = InterfaceSource(files["types.ts"], "QuestionnaireItem");

        item.Should().Contain("linkId: string;").And.Contain("item?: QuestionnaireItem[];");
        item.Should().Contain("enableWhen?: QuestionnaireItemEnableWhen[];");
        InterfaceSource(files["types.ts"], "Questionnaire").Should().Contain("status: string;");
    }

    [Fact]
    public async Task Index_has_resource_union_and_version()
    {
        var files = await GenerateFilesByNameAsync("Patient", "Questionnaire");
        var index = files["index.ts"];

        index.Should().Contain("export const fhirVersion = \"4.0.1\";");
        index.Should().Contain("| Patient\n").And.Contain("| Questionnaire;");
        index.Should().NotContain("| Resource");
        index.Should().Contain("\"Patient\",");
    }

    [Fact]
    public async Task Extension_definition_gets_typed_interface_and_constant()
    {
        var files = await GenerateFilesByNameAsync("http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl");
        var extensions = files["extensions.ts"];

        extensions.Should().Contain("url: \"http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl\";");
        extensions.Should().Contain("valueCodeableConcept: CodeableConcept;", "a single allowed type on a required value is required");
        extensions.Should().Contain("valueTypes: [\"CodeableConcept\"],");
        extensions.Should().Contain("context: [\"Questionnaire.item\", \"Questionnaire.item.item\"]");
        extensions.Should().Contain("import type { CodeableConcept, Extension } from \"./types\";");
        extensions.Should().Contain("import type { ExtensionDefinition } from \"../../model\";", "a relative path also works outside the web app");
    }

    [Fact]
    public async Task Profiles_are_rejected_for_now()
    {
        var emitter = new TypeScriptEmitter(Folder.CreateSnapshotResolver());
        var act = () => emitter.AddDefinitionAsync("http://hl7.org/fhir/StructureDefinition/vitalsigns");
        await act.Should().ThrowAsync<NotSupportedException>();
    }
}
