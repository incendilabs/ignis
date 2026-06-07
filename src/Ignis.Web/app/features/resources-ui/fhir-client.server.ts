/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { fhirHeaders, resolveFhirUrl } from "#app/fhir.server";
import {
  bundleResources,
  type FhirBundle,
  isValidFhirResourceTypeName,
} from "#app/lib/fhir";
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

export interface ResourceListItem {
  id: string;
}

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
  if (!isValidFhirResourceTypeName(resourceType)) {
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
    const body = (await response.json()) as FhirBundle;
    return body.total ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetches a small page of resources for one type and extracts the stable
 * UI-facing id for each. Returns `null` when the page can't be retrieved so
 * callers can render an error state instead of failing the whole page.
 */
export async function fetchResourceList(
  request: Request,
  accessToken: string | undefined,
  resourceType: string,
  limit = 100,
): Promise<ResourceListItem[] | null> {
  if (!isValidFhirResourceTypeName(resourceType)) {
    logger.warn(
      { context: { resourceType } },
      "Rejected list request for non-FHIR resource type name",
    );
    return null;
  }

  try {
    const url = resolveFhirUrl(
      request,
      `${resourceType}?_count=${String(limit)}&_elements=id`,
    );
    const response = await fetch(url, { headers: fhirHeaders(accessToken) });
    if (!response.ok) return null;

    const body = (await response.json()) as FhirBundle;
    return bundleResources(body)
      .map((resource) => ({
        id: typeof resource.id === "string" ? resource.id : "",
      }))
      .filter((item) => item.id.length > 0);
  } catch {
    return null;
  }
}
