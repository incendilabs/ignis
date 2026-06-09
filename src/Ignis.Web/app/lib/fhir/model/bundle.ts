/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { Resource } from "./resource";

export interface FhirBundleEntry {
  resource?: Resource;
}

export interface FhirBundle {
  total?: number;
  entry?: { resource?: Resource; }[];
}

function isResource(value: unknown): value is Resource {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns the resources carried by a FHIR Bundle's entries. */
export function bundleResources(bundle: FhirBundle): Resource[] {
  return (bundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter((resource): resource is Resource => isResource(resource));
}