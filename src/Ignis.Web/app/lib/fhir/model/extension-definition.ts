/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { asString, isObject } from "../guards";

export interface ExtensionUrl {
  url: string;
}

export interface Extensible {
  extension?: readonly ExtensionUrl[];
}

/**
 * Plain data from an extension StructureDefinition; `valueTypes` is empty for a complex extension.
 * `T` is the typed extension shape and exists only at compile time.
 */
export interface ExtensionDefinition<T extends ExtensionUrl = ExtensionUrl> {
  readonly url: string;
  readonly context: readonly string[];
  readonly valueTypes: readonly string[];
  readonly title?: string;
  readonly _type?: T;
}

export function extensionDefinitionFromStructureDefinition(value: unknown): ExtensionDefinition | undefined {
  if (!isObject(value) || value.resourceType !== "StructureDefinition" || value.type !== "Extension") return undefined;
  const url = asString(value.url);
  if (url === undefined) return undefined;

  const context = Array.isArray(value.context)
    ? value.context.map((entry) => (isObject(entry) ? asString(entry.expression) : undefined)).filter((e) => e !== undefined)
    : [];

  const elements = elementsOf(value.snapshot) ?? elementsOf(value.differential) ?? [];
  const valueElement = elements.find((element) => element.path === "Extension.value[x]");
  const valueTypes =
    valueElement === undefined || valueElement.max === "0" || !Array.isArray(valueElement.type)
      ? []
      : valueElement.type.map((type) => (isObject(type) ? asString(type.code) : undefined)).filter((c) => c !== undefined);

  const title = asString(value.title);
  return { url, context, valueTypes, ...(title !== undefined ? { title } : {}) };
}

function elementsOf(value: unknown): Record<string, unknown>[] | undefined {
  if (!isObject(value) || !Array.isArray(value.element)) return undefined;
  return value.element.filter(isObject);
}
