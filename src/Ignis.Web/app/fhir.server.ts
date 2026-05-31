/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { env } from "#app/env.server";
import { Logger } from "#app/logger";

import { joinFhirUrl, parseJson as parseJsonCore } from "./lib/fhir";

const logger = Logger.create({ namespace: "fhir" });

/**
 * Application FHIR access glue over the portable `app/lib/fhir` core: it reads
 * the configured backend base URL and wires the application logger. The core
 * itself stays free of app and framework dependencies.
 */

/**
 * Resolves a FHIR API endpoint URL against the configured backend base.
 * Falls back to the BFF's own origin under `/fhir/` when
 * `IGNIS_WEB_FHIR_BASE_URL` is unset. Use {@link fhirBaseIsDefaultSameOrigin}
 * to detect that fallback for a misconfiguration diagnostic.
 */
export function resolveFhirUrl(request: Request, endpoint: string): URL {
  const configuredBase = env("IGNIS_WEB_FHIR_BASE_URL", { default: "" });
  const base = configuredBase === ""
    ? new URL("/fhir/", request.url).toString()
    : configuredBase;

  return joinFhirUrl(base, endpoint);
}

/**
 * True when `IGNIS_WEB_FHIR_BASE_URL` is unset, so FHIR calls fall back to the
 * BFF's own origin under `/fhir/`. A process-level config fact, independent of
 * any single request — lets callers craft a useful "set the base URL" hint.
 */
export function fhirBaseIsDefaultSameOrigin(): boolean {
  return env("IGNIS_WEB_FHIR_BASE_URL", { default: "" }) === "";
}

/**
 * {@link parseJsonCore} wired to the application logger: logs a body preview
 * when a response claims JSON but fails to parse, useful when diagnosing
 * upstream output anomalies.
 */
export async function parseJson(response: Response): Promise<unknown> {
  return parseJsonCore(response, {
    onParseError: (failure) => {
      logger.info(
        {
          context: {
            url: failure.url,
            status: failure.status,
            contentType: failure.contentType,
            bodyPreview: failure.bodyPreview,
          },
          error: failure.error,
        },
        "Failed to parse response body as JSON",
      );
    },
  });
}

export { fhirHeaders, getOperationOutcomeDetails } from "./lib/fhir";
export type { OperationOutcomePayload } from "./lib/fhir";
