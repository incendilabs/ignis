/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { fhirHeaders, resolveFhirUrl } from "#app/fhir.server";
import { asString } from "#app/lib/fhir/guards";
import {
  type Bundle,
  bundleResources,
  type Parameters,
  type ParametersParameter,
  type Resource,
} from "#app/lib/fhir/model";
import { Logger } from "#app/logger";

const logger = Logger.create({ namespace: "admin:profiles" });

export interface ProfileInfo {
  canonical: string;
  type: string | null;
  name: string | null;
  title: string | null;
  version: string | null;
  status: string | null;
}

/**
 * Resource-constraint profiles loaded from the server's 
 * `GET /fhir/StructureDefinition/$profiles`.
 */
export async function fetchSupportedProfiles(
  request: Request,
  accessToken: string | undefined,
): Promise<ProfileInfo[] | null> {
  try {
    const url = resolveFhirUrl(request, "StructureDefinition/$profiles");
    const response = await fetch(url, { headers: fhirHeaders(accessToken) });
    if (!response.ok) {
      logger.warn({ context: { status: response.status } }, "Supported-profiles fetch failed");
      return null;
    }
    const body = (await response.json()) as Bundle;
    return bundleResources(body)
      .map(toProfileInfo)
      .filter((profile) => profile.canonical.length > 0);
  } catch (error) {
    logger.warn({ error }, "Supported-profiles fetch threw");
    return null;
  }
}

function toProfileInfo(resource: Resource): ProfileInfo {
  return {
    canonical: asString(resource.url) ?? "",
    type: asString(resource.type) ?? null,
    name: asString(resource.name) ?? null,
    title: asString(resource.title) ?? null,
    version: asString(resource.version) ?? null,
    status: asString(resource.status) ?? null,
  };
}

/** A FHIR package installed on the server. */
export interface PackageInfo {
  id: string;
  version: string | null;
}

/**
 * The FHIR packages loaded on the server, via `GET /fhir/$packages` (a
 * Parameters resource, one `package` part per entry). Returns `null` when the
 * list can't be retrieved so callers can render an error state.
 */
export async function fetchPackages(
  request: Request,
  accessToken: string | undefined,
): Promise<PackageInfo[] | null> {
  try {
    const url = resolveFhirUrl(request, "$packages");
    const response = await fetch(url, { headers: fhirHeaders(accessToken) });
    if (!response.ok) {
      logger.warn({ context: { status: response.status } }, "Packages fetch failed");
      return null;
    }
    const body = (await response.json()) as Parameters;
    return (body.parameter ?? [])
      .filter((parameter) => parameter.name === "package")
      .map(toPackageInfo)
      .filter((info) => info.id.length > 0);
  } catch (error) {
    logger.warn({ error }, "Packages fetch threw");
    return null;
  }
}

function toPackageInfo(parameter: ParametersParameter): PackageInfo {
  return {
    id: partString(parameter, "id") ?? "",
    version: partString(parameter, "version") ?? null,
  };
}

function partString(parameter: ParametersParameter, name: string): string | undefined {
  return parameter.part?.find((part) => part.name === name)?.valueString;
}
