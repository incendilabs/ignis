/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/** Serialization format to request from a FHIR endpoint. */
export type AcceptFormat = "json" | "xml";

const fhirAccept: Record<AcceptFormat, string> = {
  json: "application/fhir+json, application/json",
  xml: "application/fhir+xml, application/xml",
};

interface FhirHeadersOptions {
  /** Serialization format to request (default `json`). */
  format?: AcceptFormat;
}

/**
 * Builds request headers for a FHIR API call: a FHIR-aware `Accept` header for
 * the requested `format` (JSON by default), plus a bearer `Authorization`
 * header when an access token is supplied. An absent or empty token yields
 * headers without `Authorization`, suitable for anonymous endpoints such as
 * `metadata`.
 */
export function fhirHeaders(
  accessToken?: string,
  options: FhirHeadersOptions = {},
): HeadersInit {
  const headers: Record<string, string> = {
    Accept: fhirAccept[options.format ?? "json"],
  };
  if (accessToken !== undefined && accessToken !== "") {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}
