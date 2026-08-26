/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { isObject, asString } from "../guards";
import type { Uri } from "./primitives";

/**
 * FHIR Extension. `url` identifies the definition; the value lives in one of
 * ~50 `value[x]` fields, left open so any of them — and nested extensions —
 * survive parsing.
 *
 * References:
 * - R4: https://hl7.org/fhir/R4/extensibility.html
 * - R5: https://hl7.org/fhir/R5/extensibility.html
 */
export interface Extension {
  url: Uri;
  extension?: Extension[];
  [key: string]: unknown;
}

/**
 * The `value[x]` carried by an extension, as the field name that was used and
 * its raw value — e.g. `{ field: "valueBoolean", value: true }`. Undefined for
 * an extension that only nests others. Callers decide how to render it.
 */
export function extensionValue(
  extension: Extension,
): { field: string; value: unknown } | undefined {
  for (const [field, value] of Object.entries(extension)) {
    if (field.startsWith("value") && value !== undefined) return { field, value };
  }
  return undefined;
}

/** The datatype an extension used, e.g. `valueCodeableConcept` → `codeableConcept`. */
export function extensionValueType(field: string): string {
  const type = field.slice("value".length);
  return type.charAt(0).toLowerCase() + type.slice(1);
}

/** The first extension with this url, or undefined. */
export function findExtension(
  extensions: Extension[] | undefined,
  url: Uri,
): Extension | undefined {
  return extensions?.find((extension) => extension.url === url);
}

/**
 * Extensions parsed from an unknown `extension` field. Entries without a
 * string `url` are dropped — the url is what makes an extension resolvable.
 */
export function parseExtensions(value: unknown): Extension[] {
  if (!Array.isArray(value)) return [];
  const extensions: Extension[] = [];
  for (const entry of value) {
    if (!isObject(entry)) continue;
    const url = asString(entry.url);
    if (url === undefined) continue;

    const extension: Extension = { ...entry, url };
    const nested = parseExtensions(entry.extension);
    if (nested.length > 0) extension.extension = nested;
    else delete extension.extension;

    extensions.push(extension);
  }
  return extensions;
}
