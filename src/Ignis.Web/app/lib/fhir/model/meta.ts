/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {
  Canonical,
  Instant,
  ResourceId,
  Uri,
} from "./primitives";
import type { Coding } from "./coding";

/**
 * Core metadata fields shared by FHIR resources.
 *
 * References:
 * - R4: https://hl7.org/fhir/R4/resource.html#Meta
 * - R4B: https://hl7.org/fhir/R4B/resource.html#Meta
 * - R5: https://hl7.org/fhir/R5/resource.html#Meta
 */
export interface Meta {
  versionId?: ResourceId;
  lastUpdated?: Instant;
  source?: Uri;
  profile?: Canonical[];
  security?: Coding[];
  tag?: Coding[];
}
