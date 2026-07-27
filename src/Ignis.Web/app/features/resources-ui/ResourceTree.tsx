/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { DataTree, type DataNode } from "@eventuras/ratio-ui/core/DataTree";
import { useMemo } from "react";

import { formatPrimitive } from "#app/lib/fhir/format";
import type { Resource } from "#app/lib/fhir/model";
import { buildResourceTree, type FhirNode } from "#app/lib/fhir/tree";

export function ResourceTree({ resource }: { resource: Resource; }) {
  const nodes = useMemo(
    () => buildResourceTree(resource).map((node) => toDataNode(node)),
    [resource],
  );
  return <DataTree collapsible defaultOpenDepth={2} nodes={nodes} />;
}

/**
 * Label for an array item. linkId, code, or system (last segment) is preferred; otherwise the key.
 */
function arrayItemLabel(node: FhirNode): string {
  const child = (key: string) =>
    node.children.find((c) => c.key === key && c.kind === "primitive")?.value;
  const linkId = child("linkId");
  if (linkId != null) return `#${String(linkId)}`;
  const code = child("code");
  if (code != null) return String(code);
  const system = child("system");
  if (system != null) return String(system).split("/").pop() ?? String(system);
  return `[${node.key}]`;
}

/** Adapts a FhirNode to a DataTree node. */
function toDataNode(node: FhirNode, term: string = node.key): DataNode {
  const id = node.path.join(".");
  if (node.kind === "primitive") {
    return { id, term, value: formatPrimitive(node.value) };
  }
  return {
    id,
    term,
    children: node.children.map((child) =>
      toDataNode(child, node.kind === "array" ? arrayItemLabel(child) : child.key),
    ),
  };
}
