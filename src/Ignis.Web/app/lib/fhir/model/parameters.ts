/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { isResource, type Resource } from "./resource";

/** A single FHIR Parameters entry (only the value types we currently read). */
export interface ParametersParameter {
  name?: string;
  valueInteger?: number;
}

/**
 * FHIR Parameters resource.
 *
 * R4: https://hl7.org/fhir/R4/parameters.html
 * R4B: https://hl7.org/fhir/R4B/parameters.html
 * R5: https://hl7.org/fhir/R5/parameters.html
 */
export interface Parameters extends Resource<"Parameters"> {
  parameter?: ParametersParameter[];
}

/**
 * Returns the named parameter's `valueInteger`, or null when the payload is not
 * a Parameters resource or the parameter is absent / not an integer.
 */
export function getIntegerParameter(payload: unknown, name: string): number | null {
  if (!isParameters(payload)) return null;
  const value = payload.parameter?.find((p) => p.name === name)?.valueInteger;
  return typeof value === "number" ? value : null;
}

function isParameters(payload: unknown): payload is Parameters {
  return isResource(payload) && payload.resourceType === "Parameters";
}
