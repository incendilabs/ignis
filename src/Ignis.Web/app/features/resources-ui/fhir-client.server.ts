/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { fhirHeaders, resolveFhirUrl } from "#app/fhir.server";
import { Logger } from "#app/logger";

const logger = Logger.create({ namespace: "resources-ui:fhir-client" });

interface CapabilityResource {
  type: string;
}

interface CapabilityRest {
  resource?: CapabilityResource[];
}

interface CapabilityStatement {
  resourceType?: string;
  rest?: CapabilityRest[];
}

interface CountBundle {
  total?: number;
}

// FHIR resource type names are PascalCase ASCII (per the spec). Reject
// anything else so the helper is safe by construction even when called
// with input that didn't come from the CapabilityStatement.
const FHIR_RESOURCE_TYPE_NAME = /^[A-Z][A-Za-z]+$/;

/**
 * Returns the list of resource types declared by the FHIR server's
 * CapabilityStatement, or `null` if the statement can't be retrieved.
 */
export async function fetchResourceTypes(
  request: Request,
  accessToken: string | undefined,
): Promise<string[] | null> {
  try {
    const url = resolveFhirUrl(request, "metadata");
    const response = await fetch(url, { headers: fhirHeaders(accessToken) });
    if (!response.ok) {
      logger.warn(
        { context: { status: response.status } },
        "CapabilityStatement fetch failed",
      );
      return null;
    }
    const body = (await response.json()) as CapabilityStatement;
    return body.rest?.[0]?.resource?.map((r) => r.type) ?? [];
  } catch (error) {
    logger.warn({ error }, "CapabilityStatement fetch threw");
    return null;
  }
}

/**
 * Fetches the total instance count for one resource type using
 * `_summary=count`. Returns `null` when the count cannot be determined so
 * callers can render a placeholder instead of failing the whole page.
 */
export async function fetchResourceCount(
  request: Request,
  accessToken: string | undefined,
  resourceType: string,
): Promise<number | null> {
  if (!FHIR_RESOURCE_TYPE_NAME.test(resourceType)) {
    logger.warn(
      { context: { resourceType } },
      "Rejected count request for non-FHIR resource type name",
    );
    return null;
  }
  try {
    const url = resolveFhirUrl(request, `${resourceType}?_summary=count`);
    const response = await fetch(url, { headers: fhirHeaders(accessToken) });
    if (!response.ok) return null;
    const body = (await response.json()) as CountBundle;
    return body.total ?? null;
  } catch {
    return null;
  }
}
