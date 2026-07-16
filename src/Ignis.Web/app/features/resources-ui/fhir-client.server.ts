/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { fhirHeaders, resolveFhirUrl } from "#app/fhir.server";
import {
  type Bundle,
  bundleResources,
  isResource,
  type Resource,
} from "#app/lib/fhir/model";
import { fhirResourcePath } from "#app/lib/fhir/http";
import { mapWithConcurrency } from "#app/lib/concurrency";
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

export interface ResourceTypeCount {
  type: string;
  count: number | null;
}

// Cap parallel count requests so a 140-type CapabilityStatement doesn't
// fire 140 concurrent calls at the FHIR backend on every page load.
const COUNT_FETCH_CONCURRENCY = 8;

/**
 * Every declared resource type with a best-effort instance count,
 * alphabetically. Null when the CapabilityStatement is unavailable.
 */
export async function fetchResourceTypesWithCounts(
  request: Request,
  accessToken: string | undefined,
): Promise<ResourceTypeCount[] | null> {
  const types = await fetchResourceTypes(request, accessToken);
  if (types === null) return null;

  const rows = await mapWithConcurrency(types, COUNT_FETCH_CONCURRENCY, async (type) => ({
    type,
    count: await fetchResourceCount(request, accessToken, type),
  }));
  rows.sort((a, b) => a.type.localeCompare(b.type));
  return rows;
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
  const path = fhirResourcePath(resourceType);
  if (path === null) {
    logger.warn(
      { context: { resourceType } },
      "Rejected count request for non-FHIR resource type name",
    );
    return null;
  }
  try {
    const url = resolveFhirUrl(request, `${path}?_summary=count`);
    const response = await fetch(url, { headers: fhirHeaders(accessToken) });
    if (!response.ok) return null;
    const body = (await response.json()) as Bundle;
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
  const path = fhirResourcePath(resourceType);
  if (path === null) {
    logger.warn(
      { context: { resourceType } },
      "Rejected list request for non-FHIR resource type name",
    );
    return null;
  }

  try {
    const url = resolveFhirUrl(
      request,
      `${path}?_count=${String(limit)}&_elements=id`,
    );
    const response = await fetch(url, { headers: fhirHeaders(accessToken) });
    if (!response.ok) return null;

    const body = (await response.json()) as Bundle;
    return bundleResources(body)
      .map((resource) => ({
        id: typeof resource.id === "string" ? resource.id : "",
      }))
      .filter((item) => item.id.length > 0);
  } catch {
    return null;
  }
}

/**
 * Fetches a single resource instance by type and id, returning the parsed
 * resource object or `null` when it can't be retrieved (invalid type/id,
 * non-2xx, or a non-object body).
 */
export async function fetchResource(
  request: Request,
  accessToken: string | undefined,
  resourceType: string,
  id: string,
): Promise<Resource | null> {
  const path = fhirResourcePath(resourceType, id);
  if (path === null) {
    logger.warn(
      { context: { resourceType, id } },
      "Rejected read request for invalid FHIR resource type name or id",
    );
    return null;
  }

  try {
    const url = resolveFhirUrl(request, path);
    const response = await fetch(url, { headers: fhirHeaders(accessToken) });
    if (!response.ok) return null;

    const body: unknown = await response.json();
    if (!isResource(body)) return null;
    return body;
  } catch {
    return null;
  }
}

/**
 * Fetches a single resource instance serialized as FHIR XML, returning the raw
 * XML string or `null` when it can't be retrieved (invalid type/id or non-2xx).
 */
export async function fetchResourceXml(
  request: Request,
  accessToken: string | undefined,
  resourceType: string,
  id: string,
): Promise<string | null> {
  const path = fhirResourcePath(resourceType, id);
  if (path === null) {
    logger.warn(
      { context: { resourceType, id } },
      "Rejected XML read request for invalid FHIR resource type name or id",
    );
    return null;
  }

  try {
    const url = resolveFhirUrl(request, `${path}?_pretty=true`);
    const response = await fetch(url, {
      headers: fhirHeaders(accessToken, { format: "xml" }),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
