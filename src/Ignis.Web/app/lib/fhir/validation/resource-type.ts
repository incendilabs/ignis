/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

// Mirrors FHIR's StructureDefinition `name` rule, invariant sdf-0:
// `name.matches('[A-Z]([A-Za-z0-9_]){0,254}')`
// See https://hl7.org/fhir/R4/structuredefinition.html#invs (sdf-0).
const FHIR_RESOURCE_TYPE_NAME_PATTERN = /^[A-Z][A-Za-z0-9_]{0,254}$/;

/**
 * Validates that a string is a syntactically valid FHIR resource type name
 * per StructureDefinition invariant sdf-0. Use this to guard requests built
 * from caller-supplied input before interpolating the type into a FHIR URL
 * path.
 */
export function isValidFhirResourceTypeName(resourceType: string): boolean {
  return FHIR_RESOURCE_TYPE_NAME_PATTERN.test(resourceType);
}
