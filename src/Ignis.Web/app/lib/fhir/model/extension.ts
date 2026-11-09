/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { isObject, asString } from "../guards";
import type { Extensible, ExtensionDefinition, ExtensionUrl } from "./extension-definition";
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
): { field: string; value: unknown; } | undefined {
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

export function findExtension(extensions: Extension[] | undefined, url: Uri): Extension | undefined;
export function findExtension<T extends ExtensionUrl>(
  element: Extensible | undefined,
  definition: ExtensionDefinition<T>,
): T | undefined;
export function findExtension(
  source: Extension[] | Extensible | undefined,
  by: Uri | ExtensionDefinition,
): ExtensionUrl | undefined {
  const url = urlOf(by);
  return extensionsOf(source)?.find((extension) => extension.url === url);
}

export function findExtensions(extensions: Extension[] | undefined, url: Uri): Extension[];
export function findExtensions<T extends ExtensionUrl>(
  element: Extensible | undefined,
  definition: ExtensionDefinition<T>,
): T[];
export function findExtensions(
  source: Extension[] | Extensible | undefined,
  by: Uri | ExtensionDefinition,
): ExtensionUrl[] {
  const url = urlOf(by);
  return extensionsOf(source)?.filter((extension) => extension.url === url) ?? [];
}

function urlOf(by: Uri | ExtensionDefinition): string {
  return typeof by === "string" ? by : by.url;
}

function extensionsOf(source: Extension[] | Extensible | undefined): readonly ExtensionUrl[] | undefined {
  return Array.isArray(source) ? source : source?.extension;
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
