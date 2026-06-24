/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/**
 * Formats a FHIR value for display. Returns `null` for values that should
 * render as "empty" (`null` or an empty string), so callers can show a
 * placeholder instead. `0` and `false` are kept — only blank values are empty.
 */
export function formatPrimitive(value: string | number | boolean | null): string | null {
  if (value === null || value === "") return null;
  return String(value);
}
