/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

/** Narrows an unknown value to a keyed object (not null, not an array). */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The value as a string when it is one, else undefined. */
export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** The string entries of an array value; empty when it is not an array at all. */
export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}
