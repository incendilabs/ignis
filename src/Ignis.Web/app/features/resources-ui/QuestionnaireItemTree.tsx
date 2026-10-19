/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { Card } from "@eventuras/ratio-ui/core/Card";
import { Chip } from "@eventuras/ratio-ui/core/Chip";
import { Heading } from "@eventuras/ratio-ui/core/Heading";
import { Panel } from "@eventuras/ratio-ui/core/Panel";
import { Text } from "@eventuras/ratio-ui/core/Text";
import { Stack } from "@eventuras/ratio-ui/layout/Stack";
import { Tree, type TreeNode } from "@eventuras/ratio-ui/tree";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";

import { m } from "#app/i18n/paraglide/messages";
import { formatPrimitive } from "#app/lib/fhir/format";
import type { Extension, Resource } from "#app/lib/fhir/model";
import { extensionValue, extensionValueType } from "#app/lib/fhir/model";
import {
  type AnswerChoice,
  externalAnswerValueSets,
  hasExternalAnswerValueSet,
  parseQuestionnaireExtensions,
  parseQuestionnaireItems,
  type QuestionnaireItem,
  resolveAnswerChoices,
} from "#app/lib/fhir/questionnaire";

import type { ExpansionResult } from "./expand.server";

/** A tree node: either a Questionnaire item or one of its answer options. */
type QuestionnaireNode = ItemNode | OptionNode;
interface ItemNode extends TreeNode {
  kind: "item";
  item: QuestionnaireItem;
  /** Set when the item's answers come from an external ValueSet. */
  expansion?: ExpansionState;
  children?: QuestionnaireNode[];
}
interface OptionNode extends TreeNode {
  kind: "option";
  choice: AnswerChoice;
}

/** Where the `$expand` of an item's external ValueSet stands. */
type ExpansionState =
  | { kind: "pending"; }
  | { kind: "error"; }
  | { kind: "ready"; choices: AnswerChoice[]; truncated: boolean; };

interface ExpansionsData {
  expansions: Record<string, ExpansionResult>;
}

export function QuestionnaireItemTree({ resource }: { resource: Resource; }) {
  const items = useMemo(() => parseQuestionnaireItems(resource), [resource]);
  const extensions = useMemo(() => parseQuestionnaireExtensions(resource), [resource]);
  const expansions = useExpansions(items);
  const { nodes, expandedKeys: autoExpanded } = useMemo(
    () => build(resource, items, expansions),
    [resource, items, expansions],
  );

  // Expansion is controlled so rows that gain option children once their
  // ValueSet arrives open like the rest, without resetting what the user toggled.
  const [expandedKeys, setExpandedKeys] = useState<Set<string | number>>(
    () => new Set(autoExpanded),
  );
  useEffect(() => {
    setExpandedKeys((previous) =>
      autoExpanded.every((key) => previous.has(key))
        ? previous
        : new Set([...previous, ...autoExpanded]),
    );
  }, [autoExpanded]);

  if (nodes.length === 0 && extensions.length === 0) {
    return (
      <Panel>
        <Text>{m.resources_questionnaire_empty()}</Text>
      </Panel>
    );
  }

  return (
    <Stack direction="vertical" gap="md">
      {extensions.length > 0 ? <DefinitionExtensions extensions={extensions} /> : null}
      {nodes.length > 0 ? (
        <Card>
          <Tree
            aria-label={m.resources_instance_tab_form()}
            items={nodes}
            expandedKeys={expandedKeys}
            onExpandedChange={setExpandedKeys}
            getLabel={nodeLabel}
            renderNode={(node) => {
              if (node.kind === "option") return <OptionRow choice={node.choice} />;
              return node.item.type === "group" ? (
                <GroupRow item={node.item} />
              ) : (
                <QuestionRow item={node.item} expansion={node.expansion} />
              );
            }}
          />
        </Card>
      ) : null}
    </Stack>
  );
}

/**
 * Expands the items' external ValueSets through the data-only expansions route, once
 * per set of canonicals. Pending until the response lands; on the server it stays pending.
 */
