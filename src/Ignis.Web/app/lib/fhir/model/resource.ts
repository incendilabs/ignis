/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { Meta } from "./meta";
import type { Code, ResourceId, Uri } from "./primitives";

/**
 * Fhir Resource base.
 *
 * References:
 * - R4: https://hl7.org/fhir/R4/resource.html
 * - R4B: https://hl7.org/fhir/R4B/resource.html
 * - R5: https://hl7.org/fhir/R5/resource.html
 *
 */
export interface Resource<TResourceType extends string = string> {
  resourceType?: TResourceType;
  id?: ResourceId;
  meta?: Meta;
  implicitRules?: Uri;
  language?: Code;
  [key: string]: unknown;
}
