/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { fhirHeaders, resolveFhirUrl } from "#app/fhir.server";
import { getOperationOutcomeIssues } from "#app/lib/fhir";
import { asString, asStringArray } from "#app/lib/fhir/guards";
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
  | { ok: false; };

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

  try {
    const url = resolveFhirUrl(request, `${parsed.resourceType}/$validate`);
    if (profile !== null && profile !== "") url.searchParams.set("profile", profile);

    const headers = new Headers(fhirHeaders(accessToken));
    headers.set("Content-Type", "application/fhir+json");
    const response = await fetch(url, { method: "POST", headers, body: resourceText });

    // $validate reports through an OperationOutcome on success and on strict
    // 4xx rejections alike; only outcome-less responses are transport errors.
    const payload: unknown = await response.json();
    const issues = getOperationOutcomeIssues(payload);
    if (issues.length === 0 && !response.ok) {
      logger.warn({ context: { status: response.status } }, "$validate returned no outcome");
      return { ok: false };
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
  } catch (error) {
    logger.error({ error }, "Failed to call $validate");
    return { ok: false };
  }
}

function localIssue(message: string): ValidationIssue {
  return { severity: "fatal", code: "invalid", message, expression: [] };
}
