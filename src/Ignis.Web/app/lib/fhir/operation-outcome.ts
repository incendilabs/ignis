/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { isResource, type Resource } from "./model";

export interface OperationOutcomeIssue {
  diagnostics?: string;
}

export interface OperationOutcomePayload extends Resource<"OperationOutcome"> {
  issue?: OperationOutcomeIssue[];
}

/**
 * Extracts the operation id (`OperationOutcome.id`) and the first non-empty
 * issue diagnostic from a parsed FHIR response payload. Returns an empty
 * object when the payload is not an `OperationOutcome`.
 */
export function getOperationOutcomeDetails(
  payload: unknown,
): { operationId?: string; message?: string; } {
  if (!isOperationOutcomePayload(payload)) {
    return {};
  }

  return {
    operationId: payload.id,
    message: payload.issue?.find((issue) => issue.diagnostics)?.diagnostics,
  };
}

function isOperationOutcomePayload(payload: unknown): payload is OperationOutcomePayload {
  return isResource(payload) && payload.resourceType === "OperationOutcome";
}
