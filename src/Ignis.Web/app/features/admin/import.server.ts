/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {
  fhirBaseIsDefaultSameOrigin,
  fhirHeaders,
  getOperationOutcomeDetails,
  parseJson,
  resolveFhirUrl,
} from "#app/fhir.server";
import { HttpStatus } from "#app/lib/fhir/http";
import { getIntegerParameter } from "#app/lib/fhir/model";

import { mapFhirApiFailure } from "./fhir-api.server";
import {
  archiveImportEndpoint,
  archiveImportFileField,
  archiveImportMaxUploadBytesFallback,
  archiveImportScope,
  type OperationResult,
} from "./import.shared";

/**
 * Reads the configured max upload size from the FHIR `$archive-import`
 * operation. Falls back to {@link archiveImportMaxUploadBytesFallback}.
 */
export async function getArchiveImportMaxUploadBytes(
  request: Request,
  accessToken: string,
): Promise<number> {
  try {
    const url = resolveFhirUrl(request, archiveImportEndpoint);
    const response = await fetch(url, { headers: fhirHeaders(accessToken) });
    if (!response.ok) return archiveImportMaxUploadBytesFallback;

    const payload = await parseJson(response);
    const max = getIntegerParameter(payload, "maxUploadSizeBytes");
    return max !== null && max > 0 ? max : archiveImportMaxUploadBytesFallback;
  } catch {
    return archiveImportMaxUploadBytesFallback;
  }
}

/**
 * Uploads a ZIP archive to the FHIR `$archive-import` operation. The API
 * accepts the upload synchronously (202) and reports ingestion progress out of
 * band via the operations hub, so a successful result here only confirms the
 * archive was queued — `operationId` is the handle for tracking that work.
 *
 * Status codes are mapped to user-facing messages: 400 (not a ZIP), 413 (too
 * large), 429 (an import is already running) and 503 (feature disabled), with
 * 401/403 and config faults handled by {@link mapFhirApiFailure}.
 */
export async function runArchiveImport(
  request: Request,
  file: File,
  accessToken: string,
): Promise<OperationResult> {
  try {
    const url = resolveFhirUrl(request, archiveImportEndpoint);

    const body = new FormData();
    body.append(archiveImportFileField, file, file.name);

    // Spread fhirHeaders (Accept + Authorization only): never set Content-Type
    // here, or fetch can't add the multipart boundary for the FormData body.
    const response = await fetch(url, {
      method: "POST",
      headers: fhirHeaders(accessToken),
      body,
    });

    const payload = await parseJson(response);
    const outcome = getOperationOutcomeDetails(payload);

    if (response.ok) {
      return {
        ok: true,
        message:
          outcome.message ??
          "Import accepted; progress will be reported via the operations hub.",
        operationId: outcome.operationId,
      };
    }

    const statusMessage = importFailureMessage(response.status);
    if (statusMessage !== null) {
      return {
        ok: false,
        message: outcome.message ?? statusMessage,
        operationId: outcome.operationId,
      };
    }

    const genericFailure = mapFhirApiFailure(response, {
      operationId: outcome.operationId,
      requiredScope: archiveImportScope,
      usingDefaultSameOriginBase: fhirBaseIsDefaultSameOrigin(),
    });
    if (genericFailure !== null) return genericFailure;

    return {
      ok: false,
      message:
        outcome.message ??
        `Import request failed with status ${String(response.status)}.`,
      operationId: outcome.operationId,
    };
  } catch {
    return {
      ok: false,
      message:
        "FHIR backend unavailable: could not reach the configured API endpoint.",
    };
  }
}

/**
 * Maps the import-specific error statuses to a message, or `null` when the
 * status is not one this operation handles directly (so the caller can fall
 * back to the generic auth/config mapping).
 */
function importFailureMessage(status: number): string | null {
  switch (status) {
    case HttpStatus.BadRequest:
      return "The server rejected the upload request as invalid.";
    case HttpStatus.ContentTooLarge:
      return "The archive is too large to import. Reduce its size and try again.";
    case HttpStatus.TooManyRequests:
      return "An import is already in progress. Wait for it to finish, then try again.";
    case HttpStatus.ServiceUnavailable:
      return "Import is not available.";
    default:
      return null;
  }
}
