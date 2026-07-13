/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { Resource } from "./model";

export interface SummaryField {
  label: string;
  value: string;
}

/** Human title for a resource: `title`, then a string `name`, else null. */
export function resourceTitle(resource: Resource): string | null {
  const { title, name } = resource;
  if (typeof title === "string" && title !== "") return title;
  if (typeof name === "string" && name !== "") return name;
  return null;
}

/** The resource's top-level `status` code, when present. */
export function resourceStatus(resource: Resource): string | null {
  const { status } = resource;
  return typeof status === "string" && status !== "" ? status : null;
}

/** Top-level primitive fields in source order, for the generic summary card. */
export function summaryFields(resource: Resource): SummaryField[] {
  return Object.entries(resource)
    .flatMap(([key, value]) => {
      if (typeof value === "string" && value !== "") return [{ label: key, value }];
      if (typeof value === "number" || typeof value === "boolean") {
        return [{ label: key, value: String(value) }];
      }
      return [];
    });
}