function useExpansions(items: QuestionnaireItem[]): Record<string, ExpansionState> {
  const canonicals = useMemo(() => externalAnswerValueSets(items), [items]);
  const fetcher = useFetcher<ExpansionsData>();
  const { load, data } = fetcher;

  const requested = useRef<string | null>(null);
  useEffect(() => {
    const key = canonicals.join("\n");
    if (canonicals.length === 0 || requested.current === key) return;
    requested.current = key;
    const query = new URLSearchParams(canonicals.map((canonical) => ["url", canonical]));
    void load(`/resources/expansions?${query.toString()}`);
  }, [canonicals, load]);

  return useMemo(() => {
    const states: Record<string, ExpansionState> = {};
    for (const canonical of canonicals) {
      const result = data?.expansions[canonical];
      states[canonical] = data === undefined
        ? { kind: "pending" }
        : result?.ok
          ? { kind: "ready", choices: result.choices, truncated: result.truncated }
          : { kind: "error" };
    }
    return states;
  }, [canonicals, data]);
}

/** Extensions carried by the Questionnaire itself — where a profile marks the definition. */
function DefinitionExtensions({ extensions }: { extensions: Extension[]; }) {
  return (
    <Card>
      <Stack direction="vertical" gap="sm">
        <Heading as="h4">{m.resources_questionnaire_extensions()}</Heading>
        {extensions.map((extension, index) => (
          <ExtensionRow key={`${extension.url}.${String(index)}`} extension={extension} />
        ))}
      </Stack>
    </Card>
  );
}

/** One extension: its defining url, then the value[x] it carries. */
function ExtensionRow({ extension }: { extension: Extension; }) {
  const summary = extensionSummary(extension);
  return (
    <Stack direction="vertical" gap="xs">
      <Text as="span" size="sm">
        {extension.url}
      </Text>
      <Stack direction="horizontal" gap="sm" align="center" wrap>
        {summary.type ? <Chip>{summary.type}</Chip> : null}
        {summary.text ? (
          <Text as="span" variant="subtle">
            {summary.text}
          </Text>
        ) : null}
      </Stack>
    </Stack>
  );
}

/**
 * How to label an extension's payload: the datatype, plus the value itself when
 * it is a primitive. Complex values are not flattened — showing their type is
 * honest, inventing a one-line rendering of them is not.
 */
function extensionSummary(extension: Extension): { type: string; text: string; } {
  const nested = extension.extension;
  if (nested !== undefined && nested.length > 0) {
    return {
      type: "extension",
      text: m.resources_questionnaire_extensions_nested({ count: nested.length }),
    };
  }

  const value = extensionValue(extension);
  if (value === undefined) return { type: "", text: "" };

  const type = extensionValueType(value.field);
  const primitive =
    typeof value.value === "string" ||
    typeof value.value === "number" ||
    typeof value.value === "boolean"
      ? formatPrimitive(value.value)
      : null;

  return { type, text: primitive ?? "" };
}

/** Extensions on a tree row, compact: one wrapped line of url-tail chips. */
function ItemExtensions({ extensions }: { extensions: Extension[]; }) {
  return (
    <Stack direction="horizontal" gap="sm" align="center" wrap>
      {extensions.map((extension, index) => (
        <ExtensionChip key={`${extension.url}.${String(index)}`} extension={extension} />
      ))}
    </Stack>
  );
}

/** One extension as its url tail in a chip, then the primitive value or datatype. */
function ExtensionChip({ extension }: { extension: Extension; }) {
  const summary = extensionSummary(extension);
  const detail = summary.text !== "" ? summary.text : summary.type;
  return (
    <Stack direction="horizontal" gap="xs" align="center">
      <Chip>{canonicalTail(extension.url)}</Chip>
      {detail ? (
        <Text as="span" variant="subtle">
          {detail}
        </Text>
      ) : null}
    </Stack>
  );
}

function build(
  resource: Resource,
  items: QuestionnaireItem[],
  expansions: Record<string, ExpansionState>,
): { nodes: QuestionnaireNode[]; expandedKeys: string[]; } {
  const expandedKeys: string[] = [];
  const toNode = (item: QuestionnaireItem, id: string): ItemNode => {
    const itemChildren = (item.item ?? []).map((child, index) =>
      toNode(child, `${id}.${String(index)}`),
    );
    if (itemChildren.length > 0) {
      expandedKeys.push(id);
      return { kind: "item", id, item, children: itemChildren };
    }

    const node: ItemNode = { kind: "item", id, item };
    let choices = resolveAnswerChoices(resource, item);
    if (choices === null && hasExternalAnswerValueSet(item) && item.answerValueSet !== undefined) {
      const expansion = expansions[item.answerValueSet];
      node.expansion = expansion;
      if (expansion.kind === "ready") choices = expansion.choices;
    }
    if (choices && choices.length > 0) {
      expandedKeys.push(id);
      node.children = choices.map((choice, index) => ({
        kind: "option",
        id: `${id}.opt.${String(index)}`,
        choice,
      }));
    }
    return node;
  };

  const nodes = items.map((item, index) => toNode(item, String(index)));
  return { nodes, expandedKeys };
}

