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

import {
  fhirApiUnavailableMessage,
  mapFhirApiFailure,
} from "./fhir-api.server";
import {
  maintenanceOperations,
  type OperationResult,
  type MaintenanceOperation,
} from "./maintenance.shared";

export interface DatabaseConnectionStatus {
  ok: boolean;
  message: string;
}

export async function runMaintenanceOperation(
  request: Request,
  operation: MaintenanceOperation,
  accessToken: string,
): Promise<OperationResult> {
  try {
    const url = resolveFhirUrl(request, operation.endpoint);
    const response = await fetch(url, {
      method: "POST",
      headers: fhirHeaders(accessToken),
    });

    const payload = await parseJson(response);
    const outcome = getOperationOutcomeDetails(payload);

    if (response.ok) {
      return {
        ok: true,
        message: outcome.message ?? operation.successMessage,
        operationId: outcome.operationId,
      };
    }

    if (response.status === 404 && operation.intent === maintenanceOperations.clearStore.intent) {
      return {
        ok: false,
        message: "Store reset is disabled by the API feature flag.",
        operationId: outcome.operationId,
      };
    }

    const genericFailure = mapFhirApiFailure(response, {
      operationId: outcome.operationId,
      requiredScope: operation.requiredScope,
      usingDefaultSameOriginBase: fhirBaseIsDefaultSameOrigin(),
    });
    if (genericFailure !== null) return genericFailure;

    return {
      ok: false,
      message: outcome.message ?? `Maintenance request failed with status ${String(response.status)}.`,
      operationId: outcome.operationId,
    };
  } catch {
    return {
      ok: false,
      message: "FHIR backend unavailable: could not reach the configured API endpoint.",
    };
  }
}

export async function getDatabaseConnectionStatus(request: Request): Promise<DatabaseConnectionStatus> {
  try {
    const url = resolveFhirUrl(request, "metadata");
    const response = await fetch(url, {
      headers: fhirHeaders(),
    });

    if (response.ok) {
      return {
        ok: true,
        message: "FHIR backend available",
      };
    }

    return {
      ok: false,
      message: fhirApiUnavailableMessage(response, fhirBaseIsDefaultSameOrigin()),
    };
  } catch {
    return {
      ok: false,
      message: "FHIR backend unavailable: could not reach the configured API endpoint.",
    };
  }
}
