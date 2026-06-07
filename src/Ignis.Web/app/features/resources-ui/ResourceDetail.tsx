/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Renders a single FHIR resource. Presentational only — the resource is passed
 * in as a prop, with no data fetching, router, or loader coupling, so the same
 * view can be mounted in a route page or a drawer.
 *
 * First version: raw JSON. Richer, field-aware rendering can replace the body
 * without changing this component's contract.
 */
export function ResourceDetail({ resource }: { resource: Record<string, unknown> }) {
  return (
    <pre className="overflow-x-auto rounded border border-(--border) p-4 text-sm">
      {JSON.stringify(resource, null, 2)}
    </pre>
  );
}
