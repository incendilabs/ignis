/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * FHIR client primitives.
 *
 */

export { fhirHeaders, type AcceptFormat } from "./headers";
export { parseJson } from "./json";
export type { JsonParseFailure, ParseJsonOptions } from "./json";
export { getOperationOutcomeDetails } from "./operation-outcome";
export type {
  OperationOutcomeIssue,
  OperationOutcomePayload,
} from "./operation-outcome";
