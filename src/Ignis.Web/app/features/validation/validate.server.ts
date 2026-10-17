/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { fhirHeaders, resolveFhirUrl } from "#app/fhir.server";
import { getOperationOutcomeIssues } from "#app/lib/fhir";
import { asString, asStringArray } from "#app/lib/fhir/guards";
import { HttpStatus } from "#app/lib/fhir/http";
import { isResource } from "#app/lib/fhir/model";
import { isValidFhirResourceTypeName } from "#app/lib/fhir/validation";
import { Logger } from "#app/logger";

const logger = Logger.create({ namespace: "validation" });

export interface ValidationIssue {
  severity: string;
  code: string | null;
  message: string;
  /** FHIRPath locations the issue points at; empty when it is resource-wide. */
  expression: string[];
}

export type ValidationResult =
  | { ok: true; issues: ValidationIssue[]; }
  | { ok: false; reason: "unreachable"; }
  | { ok: false; reason: "no-outcome"; status: number; }
  | { ok: false; reason: "error-outcome"; status: number; message: string | null; };

/** Statuses on which $validate's OperationOutcome is a validation report, not a server error. */
const REPORT_STATUSES: ReadonlySet<number> = new Set([HttpStatus.BadRequest, HttpStatus.UnprocessableEntity]);

/**
 * Validates a pasted resource against the FHIR server's $validate operation.
 * Local pre-checks (JSON shape, resource type) come back as issues too, so the
 * UI has a single result shape. The raw text is passed through untouched —
 * the server's parser stays the authority on FHIR syntax.
 */
export async function validateResource(
  request: Request,
  accessToken: string | undefined,
  resourceText: string,
  profile: string | null,
  localMessages: { invalidJson: string; notAResource: string; },
): Promise<ValidationResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(resourceText);
  } catch {
    return { ok: true, issues: [localIssue(localMessages.invalidJson)] };
  }
  if (!isResource(parsed) || !isValidFhirResourceTypeName(parsed.resourceType)) {
    return { ok: true, issues: [localIssue(localMessages.notAResource)] };
  }

  let response: Response;
  try {
    const url = resolveFhirUrl(request, `${parsed.resourceType}/$validate`);
    if (profile !== null && profile !== "") url.searchParams.set("profile", profile);

    const headers = new Headers(fhirHeaders(accessToken));
    headers.set("Content-Type", "application/fhir+json");
    response = await fetch(url, { method: "POST", headers, body: resourceText });
  } catch (error) {
    logger.error({ error }, "Failed to call $validate");
    return { ok: false, reason: "unreachable" };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // An empty or non-JSON body carries no outcome; handled below.
  }

  // $validate always answers with an OperationOutcome; anything else (an empty body,
  // a gateway's HTML page) is not a validation result, whatever the status.
  if (!isResource(payload) || payload.resourceType !== "OperationOutcome") {
    logger.warn({ context: { status: response.status } }, "$validate returned no outcome");
    return { ok: false, reason: "no-outcome", status: response.status };
  }

  // On success and on strict 4xx rejections the outcome is the report. 
  const issues = getOperationOutcomeIssues(payload);
  if (!response.ok && !REPORT_STATUSES.has(response.status)) {
    logger.warn({ context: { status: response.status } }, "$validate failed");
    return {
      ok: false,
      reason: "error-outcome",
      status: response.status,
      message: issues.map((issue) => asString(issue.details?.text) ?? asString(issue.diagnostics))
        .find((text) => text !== undefined && text !== "") ?? null,
    };
  }

  return {
    ok: true,
    issues: issues.map((issue) => ({
      severity: asString(issue.severity) ?? "information",
      code: asString(issue.code) ?? null,
      message: asString(issue.details?.text)
        ?? asString(issue.diagnostics)
        ?? asString(issue.code)
        ?? "",
      expression: asStringArray(issue.expression),
    })),
  };
}

function localIssue(message: string): ValidationIssue {
  return { severity: "fatal", code: "invalid", message, expression: [] };
}
