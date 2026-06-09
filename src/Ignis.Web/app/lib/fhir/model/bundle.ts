/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

export interface FhirBundleEntry {
  resource?: Record<string, unknown>;
}

export interface FhirBundle {
  total?: number;
  entry?: FhirBundleEntry[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns the resource objects carried by a FHIR Bundle's entries. */
export function bundleResources(bundle: FhirBundle): Record<string, unknown>[] {
  return (bundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter((resource): resource is Record<string, unknown> => isObject(resource));
}