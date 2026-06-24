/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { DescriptionList } from "@eventuras/ratio-ui/core/DescriptionList";
import { Tabs } from "@eventuras/ratio-ui/core/Tabs";
import { useMemo } from "react";

import { m } from "#app/i18n/paraglide/messages";
import { formatPrimitive } from "#app/lib/fhir/format";
import type { Resource } from "#app/lib/fhir/model";
import { buildResourceTree, type FhirNode } from "#app/lib/fhir/tree";

/**
 * Renders a single FHIR resource.
 */
export function ResourceDetail({ resource }: { resource: Resource; }) {
  const nodes = useMemo(() => buildResourceTree(resource), [resource]);
  const json = useMemo(() => JSON.stringify(resource, null, 2), [resource]);
  return (
    <Tabs defaultSelectedKey="structured">
      <Tabs.Item id="structured" title={m.resources_instance_view()}>
        <NodeList nodes={nodes} />
      </Tabs.Item>
      <Tabs.Item id="json" title={m.resources_instance_json()}>
        <pre className="overflow-x-auto rounded border border-(--border) p-4 text-sm">
          {json}
        </pre>
      </Tabs.Item>
    </Tabs>
  );
}

/** Renders object fields as term/value rows. */
function NodeList({ nodes }: { nodes: FhirNode[]; }) {
  if (nodes.length === 0) return <EmptyValue />;
  return (
    <DescriptionList>
      {nodes.map((node) => (
        <DescriptionList.Description key={node.path.join(".")} term={node.key}>
          <NodeValue node={node} />
        </DescriptionList.Description>
      ))}
    </DescriptionList>
  );
}

/** Renders a node's value, recursing into objects and arrays. */
function NodeValue({ node }: { node: FhirNode; }) {
  switch (node.kind) {
    case "primitive":
      return <PrimitiveValue value={node.value} />;
    case "object":
      return <NodeList nodes={node.children} />;
    case "array":
      return <ArrayValue items={node.children} />;
  }
}

/** Renders array items stacked and numbered, so they read one by one. */
function ArrayValue({ items }: { items: FhirNode[]; }) {
  if (items.length === 0) return <EmptyValue />;
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.path.join(".")} className="flex gap-2">
          <span className="select-none text-(--muted-foreground)">
            {Number(item.key) + 1}.
          </span>
          <div className="min-w-0 grow">
            <NodeValue node={item} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Renders a leaf value, with a muted dash for empty/null. */
function PrimitiveValue({ value }: { value: string | number | boolean | null; }) {
  const text = formatPrimitive(value);
  if (text === null) return <EmptyValue />;
  return <>{text}</>;
}

function EmptyValue() {
  return <span className="text-(--muted-foreground)">—</span>;
}
