/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Card } from "@eventuras/ratio-ui/core/Card";
import { CodeBlock } from "@eventuras/ratio-ui/core/CodeBlock";
import { CopyButton } from "@eventuras/ratio-ui/core/CopyButton";
import { DataTree, type DataNode } from "@eventuras/ratio-ui/core/DataTree";
import { DescriptionList } from "@eventuras/ratio-ui/core/DescriptionList";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Tabs } from "@eventuras/ratio-ui/core/Tabs";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { ToggleButtonGroup } from "@eventuras/ratio-ui/core/ToggleButtonGroup";
import { Grid } from "@eventuras/ratio-ui/layout/Grid";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { useMemo, useState } from "react";
import { type FetcherWithComponents, useFetcher } from "react-router";

import { m } from "#app/i18n/paraglide/messages";
import { formatPrimitive } from "#app/lib/fhir/format";
import type { Resource } from "#app/lib/fhir/model";
import { summaryFields } from "#app/lib/fhir/summary";
import { buildResourceTree, type FhirNode } from "#app/lib/fhir/tree";

type XmlResult = { ok: true; xml: string; } | { ok: false; };

/**
 * Renders a single FHIR resource as Summary, Content tree, and Source tabs.
 * The XML serialization is fetched from the server only when first selected.
 */
export function ResourceDetail({
  resource,
  resourceType,
  id,
}: {
  resource: Resource;
  resourceType: string;
  id: string;
}) {
  const nodes = useMemo(
    () => buildResourceTree(resource).map((node) => toDataNode(node)),
    [resource],
  );
  const json = useMemo(() => JSON.stringify(resource, null, 2), [resource]);

  const xml = useFetcher<XmlResult>();
  const [sourceLang, setSourceLang] = useState<"json" | "xml">("json");

  const selectSourceLang = (value: string | null) => {
    if (value !== "json" && value !== "xml") return;
    setSourceLang(value);
    if (value === "xml" && xml.state === "idle" && xml.data === undefined) {
      void xml.load(`/resources/${resourceType}/${id}/xml`);
    }
  };

  return (
    <Tabs defaultSelectedKey="summary">
      <Tabs.Item id="summary" title={m.resources_instance_tab_summary()}>
        <SummaryTab resource={resource} resourceType={resourceType} />
      </Tabs.Item>
      <Tabs.Item id="tree" title={m.resources_instance_tab_tree()}>
        <Card>
          <DataTree collapsible defaultOpenDepth={2} nodes={nodes} />
        </Card>
      </Tabs.Item>
      <Tabs.Item id="source" title={m.resources_instance_tab_source()}>
        <SourceTab
          lang={sourceLang}
          onLangChange={selectSourceLang}
          json={json}
          xml={xml}
          id={id}
        />
      </Tabs.Item>
    </Tabs>
  );
}

/** Generic summary: readable top-level fields next to a metadata card. */
function SummaryTab({
  resource,
  resourceType,
}: {
  resource: Resource;
  resourceType: string;
}) {
  const fields = summaryFields(resource);
  const metaRows: { label: string; value: string | undefined; }[] = [
    { label: m.resources_instance_meta_type(), value: resourceType },
    { label: m.resources_instance_meta_version(), value: resource.meta?.versionId },
    { label: m.resources_instance_meta_updated(), value: resource.meta?.lastUpdated },
  ];
  const meta = metaRows.filter(
    (row): row is { label: string; value: string; } => Boolean(row.value),
  );

  return (
    <Grid cols={{ lg: 2 }}>
      <Card>
        <DescriptionList>
          {fields.map((field) => (
            <DescriptionList.Description key={field.label} term={field.label}>
              {field.label === "id" ? (
                <>
                  {field.value} <CopyButton value={field.value} size="sm" />
                </>
              ) : (
                field.value
              )}
            </DescriptionList.Description>
          ))}
        </DescriptionList>
      </Card>
      <Card>
        <Text size="xs" variant="subtle">
          {m.resources_instance_metadata()}
        </Text>
        <DescriptionList>
          {meta.map((row) => (
            <DescriptionList.Description key={row.label} term={row.label}>
              {row.value}
            </DescriptionList.Description>
          ))}
        </DescriptionList>
      </Card>
    </Grid>
  );
}

/** Raw JSON/XML in a CodeBlock, with a format toggle in its toolbar. */
function SourceTab({
  lang,
  onLangChange,
  json,
  xml,
  id,
}: {
  lang: "json" | "xml";
  onLangChange: (value: string | null) => void;
  json: string;
  xml: FetcherWithComponents<XmlResult>;
  id: string;
}) {
  const selector = (
    <ToggleButtonGroup
      size="sm"
      aria-label={m.resources_instance_tab_source()}
      options={[
        { value: "json", label: m.resources_instance_json() },
        { value: "xml", label: m.resources_instance_xml() },
      ]}
      selectedKeys={[lang]}
      onSelectionChange={(keys) => {
        const [key] = keys;
        onLangChange(typeof key === "string" ? key : null);
      }}
      disallowEmptySelection
    />
  );

  if (lang === "xml") {
    const { data, state } = xml;
    if (state === "loading" || data === undefined) {
      return (
        <SourcePending selector={selector}>
          <Text>{m.resources_instance_loading()}</Text>
        </SourcePending>
      );
    }
    if (!data.ok) {
      return (
        <SourcePending selector={selector}>
          <Panel variant="alert" status="error">
            <Text>{m.resources_instance_error()}</Text>
          </Panel>
        </SourcePending>
      );
    }
    return (
      <CodeBlock
        code={data.xml}
        language="XML"
        filename={`${id}.xml`}
        languageSelector={selector}
      />
    );
  }

  return (
    <CodeBlock
      code={json}
      language="JSON"
      filename={`${id}.json`}
      languageSelector={selector}
    />
  );
}

/** Keeps the format toggle reachable while XML is loading or failed. */
function SourcePending({
  selector,
  children,
}: {
  selector: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Stack direction="vertical" gap="sm">
      <Stack direction="horizontal" justify="end">
        {selector}
      </Stack>
      {children}
    </Stack>
  );
}

/**
 * Label for an array item: FHIR-ish identity when the item carries one
 * (`linkId`, `code`, tail of `system`), else its position.
 */
function arrayItemTerm(node: FhirNode): string {
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
      toDataNode(child, node.kind === "array" ? arrayItemTerm(child) : child.key),
    ),
  };
}
