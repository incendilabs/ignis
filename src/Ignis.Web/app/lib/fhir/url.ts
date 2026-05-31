/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Joins an endpoint onto a FHIR server base URL.
 *
 * The base path is normalized so the endpoint resolves *under* the FHIR root
 * rather than at the origin: a trailing slash is ensured, and a bare-origin
 * base (path `/`) is treated as `/fhir/`. The endpoint is resolved with the
 * standard URL algorithm, so it may carry a query string (e.g.
 * `Patient?_summary=count`).
 *
 * Pure and dependency-free: pass an already-resolved base string. Reading
 * configuration and choosing a same-origin fallback is the caller's concern.
 */
export function joinFhirUrl(base: string | URL, endpoint: string): URL {
  const baseUrl = new URL(base);
  const normalizedPath = baseUrl.pathname === "/"
    ? "/fhir/"
    : baseUrl.pathname.endsWith("/")
      ? baseUrl.pathname
      : `${baseUrl.pathname}/`;
  return new URL(endpoint, `${baseUrl.origin}${normalizedPath}`);
}
