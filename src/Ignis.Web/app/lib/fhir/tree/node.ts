/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type { Resource } from "../model";

export type FhirNodeKind = "primitive" | "object" | "array";

export interface FhirNode {
  /** Object key or array index this node sits at, relative to its parent. */
  key: string;
  /** Path from the resource root, e.g. `["name", "0", "given", "1"]` */
  path: string[];
  /** What the value at this node looks like. */
  kind: FhirNodeKind;
  /** Leaf value; only meaningful when {@link kind} is `"primitive"`. */
  value: string | number | boolean | null;
  /** Child nodes for objects and arrays; empty for primitives. */
  children: FhirNode[];
}

/**
 * Builds a tree of {@link FhirNode}s from a FHIR resource, depth-first and in
 * source order. Object fields whose value is `undefined` are skipped; `null`
 * and unsupported types collapse to a `null` primitive.
 */
export function buildResourceTree(resource: Resource): FhirNode[] {
  return walkObject(resource, []);
}

function walkObject(object: Record<string, unknown>, parentPath: string[]): FhirNode[] {
  const nodes: FhirNode[] = [];
  for (const [key, value] of Object.entries(object)) {
    if (value === undefined) continue;
    nodes.push(walkValue(key, value, [...parentPath, key]));
  }
  return nodes;
}

function walkValue(key: string, value: unknown, path: string[]): FhirNode {
  if (Array.isArray(value)) {
    return {
      key,
      path,
      kind: "array",
      value: null,
      children: value.map((item, index) =>
        walkValue(String(index), item, [...path, String(index)]),
      ),
    };
  }
  if (value !== null && typeof value === "object") {
    return {
      key,
      path,
      kind: "object",
      value: null,
      children: walkObject(value as Record<string, unknown>, path),
    };
  }
  return {
    key,
    path,
    kind: "primitive",
    value: isPrimitive(value) ? value : null,
    children: [],
  };
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}