function nodeLabel(node: QuestionnaireNode): string {
  return node.kind === "option" ? node.choice.label : (node.item.text ?? node.item.linkId);
}

/** A group row: a serif heading with a subtle `group · N` count. */
function GroupRow({ item }: { item: QuestionnaireItem; }) {
  const count = item.item?.length ?? 0;
  return (
    <Stack direction="vertical" gap="xs">
      <Stack direction="horizontal" gap="sm" align="end" wrap>
        <Heading as="h4">{item.text ?? item.linkId}</Heading>
        <Text as="span" variant="subtle">
          {`${item.type} · ${String(count)}`}
        </Text>
      </Stack>
      {item.extension ? <ItemExtensions extensions={item.extension} /> : null}
    </Stack>
  );
}

/** A question row: the text, then a subtle line with type / flags / answer source. */
function QuestionRow({
  item,
  expansion,
}: {
  item: QuestionnaireItem;
  expansion: ExpansionState | undefined;
}) {
  const hint = answerHint(item);
  const expansionHint = expansion === undefined ? undefined : expansionStatus(expansion);
  return (
    <Stack direction="vertical" gap="xs">
      <Text size="xl">{item.text ?? item.linkId}</Text>
      <Stack direction="horizontal" gap="sm" align="center" wrap>
        {item.type ? (
          <Text as="span" variant="subtle">
            {item.type}
          </Text>
        ) : null}
        {item.required ? <Chip>{m.resources_questionnaire_required()}</Chip> : null}
        {item.repeats ? (
          <Text as="span" variant="subtle">
            {m.resources_questionnaire_repeats()}
          </Text>
        ) : null}
        {hint ? (
          <Text as="span" variant="subtle">
            {hint}
          </Text>
        ) : null}
        {expansionHint ? (
          <Text as="span" variant="subtle">
            {expansionHint}
          </Text>
        ) : null}
      </Stack>
      {item.extension ? <ItemExtensions extensions={item.extension} /> : null}
    </Stack>
  );
}

/** One answer option row: its code as a badge, then the display text. */
function OptionRow({ choice }: { choice: AnswerChoice; }) {
  return (
    <Stack direction="horizontal" gap="sm" align="center" wrap>
      {choice.code ? <Chip>{choice.code}</Chip> : null}
      <Text as="span" variant="subtle">
        {choice.display ?? choice.code ?? choice.label}
      </Text>
      {choice.extension?.map((extension, index) => (
        <ExtensionChip key={`${extension.url}.${String(index)}`} extension={extension} />
      ))}
    </Stack>
  );
}

/** Where a leaf item's answers come from: a bound ValueSet or inline options. */
function answerHint(item: QuestionnaireItem): string | undefined {
  if (item.answerValueSet) {
    return m.resources_questionnaire_valueset({ name: canonicalTail(item.answerValueSet) });
  }
  if (item.answerOption && item.answerOption.length > 0) {
    return m.resources_questionnaire_options({ count: item.answerOption.length });
  }
  return undefined;
}

/** What to say about an external ValueSet's expansion; nothing when it arrived whole. */
function expansionStatus(expansion: ExpansionState): string | undefined {
  switch (expansion.kind) {
    case "pending":
      return m.resources_questionnaire_valueset_loading();
    case "error":
      return m.resources_questionnaire_valueset_error();
    case "ready":
      return expansion.truncated
        ? m.resources_questionnaire_valueset_truncated({ count: expansion.choices.length })
        : undefined;
  }
}

/** The human-facing tail of a canonical URL, dropping any `|version` suffix. */
function canonicalTail(url: string): string {
  const [base] = url.split("|");
  const tail = base.split("/").pop();
  return tail === undefined || tail === "" ? base : tail;
}
