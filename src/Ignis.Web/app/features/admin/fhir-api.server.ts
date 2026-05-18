/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { Session } from "@eventuras/fides-auth/types";
import { data } from "react-router";

import { env } from "#app/env.server";
import { Logger } from "#app/logger";

import type { OperationResult } from "./maintenance.shared";

const logger = Logger.create({ namespace: "admin:fhir-api" });

interface OperationOutcomeIssue {
  diagnostics?: string;
}

interface OperationOutcomePayload {
  resourceType?: string;
  id?: string;
  issue?: OperationOutcomeIssue[];
}

/**
 * Resolves a FHIR API endpoint URL relative to the configured backend base.
 * Falls back to the BFF's own origin under `/fhir/` when
 * `IGNIS_WEB_FHIR_BASE_URL` is unset, signalling that misconfiguration via
 * `usingDefaultSameOriginBase` so callers can give a useful diagnostic.
 */
export function resolveOperationUrl(
  request: Request,
  endpoint: string,
): { url: URL; usingDefaultSameOriginBase: boolean; } {
  const configuredBase = env("IGNIS_WEB_FHIR_BASE_URL", { default: "" });
  const usingDefaultSameOriginBase = configuredBase === "";
  const baseUrl = new URL(usingDefaultSameOriginBase
    ? new URL("/fhir/", request.url).toString()
    : configuredBase);
  const normalizedPath = baseUrl.pathname === "/"
    ? "/fhir/"
    : baseUrl.pathname.endsWith("/")
      ? baseUrl.pathname
      : `${baseUrl.pathname}/`;

  return {
    url: new URL(endpoint, `${baseUrl.origin}${normalizedPath}`),
    usingDefaultSameOriginBase,
  };
}

/**
 * Reads a JSON body, returning `null` for absent content (204, missing/empty
 * body, non-JSON Content-Type). Logs a body preview when the response claims
 * JSON but parsing fails — useful when diagnosing upstream output anomalies.
 */
export async function parseJson(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("json")) return null;

  const text = await response.text();
  if (text.length === 0) return null;

  try {
    return JSON.parse(text);
  } catch (error) {
    logger.info(
      {
        context: {
          url: response.url,
          status: response.status,
          contentType,
          bodyPreview: text.slice(0, 500),
        },
        error,
      },
      "Failed to parse response body as JSON",
    );
    return null;
  }
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
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const candidate = payload as Partial<OperationOutcomePayload>;
  return candidate.resourceType === "OperationOutcome";
}

/**
 * Generic diagnostic message for failed FHIR API calls. Distinguishes the
 * common misconfiguration where the BFF is probing /fhir on its own origin
 * because no upstream API base URL is set.
 */
export function fhirApiUnavailableMessage(
  response: Response,
  usingDefaultSameOriginBase: boolean,
): string {
  if (response.status === 404 && usingDefaultSameOriginBase) {
    return "FHIR backend unavailable: the admin UI is probing /fhir on the web origin. Set IGNIS_WEB_FHIR_BASE_URL to the API base URL.";
  }
  return `FHIR backend unavailable: API returned ${String(response.status)}.`;
}

/**
 * Validates that a session exists and carries the required scope before the
 * BFF makes a privileged FHIR API call. On failure, logs the check
 * server-side and returns a 401/403 response with a generic body so the
 * client never sees the internal scope name. Returns `null` when the caller
 * may proceed.
 */
export function requireScopedSession(
  session: Session | null,
  requiredScope: string,
): ReturnType<typeof data<OperationResult>> | null {
  if (session === null) {
    logger.info(
      { context: { requiredScope } },
      "Maintenance action blocked: no session",
    );
    return data<OperationResult>(
      { ok: false, message: "Unauthorized." },
      { status: 401 },
    );
  }

  if (!(session.scopes?.includes(requiredScope) ?? false)) {
    logger.warn(
      { context: { requiredScope } },
      "Maintenance action blocked: session missing required scope",
    );
    return data<OperationResult>(
      { ok: false, message: "Forbidden." },
      { status: 403 },
    );
  }

  return null;
}

/**
 * Maps standard auth/config failures from a FHIR API response to an
 * {@link OperationResult}. Returns `null` when the status code does not
 * match a generic case so the caller can apply operation-specific handling.
 */
export function mapFhirApiFailure(
  response: Response,
  context: {
    operationId?: string;
    requiredScope: string;
    usingDefaultSameOriginBase: boolean;
  },
): OperationResult | null {
  if (response.status === 404 && context.usingDefaultSameOriginBase) {
    return {
      ok: false,
      message: fhirApiUnavailableMessage(response, true),
      operationId: context.operationId,
    };
  }

  if (response.status === 401) {
    logger.warn(
      { context: { requiredScope: context.requiredScope } },
      "FHIR backend rejected access token (401)",
    );
    return {
      ok: false,
      message: "Unauthorized.",
      operationId: context.operationId,
    };
  }

  if (response.status === 403) {
    logger.warn(
      { context: { requiredScope: context.requiredScope } },
      "FHIR backend returned 403 despite scoped BFF call",
    );
    return {
      ok: false,
      message: "Forbidden.",
      operationId: context.operationId,
    };
  }

  return null;
}
