/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { Code, Uri } from "./primitives";

/**
 * Fhir Coding model.
 *
 * References:
 * - R4: https://hl7.org/fhir/R4/datatypes.html#Coding
 * - R4B: https://hl7.org/fhir/R4B/datatypes.html#Coding
 * - R5: https://hl7.org/fhir/R5/datatypes.html#Coding
 */
export interface Coding {
  system?: Uri;
  version?: string;
  code?: Code;
  display?: string;
  userSelected?: boolean;
}
