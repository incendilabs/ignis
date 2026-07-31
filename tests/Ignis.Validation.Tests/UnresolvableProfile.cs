/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

using Hl7.Fhir.Model;

namespace Ignis.Validation.Tests;

/// <summary>
/// A Patient profile the schema compiler cannot build: it slices <c>Patient.extension</c>, and the slice
/// declares an extension profile that resolves nowhere, so walking the discriminator gives up. Same shape
/// as the cross-version profiles in hl7.fhir.uv.xver-r5.r4, which pin extension versions the loaded
/// packages do not carry.
/// </summary>
internal static class UnresolvableProfile
{
    public const string Url = "http://example.org/StructureDefinition/pins-a-missing-extension";

    public const string MissingDependency = "http://example.org/StructureDefinition/absent-extension|1.2.3";

    public static StructureDefinition Definition => new()
    {
        Url = Url,
        Name = "PinsAMissingExtension",
        Status = PublicationStatus.Active,
        Kind = StructureDefinition.StructureDefinitionKind.Resource,
        Abstract = false,
        Type = "Patient",
        BaseDefinition = "http://hl7.org/fhir/StructureDefinition/Patient",
        Derivation = StructureDefinition.TypeDerivationRule.Constraint,
        Differential = new StructureDefinition.DifferentialComponent
        {
            Element =
            {
                new ElementDefinition("Patient.extension")
                {
                    Slicing = new ElementDefinition.SlicingComponent
                    {
                        Rules = ElementDefinition.SlicingRules.Open,
                        Discriminator =
                        {
                            new ElementDefinition.DiscriminatorComponent
                            {
                                Type = ElementDefinition.DiscriminatorType.Value,
                                Path = "url",
                            },
                        },
                    },
                },
                new ElementDefinition("Patient.extension")
                {
                    SliceName = "absent",
                    Type =
                    {
                        new ElementDefinition.TypeRefComponent
                        {
                            Code = "Extension",
                            Profile = [MissingDependency],
                        },
                    },
                },
            },
        },
    };
}
