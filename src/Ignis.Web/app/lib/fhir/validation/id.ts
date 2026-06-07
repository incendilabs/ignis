/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

// FHIR's `id` datatype: 1-64 chars of letters, digits, hyphen, and dot.
// Validating this keeps callers safe by construction when an id is
// interpolated into a FHIR URL path (rejects `/`, `?`, whitespace, etc.).
// See https://hl7.org/fhir/R4/datatypes.html#id.
const FHIR_ID_PATTERN = /^[A-Za-z0-9\-.]{1,64}$/;

/**
 * Validates that a string is a syntactically valid FHIR resource id. Use this
 * to guard requests built from caller-supplied input before interpolating the
 * id into a FHIR URL path.
 */
export function isValidFhirId(id: string): boolean {
  return FHIR_ID_PATTERN.test(id);
}
