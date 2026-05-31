/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Builds request headers for a FHIR API call: a FHIR-aware `Accept` header,
 * plus a bearer `Authorization` header when an access token is supplied. An
 * absent or empty token yields headers without `Authorization`, suitable for
 * anonymous endpoints such as `metadata`.
 */
export function fhirHeaders(accessToken?: string): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/fhir+json, application/json",
  };
  if (accessToken !== undefined && accessToken !== "") {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}
