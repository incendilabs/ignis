/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { describe, expect, expectTypeOf, it } from "vitest";

import { findExtension, findExtensions } from "./extension";
import { extensionDefinitionFromStructureDefinition, type ExtensionDefinition } from "./extension-definition";

interface MiddleNameExtension {
  url: "http://hl7.no/fhir/StructureDefinition/no-basis-middlename";
  valueString?: string;
}

const MiddleName: ExtensionDefinition<MiddleNameExtension> = {
  url: "http://hl7.no/fhir/StructureDefinition/no-basis-middlename",
  context: ["HumanName"],
  valueTypes: ["string"],
};

const name = {
  family: "Eksempel",
  extension: [
    { url: MiddleName.url, valueString: "Mellom" },
    { url: "http://example.org/other", valueBoolean: true },
    { url: MiddleName.url, valueString: "Andre" },
  ],
};

describe("findExtension with a definition", () => {
  it("returns the first match typed by the definition", () => {
    const middle = findExtension(name, MiddleName);
    expectTypeOf(middle?.valueString).toEqualTypeOf<string | undefined>();
    expect(middle?.valueString).toBe("Mellom");
  });

  it("is undefined without a match or an element", () => {
    expect(findExtension({ extension: [] }, MiddleName)).toBeUndefined();
    expect(findExtension(undefined, MiddleName)).toBeUndefined();
  });

  it("findExtensions returns every match", () => {
    expect(findExtensions(name, MiddleName).map((e) => e.valueString)).toEqual(["Mellom", "Andre"]);
    expect(findExtensions(name.extension, MiddleName.url)).toHaveLength(2);
  });
});

describe("extensionDefinitionFromStructureDefinition", () => {
  // Differential-only, as shipped in hl7.fhir.no.basis 2.2.0.
  const middleNameDefinition = {
    resourceType: "StructureDefinition",
    url: "http://hl7.no/fhir/StructureDefinition/no-basis-middlename",
    title: "no-basis-middlename",
    type: "Extension",
    context: [{ type: "element", expression: "HumanName" }],
    differential: {
      element: [
        { id: "Extension", path: "Extension", max: "1" },
        { id: "Extension.url", path: "Extension.url", fixedUri: "http://hl7.no/fhir/StructureDefinition/no-basis-middlename" },
        { id: "Extension.value[x]", path: "Extension.value[x]", type: [{ code: "string" }] },
      ],
    },
  };

  it("reads url, context and value types from a differential", () => {
    expect(extensionDefinitionFromStructureDefinition(middleNameDefinition)).toEqual({
      url: "http://hl7.no/fhir/StructureDefinition/no-basis-middlename",
      title: "no-basis-middlename",
      context: ["HumanName"],
      valueTypes: ["string"],
    });
  });

  it("works at run time like a hand-written definition", () => {
    const dynamic = extensionDefinitionFromStructureDefinition(middleNameDefinition);
    expect(dynamic).toBeDefined();
    expect(dynamic && findExtension(name, dynamic)?.url).toBe(MiddleName.url);
  });

  it("gives a complex extension no value types", () => {
    const complex = {
      ...middleNameDefinition,
      differential: { element: [{ path: "Extension.value[x]", max: "0" }] },
    };
    expect(extensionDefinitionFromStructureDefinition(complex)?.valueTypes).toEqual([]);
  });

  it("rejects other resources and malformed input", () => {
    expect(extensionDefinitionFromStructureDefinition({ ...middleNameDefinition, type: "Patient" })).toBeUndefined();
    expect(extensionDefinitionFromStructureDefinition({ resourceType: "StructureDefinition", type: "Extension" })).toBeUndefined();
    expect(extensionDefinitionFromStructureDefinition("nope")).toBeUndefined();
  });
});
