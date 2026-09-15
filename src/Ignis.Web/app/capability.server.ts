/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { fhirHeaders, resolveFhirUrl } from "#app/fhir.server";
import { asString } from "#app/lib/fhir/guards";
import { Logger } from "#app/logger";

const logger = Logger.create({ namespace: "capability" });

interface CapabilityStatement {
  implementation?: { description?: unknown; };
}

/** What the deployment says it is, from `implementation.description` in the (public)
 *  `/fhir/metadata`. Null when the server is unreachable or says nothing. */
export async function fetchServerNotice(request: Request): Promise<string | null> {
  try {
    const url = resolveFhirUrl(request, "metadata");
    const response = await fetch(url, { headers: fhirHeaders(undefined) });
    if (!response.ok) {
      logger.warn({ context: { status: response.status } }, "Server notice fetch failed");
      return null;
    }
    const body = (await response.json()) as CapabilityStatement;
    const description = asString(body.implementation?.description)?.trim();
    return description === undefined || description === "" ? null : description;
  } catch (error) {
    logger.warn({ error }, "Server notice fetch threw");
    return null;
  }
}
